<?php

namespace App\Services;

use App\Models\ClimateRiskAssessment;
use App\Models\CropSeason;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Crop yield prediction by weighted moving average.
 *
 * Rule-based and statistical. Nothing here is trained, fitted or learned: the
 * weights come from config/yield_prediction.php and were chosen by the office,
 * so every figure can be explained by pointing at the three harvests behind it
 * and the number each was multiplied by.
 *
 * SEPARATE FROM YieldPredictionService, on purpose. That one predicts from the
 * median yield per hectare of the narrowest trustworthy scope, and is what the
 * Predictive Analytics screen currently shows. This one is far stricter — the
 * same farmer, the same crop and the same season type only — so it speaks for
 * fewer parcels but speaks about each with more standing. Both write their
 * name into yield_prediction_snapshots.methodology, so once actual harvests
 * land the two can be judged against each other on measured error rather than
 * on argument.
 *
 * Three rules hold throughout:
 *
 *   NOTHING IS INVENTED. Where there is no history anywhere, the answer is
 *   null with a stated reason — never zero, which would read as a prediction
 *   of total crop failure.
 *
 *   AGGREGATES ARE AREA-WEIGHTED. Total kilograms over total hectares, never
 *   the mean of each farmer's yield. Averaging the ratios lets a tenth of a
 *   hectare count for as much as fifty.
 *
 *   ONLY KILOGRAMS. crop_seasons carries a production_unit and some croppings
 *   are recorded in sacks; those rows are excluded rather than summed into a
 *   total that would silently be wrong.
 */
class WeightedYieldPredictor
{
    public const CONFIDENCE_HIGH     = 'high';
    public const CONFIDENCE_MEDIUM   = 'medium';
    public const CONFIDENCE_LOW      = 'low';
    public const CONFIDENCE_BASELINE = 'baseline';

    public const BASIS_FARMER    = 'farmer';
    public const BASIS_BARANGAY  = 'barangay';
    public const BASIS_MUNICIPAL = 'municipal';

    /** Identifies predictions made by this method in the snapshot table. */
    public const METHODOLOGY = 'weighted-moving-average.v1';

    /**
     * Yield per hectare for one completed cropping.
     *
     * Against the HARVESTED area where one is recorded, falling back to the
     * planted area. A season half lost to flood produced what it produced on
     * the part that survived, and dividing by the planted area would describe
     * a worse farmer rather than a smaller harvest.
     *
     * Returns null — never zero — when there is no area to divide by. Zero is
     * a yield; "we cannot say" is not.
     */
    public function actualYield(CropSeason $season): ?float
    {
        $area = $this->harvestedArea($season);
        $weight = $season->yield_kg;

        if ($area === null || $area <= 0.0 || $weight === null) {
            return null;
        }

        if (! $this->isKilograms($season)) {
            return null;
        }

        return round((float) $weight / $area, 2);
    }

    /** Harvested area, else planted area, else null. Never zero-as-unknown. */
    private function harvestedArea(CropSeason $season): ?float
    {
        foreach ([$season->harvested_area_ha, $season->area_planted_ha] as $candidate) {
            if ($candidate !== null && (float) $candidate > 0.0) {
                return (float) $candidate;
            }
        }

        return null;
    }

    /** Area a current or upcoming season expects to harvest. */
    private function expectedArea(CropSeason $season): ?float
    {
        foreach ([
            $season->expected_harvested_area_ha,
            $season->harvested_area_ha,
            $season->area_planted_ha,
        ] as $candidate) {
            if ($candidate !== null && (float) $candidate > 0.0) {
                return (float) $candidate;
            }
        }

        return null;
    }

    /** Is this cropping recorded on the kilogram basis? */
    private function isKilograms(CropSeason $season): bool
    {
        $unit = $season->production_unit;

        // A null unit predates the column and means kilograms.
        return $unit === null
            || in_array(strtolower((string) $unit), (array) config('yield_prediction.kilogram_units', ['kg']), true);
    }

