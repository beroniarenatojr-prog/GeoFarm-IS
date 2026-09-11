<?php

namespace Tests\Feature;

use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The farmer's own copy of their analysis.
 *
 * The same service produces it, so the figures cannot disagree with what the
 * office sees. What this file is really guarding is the boundary: there is no
 * farmer id anywhere in the route, and these tests exist to keep it that way.
 */
class FarmerOwnAnalysisTest extends TestCase
{
    use RefreshDatabase;

    private function farmerWithAccount(string $last, string $email): array
    {
        $user = tap(User::create([
            'name' => $last, 'email' => $email,
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        $farmer = Farmer::create([
            'first_name' => 'Test', 'last_name' => $last, 'sex' => 'Male',
            'barangay' => 'Caligayan', 'user_id' => $user->id,
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        return [$user, $farmer];
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_a_farmer_sees_their_own_farm(): void
    {
        [$user, $farmer] = $this->farmerWithAccount('Beronia', 'beronia@example.test');

        $farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2,
            'commodity' => 'Rice', 'parcel_number' => '1',
        ]);

        $this->actingAs($user)
            ->get('/farmer/analysis')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Farmer/Analysis')
                ->where('analysis.farmer.id', $farmer->id)
                ->has('analysis.units', 1));
    }

    public function test_the_figures_match_what_the_office_sees(): void
    {
        // One service, two audiences. A portal that disagreed with the office
        // about the same farm, in front of the farmer who owns it, would be
        // worse than having no portal view at all.
        [$user, $farmer] = $this->farmerWithAccount('Beronia', 'beronia@example.test');

        $rice = Crop::create(['crop_name' => 'Rice', 'category' => 'Cereal']);
        $parcel = $farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2, 'commodity' => 'Rice', 'parcel_number' => '1',
        ]);

        foreach ([[2024, 4000], [2025, 3000]] as [$year, $yield]) {
            CropSeason::create([
                'parcel_id' => $parcel->id, 'crop_id' => $rice->id,
                'season' => 'wet', 'cropping_year' => $year,
                'area_planted_ha' => 2, 'yield_kg' => $yield,
                'harvest_date' => "{$year}-11-01",
            ]);
        }

        $staff = tap(User::create([
            'name' => 'Officer', 'email' => 'officer@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));

        $query = ['season' => 'wet', 'year' => 2026];

        $mine = $this->actingAs($user)->get('/farmer/analysis?' . http_build_query($query));
        $theirs = $this->actingAs($staff)
            ->get(route('admin.farmers.analysis', $farmer) . '?' . http_build_query($query));

        $this->assertSame(
            $mine->viewData('page')['props']['analysis']['units'],
            $theirs->viewData('page')['props']['analysis']['units'],
        );
    }

    public function test_one_farmer_cannot_reach_another_farmers_analysis(): void
    {
        [$mine] = $this->farmerWithAccount('Beronia', 'beronia@example.test');
        [, $other] = $this->farmerWithAccount('Telan', 'telan@example.test');

        $other->parcels()->create([
            'barangay' => 'Antagan', 'total_area_ha' => 9, 'commodity' => 'Corn',
        ]);

        // There is no id to tamper with, and a query string cannot introduce
        // one. The signed-in account is the only thing that selects the farm.
        $this->actingAs($mine)
            ->get('/farmer/analysis?farmer=' . $other->id . '&farmer_id=' . $other->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('analysis.farmer.name', 'Test Beronia')
                ->has('analysis.units', 0));
    }

    public function test_a_signed_out_visitor_is_sent_to_login(): void
    {
        $this->get('/farmer/analysis')->assertRedirect('/login');
    }

    public function test_an_office_account_cannot_use_the_farmer_route(): void
    {
        $staff = tap(User::create([
            'name' => 'Officer', 'email' => 'officer@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));

        $this->actingAs($staff)->get('/farmer/analysis')->assertForbidden();
    }

    public function test_the_portal_offers_no_period_picker_or_assistance_list(): void
    {
        [$user] = $this->farmerWithAccount('Beronia', 'beronia@example.test');

        $this->actingAs($user)
            ->get('/farmer/analysis')
            ->assertInertia(fn ($page) => $page
                ->has('periods', 0)
                ->has('assistance', 0));
    }
}
