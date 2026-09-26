<?php

namespace App\Services;

use App\Models\CropSeason;
use Illuminate\Support\Collection;

/**
 * Crop yield prediction at parcel level, and every aggregate built from it.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ----------------------------------------
 * There is exactly one prediction per parcel per cropping, and every other
 * figure — barangay, crop, season, year, municipal — is a sum of those same
 * predictions. No level is predicted independently. That is what stops the
 * municipal total disagreeing with the barangay totals that make it up, which
 * is precisely what happens when each scope runs its own forecast.
 *
 * It does NOT reimplement the statistics. The median, the low/high band and
 * the confidence labels all come from ForecastService, whose summarise() and
 * confidenceFor() are public so there is one definition of each. The scope
 * rule (farmer history, else barangay, else municipal, at three records) uses
 * ForecastService::MIN_RECORDS_FOR_SCOPE for the same reason.
 *
 * WHY IT DOES NOT CALL yieldForecast() PER PARCEL
 * -----------------------------------------------
 * yieldForecast() answers one rich question well — it loads the crop, resolves
 * history, computes a trend, a schedule, seasonal breakdowns and input
 * requirements. Running it once per parcel across a municipality would be
 * hundreds of those. Instead the whole cropping history is read ONCE here and
 * the per-hectare statistics are computed per scope in memory, then looked up
 * per parcel. Same arithmetic, one query.
 *
 * NOTHING IS INVENTED. A parcel with no usable history anywhere gets a null
 * prediction and the status 'insufficient_data'. Callers must show that as
 * "insufficient historical data", never as zero.
 */
class YieldPredictionService
{
    /**
     * Bump this when the arithmetic changes.
     *
     * Stored on every snapshot so old predictions are never read as though the
     * current rules produced them.
     */
    public const METHODOLOGY = 'median-per-ha+trend.v1';

    /** How far a prediction may be nudged by trend, as a share of the median. */
    private const MAX_TREND_SHARE = 0.25;

    /** Within this band of the historical average, a prediction is "in line". */
    private const IN_LINE_PCT = 5.0;

    public function __construct(private readonly ForecastService $forecast)
    {
    }

    /**
     * Every cropping record with a usable yield, loaded once.
     *
     * A row needs both a positive area and a positive yield to say anything
     * about yield per hectare. Rows missing either are not evidence of a poor
     * harvest — they are simply unrecorded, and averaging them in as zero
     * would drag every prediction down.
     */
    private function history(): Collection
    {
        return CropSeason::query()
            ->select([
                'crop_seasons.id', 'crop_seasons.parcel_id', 'crop_seasons.crop_id',
                'crop_seasons.cropping_year', 'crop_seasons.season',
                'crop_seasons.area_planted_ha', 'crop_seasons.yield_kg',
            ])
            ->whereNotNull('yield_kg')->where('yield_kg', '>', 0)
            ->whereNotNull('area_planted_ha')->where('area_planted_ha', '>', 0)
            // One join, so barangay and farmer are available without a query
            // per row. This is the N+1 the brief asks to avoid.
            ->join('farm_parcels', 'farm_parcels.id', '=', 'crop_seasons.parcel_id')
            ->addSelect(['farm_parcels.farmer_id', 'farm_parcels.barangay'])
            ->get();
    }

    /**
     * Per-hectare yields, grouped three ways: by farmer+crop, barangay+crop,
     * and crop alone.
     *
     * These are the three scopes a prediction may rest on, narrowest first,
     * mirroring ForecastService::resolveHistory. Built in one pass.
     */
    private function scopes(Collection $history): array
    {
        $farmer = [];
        $barangay = [];
        $crop = [];

        foreach ($history as $row) {
            $perHa = (float) $row->yield_kg / (float) $row->area_planted_ha;
            if ($perHa <= 0) {
                continue;
            }

            $crop[$row->crop_id][] = $perHa;
            $farmer[$row->farmer_id . ':' . $row->crop_id][] = $perHa;

            $place = trim((string) $row->barangay);
            if ($place !== '') {
                $barangay[$place . ':' . $row->crop_id][] = $perHa;
            }
        }

        return ['farmer' => $farmer, 'barangay' => $barangay, 'crop' => $crop];
    }

