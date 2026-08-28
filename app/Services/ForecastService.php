<?php

namespace App\Services;

use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Statistical forecasting for crop yield, harvest supply and risk exposure.
 *
 * Every prediction is returned together with the number of historical records
 * it was derived from and a confidence label. This is deliberate: with a thin
 * history an average is close to meaningless, and reporting a bare number
 * implies precision the data does not support. Callers are expected to show
 * the confidence alongside the value.
 *
 * These are historical averages, least-squares trends and season-based rules -
 * not machine learning. Nothing here is trained.
 */
class ForecastService
{
    public const CONFIDENCE_NONE = 'none';
    public const CONFIDENCE_LOW = 'low';
    public const CONFIDENCE_MODERATE = 'moderate';
    public const CONFIDENCE_HIGH = 'high';

    /** Peak typhoon months in Northern Luzon. */
    private const TYPHOON_PEAK_MONTHS = [7, 8, 9, 10];

    /** Wet season months. */
    private const WET_MONTHS = [6, 7, 8, 9, 10, 11];

    /** Fallback crop duration when no planting/harvest pairs are recorded. */
    private const DEFAULT_DAYS_TO_HARVEST = 120;

    /**
     * Minimum records before a narrower scope (farmer, then barangay) is
     * trusted over the wider one it would otherwise fall back to.
     */
    private const MIN_RECORDS_FOR_SCOPE = 3;

    /**
     * Forecast yield for a crop on a given area.
     *
     * Returns null estimates (never zero) when there is no history, so the UI
     * can say "no forecast available" instead of showing a confident 0 kg.
     */
    public function yieldForecast(
        int $cropId,
        float $areaHa,
        ?int $farmerId = null,
        ?string $plantingDate = null,
        ?string $season = null,
        ?string $barangay = null
    ): array {
        $crop = Crop::findOrFail($cropId);

        [$history, $basis, $basisDetail] = $this->resolveHistory($cropId, $farmerId, $barangay);

        $yieldsPerHa = $history
            ->map(fn ($s) => (float) $s->yield_kg / (float) $s->area_planted_ha)
            ->filter(fn ($v) => $v > 0)
            ->values();

        $stats = $this->summarise($yieldsPerHa);
        $confidence = $this->confidenceFor($yieldsPerHa->count());
        $hasForecast = $stats !== null;

        // Input requirements come from agronomic reference rates on the crop
        // record, so they are available even with zero yield history.
        $inputs = [
            'seeds_kg'        => $this->round(($crop->seeding_rate_kg_per_ha ?? 0) * $areaHa),
            'fertilizer_bags' => $this->round(($crop->fertilizer_bags_per_ha ?? 0) * $areaHa),
        ];

        $daysToHarvest = $this->averageDaysToHarvest($cropId);
        $schedule = $this->buildSchedule($plantingDate, $daysToHarvest);

        return [
            'crop_name'      => $crop->crop_name,
            'area_hectares'  => $areaHa,

            // Confidence metadata - show this next to any number below.
            'confidence'     => $confidence,
            'data_points'    => $yieldsPerHa->count(),
            'basis'          => $basis,
            'basis_detail'   => $basisDetail,
            'scope'          => $this->describeScope($farmerId, $barangay),
            'explanation'    => $this->explain($confidence, $yieldsPerHa->count(), $basis, $basisDetail),

            // Null rather than 0 when unknown.
            'yield_per_ha'   => $hasForecast ? $this->round($stats['median']) : null,
            'total_yield_kg' => $hasForecast ? $this->round($stats['median'] * $areaHa) : null,

            // A plausible range matters more than a single figure on small samples.
            'range_kg' => $hasForecast ? [
                'low'  => $this->round($stats['low'] * $areaHa),
                'high' => $this->round($stats['high'] * $areaHa),
            ] : null,

            'spread' => $hasForecast ? [
                'mean_per_ha'   => $this->round($stats['mean']),
                'median_per_ha' => $this->round($stats['median']),
                'min_per_ha'    => $this->round($stats['min']),
                'max_per_ha'    => $this->round($stats['max']),
            ] : null,

            'trend' => $this->yieldTrend($cropId, $farmerId, $barangay),

            'avg_days_to_harvest'     => $daysToHarvest,
            'estimated_harvest_date'  => $schedule['harvest_date'],
            'planting_date'           => $plantingDate,

            'recommended_seeds_kg'        => $inputs['seeds_kg'],
            'recommended_fertilizer_bags' => $inputs['fertilizer_bags'],

            'risk_assessment' => $schedule['harvest_month']
                ? $this->assessRisk($schedule['planting_month'], $schedule['harvest_month'], $season)
                : null,

            'best_planting_months' => $this->bestPlantingMonths($cropId, $barangay),
            'seasonal_data'        => $this->seasonalBreakdown($cropId, $barangay),
        ];
    }