    /**
     * Was this cropping disturbed by weather?
     *
     * Read from the climate risk assessment linked to it, not from a column.
     * `climate_events` lists what the farmer reported and includes an explicit
     * 'none', which never counts.
     */
    public function isCalamityAffected(CropSeason $season): bool
    {
        return $this->calamityType($season) !== null;
    }

    /**
     * Which calamity, in the module's vocabulary, or null for none.
     *
     * Unmapped events become 'other' rather than being guessed at. The
     * assessment has no pest option, so 'pest' can never come from here.
     */
    public function calamityType(CropSeason $season): ?string
    {
        $assessment = ClimateRiskAssessment::query()
            ->where('crop_season_id', $season->id)
            ->latest('assessed_at')
            ->first();

        if (! $assessment) {
            return null;
        }

        $reported = (array) ($assessment->climate_events ?? []);
        $counts = (array) config('yield_prediction.calamity.events', []);
        $types = (array) config('yield_prediction.calamity.types', []);

        foreach ($reported as $event) {
            if (in_array($event, $counts, true)) {
                return $types[$event] ?? 'other';
            }
        }

        return null;
    }

    /**
     * Completed croppings for one farmer, crop and season type, newest first.
     *
     * "Completed" means a harvest was recorded: a yield and a harvest date.
     * Calamity seasons are dropped here rather than filtered later, so every
     * caller works from the same history.
     *
     * `$before` excludes anything harvested on or after that date, which is
     * what lets a prediction be reconstructed as it stood BEFORE the harvest
     * now being judged. Without it, evaluating accuracy would feed the
     * outcome back into its own forecast.
     */
    public function pastSeasons(
        int $farmerId,
        int $cropId,
        string $seasonType,
        ?string $before = null,
    ): Collection {
        return CropSeason::query()
            ->whereHas('parcel', fn (Builder $q) => $q->where('farmer_id', $farmerId))
            ->where('crop_id', $cropId)
            ->where('season', $seasonType)
            ->whereNotNull('yield_kg')
            ->whereNotNull('harvest_date')
            ->when($before, fn (Builder $q, $date) => $q->where('harvest_date', '<', $date))
            ->orderByDesc('harvest_date')
            ->get()
            ->reject(fn (CropSeason $s) => $this->isCalamityAffected($s))
            ->filter(fn (CropSeason $s) => $this->actualYield($s) !== null)
            ->values();
    }

    /**
     * Predicted yield per hectare.
     *
     * The weighted average of up to three past seasons, most recent weighted
     * heaviest. With fewer than three the weights used are renormalised by
     * their own sum, so two seasons give (0.5*Y1 + 0.3*Y2) / 0.8 rather than a
     * figure quietly dragged toward zero by a missing term.
     *
     * With none at all it falls back to the barangay's area-weighted actual
     * yield for the same crop and season, then the municipality's. Both are
     * reported as 'baseline' confidence and name which fallback was used,
     * because a figure drawn from other people's fields is a different kind of
     * claim from one drawn from your own.
     *
     * @return array{yield_kg_ha: float|null, confidence: string|null, basis: string|null, records: int, reason: string|null}
     */
    public function predictYield(
        int $farmerId,
        int $cropId,
        string $seasonType,
        ?string $barangay = null,
        ?string $before = null,
    ): array {
        $history = $this->pastSeasons($farmerId, $cropId, $seasonType, $before);

        $yields = $history
            ->take(3)
            ->map(fn (CropSeason $s) => $this->actualYield($s))
            ->values();

        if ($yields->isNotEmpty()) {
            return [
                'yield_kg_ha' => $this->weightedAverage($yields),
                'confidence'  => match ($yields->count()) {
                    3 => self::CONFIDENCE_HIGH,
                    2 => self::CONFIDENCE_MEDIUM,
                    default => self::CONFIDENCE_LOW,
                },
                'basis'   => self::BASIS_FARMER,
                'records' => $yields->count(),
                'reason'  => null,
            ];
        }

        // No history of their own. Fall back, widest last.
        if ($barangay !== null && $barangay !== '') {
            $local = $this->aggregateActualYield($cropId, $seasonType, $barangay);

            if ($local !== null) {
                return [
                    'yield_kg_ha' => $local,
                    'confidence'  => self::CONFIDENCE_BASELINE,
                    'basis'       => self::BASIS_BARANGAY,
                    'records'     => 0,
                    'reason'      => null,
                ];
            }
        }

        $municipal = $this->aggregateActualYield($cropId, $seasonType, null);

        if ($municipal !== null) {
            return [
                'yield_kg_ha' => $municipal,
                'confidence'  => self::CONFIDENCE_BASELINE,
                'basis'       => self::BASIS_MUNICIPAL,
                'records'     => 0,
                'reason'      => null,
            ];
        }

        return [
            'yield_kg_ha' => null,
            'confidence'  => null,
            'basis'       => null,
            'records'     => 0,
            'reason'      => 'No recorded harvest of this crop in this season type, for this farmer, '
                . 'their barangay, or the municipality.',
        ];
    }

