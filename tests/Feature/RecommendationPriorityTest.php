<?php

namespace Tests\Feature;

use App\Services\ClimateRecommendationEngine;
use Tests\TestCase;

/**
 * Advice a farmer can act on, in the order worth acting.
 *
 * The engine already refused to invent anything: a line appears only because a
 * named factor was found true, and the wording lives in config for the office
 * to revise. What it could not do was rank — nine recommendations of equal
 * apparent weight is a list nobody works through, so the interface needs to
 * know which three come first.
 *
 * Priority is presentation. It changes what leads the page; it never changes a
 * score, a band, or whether a recommendation appears at all.
 */
class RecommendationPriorityTest extends TestCase
{
    private function engine(): ClimateRecommendationEngine
    {
        return app(ClimateRecommendationEngine::class);
    }

    private function factor(string $key, int $weight = 10): array
    {
        return ['key' => $key, 'weight' => $weight, 'label' => 'x'];
    }

    public function test_each_recommendation_carries_a_title_category_and_priority(): void
    {
        $items = $this->engine()->for([$this->factor('frequent_flooding', 15)]);

        $this->assertCount(1, $items);

        $item = $items[0];

        $this->assertSame('frequent_flooding', $item['key']);
        $this->assertSame('high', $item['priority']);
        $this->assertSame('water', $item['category']);
        $this->assertNotEmpty($item['title']);
        $this->assertNotEmpty($item['text']);
        $this->assertNotEmpty($item['category_label']);
    }

    public function test_high_priority_actions_come_before_medium(): void
    {
        $items = $this->engine()->for([
            $this->factor('no_adaptation', 10),        // medium
            $this->factor('frequent_flooding', 15),    // high
        ]);

        $this->assertSame(['frequent_flooding', 'no_adaptation'], array_column($items, 'key'));
    }

    public function test_within_a_priority_the_heavier_factor_leads(): void
    {
        // Both high priority; the one contributing more to the score first.
        $items = $this->engine()->for([
            $this->factor('yield_below_peers', 20),
            $this->factor('previous_season_loss', 30),
        ]);

        $this->assertSame('previous_season_loss', $items[0]['key']);
    }

    public function test_the_wording_still_comes_only_from_config(): void
    {
        $items = $this->engine()->for([$this->factor('declining_yield', 5)]);

        $this->assertSame(config('climate_risk.recommendations.declining_yield'), $items[0]['text']);
    }

    public function test_an_unknown_factor_produces_no_advice(): void
    {
        // Nothing is invented for a factor the office has not written wording
        // for — it simply does not appear.
        $items = $this->engine()->for([$this->factor('something_not_configured', 50)]);

        $this->assertSame(
            array_column(config('climate_risk.baseline_recommendations'), 'title'),
            array_column($items, 'title'),
            'Falls back to the baseline set, not to an invented line',
        );
    }

    public function test_a_clean_result_still_receives_maintenance_advice(): void
    {
        $items = $this->engine()->for([]);

        $this->assertNotEmpty($items);

        foreach ($items as $item) {
            $this->assertSame('low', $item['priority']);
            $this->assertNotEmpty($item['title']);
            $this->assertNotEmpty($item['category']);
        }
    }

    public function test_every_configured_factor_has_wording_and_presentation(): void
    {
        // A factor with a weight but no advice is a scored condition the farmer
        // is never told about; one with advice but no meta cannot be ranked.
        foreach (array_keys(config('climate_risk.weights')) as $key) {
            $this->assertArrayHasKey($key, config('climate_risk.recommendations'), "{$key} has no recommendation wording");
            $this->assertArrayHasKey($key, config('climate_risk.recommendation_meta'), "{$key} has no presentation metadata");
        }
    }

    public function test_every_recommendation_category_is_defined(): void
    {
        $categories = array_keys(config('climate_risk.categories'));

        foreach (config('climate_risk.recommendation_meta') as $key => $meta) {
            $this->assertContains($meta['category'], $categories, "{$key} uses an undefined category");
        }

        foreach (config('climate_risk.baseline_recommendations') as $item) {
            $this->assertContains($item['category'], $categories);
        }
    }
}
