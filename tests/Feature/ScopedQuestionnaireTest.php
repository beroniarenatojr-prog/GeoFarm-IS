<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\Farmer;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Choosing what you are assessing, and being asked the right questions.
 *
 * Before this, a farmer with a rice parcel and a carabao had one assessment
 * and no way to say which it described. They could not assess the second
 * activity at all — every submission landed on the whole farm.
 */
class ScopedQuestionnaireTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;
    private User $account;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        Crop::create(['crop_name' => 'Rice', 'category' => 'Cereal']);
        LivestockType::create(['type_name' => 'Carabao', 'category' => 'Large ruminant']);

        $this->account = tap(User::create([
            'name' => 'Renato', 'email' => 'renato@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        $this->farmer = Farmer::create([
            'first_name' => 'Renato', 'last_name' => 'Beronia', 'sex' => 'Male',
            'barangay' => 'Caligayan', 'user_id' => $this->account->id,
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function rice()
    {
        return $this->farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2,
            'commodity' => 'Rice', 'parcel_number' => '1',
        ]);
    }

    private function carabao()
    {
        return $this->farmer->parcels()->create([
            'barangay' => 'Antagan I', 'no_of_heads_trees' => 80,
            'commodity' => 'Carabao', 'parcel_number' => '2',
        ]);
    }

    private function submit(array $payload)
    {
        return $this->actingAs($this->account)->post('/farmer/risk-assessment', $payload);
    }

    // ------------------------------------------------------- choosing a scope

    public function test_the_form_offers_the_farmers_own_activities(): void
    {
        $this->rice();
        $this->carabao();

        Fishpond::create([
            'farmer_id' => $this->farmer->id, 'species' => 'Tilapia',
            'pond_type' => 'freshwater', 'area_hectares' => 0.5,
        ]);

        $this->actingAs($this->account)
            ->get('/farmer/risk-assessment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('activities.parcel', 1)
                ->has('activities.livestock', 1)
                ->has('activities.aquaculture', 1)
                ->where('activities.parcel.0.commodity', 'Rice')
                ->where('activities.livestock.0.commodity', 'Carabao')
                ->where('activities.livestock.0.size.unit', 'heads')
                ->where('activities.aquaculture.0.commodity', 'Tilapia'));
    }

    public function test_another_farmers_activities_are_never_offered(): void
    {
        $this->rice();

        $other = Farmer::create([
            'first_name' => 'Mayumi', 'last_name' => 'Telan', 'sex' => 'Female',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
        $other->parcels()->create(['barangay' => 'Antagan', 'total_area_ha' => 9, 'commodity' => 'Corn']);

        $this->actingAs($this->account)
            ->get('/farmer/risk-assessment')
            ->assertInertia(fn ($page) => $page->has('activities.parcel', 1));
    }

    // ---------------------------------------------------------- submitting

    public function test_a_parcel_assessment_records_which_parcel(): void
    {
        $rice = $this->rice();

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_PARCEL,
            'farm_parcel_id' => $rice->id,
            'flood_frequency' => 'frequently',
        ])->assertRedirect();

        $assessment = ClimateRiskAssessment::firstOrFail();

        $this->assertSame(ClimateRiskAssessment::SCOPE_PARCEL, $assessment->scope_type);
        $this->assertSame($rice->id, $assessment->farm_parcel_id);
        $this->assertTrue($assessment->is_scoped);
    }

    public function test_an_activity_scope_must_name_an_activity(): void
    {
        $this->rice();

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_PARCEL,
            'flood_frequency' => 'frequently',
        ])->assertSessionHasErrors('farm_parcel_id');
    }

    public function test_a_farmer_cannot_assess_land_that_is_not_theirs(): void
    {
        $other = Farmer::create([
            'first_name' => 'Mayumi', 'last_name' => 'Telan', 'sex' => 'Female',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
        $theirs = $other->parcels()->create(['barangay' => 'Antagan', 'total_area_ha' => 9, 'commodity' => 'Corn']);

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_PARCEL,
            'farm_parcel_id' => $theirs->id,
        ])->assertSessionHasErrors('farm_parcel_id');
    }

    public function test_a_whole_farm_assessment_keeps_no_activity_reference(): void
    {
        // A form switched back to "entire farm" after a parcel was picked must
        // not leave the parcel behind, or the record would claim to be about
        // land it was not written for.
        $rice = $this->rice();

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_FARMER,
            'farm_parcel_id' => $rice->id,
            'flood_frequency' => 'frequently',
        ])->assertRedirect();

        $assessment = ClimateRiskAssessment::firstOrFail();

        $this->assertSame(ClimateRiskAssessment::SCOPE_FARMER, $assessment->scope_type);
        $this->assertNull($assessment->farm_parcel_id);
    }

    public function test_an_aquaculture_assessment_holds_a_pond_and_not_a_parcel(): void
    {
        $rice = $this->rice();

        $pond = Fishpond::create([
            'farmer_id' => $this->farmer->id, 'species' => 'Tilapia',
            'pond_type' => 'freshwater', 'area_hectares' => 0.5,
        ]);

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_AQUACULTURE,
            'fishpond_id' => $pond->id,
            'farm_parcel_id' => $rice->id,
        ])->assertRedirect();

        $assessment = ClimateRiskAssessment::firstOrFail();

        $this->assertSame($pond->id, $assessment->fishpond_id);
        $this->assertNull($assessment->farm_parcel_id);
    }

    // ------------------------------------------------- scope-aware answers

    public function test_a_livestock_assessment_refuses_a_crop_only_answer(): void
    {
        // Hiding seed cost on screen is not enough — a direct post would still
        // store it, and a livestock record holding a seed-cost answer is the
        // mixing scoping exists to prevent.
        $carabao = $this->carabao();

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_LIVESTOCK,
            'farm_parcel_id' => $carabao->id,
            'anticipated_factors' => ['seed_cost'],
        ])->assertSessionHasErrors('anticipated_factors.0');
    }

    public function test_a_livestock_assessment_accepts_a_livestock_answer(): void
    {
        $carabao = $this->carabao();

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_LIVESTOCK,
            'farm_parcel_id' => $carabao->id,
            'loss_types' => ['livestock_death'],
            'anticipated_factors' => ['extreme_heat'],
        ])->assertSessionHasNoErrors();

        $this->assertSame(['livestock_death'], ClimateRiskAssessment::firstOrFail()->loss_types);
    }

    public function test_a_crop_assessment_still_accepts_every_crop_answer(): void
    {
        $rice = $this->rice();

        $this->submit([
            'scope_type' => ClimateRiskAssessment::SCOPE_PARCEL,
            'farm_parcel_id' => $rice->id,
            'anticipated_factors' => ['seed_cost', 'fertilizer_cost'],
            'loss_types' => ['reduced_yield'],
        ])->assertSessionHasNoErrors();
    }

    public function test_the_narrowing_is_defined_once_for_form_and_validator(): void
    {
        $allowed = ClimateRiskAssessment::optionsFor(
            ClimateRiskAssessment::SCOPE_LIVESTOCK,
            'anticipated_factors',
            ClimateRiskAssessment::ANTICIPATED_FACTORS,
        );

        $this->assertNotContains('seed_cost', $allowed);
        $this->assertContains('extreme_heat', $allowed);

        // A question nobody narrowed keeps its full list.
        $this->assertSame(
            ClimateRiskAssessment::FREQUENCIES,
            ClimateRiskAssessment::optionsFor(
                ClimateRiskAssessment::SCOPE_LIVESTOCK,
                'flood_frequency',
                ClimateRiskAssessment::FREQUENCIES,
            ),
        );
    }

    public function test_a_crop_only_question_is_not_asked_of_livestock(): void
    {
        $this->assertContains('season_comparison', ClimateRiskAssessment::hiddenFor(ClimateRiskAssessment::SCOPE_LIVESTOCK));
        $this->assertSame([], ClimateRiskAssessment::hiddenFor(ClimateRiskAssessment::SCOPE_PARCEL));
    }

    public function test_an_unrecognised_scope_is_refused(): void
    {
        $this->rice();

        $this->submit(['scope_type' => 'something_invented'])->assertSessionHasErrors('scope_type');
    }
}