    /**
     * Weighted average of up to three yields, newest first.
     *
     * Divided by the sum of the weights actually used. With all three present
     * that divisor is 1.0 and this is the plain weighted sum.
     */
    private function weightedAverage(Collection $yields): ?float
    {
        $weights = array_slice(
            (array) config('yield_prediction.weights', [0.5, 0.3, 0.2]),
            0,
            $yields->count(),
        );

        $divisor = array_sum($weights);

        if ($divisor <= 0.0) {
            return null;
        }

        $total = 0.0;
        foreach ($yields->values() as $i => $value) {
            $total += ($weights[$i] ?? 0.0) * (float) $value;
        }

        return round($total / $divisor, 2);
    }

    /**
     * Total kilograms a season is expected to produce.
     *
     * Null when either side is unknown, so an unpredictable parcel contributes
     * nothing to a total rather than contributing a confident zero.
     */
    public function predictedHarvest(?float $yieldPerHa, ?float $expectedAreaHa): ?float
    {
        if ($yieldPerHa === null || $expectedAreaHa === null || $expectedAreaHa <= 0.0) {
            return null;
        }

        return round($yieldPerHa * $expectedAreaHa, 2);
    }

    /** Predicted total for one season record, reading its own expected area. */
    public function predictedHarvestFor(CropSeason $season, ?float $yieldPerHa): ?float
    {
        return $this->predictedHarvest($yieldPerHa, $this->expectedArea($season));
    }

    /**
     * Area-weighted actual yield for a crop and season type.
     *
     * SUM(kilograms) / SUM(hectares) — never the mean of each farmer's yield.
     * Averaging ratios would let a tenth of a hectare count for as much as
     * fifty, which is how a barangay figure ends up describing nobody.
     *
     * Calamity seasons are excluded for the same reason they are excluded from
     * the moving average: they describe the weather, not the farming.
     */
    public function aggregateActualYield(
        int $cropId,
        string $seasonType,
        ?string $barangay = null,
        ?int $year = null,
    ): ?float {
        $seasons = CropSeason::query()
            ->where('crop_id', $cropId)
            ->where('season', $seasonType)
            ->whereNotNull('yield_kg')
            ->when($year, fn (Builder $q, $y) => $q->where('cropping_year', $y))
            ->when(
                $barangay,
                fn (Builder $q, $b) => $q->whereHas('parcel', fn (Builder $p) => $p->where('barangay', $b)),
            )
            ->get()
            ->reject(fn (CropSeason $s) => $this->isCalamityAffected($s));

        $kilograms = 0.0;
        $hectares = 0.0;

        foreach ($seasons as $season) {
            $area = $this->harvestedArea($season);

            // A row without an area cannot contribute to a per-hectare figure,
            // and counting its kilograms alone would inflate the result.
            if ($area === null || ! $this->isKilograms($season)) {
                continue;
            }

            $kilograms += (float) $season->yield_kg;
            $hectares += $area;
        }

        return $hectares > 0.0 ? round($kilograms / $hectares, 2) : null;
    }

