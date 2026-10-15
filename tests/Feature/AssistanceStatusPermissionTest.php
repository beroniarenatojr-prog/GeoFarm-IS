<?php

namespace Tests\Feature;

use App\Models\AssistanceType;
use App\Models\FinancialAssistance;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Only Admin and Super Admin may open or close an assistance programme.
 *
 * Staff keep `edit assistance` and may record everything else about a
 * programme. Its status decides whether farmers can still be enrolled and
 * whether it counts as delivered, so it belongs with the people accountable
 * for that — the same reasoning that keeps the padlock out of Staff hands.
 *
 * The bypass matters more than the button. Guarding only the toggle route
 * would have been theatre: the edit form is gated on `edit assistance`, which
 * Staff hold, and it posts a status field. The last two tests here are the
 * ones that would catch that coming back.
 */
class AssistanceStatusPermissionTest extends TestCase
{
    use RefreshDatabase;

    private AssistanceType $type;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->type = AssistanceType::create(['type_name' => 'Seed Distribution', 'category' => 'in_kind']);
    }

    private function user(string $role, string $email): User
    {
        return tap(User::create([
            'name'      => $role . ' Account',
            'email'     => $email,
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $u) => $u->assignRole($role));
    }

    private function programme(string $status = 'active'): FinancialAssistance
    {
        return FinancialAssistance::create([
            'program_name'       => 'Corn Seed Support',
            'assistance_type_id' => $this->type->id,
            'start_date'         => '2026-01-01',
            'end_date'           => '2026-12-31',
            'status'             => $status,
        ]);
    }

    /** The form fields the update route requires, so only status is under test. */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'program_name'       => 'Corn Seed Support',
            'assistance_type_id' => $this->type->id,
            'start_date'         => '2026-01-01',
            'end_date'           => '2026-12-31',
        ], $overrides);
    }

    // ── The switch ────────────────────────────────────────────────────────

    public function test_staff_cannot_toggle_a_programme_status(): void
    {
        $programme = $this->programme('active');

        $this->actingAs($this->user('Staff', 'staff@example.test'))
            ->patch("/admin/assistance/{$programme->id}/status")
            ->assertForbidden();

        $this->assertSame('active', $programme->fresh()->status);
    }

    public function test_an_admin_can_toggle_a_programme_status(): void
    {
        $programme = $this->programme('active');

        $this->actingAs($this->user('Admin', 'admin@example.test'))
            ->patch("/admin/assistance/{$programme->id}/status");

        $this->assertNotSame(
            'active',
            $programme->fresh()->status,
            'an Admin holds set assistance status, so the switch must work',
        );
    }

    public function test_a_super_admin_can_toggle_a_programme_status(): void
    {
        $programme = $this->programme('active');

        $this->actingAs($this->user('Super Admin', 'super@example.test'))
            ->patch("/admin/assistance/{$programme->id}/status");

        $this->assertNotSame('active', $programme->fresh()->status);
    }

    // ── The way around the switch ─────────────────────────────────────────

    public function test_staff_cannot_change_status_through_the_edit_form(): void
    {
        $programme = $this->programme('inactive');

        /*
         * The request SUCCEEDS — Staff may edit a programme, and this is an
         * ordinary edit. Only the status field is dropped, so the rest of
         * their change must still be saved.
         */
        $this->actingAs($this->user('Staff', 'staff2@example.test'))
            ->put("/admin/assistance/{$programme->id}", $this->payload([
                'status'       => 'active',
                'program_name' => 'Corn Seed Support 2026',
            ]))
            ->assertRedirect();

        $fresh = $programme->fresh();

        $this->assertSame('inactive', $fresh->status, 'status must be ignored for Staff');
        $this->assertSame('Corn Seed Support 2026', $fresh->program_name, 'the rest of the edit must still save');
    }

    public function test_an_admin_can_change_status_through_the_edit_form(): void
    {
        $programme = $this->programme('inactive');

        $this->actingAs($this->user('Admin', 'admin2@example.test'))
            ->put("/admin/assistance/{$programme->id}", $this->payload(['status' => 'active']));

        $this->assertSame('active', $programme->fresh()->status);
    }


    // ── Creating a programme ──────────────────────────────────────────────

    public function test_staff_cannot_create_an_assistance_programme(): void
    {
        $this->actingAs($this->user('Staff', 'staff4@example.test'))
            ->post('/admin/assistance', $this->payload(['program_name' => 'Should Not Exist']))
            ->assertForbidden();

        $this->assertDatabaseMissing('financial_assistance', ['program_name' => 'Should Not Exist']);
    }

    public function test_staff_cannot_reach_the_create_form(): void
    {
        $this->actingAs($this->user('Staff', 'staff5@example.test'))
            ->get('/admin/assistance/create')
            ->assertForbidden();
    }

    public function test_an_admin_can_still_create_one(): void
    {
        $this->actingAs($this->user('Admin', 'admin3@example.test'))
            ->post('/admin/assistance', $this->payload(['program_name' => 'Rice Input Support']));

        $this->assertDatabaseHas('financial_assistance', ['program_name' => 'Rice Input Support']);
    }

    public function test_staff_can_still_view_and_edit_an_existing_programme(): void
    {
        $programme = $this->programme('active');
        $staff = $this->user('Staff', 'staff6@example.test');

        $this->actingAs($staff)->get('/admin/assistance')->assertOk();

        /*
         * Editing is still theirs. Removing creation must not also take away
         * recording what happened to a programme already running — that is the
         * bulk of the work and the reason Staff hold 'edit assistance'.
         */
        $this->actingAs($staff)
            ->put("/admin/assistance/{$programme->id}", $this->payload([
                'program_name' => 'Corn Seed Support (revised)',
            ]))
            ->assertRedirect();

        $this->assertSame('Corn Seed Support (revised)', $programme->fresh()->program_name);
    }

    // ── The permission itself ─────────────────────────────────────────────

    public function test_the_role_grants_match_the_intent(): void
    {
        $this->assertFalse($this->user('Staff', 's@example.test')->can('set assistance status'));
        $this->assertTrue($this->user('Admin', 'a@example.test')->can('set assistance status'));
        $this->assertTrue($this->user('Super Admin', 'sa@example.test')->can('set assistance status'));

        // Staff keep everything else about a programme.
        $this->assertTrue($this->user('Staff', 's2@example.test')->can('edit assistance'));

        // Creating one is Admin-only, for the same reason opening one is.
        $this->assertFalse($this->user('Staff', 's3@example.test')->can('create assistance'));
        $this->assertTrue($this->user('Admin', 'a2@example.test')->can('create assistance'));
    }
}