    /**
     * Expected harvest volume per month across the municipality.
     *
     * Uses recorded plantings and projects the harvest date from the crop's
     * average duration when the harvest date has not been entered yet.
     */
    public function harvestCalendar(int $monthsAhead = 12, ?string $barangay = null): array
    {
        $from = now()->startOfMonth();
        $to = now()->addMonths($monthsAhead)->endOfMonth();

        $seasons = $this->scopeBarangay(
            CropSeason::forVerifiedFarmers()
                ->with(['crop', 'parcel.farmer'])
                ->whereNotNull('planting_date'),
            $barangay
        )->get();

        $durations = $this->cropDurations();
        $averages = $this->cropYieldAverages();
        $buckets = [];

        foreach ($seasons as $s) {
            $harvest = $s->harvest_date
                ?? Carbon::parse($s->planting_date)
                    ->addDays($durations[$s->crop_id] ?? self::DEFAULT_DAYS_TO_HARVEST);

            $harvest = Carbon::parse($harvest);

            if ($harvest->lt($from) || $harvest->gt($to)) {
                continue;
            }

            $key = $harvest->format('Y-m');

            $buckets[$key] ??= [
                'month'          => $key,
                'month_label'    => $harvest->format('M Y'),
                'volume_kg'      => 0.0,
                'parcels'        => 0,
                'unknown_volume' => 0,
                'is_estimated'   => false,
                'crops'          => [],
            ];

            $buckets[$key]['parcels']++;

            // Prefer the recorded yield, else project from the crop average.
            // A crop with no history at all cannot be projected - count it as
            // unknown rather than contributing 0, which would read as a real
            // forecast of "no harvest".
            $cropAverage = $averages[$s->crop_id] ?? null;

            if ($s->yield_kg === null && ($cropAverage === null || $cropAverage <= 0)) {
                $buckets[$key]['unknown_volume']++;
                continue;
            }

            $projected = $s->yield_kg !== null
                ? (float) $s->yield_kg
                : (float) $cropAverage * (float) $s->area_planted_ha;

            $buckets[$key]['volume_kg'] += $projected;
            $buckets[$key]['is_estimated'] = $buckets[$key]['is_estimated'] || $s->yield_kg === null;

            $cropName = $s->crop->crop_name ?? 'Unspecified';
            $buckets[$key]['crops'][$cropName] = ($buckets[$key]['crops'][$cropName] ?? 0) + $projected;
        }

        ksort($buckets);

        return collect($buckets)->map(function ($bucket) {
            // No projectable volume at all - report null, not zero.
            $bucket['volume_kg'] = $bucket['crops'] === []
                ? null
                : $this->round($bucket['volume_kg']);

            $bucket['crops'] = collect($bucket['crops'])
                ->map(fn ($v) => $this->round($v))
                ->sortDesc()
                ->toArray();

            return $bucket;
        })->values()->all();
    }