    /**
     * Choose the narrowest history worth trusting for one parcel and crop.
     *
     * The farmer's own record first — their land and their practice predict
     * their next harvest better than anything else. Only when that is too thin
     * does it widen to the barangay, and then to the whole municipality.
     *
     * Returns the per-hectare figures and how it got them, so a prediction can
     * always explain which history it rested on.
     */
    private function pickScope(array $scopes, ?int $farmerId, ?string $barangay, int $cropId): array
    {
        $min = ForecastService::MIN_RECORDS_FOR_SCOPE;
        $place = trim((string) $barangay);

        $own = $scopes['farmer'][$farmerId . ':' . $cropId] ?? [];
        if (count($own) >= $min) {
            return [$own, 'farmer', "this farmer's own record for this crop"];
        }

        $near = $place !== '' ? ($scopes['barangay'][$place . ':' . $cropId] ?? []) : [];
        if (count($near) >= $min) {
            return [$near, 'barangay', "other farms growing this crop in {$place}"];
        }

        $all = $scopes['crop'][$cropId] ?? [];
        if (count($all) > 0) {
            return [$all, 'municipal', 'all recorded croppings of this crop in the municipality'];
        }

        // Even a thin farmer history beats nothing at all, and saying so is
        // more honest than refusing to predict while holding two records.
        if (count($own) > 0) {
            return [$own, 'farmer', "this farmer's own record for this crop (very few)"];
        }

        return [[], 'none', null];
    }

    /**
     * Direction of travel for one parcel and crop, in kg per hectare per year.
     *
     * Least squares over the farmer's own yields against cropping year. Needs
     * at least three croppings across at least two different years: three
     * harvests in the same year describe seasons, not a trend.
     */
    private function trendPerHa(Collection $history, int $parcelId, int $cropId): ?float
    {
        $rows = $history->filter(
            fn ($r) => (int) $r->parcel_id === $parcelId && (int) $r->crop_id === $cropId
        )->values();

        if ($rows->count() < 3 || $rows->pluck('cropping_year')->unique()->count() < 2) {
            return null;
        }

        $n = $rows->count();
        $meanX = $rows->avg(fn ($r) => (int) $r->cropping_year);
        $meanY = $rows->avg(fn ($r) => (float) $r->yield_kg / (float) $r->area_planted_ha);

        $num = 0.0;
        $den = 0.0;
        foreach ($rows as $r) {
            $dx = (int) $r->cropping_year - $meanX;
            $num += $dx * (((float) $r->yield_kg / (float) $r->area_planted_ha) - $meanY);
            $den += $dx * $dx;
        }

        return $den > 0.0 ? $num / $den : null;
    }

    /**
     * Predict one cropping.
     *
     * The prediction is the median per hectare for the chosen scope, nudged by
     * the parcel's own trend, multiplied by the area.
     *
     * Median rather than mean: one failed harvest or one exceptional year
     * would drag a mean badly on the handful of records most farmers have.
     *
     * The trend is capped at a quarter of the median. A two-point trend can
     * extrapolate to something absurd, and a prediction that leaves the range
     * of anything ever recorded is not a prediction.
     */
    public function predictOne(
        array $scopes,
        Collection $history,
        int $parcelId,
        ?int $farmerId,
        ?string $barangay,
        int $cropId,
        float $areaHa,
    ): array {
        [$perHa, $basis, $basisDetail] = $this->pickScope($scopes, $farmerId, $barangay, $cropId);

        $values = collect($perHa);
        $stats = $this->forecast->summarise($values);
        $confidence = $this->forecast->confidenceFor($values->count());

        if ($stats === null || $areaHa <= 0) {
            return [
                'historical_average_kg' => null,
                'predicted_yield_kg'    => null,
                'predicted_low_kg'      => null,
                'predicted_high_kg'     => null,
                'expected_change_pct'   => null,
                'prediction_status'     => 'insufficient_data',
                'confidence'            => ForecastService::CONFIDENCE_NONE,
                'data_points'           => $values->count(),
                'basis'                 => $basis,
                'basis_detail'          => $basisDetail,
                'trend_per_ha'          => null,
                'explanation'           => 'No recorded harvest for this crop is close enough to base a prediction on.',
            ];
        }

        $median = (float) $stats['median'];
        $historicalKg = $median * $areaHa;

        $trend = $this->trendPerHa($history, $parcelId, $cropId);
        $cap = $median * self::MAX_TREND_SHARE;
        $applied = $trend === null ? 0.0 : max(-$cap, min($cap, $trend));

        // A prediction is never negative: the worst a field does is nothing.
        $predictedPerHa = max(0.0, $median + $applied);
        $predictedKg = $predictedPerHa * $areaHa;

        $changePct = $historicalKg > 0.0
            ? (($predictedKg - $historicalKg) / $historicalKg) * 100
            : null;

        return [
            'historical_average_kg' => round($historicalKg, 2),
            'predicted_yield_kg'    => round($predictedKg, 2),
            'predicted_low_kg'      => round((float) $stats['low'] * $areaHa, 2),
            'predicted_high_kg'     => round((float) $stats['high'] * $areaHa, 2),
            'expected_change_pct'   => $changePct === null ? null : round($changePct, 2),
            'prediction_status'     => $this->statusFor($changePct),
            'confidence'            => $confidence,
            'data_points'           => $values->count(),
            'basis'                 => $basis,
            'basis_detail'          => $basisDetail,
            'trend_per_ha'          => $trend === null ? null : round($trend, 2),
            'explanation'           => $this->explain($values->count(), $basisDetail, $median, $applied),
        ];
    }

