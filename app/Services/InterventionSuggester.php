<?php

namespace App\Services;

/**
 * What the office might do about a risk factor.
 *
 * The third link in one chain, and deliberately a separate sentence from the
 * second:
 *
 *   factor          frequent_flooding
 *   recommendation  "inspect and improve drainage"   → the farmer's job
 *   intervention    "visit the farm, assess drainage" → the office's job
 *
 * Collapsing those two would let a page tell a farmer to do something and then
 * report it as work the office had in hand, which is precisely the confusion
 * this whole feature exists to prevent.
 *
 * It suggests and never acts. Nothing here writes a row: a suggestion becomes
 * real work only when a staff member opens it. A service that filled its own
 * queue would produce farm visits nobody agreed to make, and a queue nobody
 * trusts is worse than no queue.
 *
 * A factor with no configured plan yields nothing at all. That is the honest
 * answer for a condition the office has not yet decided how to act on, and far
 * better than defaulting everything to a generic visit.
 */
class InterventionSuggester
{
    /**
     * Suggested interventions for a set of risk factors, heaviest first.
     *
     * @param  array  $factors  as produced by ParcelRiskAnalyser or ClimateRiskScorer
     * @return array<int, array{factor_key: string, type: string, type_label: string,
     *                          icon: string, reason: string, priority: string, target_days: int}>
     */
    public function for(array $factors, ?string $scope = null): array
    {
        $plans = config('climate_risk.interventions');
        $types = config('climate_risk.intervention_types');

        // Heaviest factor first, so that when two factors want the same visit
        // the stronger evidence is the one recorded as its reason.
        usort($factors, fn ($a, $b) => ($b['weight'] ?? 0) <=> ($a['weight'] ?? 0));

        $suggestions = [];
        $seenTypes = [];

        foreach ($factors as $factor) {
            $key = $factor['key'] ?? null;

            if ($key === null || ! isset($plans[$key])) {
                continue;
            }

            /*
             * The activity's own plan where the office has written one.
             *
             * Assessing water access on a rice field is a different visit from
             * checking that a herd can drink. Falling back to the general plan
             * is safe because it was written for crops.
             */
            $plan = ($scope !== null ? config("climate_risk.scoped_interventions.{$key}.{$scope}") : null)
                ?? $plans[$key];

            $type = $plan['type'];

            // One visit per kind of visit. Two cost factors on one farm are
            // still one cost review; opening it twice is noise in the queue.
            if (isset($seenTypes[$type])) {
                continue;
            }

            $seenTypes[$type] = true;

            $priority = $this->priorityFor((int) ($factor['weight'] ?? 0));

            $suggestions[] = [
                'factor_key'  => $key,
                'factor_label' => $factor['label'] ?? null,
                'source'      => $factor['source'] ?? null,
                'type'        => $type,
                'type_label'  => $types[$type]['label'] ?? $type,
                'icon'        => $types[$type]['icon'] ?? '🏢',
                'reason'      => $plan['reason'],
                'priority'    => $priority,
                'target_days' => (int) config("climate_risk.intervention_target_days.{$priority}", 21),
            ];
        }

        return $suggestions;
    }

    /**
     * How soon this wants looking at, from the weight of the factor behind it.
     *
     * Derived from the weight rather than stated separately, because for the
     * office the two really are the same question: a condition the scheme
     * counts heavily is the one to reach first. The farmer-facing priority in
     * ClimateRecommendationEngine is stated instead, because there urgency and
     * contribution genuinely differ — a cheap, time-bound task can be worth
     * doing first even when it barely moves the score.
     */
    private function priorityFor(int $weight): string
    {
        return match (true) {
            $weight >= 20 => 'high',
            $weight >= 15 => 'medium',
            default       => 'low',
        };
    }
}
