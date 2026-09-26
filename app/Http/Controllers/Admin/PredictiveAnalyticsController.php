<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crop;
use App\Models\ClimateRiskAssessment;
use App\Models\CropSeason;
use App\Models\FarmParcel;
use App\Models\Farmer;
use App\Services\ClimateRiskScorer;
use App\Services\ForecastService;
use App\Services\ParcelRiskAnalyser;
use App\Services\YieldPredictionService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

    public function index(
        Request $request,
        ForecastService $forecast,
        ParcelRiskAnalyser $analyser,
        YieldPredictionService $predictor,
    ) {
        /*
         * Every filter is optional and validated. `barangay` keeps its old
         * name and behaviour so the existing scope selector, and any bookmarked
         * link using it, still work exactly as before.
         */
        $validated = $request->validate([
            'barangay'  => 'nullable|string|max:50',
            'season'    => 'nullable|in:dry,wet',
            'crop_id'   => 'nullable|integer|exists:crops,id',
            'farmer_id' => 'nullable|integer|exists:farmers,id',
            'status'    => 'nullable|in:above_average,in_line,below_average,insufficient_data',
        ]);

        $barangay = $validated['barangay'] ?? null;

        /*
         * One filter array, passed to every section.
         *
         * This is what stops one part of the page showing filtered figures
         * while another shows everything — the single most confusing thing an
         * analytics screen can do.
         */
        $filters = [
            'barangay'  => $barangay,
            'season'    => $validated['season'] ?? null,
            'crop_id'   => $validated['crop_id'] ?? null,
            'farmer_id' => $validated['farmer_id'] ?? null,
            'status'    => $validated['status'] ?? null,
        ];

        // The cache key carries every filter, or one scope's figures would be
        // served for another.
        $suffix = md5(json_encode($filters));

        return Inertia::render('Admin/Analytics/Predictive', [
            'filters'       => $filters,
            'filterOptions' => $this->filterOptions(),
            'barangays'     => $forecast->barangaysWithData(),
            'readiness'     => $this->readiness($barangay),

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

            /*
             * Crop yield outlook, built from per-parcel predictions.
             *
             * Every figure in here — municipal, barangay, crop — is the same
             * parcel predictions summed by YieldPredictionService, so no two
             * levels on this page can disagree.
             *
             * Deferred and cached like the rest: it reads the whole cropping
             * history once, which is cheap but not free on every keystroke.
             */
            'yieldOutlook' => Inertia::defer(fn () => Cache::remember(
                "analytics.yield_outlook.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $this->yieldOutlook($predictor, $filters)
            )),

            /*
             * Recorded production per year, plus next year's prediction.
             *
             * Actual and predicted stay in separate keys on each point so the
             * chart can draw them differently. Merging them into one series is
             * what makes a forecast look like a record.
             */
            'yearlySeries' => Inertia::defer(fn () => Cache::remember(
                "analytics.yearly_series.{$suffix}",
                self::CACHE_TTL_SECONDS,
                fn () => $this->yearlySeries($predictor, $filters)
            )),

            'method' => [
                'type'    => 'rule_based',
                'version' => (string) config('climate_risk.version'),
            ],
        ]);
    }


    /**
     * Crop yield outlook for the next cropping, at every level at once.
     *
     * One pass of per-parcel predictions, then the SAME rows grouped several
     * ways. The municipal figure is not computed separately — it is the total
     * of what is listed beneath it, which is the only way the page can be
     * internally consistent and the only way to avoid double counting.
     *
     * `coverage` comes first deliberately. A forecast covering a third of the
     * parcels is a different claim from one covering all of them, and a page
     * that leads with the total hides which it is.
     */
    /**
     * Why there is nothing to forecast, stated in the office's own numbers.
     *
     * "No data available" is useless when the office knows perfectly well it
     * has data. It has farmers, parcels and crop records — what it may not
     * have is the ONE combination a yield prediction needs: a cropping row
     * carrying both a planted area and a harvested yield.
     *
     * So this counts each step and hands them to the screen, which can then
     * say exactly which one is missing and what to record to fix it.
     */
    private function dataDiagnostics(): array
    {
        $seasons = CropSeason::query()->count();

        $withArea = CropSeason::query()
            ->whereNotNull('area_planted_ha')->where('area_planted_ha', '>', 0)
            ->count();

        $withYield = CropSeason::query()
            ->whereNotNull('yield_kg')->where('yield_kg', '>', 0)
            ->count();

        // The only rows a prediction can be built from.
        $usable = CropSeason::query()
            ->whereNotNull('area_planted_ha')->where('area_planted_ha', '>', 0)
            ->whereNotNull('yield_kg')->where('yield_kg', '>', 0)
            ->count();

        return [
            'crop_seasons'      => $seasons,
            'with_area'         => $withArea,
            'with_yield'        => $withYield,
            'usable'            => $usable,
            'parcels'           => FarmParcel::query()->count(),
            'parcels_cropped'   => CropSeason::query()->distinct()->count('parcel_id'),
            // Three comparable harvests is where a farmer's own history starts
            // being trusted over the wider fallback. Stated so the office can
            // see how far off that is.
            'min_for_own_history' => ForecastService::MIN_RECORDS_FOR_SCOPE,
        ];
    }

    private function yieldOutlook(YieldPredictionService $predictor, array $filters): array
    {
        $targets = $predictor->nextCroppingTargets($filters);

        if ($targets->isEmpty()) {
            return [
                'available'   => false,
                'reason'      => 'No cropping matches these filters, so there is nothing to predict from.',
                'diagnostics' => $this->dataDiagnostics(),
            ];
        }

        $predictions = $predictor->predictMany($targets);

        /*
         * Prediction status is filtered AFTER the predictions are made.
         *
         * It is a property of the result, not of the query — there is no way
         * to ask the database for "parcels that will come in below average".
         */
        if (! empty($filters['status'])) {
            $predictions = $predictions
                ->filter(fn ($p) => $p['prediction_status'] === $filters['status'])
                ->values();
        }

        if ($predictions->isEmpty()) {
            return [
                'available'   => false,
                'reason'      => 'No parcel matches these filters.',
                'diagnostics' => $this->dataDiagnostics(),
            ];
        }

        $crops = Crop::query()->pluck('crop_name', 'id');
        $municipal = $predictor->aggregateBy($predictions, fn () => 'all')->first();

        return [
            'available'   => true,
            'coverage'    => $predictor->coverage($predictions),
            /*
             * Always sent, not only when empty.
             *
             * "No data" is useless to an office that knows it has data. These
             * counts let the screen say which specific thing is missing: a
             * cropping row needs BOTH a planted area and a harvested yield
             * before it can predict anything, and a registry can be full of
             * crop records while having very few of those.
             */
            'diagnostics' => $this->dataDiagnostics(),
            'municipal'   => $municipal,
            'byBarangay'  => $predictor
                ->aggregateBy($predictions, fn ($p) => $p['barangay'] ?: 'No barangay recorded')
                ->sortByDesc('predicted_total_kg')->values()->all(),
            'byCrop'      => $predictor
                ->aggregateBy($predictions, fn ($p) => $p['crop_id'])
                ->map(fn ($row) => $row + ['crop_name' => $crops[$row['group']] ?? 'Unknown crop'])
                ->sortByDesc('predicted_total_kg')->values()->all(),
            'byFarmer'    => $this->farmerRows($predictions, $crops),
            'watchlist'   => $predictions
                ->filter(fn ($p) => $p['prediction_status'] === 'below_average')
                ->sortBy('expected_change_pct')->take(15)
                ->map(fn ($p) => $p + ['crop_name' => $crops[$p['crop_id']] ?? 'Unknown crop'])
                ->values()->all(),
            'methodology' => YieldPredictionService::METHODOLOGY,
        ];
    }

    /**
     * Per-parcel predictions with the farmer named, and their assessment beside it.
     *
     * The assessment is READ, never recomputed: risk_status and the date of the
     * latest climate risk assessment are what the existing Farmer Assessment
     * already produced and stored. This page shows a summary and links to the
     * real thing; it does not form a second opinion.
     *
     * Two queries for the whole table — one for farmers, one for assessment
     * dates — rather than one per row.
     */
    private function farmerRows(Collection $predictions, $crops): array
    {
        $farmerIds = $predictions->pluck('farmer_id')->filter()->unique()->values();

        $farmers = Farmer::query()
            ->whereIn('id', $farmerIds)
            ->get(['id', 'first_name', 'last_name', 'barangay', 'rsbsa_no', 'risk_status'])
            ->keyBy('id');

        // The date of each farmer's most recent assessment, in one query.
        $assessedAt = ClimateRiskAssessment::query()
            ->whereIn('farmer_id', $farmerIds)
            ->selectRaw('farmer_id, MAX(assessed_at) as last_assessed')
            ->groupBy('farmer_id')
            ->pluck('last_assessed', 'farmer_id');

        return $predictions->map(function ($p) use ($farmers, $assessedAt, $crops) {
            $farmer = $farmers[$p['farmer_id']] ?? null;

            return $p + [
                'farmer_name'   => $farmer?->full_name,
                'rsbsa_no'      => $farmer?->rsbsa_no,
                'crop_name'     => $crops[$p['crop_id']] ?? 'Unknown crop',
                // Null means never assessed, which is different from "assessed
                // and found to be low risk". The UI must not conflate them.
                'risk_status'   => $farmer?->risk_status,
                'assessed_at'   => $assessedAt[$p['farmer_id']] ?? null,
            ];
        })->sortBy('farmer_name')->values()->all();
    }

    /**
     * Recorded production per year, with the next year's prediction appended.
     *
     * Actual and predicted are returned as SEPARATE keys on each point, never
     * merged into one series. A chart that plots them as one line makes a
     * forecast look like a record of something that happened.
     */
    private function yearlySeries(YieldPredictionService $predictor, array $filters): array
    {
        $actuals = CropSeason::query()
            ->join('farm_parcels', 'farm_parcels.id', '=', 'crop_seasons.parcel_id')
            ->whereNotNull('crop_seasons.yield_kg')
            ->where('crop_seasons.yield_kg', '>', 0)
            ->when($filters['barangay'] ?? null, fn ($q, $v) => $q->where('farm_parcels.barangay', $v))
            ->when($filters['crop_id'] ?? null, fn ($q, $v) => $q->where('crop_seasons.crop_id', $v))
            ->when($filters['farmer_id'] ?? null, fn ($q, $v) => $q->where('farm_parcels.farmer_id', $v))
            ->when($filters['season'] ?? null, fn ($q, $v) => $q->where('crop_seasons.season', $v))
            ->groupBy('crop_seasons.cropping_year')
            ->orderBy('crop_seasons.cropping_year')
            ->selectRaw('crop_seasons.cropping_year as year, SUM(crop_seasons.yield_kg) as total')
            ->pluck('total', 'year');

        $points = [];
        foreach ($actuals as $year => $total) {
            $points[] = [
                'year'      => (int) $year,
                'actual'    => round((float) $total, 2),
                'predicted' => null,
            ];
        }

        /*
         * The forecast point, one year past the last recorded one.
         *
         * Only when there is something to forecast from. An empty history
         * gets no point rather than a zero, which would draw a line to the
         * floor and read as a predicted total crop failure.
         */
        if (! empty($points)) {
            $targets = $predictor->nextCroppingTargets($filters);

            if ($targets->isNotEmpty()) {
                $predictions = $predictor->predictMany($targets);
                $total = $predictions
                    ->filter(fn ($p) => $p['predicted_yield_kg'] !== null)
                    ->sum(fn ($p) => (float) $p['predicted_yield_kg']);

                if ($total > 0) {
                    $points[] = [
                        'year'      => (int) end($points)['year'] + 1,
                        'actual'    => null,
                        'predicted' => round($total, 2),
                    ];
                }
            }
        }

        return $points;
    }

    /**
     * The values each filter dropdown may offer.
     *
     * Derived from the records themselves, so a filter can only ever offer
     * something that exists. A hard-coded crop list would offer crops nobody
     * grows and hide ones they do.
     */
    private function filterOptions(): array
    {
        return [
            'years' => CropSeason::query()
                ->distinct()->orderByDesc('cropping_year')
                ->pluck('cropping_year')->map(fn ($y) => (int) $y)->values()->all(),

            'seasons' => CropSeason::query()
                ->distinct()->orderBy('season')->pluck('season')->values()->all(),

            'crops' => Crop::query()
                ->whereIn('id', CropSeason::query()->distinct()->pluck('crop_id'))
                ->orderBy('crop_name')
                ->get(['id', 'crop_name'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->crop_name])
                ->all(),

            'statuses' => [
                ['id' => 'above_average', 'name' => 'Above historical average'],
                ['id' => 'in_line', 'name' => 'Near historical average'],
                ['id' => 'below_average', 'name' => 'Below historical average'],
                ['id' => 'insufficient_data', 'name' => 'Insufficient data'],
            ],
        ];
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