    /**
     * Parcels whose harvest window overlaps peak typhoon season, or whose
     * farmer is already flagged as high risk. Ordered most severe first.
     */
    public function atRiskParcels(?string $barangay = null): array
    {
        $durations = $this->cropDurations();

        $seasons = $this->scopeBarangay(
            CropSeason::forVerifiedFarmers()
                ->with(['crop', 'parcel.farmer'])
                ->whereNotNull('planting_date'),
            $barangay
        )->get();

        $rows = [];

        foreach ($seasons as $s) {
            $farmer = $s->parcel->farmer ?? null;

            if (!$farmer) {
                continue;
            }

            $harvest = Carbon::parse(
                $s->harvest_date
                    ?? Carbon::parse($s->planting_date)
                        ->addDays($durations[$s->crop_id] ?? self::DEFAULT_DAYS_TO_HARVEST)
            );

            // Only forward-looking exposure is actionable.
            if ($harvest->isPast()) {
                continue;
            }

            $reasons = [];
            $score = 0;

            if (in_array((int) $harvest->format('n'), self::TYPHOON_PEAK_MONTHS, true)) {
                $reasons[] = 'Harvest falls in peak typhoon season (July-October)';
                $score += 2;
            } elseif (in_array((int) $harvest->format('n'), self::WET_MONTHS, true)) {
                $reasons[] = 'Harvest falls in the wet season';
                $score += 1;
            }

            if (in_array($farmer->risk_status, ['high', 'critical'], true)) {
                $reasons[] = "Farmer is flagged {$farmer->risk_status} risk";
                $score += 2;
            }

            if ($reasons === []) {
                continue;
            }

            $rows[] = [
                'farmer_id'    => $farmer->id,
                'farmer_name'  => $farmer->full_name,
                'barangay'     => $s->parcel->barangay ?? $farmer->barangay,
                'crop'         => $s->crop->crop_name ?? 'Unspecified',
                'area_ha'      => (float) $s->area_planted_ha,
                'harvest_date' => $harvest->toDateString(),
                'risk_level'   => $score >= 3 ? 'high' : ($score >= 2 ? 'medium' : 'low'),
                'reasons'      => $reasons,
            ];
        }

        usort($rows, function ($a, $b) {
            $rank = ['high' => 0, 'medium' => 1, 'low' => 2];

            return [$rank[$a['risk_level']], $a['harvest_date']]
                <=> [$rank[$b['risk_level']], $b['harvest_date']];
        });

        return $rows;
    }

    /**
     * Per-crop outlook: planted area, average productivity and direction of travel.
     */
    public function commodityOutlook(?string $barangay = null): array
    {
        $rows = $this->scopeBarangay(
            CropSeason::forVerifiedFarmers()
                ->with('crop')
                ->whereNotNull('yield_kg')
                ->where('area_planted_ha', '>', 0),
            $barangay
        )->get()->groupBy('crop_id');

        return $rows->map(function (Collection $seasons, $cropId) use ($barangay) {
            $perHa = $seasons
                ->map(fn ($s) => (float) $s->yield_kg / (float) $s->area_planted_ha)
                ->filter(fn ($v) => $v > 0)
                ->values();

            $stats = $this->summarise($perHa);

            return [
                'crop_id'      => (int) $cropId,
                'crop_name'    => $seasons->first()->crop->crop_name ?? 'Unspecified',
                'total_area_ha' => $this->round($seasons->sum('area_planted_ha')),
                'total_yield_kg' => $this->round($seasons->sum('yield_kg')),
                'yield_per_ha' => $stats ? $this->round($stats['median']) : null,
                'data_points'  => $perHa->count(),
                'confidence'   => $this->confidenceFor($perHa->count()),
                'trend'        => $this->yieldTrend((int) $cropId, null, $barangay),
            ];
        })->sortByDesc('total_area_ha')->values()->all();
    }

