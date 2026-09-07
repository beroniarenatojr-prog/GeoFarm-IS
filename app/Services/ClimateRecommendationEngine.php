<?php

namespace App\Services;

/**
 * Turns the factors a risk score found into things a farmer can act on.
 *
 * Kept apart from ClimateRiskScorer because they answer different questions -
 * what the risk is, and what to do about it - and because the office will
 * revise the advice far more often than the scoring rules. Separate classes
 * mean editing one does not risk the other.
 *
 * The wording lives in config/climate_risk.php, is drafted rather than
 * approved, and stays deliberately general: nothing names a variety, a
 * chemical, a rate or a schedule. Those are decisions for an agriculturist who
 * has seen the land, and issuing them from a questionnaire would be technical
 * advice with no basis behind it.
 *
 * A recommendation only ever appears because a specific stated factor was
 * found true, so any line shown can be traced back to the condition and the
 * figures that raised it.
 */
class ClimateRecommendationEngine
{
    /**
     * @param  array  $factors  as produced by ClimateRiskScorer
     * @return array<int, array{key: string, text: string}>
     */
    public function for(array $factors): array
    {
        $advice = config('climate_risk.recommendations');

        $matched = [];

        foreach ($factors as $factor) {
            $key = $factor['key'] ?? null;

            if ($key !== null && isset($advice[$key])) {
                $matched[] = ['key' => $key, 'text' => $advice[$key]];
            }
        }

        // A farmer at lower risk still gets advice. The assessment exists to
        // say what to do next, not only to warn - and a clean result with an
        // empty list would read as the system having nothing to offer.
        if ($matched === []) {
            return array_map(
                fn (string $text, int $i) => ['key' => 'baseline_' . $i, 'text' => $text],
                config('climate_risk.baseline_recommendations'),
                array_keys(config('climate_risk.baseline_recommendations')),
            );
        }

        return $matched;
    }
}
