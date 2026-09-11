<?php

namespace Tests\Feature;

use App\Services\ClimateRecommendationEngine;
use Tests\TestCase;

/**
 * What the system tells a farmer to do next.
 *
 * The wording itself is drafted and awaiting MAO review, so these do not test
 * phrasing. They pin the behaviour that must hold whatever the words become:
 * that advice only ever follows a stated factor, that a farmer at lower risk
 * still receives some, and that nothing is invented for a factor with no
 * guidance behind it.
 */
class ClimateRecommendationTest extends TestCase
{
    private ClimateRecommendationEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = app(ClimateRecommendationEngine::class);
    }

    public function test_a_factor_produces_its_matching_advice(): void
    {
        $advice = $this->engine->for([['key' => 'frequent_flooding', 'weight' => 15]]);

        $this->assertCount(1, $advice);
        $this->assertSame('frequent_flooding', $advice[0]['key']);
        $this->assertSame(config('climate_risk.recommendations.frequent_flooding'), $advice[0]['text']);
    }

    public function test_each_factor_contributes_its_own_line(): void
    {
        $advice = $this->engine->for([
            ['key' => 'frequent_flooding', 'weight' => 15],
            ['key' => 'no_adaptation', 'weight' => 10],
        ]);

        $this->assertSame(['frequent_flooding', 'no_adaptation'], array_column($advice, 'key'));
    }

    public function test_a_farmer_with_no_risk_factors_still_gets_advice(): void
    {
        // The assessment exists to say what to do next, not only to warn. An
        // empty list would read as the system having nothing to offer.
        $advice = $this->engine->for([]);

        $this->assertNotEmpty($advice);
        $this->assertSame(
            array_column(config('climate_risk.baseline_recommendations'), 'text'),
            array_column($advice, 'text'),
        );
    }

    public function test_a_factor_with_no_guidance_produces_nothing_rather_than_filler(): void
    {
        // If the scorer gains a factor before the office has written advice
        // for it, the honest result is silence - not a generic line implying
        // guidance that does not exist.
        $advice = $this->engine->for([['key' => 'a_factor_nobody_has_written_advice_for', 'weight' => 5]]);

        $this->assertSame(
            array_column(config('climate_risk.baseline_recommendations'), 'text'),
            array_column($advice, 'text'),
            'an unmatched factor should fall through to baseline advice, not invent its own',
        );
    }

    public function test_every_factor_the_scorer_can_emit_has_guidance(): void
    {
        // Guards the gap the previous test tolerates: each weighted factor
        // should have wording, so a real assessment never silently drops one.
        $scorable = array_keys(config('climate_risk.weights'));
        $written  = array_keys(config('climate_risk.recommendations'));

        $this->assertSame([], array_diff($scorable, $written),
            'these factors can be scored but have no recommendation written for them');
    }

    public function test_no_recommendation_prescribes_a_specific_treatment(): void
    {
        // The deliberate limit: naming a variety, chemical or rate would be
        // technical advice the system has no basis to give. Guidance points to
        // the office instead.
        $prescriptive = ['/\bapply \d/i', '/\bkg\/ha\b/i', '/\bbags per\b/i', '/\bspray\b/i'];

        foreach (config('climate_risk.recommendations') as $key => $text) {
            foreach ($prescriptive as $pattern) {
                $this->assertDoesNotMatchRegularExpression($pattern, $text,
                    "recommendation '{$key}' reads as a technical prescription");
            }
        }
    }
}
