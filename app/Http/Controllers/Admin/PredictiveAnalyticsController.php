<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClimateRiskAssessment;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Services\ClimateRiskScorer;
use App\Services\ForecastService;
use App\Services\ParcelRiskAnalyser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

/**
 * Predictive analytics for the whole municipality, or narrowed to one barangay.
 *
 * Aggregates are cached briefly because they scan the full cropping history and
 * the underlying data changes a few times a day, not per request. The cache key
 * includes the barangay so each scope is cached separately.
 */
class PredictiveAnalyticsController extends Controller
{
    private const CACHE_TTL_SECONDS = 600;

    public function index(Request $request, ForecastService $forecast, ParcelRiskAnalyser $analyser)
    {
        $validated = $request->validate([
            'barangay' => 'nullable|string|max:50',
        ]);

        $barangay = $validated['barangay'] ?? null;
        $suffix = $barangay ? 'brgy.' . md5($barangay) : 'all';

        return Inertia::render('Admin/Analytics/Predictive', [
            'filters'   => ['barangay' => $barangay],
            'barangays' => $forecast->barangaysWithData(),
            'readiness' => $this->readiness($barangay),

            // Deferred so the page paints before the heavy aggregates land.
            'harvestCalendar' => Inertia::defer(fn () => Cache::remember(
                "analytics.harvest_calendar.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $forecast->harvestCalendar(12, $barangay)
            )),

            'atRisk' => Inertia::defer(fn () => Cache::remember(
                "analytics.at_risk.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $forecast->atRiskParcels($barangay)
            )),

            'commodityOutlook' => Inertia::defer(fn () => Cache::remember(
                "analytics.commodity_outlook.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $forecast->commodityOutlook($barangay)
            )),

            'inactiveFarmers' => Inertia::defer(fn () => Cache::remember(
                "analytics.inactive_farmers.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $forecast->inactiveFarmers(18, $barangay)
            )),

            // Always municipality-wide - the point is to compare barangays.
            'barangayComparison' => Inertia::defer(fn () => Cache::remember(
                'analytics.barangay_comparison',
                self::CACHE_TTL_SECONDS,
                fn () => $forecast->barangayComparison()
            )),

            /*
             * Who needs attention, and how many of each.
             *
             * Read from the assessments already scored and stored rather than
             * re-analysing every farm on page load: a municipality-wide
             * per-parcel pass would be a query per parcel per farmer, and the
             * detailed breakdown is one click away on the farmer's own page.
             */
            'riskBoard' => Inertia::defer(fn () => Cache::remember(
                "analytics.risk_board.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $this->riskBoard($barangay)
            )),

            'priorityFarmers' => Inertia::defer(fn () => Cache::remember(
                "analytics.priority_farmers.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $this->priorityFarmers($barangay)
            )),

            'recentAnalyses' => Inertia::defer(fn () => Cache::remember(
                "analytics.recent_analyses.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $this->recentAnalyses($barangay)
            )),

            // Named on the page so the reader knows what the counts describe.
            'upcoming' => $analyser->upcomingPeriod(),

            'method' => [
                'type'    => 'rule_based',
                'version' => (string) config('climate_risk.version'),
            ],
        ]);
    }

    /**
     * The four counts across the top of the page.
     *
     * "Insufficient" is a count of farmers nobody has assessed, and it is
     * deliberately NOT folded into low. A farm nothing is known about is not a
     * safe farm, and a dashboard that says otherwise sends the office to the
     * wrong villages.
     */
    private function riskBoard(?string $barangay): array
    {
        $latest = fn () => ClimateRiskAssessment::query()
            ->whereIn('id', function ($q) {
                $q->selectRaw('MAX(id)')->from('climate_risk_assessments')->groupBy('farmer_id');
            })
            ->when($barangay, fn ($q) => $q->whereHas('farmer', fn ($f) => $f->where('barangay', $barangay)));

        $assessed = (clone $latest())->distinct('farmer_id')->count('farmer_id');

        $verified = Farmer::verified()
            ->when($barangay, fn ($q) => $q->where('barangay', $barangay))
            ->count();

        return [
            'high'         => (clone $latest())->where('risk_level', ClimateRiskScorer::LEVEL_HIGH)->count(),
            'moderate'     => (clone $latest())->where('risk_level', ClimateRiskScorer::LEVEL_MODERATE)->count(),
            'low'          => (clone $latest())->where('risk_level', ClimateRiskScorer::LEVEL_LOW)->count(),
            'insufficient' => max(0, $verified - $assessed),
            'verified'     => $verified,
        ];
    }

