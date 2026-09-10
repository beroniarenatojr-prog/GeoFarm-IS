<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Reproducing the production 500 on /admin/crop-estimator.
 *
 * The page opens fine locally, so the fault is something production's database
 * has that a fresh test database does not — or rather, something it LACKS. The
 * page load touches only two tables, so there are not many candidates, and
 * each one below is an experiment rather than a guess: put the database into
 * the suspected state and see whether the response is a 500.
 */
class CropEstimatorFailureModesTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $this->seed(RolePermissionSeeder::class);

        return tap(User::create([
            'name'      => 'Office Admin',
            'email'     => 'admin@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $user) => $user->assignRole('Admin'));
    }

    /**
     * Candidate 1: the permission row is absent.
     *
     * Both forecasting routes are guarded by permission:view predictive, and
     * they were hidden from the menu for months. If production was seeded
     * before that permission existed, spatie has to look up a permission that
     * is not there — and whether that is a clean 403 or a 500 is the question.
     */
    public function test_what_happens_when_the_permission_row_does_not_exist(): void
    {
        $user = $this->admin();

        Permission::where('name', 'view predictive')->delete();
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        $response = $this->actingAs($user)->get('/admin/crop-estimator');

        // Recorded, not asserted as correct: this test exists to find out.
        fwrite(STDERR, "\n  [permission missing] status = {$response->status()}\n");

        $this->assertTrue(true);
    }

    /**
     * Candidate 2: the crop recommendation columns were never added.
     *
     * CropEstimatorController::index() selects seeding_rate_kg_per_ha and
     * fertilizer_bags_per_ha explicitly. Both arrived in a later migration
     * (2026_04_03_000008). If that never ran on production, this select is an
     * unknown-column error on every page load.
     */
    public function test_what_happens_when_the_crop_recommendation_columns_are_missing(): void
    {
        $user = $this->admin();

        Schema::table('crops', function ($table) {
            $table->dropColumn(['seeding_rate_kg_per_ha', 'fertilizer_bags_per_ha']);
        });

        $this->withoutExceptionHandling();

        try {
            $this->actingAs($user)->get('/admin/crop-estimator');
            fwrite(STDERR, "\n  [columns missing] no exception — not the cause\n");
        } catch (\Throwable $e) {
            fwrite(STDERR, "\n  [columns missing] " . get_class($e) . "\n  " . $e->getMessage() . "\n");
        }

        $this->assertTrue(true);
    }
}