    /**
     * Side-by-side productivity of every barangay with recorded harvests.
     *
     * Lets the office see which barangays are underperforming or declining and
     * target extension work there. Optionally narrowed to a single crop, since
     * comparing rice barangays against vegetable barangays is not meaningful.
     */
    public function barangayComparison(?int $cropId = null): array
    {
        $rows = CropSeason::query()
            ->join('farm_parcels', 'crop_seasons.parcel_id', '=', 'farm_parcels.id')
            ->join('farmers', 'farm_parcels.farmer_id', '=', 'farmers.id')
            ->where('farmers.verification_status', Farmer::STATUS_VERIFIED)
            ->whereNotNull('crop_seasons.yield_kg')
            ->where('crop_seasons.area_planted_ha', '>', 0)
            ->whereNotNull('farm_parcels.barangay')
            ->when($cropId, fn ($q) => $q->where('crop_seasons.crop_id', $cropId))
            ->selectRaw('farm_parcels.barangay as barangay')
            ->selectRaw('crop_seasons.cropping_year as cropping_year')
            ->selectRaw('SUM(crop_seasons.area_planted_ha) as area')
            ->selectRaw('SUM(crop_seasons.yield_kg) as yield_total')
            ->selectRaw('COUNT(*) as records')
            ->groupBy('farm_parcels.barangay', 'crop_seasons.cropping_year')
            ->get()
            ->groupBy('barangay');

        // Count farmers by where their land actually is, not where they live.
        // A farmer can reside in one barangay and farm in another, and for
        // productivity the parcel location is what matters.
        $farmerCounts = DB::table('farm_parcels')
            ->join('farmers', 'farm_parcels.farmer_id', '=', 'farmers.id')
            ->where('farmers.verification_status', Farmer::STATUS_VERIFIED)
            ->whereNotNull('farm_parcels.barangay')
            ->selectRaw('farm_parcels.barangay as barangay, COUNT(DISTINCT farmers.id) as total')
            ->groupBy('farm_parcels.barangay')
            ->pluck('total', 'barangay');

        $comparison = $rows->map(function (Collection $years, string $barangay) use ($farmerCounts) {
            $totalArea = (float) $years->sum('area');
            $totalYield = (float) $years->sum('yield_total');
            $records = (int) $years->sum('records');

            // Yield per hectare for each year, used for the trend line.
            $byYear = $years
                ->filter(fn ($r) => (float) $r->area > 0)
                ->mapWithKeys(fn ($r) => [
                    (string) $r->cropping_year => (float) $r->yield_total / (float) $r->area,
                ])
                ->sortKeys();

            return [
                'barangay'      => $barangay,
                'total_area_ha' => $this->round($totalArea),
                'total_yield_kg' => $this->round($totalYield),
                // Area-weighted, so a large low-yield parcel is not hidden by a
                // small high-yield one.
                'yield_per_ha'  => $totalArea > 0 ? $this->round($totalYield / $totalArea) : null,
                'records'       => $records,
                'farmers'       => (int) ($farmerCounts[$barangay] ?? 0),
                'confidence'    => $this->confidenceFor($records),
                'trend'         => $this->trendFromSeries($byYear),
            ];
        })->values();

        // Rank against the municipal average so "below average" is explicit.
        $municipalAverage = $comparison->whereNotNull('yield_per_ha')->avg('yield_per_ha');

        return $comparison
            ->map(function (array $row) use ($municipalAverage) {
                $row['municipal_avg_yield_per_ha'] = $this->round($municipalAverage);
                $row['vs_municipal_pct'] = ($municipalAverage && $row['yield_per_ha'] !== null)
                    ? $this->round((($row['yield_per_ha'] - $municipalAverage) / $municipalAverage) * 100)
                    : null;

                return $row;
            })
            ->sortByDesc(fn ($row) => $row['yield_per_ha'] ?? -1)
            ->values()
            ->all();
    }

    /** Barangays that currently have any cropping records, for filter dropdowns. */
    public function barangaysWithData(): array
    {
        return CropSeason::query()
            ->join('farm_parcels', 'crop_seasons.parcel_id', '=', 'farm_parcels.id')
            ->join('farmers', 'farm_parcels.farmer_id', '=', 'farmers.id')
            ->where('farmers.verification_status', Farmer::STATUS_VERIFIED)
            ->whereNotNull('farm_parcels.barangay')
            ->distinct()
            ->orderBy('farm_parcels.barangay')
            ->pluck('farm_parcels.barangay')
            ->all();
    }

    /**
     * Verified farmers who own parcels but have no cropping activity recorded
     * recently. Either they stopped farming or data collection has lapsed -
     * both are worth a follow up.
     */
    public function inactiveFarmers(int $monthsIdle = 18, ?string $barangay = null): array
    {
        $cutoff = now()->subMonths($monthsIdle);

        return Farmer::query()
            ->verified()
            ->has('parcels')
            ->when($barangay, fn ($q) => $q->where('barangay', $barangay))
            ->whereDoesntHave('parcels.seasons', function ($q) use ($cutoff) {
                $q->where('planting_date', '>=', $cutoff);
            })
            ->with('parcels:id,farmer_id,barangay,total_area_ha,commodity')
            ->get()
            ->map(fn ($f) => [
                'farmer_id'   => $f->id,
                'farmer_name' => $f->full_name,
                'barangay'    => $f->barangay,
                'parcels'     => $f->parcels->count(),
                'total_area_ha' => $this->round($f->parcels->sum('total_area_ha')),
                'commodities' => $f->parcels->pluck('commodity')->filter()->unique()->values()->all(),
            ])
            ->values()
            ->all();
    }

    // ---------------------------------------------------------------- helpers