    /**
     * The farms to look at first.
     *
     * High before moderate, and the higher score first within each. Every field
     * comes from the stored assessment - the parcel it was taken against and
     * the heaviest factor it raised - so nothing on this list is a summary
     * invented for the card.
     */
    private function priorityFarmers(?string $barangay, int $limit = 8): array
    {
        return ClimateRiskAssessment::query()
            ->with(['farmer:id,first_name,middle_name,last_name,suffix,barangay', 'parcel:id,parcel_number,commodity,total_area_ha'])
            ->whereIn('id', function ($q) {
                $q->selectRaw('MAX(id)')->from('climate_risk_assessments')->groupBy('farmer_id');
            })
            ->whereIn('risk_level', [ClimateRiskScorer::LEVEL_HIGH, ClimateRiskScorer::LEVEL_MODERATE])
            ->when($barangay, fn ($q) => $q->whereHas('farmer', fn ($f) => $f->where('barangay', $barangay)))
            ->orderByRaw("FIELD(risk_level, 'high', 'moderate')")
            ->orderByDesc('risk_score')
            ->limit($limit)
            ->get()
            ->map(fn (ClimateRiskAssessment $a) => [
                'farmer_id'   => $a->farmer_id,
                'farmer'      => $a->farmer?->full_name ?? 'Unknown farmer',
                'barangay'    => $a->farmer?->barangay,
                'parcel'      => $a->parcel?->parcel_number ? "Parcel #{$a->parcel->parcel_number}" : null,
                'commodity'   => $a->parcel?->commodity,
                'area_ha'     => $a->parcel?->total_area_ha ? (float) $a->parcel->total_area_ha : null,
                'risk_level'  => $a->risk_level,
                'risk_score'  => $a->risk_score,
                // The heaviest reason, not a paraphrase of several.
                'main_concern' => collect($a->risk_factors ?? [])
                    ->sortByDesc('weight')
                    ->first()['label'] ?? null,
                'assessed_at' => $a->assessed_at,
                'is_stale'    => $a->is_stale,
            ])
            ->values()
            ->all();
    }

    /** The most recent assessments, whatever they came out at. */
    private function recentAnalyses(?string $barangay, int $limit = 10): array
    {
        return ClimateRiskAssessment::query()
            ->with(['farmer:id,first_name,middle_name,last_name,suffix,barangay', 'parcel:id,parcel_number,commodity', 'season:id,season,cropping_year'])
            ->when($barangay, fn ($q) => $q->whereHas('farmer', fn ($f) => $f->where('barangay', $barangay)))
            ->orderByDesc('assessed_at')
            ->limit($limit)
            ->get()
            ->map(fn (ClimateRiskAssessment $a) => [
                'id'          => $a->id,
                'farmer_id'   => $a->farmer_id,
                'farmer'      => $a->farmer?->full_name ?? 'Unknown farmer',
                'parcel'      => $a->parcel?->parcel_number ? "Parcel #{$a->parcel->parcel_number}" : '—',
                'commodity'   => $a->parcel?->commodity ?? '—',
                'season'      => $a->season
                    ? ucfirst($a->season->season) . ' ' . $a->season->cropping_year
                    : '—',
                'risk_level'  => $a->risk_level,
                'risk_score'  => $a->risk_score,
                // Said plainly on every row: a score computed without recorded
                // seasons behind it rests on the questionnaire alone.
                'evidence'    => ($a->crop_season_id !== null)
                    ? 'Historical data available'
                    : 'Assessment only',
                'assessed_at' => $a->assessed_at,
            ])
            ->values()
            ->all();
    }

    /**
     * How much history the forecasts have to work with. Shown up front so the
     * user understands why a prediction is thin instead of assuming it is wrong.
     */
    private function readiness(?string $barangay): array
    {
        // Matches the forecasts: verified farmers only.
        $scoped = fn () => CropSeason::forVerifiedFarmers()->when(
            $barangay,
            fn ($q) => $q->whereHas('parcel', fn ($p) => $p->where('barangay', $barangay))
        );

        $seasons = $scoped()->count();
        $withYield = $scoped()->whereNotNull('yield_kg')->where('area_planted_ha', '>', 0)->count();
        $years = $scoped()->distinct()->count('cropping_year');

        return [
            'scope'              => $barangay ?? 'All of Tumauini',
            'recorded_seasons'   => $seasons,
            'seasons_with_yield' => $withYield,
            'distinct_years'     => $years,
            'verified_farmers'   => Farmer::verified()
                ->when($barangay, fn ($q) => $q->where('barangay', $barangay))
                ->count(),
            'level' => match (true) {
                $withYield === 0 => 'none',
                $withYield < 10  => 'thin',
                $withYield < 40  => 'usable',
                default          => 'good',
            },
        ];
    }
}