    /**
     * Area-weighted PREDICTED yield across a set of predictions.
     *
     * Same rule as the actual aggregate: total predicted kilograms over total
     * expected hectares. Each entry needs `predicted_harvest_kg` and
     * `expected_harvested_area_ha`; entries missing either are skipped rather
     * than counted as zero.
     */
    public function aggregatePredictedYield(iterable $predictions): ?float
    {
        $kilograms = 0.0;
        $hectares = 0.0;

        foreach ($predictions as $row) {
            $kg = $row['predicted_harvest_kg'] ?? null;
            $ha = $row['expected_harvested_area_ha'] ?? null;

            if ($kg === null || $ha === null || (float) $ha <= 0.0) {
                continue;
            }

            $kilograms += (float) $kg;
            $hectares += (float) $ha;
        }

        return $hectares > 0.0 ? round($kilograms / $hectares, 2) : null;
    }

    /**
     * How far short of the prediction the harvest came, as a percentage.
     *
     * Positive means the farm produced LESS than predicted. Measured against
     * the prediction, because the question being asked is "how far off was
     * what we expected", not "how far off was what happened".
     */
    public function yieldGapPercent(?float $predictedYield, ?float $actualYield): ?float
    {
        if ($predictedYield === null || $actualYield === null || $predictedYield == 0.0) {
            return null;
        }

        return round((($predictedYield - $actualYield) / $predictedYield) * 100, 2);
    }

    /**
     * Should this farmer be looked at, and why.
     *
     * The reason matters more than the flag. A shortfall in a calamity season
     * calls for calamity assistance; the same shortfall in an ordinary season
     * is a question about practice, and training is the answer. Recommending
     * training to someone whose field was under water would be both useless
     * and insulting.
     *
     * NOT a determination of eligibility. It says who is worth reviewing;
     * authorised Municipal Agriculture Office staff decide the rest.
     *
     * @return array{flagged: bool, gap_percent: float|null, reason: string|null, threshold: float}
     */
    public function assessmentFlag(
        ?float $predictedYield,
        ?float $actualYield,
        bool $calamityAffected = false,
    ): array {
        $threshold = (float) config('yield_prediction.yield_gap_threshold_percent', 20);
        $gap = $this->yieldGapPercent($predictedYield, $actualYield);

        if ($gap === null) {
            return ['flagged' => false, 'gap_percent' => null, 'reason' => null, 'threshold' => $threshold];
        }

        $flagged = $gap > $threshold;

        return [
            'flagged'     => $flagged,
            'gap_percent' => $gap,
            // The gap is still reported for a calamity season — it is real —
            // but it is not evidence about the farmer.
            'reason'      => $flagged ? ($calamityAffected ? 'calamity' : 'performance') : null,
            'threshold'   => $threshold,
        ];
    }

    /**
     * How wrong one prediction turned out to be, as a percentage of the actual.
     *
     * Absolute: a forecast 200 kg over is as wrong as one 200 kg under, and
     * letting them cancel would make a wildly inaccurate method look perfect
     * on average. Undefined against a zero harvest, which is a total loss and
     * not something a percentage describes.
     */
    public function errorPercent(?float $predictedHarvest, ?float $actualHarvest): ?float
    {
        if ($predictedHarvest === null || $actualHarvest === null || $actualHarvest == 0.0) {
            return null;
        }

        return round(abs($predictedHarvest - $actualHarvest) / $actualHarvest * 100, 2);
    }

    /**
     * Mean absolute percentage error across many predictions.
     *
     * Pairs that cannot be scored are skipped, not counted as zero error —
     * padding with zeroes would make a method look more accurate the less of
     * it could be checked.
     *
     * @param  iterable<array{predicted: float|null, actual: float|null}>  $pairs
     */
    public function mape(iterable $pairs): ?float
    {
        $errors = [];

        foreach ($pairs as $pair) {
            $error = $this->errorPercent($pair['predicted'] ?? null, $pair['actual'] ?? null);

            if ($error !== null) {
                $errors[] = $error;
            }
        }

        return $errors === [] ? null : round(array_sum($errors) / count($errors), 2);
    }
}
