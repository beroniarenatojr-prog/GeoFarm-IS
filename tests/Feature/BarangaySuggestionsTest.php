<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The barangay type-aheads have something to suggest.
 *
 * The component fails silently when its options never arrive: the box still
 * accepts typing, so nothing looks broken, and the office goes on spelling
 * Caligayan four different ways. These pin the props at each render point.
 */
class BarangaySuggestionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        Barangay::create(['name' => 'Caligayan']);
        Barangay::create(['name' => 'Annafunan']);
        // Retired barangays are still rows, but must not be offered.
        Barangay::create(['name' => 'Old Poblacion', 'is_active' => false]);
    }

    private function staff(): User
    {
        $user = User::create([
            'name'      => 'Encoder',
            'email'     => 'encoder@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $user->assignRole('Admin');

        return $user;
    }

    public function test_the_public_registration_form_offers_barangays(): void
    {
        // The public form matters most: a farmer registering themselves is the
        // likeliest source of a spelling the office has never seen.
        $this->get(route('farmer-registration'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Farmers/FormRSBSA')
                ->where('publicMode', true)
                ->has('barangays', 2)
                ->where('barangays.0', 'Annafunan'));
    }

    public function test_the_admin_registration_form_offers_barangays(): void
    {
        $this->actingAs($this->staff())
            ->get(route('admin.farmers.create'))
            ->assertInertia(fn ($page) => $page->has('barangays', 2));
    }

    public function test_the_parcel_form_offers_barangays(): void
    {
        $this->actingAs($this->staff())
            ->get(route('admin.parcels.create'))
            ->assertInertia(fn ($page) => $page->has('barangays', 2));
    }

    public function test_an_inactive_barangay_is_not_suggested(): void
    {
        $this->actingAs($this->staff())
            ->get(route('admin.farmers.create'))
            ->assertInertia(fn ($page) => $page
                ->where('barangays', fn ($names) => !in_array('Old Poblacion', $names->all(), true)));
    }

    public function test_a_partly_typed_barangay_still_filters_the_registry(): void
    {
        // The filter used to be an exact match, which returned nothing for the
        // half-typed value a type-ahead leaves in the box.
        $match = Farmer::create([
            'first_name' => 'Maria', 'last_name' => 'Bautista',
            'sex' => 'Female', 'barangay' => 'Caligayan',
            'verification_status' => 'verified',
        ]);
        Farmer::create([
            'first_name' => 'Juan', 'last_name' => 'Cruz',
            'sex' => 'Male', 'barangay' => 'Annafunan',
            'verification_status' => 'verified',
        ]);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.index', ['barangay' => 'Cali']))
            ->assertInertia(fn ($page) => $page
                ->has('farmers.data', 1)
                ->where('farmers.data.0.id', $match->id));
    }
}
