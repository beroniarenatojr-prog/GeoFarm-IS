<?php

namespace App\Services;

use App\Models\ClimateRiskAssessment;
use App\Models\CropSeason;

/**
 * Works out how exposed a farming operation is to financial loss.
 *
 * This is a rule-based scorer, not a trained model. It sums the weights in
 * config/climate_risk.php for the conditions it finds true, and reports which
 * ones fired. There is no machine learning here and no probability: nothing
 * has been fitted against outcomes, so the number means "these stated rules
 * matched" and nothing more.
 *
 * It is built to be replaced. When a trained model exists it takes over this
 * class's job, and the stored results become the baseline it is measured
 * against - which is why every result records its scoring_version.
 *
 * Recorded history outweighs self-report throughout: a season that actually
 * lost money is stronger evidence than a recollection of how often it flooded.
 */
class ClimateRiskScorer
{
    public const LEVEL_LOW      = 'low';
    public const LEVEL_MODERATE = 'moderate';
    public const LEVEL_HIGH     = 'high';

    /**
     * @return array{level: string, score: int, factors: array, version: string}
     */
    public function score(ClimateRiskAssessment $assessment): array
    {
        $factors = array_merge(
            $this->fromRecordedSeasons($assessment),
            $this->fromQuestionnaire($assessment),
        );

        // Capped, because the weights are a draft: a farmer meeting every
        // condition should read as "as high as this goes", not as a number
        // whose size implies a precision the scheme does not have.
        $score = min(100, (int) array_sum(array_column($factors, 'weight')));

        return [
            'level'   => $this->band($score),
            'score'   => $score,
            'factors' => $factors,
            'version' => (string) config('climate_risk.version'),
        ];
    }

    private function band(int $score): string
    {
        $bands = config('climate_risk.bands');

        return match (true) {
            $score >= $bands['high']     => self::LEVEL_HIGH,
            $score >= $bands['moderate'] => self::LEVEL_MODERATE,
            default                      => self::LEVEL_LOW,
        };
    }

    /**
     * Factors drawn from what the office recorded, not from what was reported.
     *
     * All of these are silent when the underlying figures are missing. A farm
     * with no costed season is not low risk and not high risk - it is
     * unmeasured, and inventing a factor from absent data would put a farmer
     * in a band for having incomplete paperwork.
     */
    private function fromRecordedSeasons(ClimateRiskAssessment $assessment): array
    {
        $weights = config('climate_risk.weights');
        $limits  = config('climate_risk.thresholds');
        $factors = [];

        $season = $assessment->season;

        if (! $season) {
            return $factors;
        }

        if ($season->financial_outcome === CropSeason::OUTCOME_LOSS) {
            $factors[] = $this->factor(
                'previous_season_loss',
                $weights['previous_season_loss'],
                'The last recorded season did not cover its costs',
                ['net_farm_income' => $season->net_farm_income],
            );
        }

        $peers = $this->peerFigures($season);

        if ($peers !== null) {
            if ($season->cost_per_kg !== null && $peers['cost_per_kg'] > 0
                && $season->cost_per_kg >= $peers['cost_per_kg'] * $limits['cost_per_kilo_ratio']) {
                $factors[] = $this->factor(
                    'cost_per_kilo_above_peers',
                    $weights['cost_per_kilo_above_peers'],
                    'Production cost per kilo is well above other farms growing the same crop nearby',
                    ['this_farm' => $season->cost_per_kg, 'nearby_average' => $peers['cost_per_kg']],
                );
            }

            $yieldPerHa = $this->yieldPerHectare($season);

            if ($yieldPerHa !== null && $peers['yield_per_ha'] > 0
                && $yieldPerHa <= $peers['yield_per_ha'] * $limits['yield_ratio']) {
                $factors[] = $this->factor(
                    'yield_below_peers',
                    $weights['yield_below_peers'],
                    'Yield per hectare is below other farms growing the same crop nearby',
                    ['this_farm' => $yieldPerHa, 'nearby_average' => $peers['yield_per_ha']],
                );
            }
        }

        if ($this->yieldIsDeclining($season)) {
            $factors[] = $this->factor(
                'declining_yield',
                $weights['declining_yield'],
                'Yield per hectare has fallen across recent seasons on this parcel',
            );
        }

        return $factors;
    }

