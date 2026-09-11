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
 *
 * Each line also carries a title, a category and a priority. That is
 * presentation and nothing more - it decides what leads the page, never what
 * the score is, which band was reached, or whether a recommendation appears.
 * A farmer handed nine equal-looking instructions acts on none of them.
 */
class ClimateRecommendationEngine
{
    /** Ranked highest first when ordering the list. */
    private const PRIORITY_RANK = ['high' => 3, 'medium' => 2, 'low' => 1];

    /**
     * @param  array  $factors  as produced by ClimateRiskScorer or ParcelRiskAnalyser
     * @return array<int, array{key: string, title: string, text: string, category: string,
     *                          category_label: string, icon: string, priority: string}>
     */
    public function for(array $factors, ?string $scope = null): array
    {
        $advice = config('climate_risk.recommendations');
        $meta   = config('climate_risk.recommendation_meta');

        $matched = [];

        foreach ($factors as $factor) {
            $key = $factor['key'] ?? null;

            if ($key === null || ! isset($advice[$key])) {
                continue;
            }

            $for = $meta[$key] ?? [];

            $matched[] = $this->present(
                key: $key,
                title: $for['title'] ?? $key,
                /*
                 * The activity's own wording where the office has written one.
                 *
                 * "No water" on a rice parcel is about irrigating a field; on
                 * a carabao it is about the animals drinking. Falling back to
                 * the general line is safe because that line was written for
                 * crops — the map above holds only what genuinely differs.
                 */
                text: $this->wordingFor($key, $scope) ?? $advice[$key],
                category: $for['category'] ?? 'assistance',
                priority: $for['priority'] ?? 'medium',
                weight: (int) ($factor['weight'] ?? 0),
            );
        }

        // A farmer at lower risk still gets advice. The assessment exists to
        // say what to do next, not only to warn - and a clean result with an
        // empty list would read as the system having nothing to offer.
        if ($matched === []) {
            return $this->baseline();
        }

        /*
         * Stated priority first, then how much the factor actually contributed.
         *
         * The two are separate on purpose: urgency and contribution are not the
         * same thing, and a smaller weight can still be the thing to do first
         * if it is cheap and time-bound. The weight only breaks ties.
         */
        usort($matched, fn ($a, $b) => [self::PRIORITY_RANK[$b['priority']] ?? 0, $b['weight']]
            <=> [self::PRIORITY_RANK[$a['priority']] ?? 0, $a['weight']]);

        return $matched;
    }

    /**
     * The few actions that lead the result.
     *
     * Everything else stays available behind "view all" rather than being
     * discarded - the office may still want the full list.
     */
    public function topOf(array $recommendations, ?int $limit = null): array
    {
        return array_slice($recommendations, 0, $limit ?? (int) config('climate_risk.top_actions', 3));
    }

    /** The activity's own wording for a factor, or null to use the general one. */
    private function wordingFor(string $key, ?string $scope): ?string
    {
        if ($scope === null) {
            return null;
        }

        return config("climate_risk.scoped_recommendations.{$key}.{$scope}");
    }

    /**
     * Advice that exists because the records do not.
     *
     * A farm nobody has recorded is not a risky farm, but it is one nothing
     * can yet be said about — and saying that plainly is more use than
     * silence. Worded per activity, because what needs recording differs.
     *
     * Deliberately separate from for(): this is not a factor, carries no
     * weight, and must never reach the scorer. It is advice about the record,
     * not about the farm.
     */
    public function forMissingEvidence(string $kind): ?array
    {
        $item = config("climate_risk.evidence_recommendations.{$kind}");

        if (! $item) {
            return null;
        }

        return $this->present(
            key: "missing_evidence_{$kind}",
            title: $item['title'],
            text: $item['text'],
            category: $item['category'],
            // Low: there is nothing wrong to put right, only something to
            // start writing down.
            priority: 'low',
            weight: 0,
        );
    }

    /** Maintenance advice, shown when nothing was raised against the farm. */
    private function baseline(): array
    {
        $items = [];

        foreach (config('climate_risk.baseline_recommendations') as $i => $item) {
            $items[] = $this->present(
                key: 'baseline_' . $i,
                title: $item['title'],
                text: $item['text'],
                category: $item['category'],
                // Low, not medium: there is nothing wrong to put right, and
                // marking upkeep as urgent would drain the word of meaning on
                // the results that genuinely are.
                priority: 'low',
                weight: 0,
            );
        }

        return $items;
    }

    private function present(
        string $key,
        string $title,
        string $text,
        string $category,
        string $priority,
        int $weight,
    ): array {
        $known = config('climate_risk.categories');

        return [
            'key'            => $key,
            'title'          => $title,
            'text'           => $text,
            'category'       => $category,
            'category_label' => $known[$category]['label'] ?? 'Agricultural Assistance',
            'icon'           => $known[$category]['icon'] ?? '🏢',
            'priority'       => $priority,
            'weight'         => $weight,
        ];
    }
}