    /**
     * Pick the narrowest scope that still has enough records to be meaningful:
     * the farmer's own history, then their barangay, then the whole
     * municipality.
     *
     * The barangay tier matters agronomically - a neighbouring farm shares
     * soil type and microclimate, so it is a far better proxy than a farm on
     * the other side of Tumauini.
     *
     * Returns [history, basis, basisDetail] so the caller can state which
     * scope was actually used rather than implying a precision it does not have.
     */
    private function resolveHistory(int $cropId, ?int $farmerId, ?string $barangay = null): array
    {
        $base = fn () => CropSeason::forVerifiedFarmers()
            ->where('crop_id', $cropId)
            ->whereNotNull('yield_kg')
            ->where('area_planted_ha', '>', 0);

        // Tier 1 - the farmer's own track record.
        if ($farmerId) {
            $own = $base()
                ->whereHas('parcel', fn ($q) => $q->where('farmer_id', $farmerId))
                ->get();

            if ($own->count() >= self::MIN_RECORDS_FOR_SCOPE) {
                return [$own, 'farmer', null];
            }

            // Without an explicit barangay, use the farmer's own.
            $barangay ??= Farmer::find($farmerId)?->barangay;
        }

        // Tier 2 - same barangay.
        if ($barangay) {
            $local = $base()
                ->whereHas('parcel', fn ($q) => $q->where('barangay', $barangay))
                ->get();

            if ($local->count() >= self::MIN_RECORDS_FOR_SCOPE) {
                return [$local, 'barangay', $barangay];
            }
        }

        // Tier 3 - everything on record.
        return [$base()->get(), 'municipality', null];
    }

    /** Human-readable description of what was asked for. */
    private function describeScope(?int $farmerId, ?string $barangay): string
    {
        if ($farmerId) {
            return 'farmer';
        }

        return $barangay ? 'barangay' : 'municipality';
    }

    /** Constrain a CropSeason query to parcels in one barangay. */
    private function scopeBarangay($query, ?string $barangay)
    {
        return $query->when(
            $barangay,
            fn ($q) => $q->whereHas('parcel', fn ($p) => $p->where('barangay', $barangay))
        );
    }

    /**
     * Median-centred summary. Median is used as the headline figure because a
     * single exceptional harvest skews the mean badly on small samples.
     */
    private function summarise(Collection $values): ?array
    {
        if ($values->isEmpty()) {
            return null;
        }

        $sorted = $values->sort()->values();
        $count = $sorted->count();
        $mean = $sorted->avg();

        $median = $count % 2 === 0
            ? ($sorted[$count / 2 - 1] + $sorted[$count / 2]) / 2
            : $sorted[intdiv($count, 2)];

        // Population standard deviation; 0 when there is a single record.
        $variance = $count > 1
            ? $sorted->reduce(fn ($c, $v) => $c + (($v - $mean) ** 2), 0) / $count
            : 0.0;
        $stdDev = sqrt($variance);

        return [
            'mean'   => $mean,
            'median' => $median,
            'min'    => $sorted->first(),
            'max'    => $sorted->last(),
            // Clamp the band to what was actually observed.
            'low'    => max($sorted->first(), $median - $stdDev),
            'high'   => min($sorted->last(), $median + $stdDev),
        ];
    }

    private function confidenceFor(int $dataPoints): string
    {
        return match (true) {
            $dataPoints === 0 => self::CONFIDENCE_NONE,
            $dataPoints < 5   => self::CONFIDENCE_LOW,
            $dataPoints < 15  => self::CONFIDENCE_MODERATE,
            default           => self::CONFIDENCE_HIGH,
        };
    }

    private function explain(string $confidence, int $points, string $basis, ?string $basisDetail = null): string
    {
        if ($confidence === self::CONFIDENCE_NONE) {
            return 'No harvest history recorded for this crop yet, so no yield forecast can be produced. Record completed cropping seasons to enable forecasting.';
        }

        $source = match ($basis) {
            'farmer'   => "this farmer's own harvest history",
            'barangay' => "harvest history from Barangay {$basisDetail}, which shares similar soil and climate",
            default    => 'municipality-wide history across Tumauini',
        };

        $caveat = match ($confidence) {
            self::CONFIDENCE_LOW => ' Treat this as a rough indication only.',
            self::CONFIDENCE_MODERATE => ' Reasonably indicative, but expect variation.',
            default => '',
        };

        return "Based on {$points} recorded harvest(s) from {$source}.{$caveat}";
    }

