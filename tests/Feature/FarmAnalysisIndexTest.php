<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Choosing whose farm to analyse.
 *
 * This replaces the Crop Estimator in the menu, so it has to answer the
 * question the office actually arrives with — which farmer — rather than
 * asking them to already know a hectare figure.
 *
 * The list has to be honest about the same thing every other screen in this
 * feature is: a farmer nobody has assessed is shown as unassessed, never as
 * low risk.
 */
class FarmAnalysisIndexTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        LivestockType::create(['type_name' => 'Cattle', 'category' => 'Large ruminant']);
    }

    private function admin(): User
    {
        return $this->staff ??= tap(User::create([
            'name' => 'Office Admin', 'email' => 'admin@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));
    }

    private function farmer(string $last, string $barangay = 'Caligayan', string $status = Farmer::STATUS_VERIFIED): Farmer
    {
        return Farmer::create([
            'first_name' => 'Test', 'last_name' => $last, 'sex' => 'Male',
            'barangay' => $barangay, 'verification_status' => $status,
        ]);
    }

    private function index(array $query = [])
    {
        $response = $this->actingAs($this->admin())->get(route('admin.analytics.farms', $query));

        $response->assertOk();

        return $response;
    }

    public function test_it_lists_verified_farmers_to_choose_from(): void
    {
        $this->farmer('Beronia');
        $this->farmer('Telan');

        $this->index()->assertInertia(fn ($page) => $page
            ->component('Admin/Analytics/FarmIndex')
            ->has('farmers.data', 2));
    }

    public function test_an_unverified_farmer_is_not_offered(): void
    {
        // Nothing recorded against a pending registration has been checked, so
        // analysing it would dress up unverified data as a finding.
        $this->farmer('Verified');
        $this->farmer('Pending', 'Caligayan', Farmer::STATUS_PENDING);

        $this->index()->assertInertia(fn ($page) => $page
            ->has('farmers.data', 1)
            ->where('farmers.data.0.name', 'Test Verified'));
    }

    public function test_a_farmer_can_be_found_by_name(): void
    {
        $this->farmer('Beronia');
        $this->farmer('Telan');

        $this->index(['search' => 'Telan'])->assertInertia(fn ($page) => $page
            ->has('farmers.data', 1)
            ->where('farmers.data.0.name', 'Test Telan'));
    }

    public function test_the_list_can_be_narrowed_to_a_barangay(): void
    {
        $this->farmer('Here', 'Caligayan');
        $this->farmer('Elsewhere', 'Antagan');

        $this->index(['barangay' => 'Antagan'])->assertInertia(fn ($page) => $page
            ->has('farmers.data', 1)
            ->where('farmers.data.0.barangay', 'Antagan'));
    }

    public function test_each_row_counts_what_there_is_to_analyse(): void
    {
        $farmer = $this->farmer('Beronia');

        $farmer->parcels()->create(['barangay' => 'Caligayan', 'total_area_ha' => 2, 'commodity' => 'Rice']);
        $farmer->parcels()->create(['barangay' => 'Caligayan', 'no_of_heads_trees' => 8, 'commodity' => 'Cattle']);

        Fishpond::create([
            'farmer_id' => $farmer->id, 'species' => 'Tilapia',
            'pond_type' => 'freshwater', 'area_hectares' => 0.5,
        ]);

        $this->index()->assertInertia(fn ($page) => $page
            ->where('farmers.data.0.crop_parcels', 1)
            ->where('farmers.data.0.livestock_parcels', 1)
            ->where('farmers.data.0.fishponds', 1));
    }

    public function test_an_unassessed_farmer_is_shown_as_unassessed_never_as_low_risk(): void
    {
        $this->farmer('NeverAssessed');

        $this->index()->assertInertia(fn ($page) => $page
            ->where('farmers.data.0.risk_level', null)
            ->where('farmers.data.0.assessed', false));
    }

    public function test_a_farmers_latest_level_is_shown(): void
    {
        $farmer = $this->farmer('Assessed');

        ClimateRiskAssessment::create([
            'farmer_id' => $farmer->id, 'assessed_at' => now()->subYear(),
            'risk_level' => 'low', 'risk_score' => 5,
        ]);
        ClimateRiskAssessment::create([
            'farmer_id' => $farmer->id, 'assessed_at' => now(),
            'risk_level' => 'high', 'risk_score' => 75,
        ]);

        $this->index()->assertInertia(fn ($page) => $page
            ->where('farmers.data.0.risk_level', 'high')
            ->where('farmers.data.0.risk_score', 75)
            ->where('farmers.data.0.assessed', true));
    }

    public function test_the_highest_risk_farmers_come_first(): void
    {
        $low = $this->farmer('Low');
        $high = $this->farmer('High');

        ClimateRiskAssessment::create(['farmer_id' => $low->id, 'assessed_at' => now(), 'risk_level' => 'low', 'risk_score' => 5]);
        ClimateRiskAssessment::create(['farmer_id' => $high->id, 'assessed_at' => now(), 'risk_level' => 'high', 'risk_score' => 80]);

        $this->index()->assertInertia(fn ($page) => $page
            ->where('farmers.data.0.name', 'Test High'));
    }

    public function test_it_opens_on_an_empty_register(): void
    {
        $this->index()->assertInertia(fn ($page) => $page->has('farmers.data', 0));
    }

    public function test_a_farmer_account_cannot_browse_the_office_list(): void
    {
        $account = tap(User::create([
            'name' => 'A Farmer', 'email' => 'farmer@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        $this->actingAs($account)->get(route('admin.analytics.farms'))->assertForbidden();
    }
}
