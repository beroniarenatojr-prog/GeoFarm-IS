<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Inertia;
use Tests\TestCase;

/**
 * The admin dashboard loads.
 *
 * Every figure on it is wrapped in Inertia::defer(), so the first request only
 * returns the shell and a second request fetches the numbers. That split is
 * why a broken query here shows up as an error modal over a dashboard that
 * looks fine rather than as a plain error page - and why a test that only
 * asked for the first request would pass while the screen was visibly broken.
 */
class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $this->seed(RolePermissionSeeder::class);

        $user = User::create([
            'name'      => 'Dashboard Admin',
            'email'     => 'dashboard@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $user->assignRole('Admin');

        return $user;
    }

    public function test_the_shell_renders(): void
    {
        $this->actingAs($this->admin())
            ->get('/admin')
            ->assertOk();
    }

    public function test_the_deferred_figures_resolve(): void
    {
        $admin = $this->admin();

        // Inertia hashes the Vite manifest into an asset version and answers
        // 409 to any request carrying a different one - before running a
        // single query. Matching it is what makes the next request actually
        // execute them. Mirrors Middleware::version().
        $version = hash_file('xxh128', public_path('build/manifest.json'));

        // The request the browser makes straight after the shell. This is the
        // one that runs every dashboard query.
        $this->actingAs($admin)
            ->get('/admin', [
                'X-Inertia'                   => 'true',
                'X-Inertia-Version'           => $version,
                'X-Inertia-Partial-Component' => 'Admin/Dashboard',
                'X-Inertia-Partial-Data'      => 'metrics,charts,quickStats',
            ])
            ->assertOk();
    }
}