    /**
     * Least-squares gradient of yield per hectare against cropping year.
     * Needs at least 3 distinct years to be worth reporting.
     */
    private function yieldTrend(int $cropId, ?int $farmerId = null, ?string $barangay = null): array
    {
        $query = CropSeason::forVerifiedFarmers()
            ->where('crop_id', $cropId)
            ->whereNotNull('yield_kg')
            ->where('area_planted_ha', '>', 0);

        if ($farmerId) {
            $query->whereHas('parcel', fn ($q) => $q->where('farmer_id', $farmerId));
        }

        $this->scopeBarangay($query, $barangay);

        $byYear = $query->get()
            ->groupBy('cropping_year')
            ->map(fn ($rows) => $rows->avg(fn ($s) => (float) $s->yield_kg / (float) $s->area_planted_ha))
            ->sortKeys();

        return $this->trendFromSeries($byYear);
    }

    /**
     * Least-squares gradient over a year => value series.
     * Reused for per-crop and per-barangay trends.
     */
    private function trendFromSeries(Collection $byYear): array
    {
        if ($byYear->count() < 3) {
            return [
                'direction'   => 'unknown',
                'years'       => $byYear->count(),
                'per_year'    => $byYear->map(fn ($v) => $this->round($v))->toArray(),
                'explanation' => 'At least 3 years of data are needed to identify a trend.',
            ];
        }

        $years = $byYear->keys()->map(fn ($y) => (float) $y)->all();
        $values = array_map('floatval', $byYear->values()->all());
        $n = count($years);

        $meanX = array_sum($years) / $n;
        $meanY = array_sum($values) / $n;

        $numerator = 0.0;
        $denominator = 0.0;

        for ($i = 0; $i < $n; $i++) {
            $numerator += ($years[$i] - $meanX) * ($values[$i] - $meanY);
            $denominator += ($years[$i] - $meanX) ** 2;
        }

        $slope = $denominator > 0 ? $numerator / $denominator : 0.0;

        // Treat movement under 2% of the mean per year as flat.
        $threshold = abs($meanY) * 0.02;

        $direction = match (true) {
            $slope > $threshold  => 'improving',
            $slope < -$threshold => 'declining',
            default              => 'stable',
        };

        return [
            'direction'        => $direction,
            'change_per_year'  => $this->round($slope),
            'years'            => $n,
            'per_year'         => $byYear->map(fn ($v) => $this->round($v))->toArray(),
            'explanation'      => match ($direction) {
                'improving' => 'Yield per hectare has been rising across recorded years.',
                'declining' => 'Yield per hectare has been falling - worth investigating inputs, soil or pests.',
                default     => 'Yield per hectare has held roughly steady.',
            },
        ];
    }

    private function averageDaysToHarvest(int $cropId): int
    {
        $avg = CropSeason::forVerifiedFarmers()
            ->where('crop_id', $cropId)
            ->whereNotNull('planting_date')
            ->whereNotNull('harvest_date')
            ->selectRaw('AVG(DATEDIFF(harvest_date, planting_date)) as avg_days')
            ->value('avg_days');

        return (int) round($avg ?: self::DEFAULT_DAYS_TO_HARVEST);
    }

    /** Average duration per crop, keyed by crop id. */
    private function cropDurations(): array
    {
        return CropSeason::forVerifiedFarmers()
            ->whereNotNull('planting_date')
            ->whereNotNull('harvest_date')
            ->selectRaw('crop_id, AVG(DATEDIFF(harvest_date, planting_date)) as avg_days')
            ->groupBy('crop_id')
            ->pluck('avg_days', 'crop_id')
            ->map(fn ($d) => (int) round($d))
            ->toArray();
    }

    /** Average yield per hectare per crop, keyed by crop id. */
    private function cropYieldAverages(): array
    {
        return CropSeason::forVerifiedFarmers()
            ->whereNotNull('yield_kg')
            ->where('area_planted_ha', '>', 0)
            ->selectRaw('crop_id, AVG(yield_kg / area_planted_ha) as avg_yield')
            ->groupBy('crop_id')
            ->pluck('avg_yield', 'crop_id')
            ->map(fn ($v) => (float) $v)
            ->toArray();
    }

