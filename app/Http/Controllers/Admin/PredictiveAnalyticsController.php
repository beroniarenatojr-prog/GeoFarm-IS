<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Services\ForecastService;
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

    public function index(Request $request, ForecastService $forecast)
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
        ]);
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
