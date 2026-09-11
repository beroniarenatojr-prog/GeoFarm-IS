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
 * The way in to assessing a second parcel.
 *
 * A farmer with two parcels saw one risk figure and one "Update assessment"
 * button, and reasonably concluded there was no way to assess the other one.
 * The scoping worked; nothing on the page led to it.
 *
 * These hold the two things that fix that: the dashboard lists every activity
 * with its own state, and each row links into the questionnaire with that
 * activity already chosen.
 */
class FarmerDashboardActivitiesTest extends TestCase
{
    use RefreshDatabase;

    private User $account;
    private Farmer $farmer;

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

    private function dashboard()
    {
        return $this->actingAs($this->account)->get('/farmer/dashboard');
    }

    public function test_every_activity_is_listed_with_its_own_state(): void
    {
        $this->rice();
        $this->carabao();

        Fishpond::create([
            'farmer_id' => $this->farmer->id, 'species' => 'Tilapia',
            'pond_type' => 'freshwater', 'area_hectares' => 0.5,
        ]);

        $this->dashboard()
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('assessable', 3)
                ->where('assessable.0.commodity', 'Rice')
                ->where('assessable.0.scope', ClimateRiskAssessment::SCOPE_PARCEL)
                ->where('assessable.1.commodity', 'Carabao')
                ->where('assessable.1.scope', ClimateRiskAssessment::SCOPE_LIVESTOCK)
                ->where('assessable.2.scope', ClimateRiskAssessment::SCOPE_AQUACULTURE));
    }

    public function test_an_unassessed_parcel_says_so(): void
    {
        $this->rice();
        $this->carabao();

        $this->dashboard()->assertInertia(fn ($page) => $page
            ->where('assessable.0.own_assessment', false)
            ->where('assessable.0.covered_by_general', false)
            ->where('assessable.0.risk_level', null));
    }

    public function test_a_parcel_with_its_own_assessment_shows_its_own_level(): void
    {
        $rice = $this->rice();
        $this->carabao();

        ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id,
            'scope_type' => ClimateRiskAssessment::SCOPE_PARCEL,
            'farm_parcel_id' => $rice->id,
            'assessed_at' => now(),
            'risk_level' => 'high', 'risk_score' => 70,
        ]);

        $this->dashboard()->assertInertia(fn ($page) => $page
            ->where('assessable.0.own_assessment', true)
            ->where('assessable.0.risk_level', 'high')
            // The carabao was never asked about, and must not borrow it.
            ->where('assessable.1.own_assessment', false)
            ->where('assessable.1.risk_level', null));
    }

    public function test_a_general_assessment_reads_as_covering_rather_than_assessing(): void
    {
        // A whole-farm assessment does say something about every activity, but
        // it is not an assessment OF this parcel — and treating the two as the
        // same is what let a rice answer stand in for a carabao.
        $this->rice();

        ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id,
            'scope_type' => ClimateRiskAssessment::SCOPE_FARMER,
            'assessed_at' => now(),
            'risk_level' => 'low', 'risk_score' => 5,
        ]);

        $this->dashboard()->assertInertia(fn ($page) => $page
            ->where('assessable.0.own_assessment', false)
            ->where('assessable.0.covered_by_general', true));
    }

    public function test_each_row_links_straight_into_the_questionnaire(): void
    {
        $carabao = $this->carabao();

        $this->dashboard()->assertInertia(fn ($page) => $page
            ->where('assessable.0.assess_url', "/farmer/risk-assessment?scope=livestock&activity={$carabao->id}"));
    }

    // ------------------------------------------------- the link preselects

    public function test_the_link_opens_the_form_with_that_activity_chosen(): void
    {
        $carabao = $this->carabao();

        $this->actingAs($this->account)
            ->get("/farmer/risk-assessment?scope=livestock&activity={$carabao->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('preselect.scope', 'livestock')
                ->where('preselect.farm_parcel_id', $carabao->id));
    }

    public function test_a_link_naming_another_farmers_parcel_preselects_nothing(): void
    {
        $this->rice();

        $other = Farmer::create([
            'first_name' => 'Mayumi', 'last_name' => 'Telan', 'sex' => 'Female',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
        $theirs = $other->parcels()->create(['barangay' => 'Antagan', 'total_area_ha' => 9, 'commodity' => 'Corn']);

        $this->actingAs($this->account)
            ->get("/farmer/risk-assessment?scope=parcel&activity={$theirs->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('preselect', null));
    }

    public function test_a_nonsense_link_preselects_nothing_rather_than_failing(): void
    {
        $this->rice();

        foreach (['?scope=banana&activity=1', '?scope=parcel&activity=abc', '?scope=farmer&activity=1'] as $query) {
            $this->actingAs($this->account)
                ->get("/farmer/risk-assessment{$query}")
                ->assertOk()
                ->assertInertia(fn ($page) => $page->where('preselect', null));
        }
    }

    public function test_a_farmer_with_nothing_recorded_sees_an_empty_list(): void
    {
        $this->dashboard()->assertOk()->assertInertia(fn ($page) => $page->has('assessable', 0));
    }
}
