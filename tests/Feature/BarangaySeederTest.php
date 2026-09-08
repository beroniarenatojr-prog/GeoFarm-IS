<?php

namespace Tests\Feature;

use App\Models\Barangay;
use Database\Seeders\BarangaySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Reconciling the official barangay list.
 *
 * The seeder used to return early whenever any barangay existed, so a
 * correction to the list could never reach a database that had already been
 * seeded. These pin the behaviour that replaced it, including the part that
 * matters most: a name leaving the list must not take a drawn boundary or a
 * programme's targeting with it.
 */
class BarangaySeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_seeds_the_full_official_list(): void
    {
        $this->seed(BarangaySeeder::class);

        $this->assertSame(46, Barangay::where('is_active', true)->count());
        $this->assertDatabaseHas('barangays', ['name' => 'Caligayan', 'is_active' => true]);
        $this->assertDatabaseHas('barangays', ['name' => 'Barangay District 1']);
        $this->assertDatabaseHas('barangays', [
            'name'         => 'Ugad',
            'municipality' => 'Tumauini',
            'province'     => 'Isabela',
        ]);
    }

    public function test_running_it_twice_does_not_duplicate(): void
    {
        $this->seed(BarangaySeeder::class);
        $this->seed(BarangaySeeder::class);

        $this->assertSame(46, Barangay::count());
    }

    public function test_it_reaches_a_database_that_was_already_seeded(): void
    {
        // The whole reason for the rewrite: the old guard skipped on any
        // existing row, so a corrected list never landed anywhere real.
        Barangay::create(['name' => 'Bintawan']);

        $this->seed(BarangaySeeder::class);

        $this->assertDatabaseHas('barangays', ['name' => 'Caligayan', 'is_active' => true]);
    }

    public function test_a_name_no_longer_on_the_list_is_retired_not_deleted(): void
    {
        $obsolete = Barangay::create(['name' => 'Bintawan']);

        $this->seed(BarangaySeeder::class);

        $this->assertDatabaseHas('barangays', ['id' => $obsolete->id, 'is_active' => false]);
        $this->assertNotNull($obsolete->fresh(), 'the row must survive so its boundary and pivots do');
    }

    public function test_retiring_a_barangay_does_not_destroy_its_boundary(): void
    {
        // barangay_boundaries cascades on delete. If the seeder ever removed
        // rows instead of deactivating them, a re-seed would quietly wipe
        // boundaries the office had drawn.
        $obsolete = Barangay::create(['name' => 'Bintawan']);

        DB::table('barangay_boundaries')->insert([
            'barangay_id' => $obsolete->id,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $this->seed(BarangaySeeder::class);

        $this->assertDatabaseHas('barangay_boundaries', ['barangay_id' => $obsolete->id]);
    }

    public function test_a_barangay_that_returns_to_the_list_is_reactivated(): void
    {
        Barangay::create(['name' => 'Caligayan', 'is_active' => false]);

        $this->seed(BarangaySeeder::class);

        $this->assertDatabaseHas('barangays', ['name' => 'Caligayan', 'is_active' => true]);
        $this->assertSame(1, Barangay::where('name', 'Caligayan')->count());
    }
}