    /** Above, below, or near enough to the historical average to be neither. */
    private function statusFor(?float $changePct): string
    {
        if ($changePct === null) {
            return 'insufficient_data';
        }

        return match (true) {
            $changePct > self::IN_LINE_PCT  => 'above_average',
            $changePct < -self::IN_LINE_PCT => 'below_average',
            default                         => 'in_line',
        };
    }

    /** One sentence saying where the number came from. */
    private function explain(int $points, ?string $basisDetail, float $median, float $trend): string
    {
        $where = $basisDetail ?? 'recorded harvests';
        $base = "Median of {$points} recorded harvest" . ($points === 1 ? '' : 's')
            . " from {$where}: " . round($median, 2) . ' kg per hectare.';

        if (abs($trend) < 0.01) {
            return $base . ' No clear trend, so the median is used unchanged.';
        }

        return $base . ' Adjusted by ' . ($trend > 0 ? '+' : '') . round($trend, 2)
            . ' kg per hectare for this parcel\'s own trend.';
    }

    /**
     * Predict every parcel that grows a given crop, for one cropping period.
     *
     * The single source every aggregate below is built from.
     *
     * `$targets` is what to predict for: each entry needs parcel_id, crop_id
     * and an area. Callers decide which croppings to look ahead to — this does
     * not guess that a farmer will plant again.
     */
    public function predictMany(Collection $targets): Collection
    {
        $history = $this->history();
        $scopes = $this->scopes($history);

        return $targets->map(function ($t) use ($scopes, $history) {
            $prediction = $this->predictOne(
                $scopes,
                $history,
                (int) $t['parcel_id'],
                isset($t['farmer_id']) ? (int) $t['farmer_id'] : null,
                $t['barangay'] ?? null,
                (int) $t['crop_id'],
                (float) ($t['area_planted_ha'] ?? 0),
            );

            return array_merge($t, $prediction);
        })->values();
    }

    /**
     * Roll predictions up to any level, by summing the SAME rows.
     *
     * Every aggregate the analytics screen shows goes through here, which is
     * what guarantees the municipal total equals the sum of its barangays.
     *
     * Rows with no prediction contribute to `without_prediction` and to
     * nothing else. Counting them as zero would understate a barangay's
     * expected production in proportion to how much data it is missing —
     * exactly backwards.
     */
    public function aggregateBy(Collection $predictions, callable $key): Collection
    {
        return $predictions
            ->groupBy($key)
            ->map(function (Collection $rows, $group) {
                $withPrediction = $rows->filter(fn ($r) => $r['predicted_yield_kg'] !== null);

                $historical = $withPrediction->sum(fn ($r) => (float) $r['historical_average_kg']);
                $predicted = $withPrediction->sum(fn ($r) => (float) $r['predicted_yield_kg']);

                return [
                    'group'                => $group,
                    'farmers'              => $rows->pluck('farmer_id')->filter()->unique()->count(),
                    'parcels'              => $rows->count(),
                    'area_ha'              => round($rows->sum(fn ($r) => (float) ($r['area_planted_ha'] ?? 0)), 2),
                    'with_prediction'      => $withPrediction->count(),
                    'without_prediction'   => $rows->count() - $withPrediction->count(),
                    'historical_total_kg'  => round($historical, 2),
                    'predicted_total_kg'   => round($predicted, 2),
                    'expected_change_pct'  => $historical > 0.0
                        ? round((($predicted - $historical) / $historical) * 100, 2)
                        : null,
                    // Null, not zero: a group with nothing to predict has no
                    // average yield, and 0 kg/ha would read as a failed crop.
                    'avg_predicted_per_ha' => $withPrediction->isNotEmpty()
                        ? round($predicted / max(0.01, $withPrediction->sum(fn ($r) => (float) ($r['area_planted_ha'] ?? 0))), 2)
                        : null,
                ];
            })
            ->values();
    }
}
