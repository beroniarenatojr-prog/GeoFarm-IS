<?php

namespace Tests\Feature;

use App\Models\AgriculturalIntervention;
use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Crop;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\FinancialAssistance;
use App\Models\Fishpond;
use App\Models\FollowUp;
use App\Models\LivestockType;
use App\Models\Recommendation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Ownership, scope and idempotency for the agricultural support workflow.
 *
 * These pin the rules that stop one farmer's records being attached to
 * another's, and that stop a re-run of the analysis either duplicating advice
 * or undoing a decision staff have already made.
 *
 * Every rule is asserted at the MODEL layer, not through a controller, because
 * that is where it is enforced — a later controller that forgets a check must
 * still be unable to write a bad row.
 */
class WorkflowIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;
    private Farmer $other;

    protected function setUp(): void
    {
        parent::setUp();

        $this->farmer = $this->makeFarmer('Juan', 'Dela Cruz');
        $this->other  = $this->makeFarmer('Maria', 'Santos');
    }

    private function makeFarmer(string $first, string $last): Farmer
    {
        return Farmer::create([
            'first_name'          => $first,
            'last_name'           => $last,
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function makeParcel(Farmer $farmer, string $commodity, string $number = 'P-1'): FarmParcel
    {
        return FarmParcel::create([
            'farmer_id'     => $farmer->id,
            'parcel_number' => $number,
            'barangay'      => 'Caligayan',
            'total_area_ha' => 2.0,
            'commodity'     => $commodity,
        ]);
    }

    private function makePond(Farmer $farmer): Fishpond
    {
        return Fishpond::create([
            'farmer_id'     => $farmer->id,
            'species'       => 'Tilapia',
            'area_hectares' => 0.30,
        ]);
    }

    /** A commodity that CommodityCatalogue will resolve as livestock. */
    private function livestockCommodity(): string
    {
        return LivestockType::firstOrCreate(['type_name' => 'Carabao'], ['category' => 'Large Ruminant'])->type_name;
    }

    /** A commodity that CommodityCatalogue will resolve as a crop. */
    private function cropCommodity(): string
    {
        return Crop::firstOrCreate(['crop_name' => 'Rice'], ['category' => 'Cereal'])->crop_name;
    }

    private function baseRecommendation(array $overrides = []): array
    {
        return array_merge([
            'farmer_id'  => $this->farmer->id,
            'scope_type' => Recommendation::SCOPE_FARMER,
            'factor_key' => 'no_water',
            'title'      => 'Discuss water-management options with the Municipal Agriculture Office.',
            'reason'     => 'Farmer identified lack of water as the main adaptation barrier.',
            'priority'   => 'high',
        ], $overrides);
    }

    private function makeIntervention(Farmer $farmer): AgriculturalIntervention
    {
        return AgriculturalIntervention::create([
            'farmer_id' => $farmer->id,
            'type'      => 'farm_visit',
            'reason'    => 'Drought-related concern raised by the assessment.',
        ]);
    }

    private function makeDistribution(Farmer $farmer): AssistanceDistribution
    {
        $type = AssistanceType::firstOrCreate(
            ['type_name' => 'Seed Assistance'],
            ['category' => 'Production Support', 'distribution_type' => 'material']
        );

        $program = FinancialAssistance::create([
            'program_name'       => 'Seed Assistance 2026',
            'assistance_type_id' => $type->id,
            'status'             => 'active',
        ]);

        return AssistanceDistribution::create([
            'assistance_id'     => $program->id,
            'farmer_id'         => $farmer->id,
            'distribution_date' => now()->toDateString(),
        ]);
    }

    private function makeFollowUp(Farmer $farmer, array $overrides = []): FollowUp
    {
        return FollowUp::create(array_merge([
            'farmer_id'     => $farmer->id,
            'scheduled_for' => now()->addWeek()->toDateString(),
        ], $overrides));
    }

    // ---------------------------------------------------------------- 1

    public function test_recommendation_relationships_resolve(): void
    {
        $parcel       = $this->makeParcel($this->farmer, $this->cropCommodity());
        $intervention = $this->makeIntervention($this->farmer);

        $recommendation = Recommendation::create($this->baseRecommendation([
            'scope_type'      => Recommendation::SCOPE_PARCEL,
            'farm_parcel_id'  => $parcel->id,
            'intervention_id' => $intervention->id,
        ]));

        $this->assertTrue($recommendation->farmer->is($this->farmer));
        $this->assertTrue($recommendation->parcel->is($parcel));
        $this->assertTrue($recommendation->intervention->is($intervention));
        $this->assertNull($recommendation->fishpond);

        // The inverse sides, including the deliberately renamed one.
        $this->assertTrue($this->farmer->recommendationRecords->contains($recommendation));
        $this->assertTrue($intervention->recommendation->is($recommendation));
    }

    /** The JSON attribute must survive alongside the new relation. */
    public function test_assessment_json_recommendations_attribute_is_not_shadowed(): void
    {
        $assessment = $this->farmer->riskAssessments()->create([
            'scope_type'      => 'farmer',
            'recommendations' => [['title' => 'snapshot wording']],
        ]);

        $this->assertIsArray($assessment->fresh()->recommendations);
        $this->assertSame('snapshot wording', $assessment->fresh()->recommendations[0]['title']);

        Recommendation::create($this->baseRecommendation([
            'climate_risk_assessment_id' => $assessment->id,
        ]));

        // The attribute still returns the JSON, and the rows come from the relation.
        $this->assertIsArray($assessment->fresh()->recommendations);
        $this->assertCount(1, $assessment->fresh()->recommendationRecords);
    }

    // ---------------------------------------------------------------- 2, 3

    public function test_parcel_scope_accepts_the_farmers_own_parcel(): void
    {
        $parcel = $this->makeParcel($this->farmer, $this->cropCommodity());

        $recommendation = Recommendation::create($this->baseRecommendation([
            'scope_type'     => Recommendation::SCOPE_PARCEL,
            'farm_parcel_id' => $parcel->id,
        ]));

        $this->assertSame($parcel->id, $recommendation->farm_parcel_id);
    }

    public function test_parcel_scope_rejects_another_farmers_parcel(): void
    {
        $foreign = $this->makeParcel($this->other, $this->cropCommodity(), 'P-9');

        $this->expectException(ValidationException::class);

        Recommendation::create($this->baseRecommendation([
            'scope_type'     => Recommendation::SCOPE_PARCEL,
            'farm_parcel_id' => $foreign->id,
        ]));
    }

    // ---------------------------------------------------------------- 4, 5

    public function test_aquaculture_scope_accepts_the_farmers_own_pond(): void
    {
        $pond = $this->makePond($this->farmer);

        $recommendation = Recommendation::create($this->baseRecommendation([
            'scope_type'  => Recommendation::SCOPE_AQUACULTURE,
            'fishpond_id' => $pond->id,
        ]));

        $this->assertSame($pond->id, $recommendation->fishpond_id);
    }

    public function test_aquaculture_scope_rejects_another_farmers_pond(): void
    {
        $foreign = $this->makePond($this->other);

        $this->expectException(ValidationException::class);

        Recommendation::create($this->baseRecommendation([
            'scope_type'  => Recommendation::SCOPE_AQUACULTURE,
            'fishpond_id' => $foreign->id,
        ]));
    }

    // ---------------------------------------------------------------- 6

    public function test_farmer_scope_cannot_name_a_parcel(): void
    {
        $parcel = $this->makeParcel($this->farmer, $this->cropCommodity());

        $this->expectException(ValidationException::class);

        Recommendation::create($this->baseRecommendation([
            'scope_type'     => Recommendation::SCOPE_FARMER,
            'farm_parcel_id' => $parcel->id,
        ]));
    }

    public function test_farmer_scope_cannot_name_a_fishpond(): void
    {
        $pond = $this->makePond($this->farmer);

        $this->expectException(ValidationException::class);

        Recommendation::create($this->baseRecommendation([
            'scope_type'  => Recommendation::SCOPE_FARMER,
            'fishpond_id' => $pond->id,
        ]));
    }

    /** Livestock scope uses the existing CommodityCatalogue classification. */
    public function test_livestock_scope_accepts_a_livestock_parcel_and_rejects_a_crop_parcel(): void
    {
        $herd = $this->makeParcel($this->farmer, $this->livestockCommodity(), 'P-LIVE');
        $rice = $this->makeParcel($this->farmer, $this->cropCommodity(), 'P-RICE');

        $ok = Recommendation::create($this->baseRecommendation([
            'scope_type'     => Recommendation::SCOPE_LIVESTOCK,
            'farm_parcel_id' => $herd->id,
        ]));
        $this->assertSame($herd->id, $ok->farm_parcel_id);

        $this->expectException(ValidationException::class);

        Recommendation::create($this->baseRecommendation([
            'scope_type'     => Recommendation::SCOPE_LIVESTOCK,
            'farm_parcel_id' => $rice->id,
            'factor_key'     => 'different_factor',
        ]));
    }

    // ---------------------------------------------------------------- 7, 8

    public function test_follow_up_rejects_an_intervention_belonging_to_another_farmer(): void
    {
        $foreign = $this->makeIntervention($this->other);

        $this->expectException(ValidationException::class);

        $this->makeFollowUp($this->farmer, ['agricultural_intervention_id' => $foreign->id]);
    }

    public function test_follow_up_rejects_an_assistance_record_belonging_to_another_farmer(): void
    {
        $foreign = $this->makeDistribution($this->other);

        $this->expectException(ValidationException::class);

        $this->makeFollowUp($this->farmer, ['assistance_distribution_id' => $foreign->id]);
    }

    public function test_follow_up_rejects_a_parcel_belonging_to_another_farmer(): void
    {
        $foreign = $this->makeParcel($this->other, $this->cropCommodity(), 'P-9');

        $this->expectException(ValidationException::class);

        $this->makeFollowUp($this->farmer, ['farm_parcel_id' => $foreign->id]);
    }

    public function test_follow_up_accepts_its_own_farmers_records(): void
    {
        $intervention = $this->makeIntervention($this->farmer);
        $parcel       = $this->makeParcel($this->farmer, $this->cropCommodity());
        $distribution = $this->makeDistribution($this->farmer);

        $followUp = $this->makeFollowUp($this->farmer, [
            'agricultural_intervention_id' => $intervention->id,
            'assistance_distribution_id'   => $distribution->id,
            'farm_parcel_id'               => $parcel->id,
        ]);

        $this->assertTrue($followUp->intervention->is($intervention));
        $this->assertTrue($followUp->assistanceRecord->is($distribution));
        $this->assertTrue($followUp->parcel->is($parcel));
    }

    // ---------------------------------------------------------------- 9, 10, 11

    public function test_next_follow_up_must_belong_to_the_same_farmer(): void
    {
        $mine    = $this->makeFollowUp($this->farmer);
        $foreign = $this->makeFollowUp($this->other);

        $this->expectException(ValidationException::class);

        $mine->update(['next_follow_up_id' => $foreign->id]);
    }

    public function test_follow_up_cannot_point_at_itself(): void
    {
        $followUp = $this->makeFollowUp($this->farmer);

        $this->expectException(ValidationException::class);

        $followUp->update(['next_follow_up_id' => $followUp->id]);
    }

    public function test_circular_follow_up_chain_is_rejected(): void
    {
        $a = $this->makeFollowUp($this->farmer);
        $b = $this->makeFollowUp($this->farmer);
        $c = $this->makeFollowUp($this->farmer);

        $a->update(['next_follow_up_id' => $b->id]);
        $b->update(['next_follow_up_id' => $c->id]);

        // c -> a would close the loop a -> b -> c -> a.
        $this->expectException(ValidationException::class);

        $c->update(['next_follow_up_id' => $a->id]);
    }

    public function test_a_straight_chain_is_allowed(): void
    {
        $a = $this->makeFollowUp($this->farmer);
        $b = $this->makeFollowUp($this->farmer);

        $a->update(['next_follow_up_id' => $b->id]);

        $this->assertTrue($a->fresh()->next->is($b));
    }

    // ---------------------------------------------------------------- 12

    public function test_due_is_derived_and_never_stored(): void
    {
        $overdue = $this->makeFollowUp($this->farmer, [
            'scheduled_for' => now()->subDays(3)->toDateString(),
        ]);
        $upcoming = $this->makeFollowUp($this->farmer, [
            'scheduled_for' => now()->addDays(3)->toDateString(),
        ]);

        $this->assertTrue($overdue->is_due);
        $this->assertFalse($upcoming->is_due);

        // Stored status is untouched by being overdue.
        $this->assertSame(FollowUp::STATUS_SCHEDULED, $overdue->fresh()->status);

        // The scope agrees with the accessor.
        $this->assertTrue(FollowUp::due()->get()->contains($overdue));
        $this->assertFalse(FollowUp::due()->get()->contains($upcoming));

        // A completed check is never due, however old.
        $overdue->update(['status' => FollowUp::STATUS_COMPLETED, 'completed_at' => now()]);
        $this->assertFalse($overdue->fresh()->is_due);

        // 'due' cannot be written as a status, and there is no such column.
        $this->assertNotContains('due', FollowUp::STATUSES);
        $this->assertFalse(\Schema::hasColumn('follow_ups', 'due'));

        $this->expectException(ValidationException::class);
        $upcoming->update(['status' => 'due']);
    }

    // ---------------------------------------------------------------- 13, 14

    public function test_regenerating_the_same_advice_does_not_duplicate_it(): void
    {
        $attributes = $this->baseRecommendation();

        $first = Recommendation::remember($attributes);

        for ($run = 0; $run < 3; $run++) {
            Recommendation::remember($attributes);
        }

        $this->assertSame(1, Recommendation::count());
        $this->assertSame($first->id, Recommendation::first()->id);
    }

    public function test_a_rejected_recommendation_is_not_resurrected(): void
    {
        $attributes = $this->baseRecommendation();

        $original = Recommendation::remember($attributes);
        $original->update([
            'status'      => Recommendation::STATUS_REJECTED,
            'reviewed_at' => now(),
        ]);

        // The analysis runs again with identical inputs.
        $returned = Recommendation::remember($attributes);

        $this->assertSame($original->id, $returned->id);
        $this->assertSame(Recommendation::STATUS_REJECTED, $returned->fresh()->status);
        $this->assertSame(1, Recommendation::count());
    }

    public function test_the_snapshot_wording_is_not_rewritten_by_a_later_run(): void
    {
        $attributes = $this->baseRecommendation();
        $original   = Recommendation::remember($attributes);

        // Config wording is revised, and the analysis runs again.
        $revised = $attributes;
        $revised['title']    = 'Completely reworded advice.';
        $revised['priority'] = 'low';
        Recommendation::remember($revised);

        $this->assertSame(1, Recommendation::count());
        $this->assertSame($original->title, Recommendation::first()->title);
        $this->assertSame('high', Recommendation::first()->priority);
    }

    public function test_a_new_assessment_creates_a_new_snapshot(): void
    {
        $first  = $this->farmer->riskAssessments()->create(['scope_type' => 'farmer']);
        $second = $this->farmer->riskAssessments()->create(['scope_type' => 'farmer']);

        Recommendation::remember($this->baseRecommendation(['climate_risk_assessment_id' => $first->id]));
        Recommendation::remember($this->baseRecommendation(['climate_risk_assessment_id' => $second->id]));

        $this->assertSame(2, Recommendation::count());
    }

    public function test_fingerprints_do_not_collide_across_farmers(): void
    {
        // Same factor, no assessment behind it, two different farmers.
        Recommendation::remember($this->baseRecommendation());
        Recommendation::remember($this->baseRecommendation(['farmer_id' => $this->other->id]));

        $this->assertSame(2, Recommendation::count());
    }

    public function test_production_history_sufficiency_is_normalised(): void
    {
        $this->assertSame(
            Recommendation::SUFFICIENCY_INSUFFICIENT,
            Recommendation::normaliseSufficiency('none')
        );
        $this->assertSame('limited', Recommendation::normaliseSufficiency('limited'));
        $this->assertNull(Recommendation::normaliseSufficiency(null));
        $this->assertNull(Recommendation::normaliseSufficiency('made up'));
    }
}
