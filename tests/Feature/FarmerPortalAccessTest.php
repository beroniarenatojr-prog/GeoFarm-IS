<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Who may open the farmer portal.
 *
 * Added after a live 403 — "USER DOES NOT HAVE THE RIGHT ROLES" — on
 * /farmer/dashboard. The portal is guarded by role:Farmer, and nothing had a
 * test on that route directly, so there was no way to tell a broken guard from
 * an account signed in with the wrong role.
 *
 * These say plainly what the guard is meant to do, so the next 403 can be read
 * as a question about the account rather than about the code.
 */
class FarmerPortalAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function account(string $role, string $email): User
    {
        return tap(User::create([
            'name' => $role, 'email' => $email,
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole($role));
    }

    private function farmerWithAccount(): array
    {
        $user = $this->account('Farmer', 'farmer@example.test');

        $farmer = Farmer::create([
            'first_name' => 'Renato', 'last_name' => 'Beronia', 'sex' => 'Male',
            'barangay' => 'Caligayan', 'user_id' => $user->id,
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        return [$user, $farmer];
    }

    public function test_a_farmer_account_opens_the_dashboard(): void
    {
        [$user] = $this->farmerWithAccount();

        $this->actingAs($user)->get('/farmer/dashboard')->assertOk();
    }

    public function test_a_farmer_account_opens_the_questionnaire_and_the_analysis(): void
    {
        [$user] = $this->farmerWithAccount();

        $this->actingAs($user)->get('/farmer/risk-assessment')->assertOk();
        $this->actingAs($user)->get('/farmer/analysis')->assertOk();
    }

    public function test_an_office_account_is_refused_the_farmer_portal(): void
    {
        // This is the guard working, not failing. An admin browsing to
        // /farmer/dashboard gets exactly the 403 the portal is supposed to
        // give them — it is a portal for one farmer's own records.
        foreach (['Admin', 'Staff'] as $role) {
            $user = $this->account($role, strtolower($role) . '@example.test');

            $this->actingAs($user)
                ->get('/farmer/dashboard')
                ->assertForbidden();
        }
    }

    public function test_an_account_with_no_role_at_all_is_refused(): void
    {
        $user = User::create([
            'name' => 'Nobody', 'email' => 'nobody@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]);

        $this->actingAs($user)->get('/farmer/dashboard')->assertForbidden();
    }

    public function test_a_signed_out_visitor_is_sent_to_login_rather_than_refused(): void
    {
        $this->get('/farmer/dashboard')->assertRedirect('/login');
    }

    public function test_the_role_still_resolves_after_the_permission_cache_is_dropped(): void
    {
        /*
         * Spatie caches roles and permissions, and a stale cache is the usual
         * reason a correct assignment stops being honoured after a deploy or a
         * migration. Dropping it here proves the assignment itself is real and
         * not merely something the cache remembers.
         */
        [$user] = $this->farmerWithAccount();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->actingAs($user)->get('/farmer/dashboard')->assertOk();
    }

    public function test_the_farmer_role_exists_with_its_own_permissions(): void
    {
        // If this role were ever dropped, every farmer would meet the same
        // 403 at once and the cause would not be obvious from the message.
        $role = \Spatie\Permission\Models\Role::where('name', 'Farmer')->first();

        $this->assertNotNull($role, 'The Farmer role must exist or the whole portal is unreachable');
        $this->assertNotEmpty($role->permissions, 'A role with no permissions cannot do anything');
    }
}