    private function buildSchedule(?string $plantingDate, int $daysToHarvest): array
    {
        if (!$plantingDate) {
            return ['harvest_date' => null, 'planting_month' => null, 'harvest_month' => null];
        }

        $planting = Carbon::parse($plantingDate);
        $harvest = $planting->copy()->addDays($daysToHarvest);

        return [
            'harvest_date'   => $harvest->toDateString(),
            'planting_month' => (int) $planting->format('n'),
            'harvest_month'  => (int) $harvest->format('n'),
        ];
    }

    /**
     * Season-based risk rules for Northern Luzon. These are calendar
     * heuristics, not a weather forecast.
     */
    private function assessRisk(int $plantingMonth, int $harvestMonth, ?string $season): array
    {
        $risks = [];
        $level = 'low';

        if (in_array($harvestMonth, self::TYPHOON_PEAK_MONTHS, true)) {
            $risks[] = 'Harvest period falls during peak typhoon season (July-October)';
            $level = 'high';
        } elseif (in_array($harvestMonth, self::WET_MONTHS, true)) {
            $risks[] = 'Harvest period during wet season - risk of heavy rainfall';
            $level = 'medium';
        }

        if (in_array($plantingMonth, self::TYPHOON_PEAK_MONTHS, true)) {
            $risks[] = 'Planting during peak typhoon season may affect germination';
            $level = $level === 'low' ? 'medium' : $level;
        }

        if (!in_array($plantingMonth, self::WET_MONTHS, true)
            && !in_array($harvestMonth, self::WET_MONTHS, true)) {
            $risks[] = 'Good timing - both planting and harvest fall in the dry season';
            $level = 'low';
        }

        if ($season === 'wet' && !in_array($plantingMonth, self::WET_MONTHS, true)) {
            $risks[] = 'Wet season selected but the planting date falls in dry months';
        } elseif ($season === 'dry' && in_array($plantingMonth, self::WET_MONTHS, true)) {
            $risks[] = 'Dry season selected but the planting date falls in wet months';
        }

        return [
            'level'          => $level,
            'risks'          => $risks,
            'recommendation' => match ($level) {
                'high'   => 'Consider moving planting earlier so harvest lands outside July-October. December to March plantings are typically safest.',
                'medium' => 'Moderate exposure. Ensure drainage is prepared and monitor PAGASA advisories as harvest approaches.',
                default  => 'Schedule looks sound. Continue standard monitoring and recommended practices.',
            },
        ];
    }

    private function bestPlantingMonths(int $cropId, ?string $barangay = null): array
    {
        $query = CropSeason::forVerifiedFarmers()
            ->selectRaw('MONTH(planting_date) as month, AVG(yield_kg / area_planted_ha) as avg_yield, COUNT(*) as count')
            ->where('crop_id', $cropId)
            ->whereNotNull('planting_date')
            ->whereNotNull('yield_kg')
            ->where('area_planted_ha', '>', 0);

        return $this->scopeBarangay($query, $barangay)
            ->groupBy('month')
            ->orderByDesc('avg_yield')
            ->limit(3)
            ->get()
            ->map(fn ($row) => [
                'month'      => (int) $row->month,
                'month_name' => date('F', mktime(0, 0, 0, (int) $row->month, 1)),
                'avg_yield'  => $this->round($row->avg_yield),
                'count'      => (int) $row->count,
            ])
            ->all();
    }

    private function seasonalBreakdown(int $cropId, ?string $barangay = null): array
    {
        $query = CropSeason::forVerifiedFarmers()
            ->selectRaw('season, cropping_year, AVG(yield_kg / area_planted_ha) as avg_yield, AVG(DATEDIFF(harvest_date, planting_date)) as avg_days_to_harvest')
            ->where('crop_id', $cropId)
            ->whereNotNull('yield_kg')
            ->where('area_planted_ha', '>', 0);

        return $this->scopeBarangay($query, $barangay)
            ->groupBy('season', 'cropping_year')
            ->orderByDesc('cropping_year')
            ->orderBy('season')
            ->limit(10)
            ->get()
            ->map(fn ($r) => [
                'season'               => $r->season,
                'cropping_year'        => $r->cropping_year,
                'avg_yield'            => $this->round($r->avg_yield),
                'avg_days_to_harvest'  => $r->avg_days_to_harvest ? (int) round($r->avg_days_to_harvest) : null,
            ])
            ->all();
    }

    private function round(float|int|null $value): ?float
    {
        return $value === null ? null : round((float) $value, 2);
    }
}
