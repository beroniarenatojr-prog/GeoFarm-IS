<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Services\ClimateRiskScorer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The rule-based risk scorer.
 *
 * These pin the behaviour that matters for research defensibility: that a
 * score is only ever the sum of stated rules, that missing data raises no
 * factor, and that every result says which rules fired and under which
 * version of the weights.
 */
class ClimateRiskScorerTest extends TestCase
{
    use RefreshDatabase;

    private ClimateRiskScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scorer = app(ClimateRiskScorer::class);
    }

    private function assessment(array $answers = [], ?CropSeason $season = null): ClimateRiskAssessment
    {
        $farmer = Farmer::create(['first_name' => 'Test', 'last_name' => 'Farmer']);

        return new ClimateRiskAssessment(array_merge([
            'farmer_id'      => $farmer->id,
            'crop_season_id' => $season?->id,
        ], $answers));
    }

    private function losingSeason(): CropSeason
    {
        $farmer = Farmer::create(['first_name' => 'Test', 'last_name' => 'Farmer']);
        $parcel = $farmer->parcels()->create(['barangay' => 'San Pedro']);
        $crop   = Crop::create(['crop_name' => 'Rice ' . uniqid(), 'category' => 'Cereal']);

        return $parcel->seasons()->create([
            'season' => 'wet', 'cropping_year' => 2026, 'crop_id' => $crop->id,
            'area_planted_ha' => 2, 'yield_kg' => 1000,
            'harvest_date' => now()->subMonth(),
            'production_cost' => 90000, 'total_income' => 40000,
        ]);
    }

    public function test_an_empty_assessment_scores_zero_and_reads_low(): void
    {
        $result = $this->scorer->score($this->assessment());

        $this->assertSame(0, $result['score']);
        $this->assertSame(ClimateRiskScorer::LEVEL_LOW, $result['level']);
        $this->assertSame([], $result['factors']);
    }

    public function test_every_result_records_which_rules_produced_it(): void
    {
        $result = $this->scorer->score($this->assessment(['flood_frequency' => 'very_frequently']));

        $this->assertSame(config('climate_risk.version'), $result['version']);
        $this->assertSame('frequent_flooding', $result['factors'][0]['key']);
        $this->assertNotEmpty($result['factors'][0]['label']);
    }

    public function test_the_score_is_the_sum_of_the_configured_weights(): void
    {
        // Not a magic number: the test reads the same config the scorer does,
        // so revising a weight for the panel cannot silently break this.
        $weights = config('climate_risk.weights');

        $result = $this->scorer->score($this->assessment([
            'flood_frequency'    => 'frequently',
            'drought_frequency'  => 'very_frequently',
            'had_financial_loss' => 'yes',
        ]));

        $this->assertSame(
            $weights['frequent_flooding'] + $weights['frequent_drought'] + $weights['reported_financial_loss'],
            $result['score'],
        );
    }

    public function test_a_season_that_lost_money_raises_a_factor(): void
    {
        $season = $this->losingSeason();

        $result = $this->scorer->score($this->assessment([], $season)->load('season.parcel'));

        $this->assertContains('previous_season_loss', array_column($result['factors'], 'key'));
    }

    public function test_an_occasional_problem_is_not_scored(): void
    {
        $result = $this->scorer->score($this->assessment(['flood_frequency' => 'rarely']));

        $this->assertSame(0, $result['score']);
    }

    public function test_an_unanswered_adaptation_question_is_not_read_as_none(): void
    {
        // Leaving Q13 blank means the farmer did not answer. Scoring it as
        // "no adaptation practices" would penalise an incomplete form.
        $unanswered = $this->scorer->score($this->assessment(['adaptation_practices' => []]));
        $answeredNone = $this->scorer->score($this->assessment(['adaptation_practices' => ['none']]));

        $this->assertSame(0, $unanswered['score']);
        $this->assertContains('no_adaptation', array_column($answeredNone['factors'], 'key'));
    }

    public function test_peer_comparison_is_skipped_when_too_few_farms_are_comparable(): void
    {
        // An "average" drawn from one neighbour says nothing, and would attach
        // a factor to a farmer on the strength of a single other record.
        $season = $this->losingSeason();

        $result = $this->scorer->score($this->assessment([], $season)->load('season.parcel'));
        $keys = array_column($result['factors'], 'key');

        $this->assertNotContains('cost_per_kilo_above_peers', $keys);
        $this->assertNotContains('yield_below_peers', $keys);
    }

    public function test_the_bands_follow_the_configured_thresholds(): void
    {
        $bands = config('climate_risk.bands');
        $weights = config('climate_risk.weights');

        // Flood + drought + severe damage clears the moderate threshold.
        $moderate = $this->scorer->score($this->assessment([
            'flood_frequency' => 'frequently',
            'drought_frequency' => 'frequently',
        ]));

        $this->assertGreaterThanOrEqual($bands['moderate'], $moderate['score']);
        $this->assertSame(ClimateRiskScorer::LEVEL_MODERATE, $moderate['level']);
        $this->assertLessThan($bands['high'], $moderate['score']);
    }

    public function test_the_score_never_exceeds_one_hundred(): void
    {
        $season = $this->losingSeason();

        $result = $this->scorer->score($this->assessment([
            'flood_frequency'    => 'very_frequently',
            'drought_frequency'  => 'very_frequently',
            'worst_effect'       => 'total_loss',
            'adaptation_practices' => ['none'],
            'had_financial_loss' => 'yes',
        ], $season)->load('season.parcel'));

        $this->assertLessThanOrEqual(100, $result['score']);
        $this->assertSame(ClimateRiskScorer::LEVEL_HIGH, $result['level']);
    }
}
