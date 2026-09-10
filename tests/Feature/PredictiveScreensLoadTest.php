<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The two forecasting screens open.
 *
 * Both were hidden from the sidebar for months while nobody looked at them,
 * which is exactly how a page rots: the routes stayed live, so nothing failed
 * loudly, and the first anyone knew was a 500 the moment the menu entry came
 * back. These load them with an empty register — no farmers, no crops, no
 * cropping history — because that is the state most likely to break an
 * aggregate and the state a fresh deployment is in.
 */
class PredictiveScreensLoadTest extends TestCase
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

    public function test_the_crop_estimator_opens(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.crop-estimator.index'))
            ->assertOk();
    }

    public function test_the_forecast_and_advisory_page_opens(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.analytics.predictive'))
            ->assertOk();
    }
}