    /** Factors drawn from the questionnaire. */
    private function fromQuestionnaire(ClimateRiskAssessment $assessment): array
    {
        $weights = config('climate_risk.weights');
        $limits  = config('climate_risk.thresholds');
        $factors = [];

        $frequent = $limits['frequent_answers'];

        if (in_array($assessment->flood_frequency, $frequent, true)) {
            $factors[] = $this->factor('frequent_flooding', $weights['frequent_flooding'],
                'Flooding was reported as a frequent problem');
        }

        if (in_array($assessment->drought_frequency, $frequent, true)) {
            $factors[] = $this->factor('frequent_drought', $weights['frequent_drought'],
                'Drought or prolonged dry periods were reported as frequent');
        }

        if (in_array($assessment->worst_effect, $limits['severe_effects'], true)) {
            $factors[] = $this->factor('severe_climate_damage', $weights['severe_climate_damage'],
                'Climate events have caused severe or total loss of production');
        }

        // Only when the farmer answered the question. An unanswered Q13 is not
        // the same as answering "none", and must not be scored as though it were.
        $practices = $assessment->adaptation_practices;

        if (is_array($practices) && $practices !== []
            && $practices === [ClimateRiskAssessment::EXCLUSIVE_CHOICE]) {
            $factors[] = $this->factor('no_adaptation', $weights['no_adaptation'],
                'No climate adaptation practices are currently in use');
        }

        if ($assessment->had_financial_loss === 'yes') {
            $factors[] = $this->factor('reported_financial_loss', $weights['reported_financial_loss'],
                'The farmer reported financial loss from climate events',
                ['reported_amount' => $assessment->estimated_loss_amount]);
        }

        return $factors;
    }

    /**
     * The same crop, in the same barangay, from other farms.
     *
     * Null when too few comparable seasons exist. An "average" drawn from one
     * other farm says nothing, and would attach a factor to a farmer on the
     * strength of a single neighbour's record.
     */
    private function peerFigures(CropSeason $season): ?array
    {
        $barangay = $season->parcel?->barangay;

        if (! $barangay || ! $season->crop_id) {
            return null;
        }

        $peers = CropSeason::forVerifiedFarmers()
            ->where('crop_id', $season->crop_id)
            ->where('id', '!=', $season->id)
            ->whereHas('parcel', fn ($q) => $q->where('barangay', $barangay))
            ->whereNotNull('yield_kg')
            ->where('yield_kg', '>', 0)
            ->whereNotNull('area_planted_ha')
            ->where('area_planted_ha', '>', 0)
            ->get();

        if ($peers->count() < config('climate_risk.thresholds.minimum_peers')) {
            return null;
        }

        $costed = $peers->filter(fn ($p) => $p->production_cost !== null);

        return [
            'cost_per_kg'  => $costed->isEmpty() ? 0.0 : round(
                $costed->sum('production_cost') / max($costed->sum('yield_kg'), 1), 2
            ),
            'yield_per_ha' => round(
                $peers->sum('yield_kg') / max($peers->sum('area_planted_ha'), 1), 2
            ),
        ];
    }

    private function yieldPerHectare(CropSeason $season): ?float
    {
        if (! $season->yield_kg || ! $season->area_planted_ha) {
            return null;
        }

        return round((float) $season->yield_kg / (float) $season->area_planted_ha, 2);
    }

    /**
     * Whether this parcel's yield per hectare is going down.
     *
     * Compares the latest completed season against the one before it on the
     * same parcel. Deliberately simple: two points is the least that can show
     * a direction, and the office often has no more than that.
     */
    private function yieldIsDeclining(CropSeason $season): bool
    {
        $previous = CropSeason::where('parcel_id', $season->parcel_id)
            ->where('id', '!=', $season->id)
            ->whereNotNull('harvest_date')
            ->where('harvest_date', '<', $season->harvest_date)
            ->orderByDesc('harvest_date')
            ->first();

        if (! $previous) {
            return false;
        }

        $now  = $this->yieldPerHectare($season);
        $then = $this->yieldPerHectare($previous);

        return $now !== null && $then !== null && $now < $then;
    }

    /** One reason the score is what it is, with the figures behind it. */
    private function factor(string $key, int $weight, string $label, array $evidence = []): array
    {
        return array_filter([
            'key'      => $key,
            'weight'   => $weight,
            'label'    => $label,
            'evidence' => $evidence ?: null,
        ], fn ($value) => $value !== null);
    }
}
