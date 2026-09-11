<?php

namespace Tests\Feature;

use App\Models\AgriculturalIntervention;
use App\Services\InterventionSuggester;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What the office might do, as opposed to what the farmer is advised to do.
 *
 * Two different sentences from one factor: "improve drainage" is the farmer's
 * job; "visit the farm and assess drainage" is the office's. Keeping them
 * apart is the point of this class.
 *
 * It suggests and never acts. Nothing here writes a row — a suggestion becomes
 * real work only when a person opens it, because a system that filled its own
 * queue would record visits nobody agreed to make.
 */
class InterventionSuggesterTest extends TestCase
{
    use RefreshDatabase;

    private function suggester(): InterventionSuggester
    {
        return app(InterventionSuggester::class);
    }

    private function factor(string $key, int $weight = 15, string $source = 'assessment'): array
    {
        return ['key' => $key, 'weight' => $weight, 'label' => 'A stated condition', 'source' => $source];
    }

    public function test_a_water_factor_suggests_a_drainage_assessment(): void
    {
        $suggestions = $this->suggester()->for([$this->factor('frequent_flooding')]);

        $this->assertCount(1, $suggestions);
        $this->assertSame('drainage_assessment', $suggestions[0]['type']);
        $this->assertSame('frequent_flooding', $suggestions[0]['factor_key']);
        $this->assertNotEmpty($suggestions[0]['reason']);
        $this->assertNotEmpty($suggestions[0]['type_label']);
    }

    public function test_a_factor_the_office_has_no_plan_for_suggests_nothing(): void
    {
        // Better than defaulting everything to a farm visit, which would fill
        // the queue with work nobody decided on.
        $suggestions = $this->suggester()->for([$this->factor('a_factor_with_no_configured_intervention')]);

        $this->assertSame([], $suggestions);
    }

    public function test_no_factors_means_no_suggestions(): void
    {
        $this->assertSame([], $this->suggester()->for([]));
    }

    public function test_the_priority_follows_the_weight_of_the_factor_that_raised_it(): void
    {
        // A 30-weight recorded loss outranks a 10-weight self-report, and the
        // office's queue should reflect that ordering rather than invent one.
        $heavy = $this->suggester()->for([$this->factor('previous_season_loss', 30, 'history')]);
        $light = $this->suggester()->for([$this->factor('no_adaptation', 10)]);

        $this->assertSame('high', $heavy[0]['priority']);
        $this->assertSame('low', $light[0]['priority']);
    }

    public function test_suggestions_lead_with_the_heaviest_factor(): void
    {
        $suggestions = $this->suggester()->for([
            $this->factor('no_adaptation', 10),
            $this->factor('previous_season_loss', 30, 'history'),
            $this->factor('frequent_flooding', 15),
        ]);

        $this->assertSame(
            ['previous_season_loss', 'frequent_flooding', 'no_adaptation'],
            array_column($suggestions, 'factor_key'),
        );
    }

    public function test_the_same_intervention_type_is_not_suggested_twice(): void
    {
        // Two cost factors both point at a cost review. Opening two identical
        // visits for one farm is noise, so the heavier factor carries it.
        $suggestions = $this->suggester()->for([
            $this->factor('previous_season_loss', 30, 'history'),
            $this->factor('cost_per_kilo_above_peers', 20, 'history'),
        ]);

        $this->assertCount(1, $suggestions);
        $this->assertSame('previous_season_loss', $suggestions[0]['factor_key']);
    }

    public function test_a_suggested_target_date_reflects_its_priority(): void
    {
        $urgent = $this->suggester()->for([$this->factor('previous_season_loss', 30, 'history')])[0];
        $routine = $this->suggester()->for([$this->factor('no_adaptation', 10)])[0];

        $this->assertLessThan($routine['target_days'], $urgent['target_days']);
    }

    public function test_every_configured_intervention_names_a_defined_type(): void
    {
        $types = array_keys(config('climate_risk.intervention_types'));

        foreach (config('climate_risk.interventions') as $key => $plan) {
            $this->assertContains($plan['type'], $types, "{$key} points at an undefined intervention type");
            $this->assertNotEmpty($plan['reason'], "{$key} has no reason wording");
        }
    }

    public function test_a_suggestion_is_only_a_suggestion(): void
    {
        // Nothing is written. The office queue must only ever contain records
        // a person chose to open.
        $before = \App\Models\AgriculturalIntervention::count();

        $this->suggester()->for([$this->factor('frequent_flooding')]);

        $this->assertSame($before, \App\Models\AgriculturalIntervention::count());
    }
}
