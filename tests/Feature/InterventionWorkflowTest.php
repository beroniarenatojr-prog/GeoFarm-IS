<?php

namespace Tests\Feature;

use App\Models\AgriculturalIntervention;
use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Opening, working and closing an intervention.
 *
 * The rule the whole module exists to hold:
 *
 *   A RECOMMENDATION IS NOT EVIDENCE THAT ANYTHING HAPPENED.
 *
 * The system may suggest a farm visit. Only a person can open one, and only a
 * person can close it — by writing down what they actually did. Nothing here
 * reaches "completed" on its own, and nothing infers an action from the advice
 * that prompted it.
 */
class InterventionWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;
    private Farmer $farmer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        $this->farmer = Farmer::create([
            'first_name' => 'Renato', 'last_name' => 'Beronia', 'sex' => 'Male',
            'barangay' => 'Caligayan', 'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function staff(string $role = 'Admin'): User
    {
        return $this->staff ??= tap(User::create([
            'name' => 'Office Admin', 'email' => 'admin@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole($role));
    }

    private function open(array $overrides = []): AgriculturalIntervention
    {
        return AgriculturalIntervention::create($overrides + [
            'farmer_id' => $this->farmer->id,
            'type'      => 'drainage_assessment',
            'priority'  => 'high',
            'reason'    => 'Flooding reported as a frequent problem on this farm',
            'status'    => AgriculturalIntervention::STATUS_PENDING,
        ]);
    }

    // ------------------------------------------------------------- creating

    public function test_staff_can_open_an_intervention_from_a_suggestion(): void
    {
        $assessment = ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id, 'assessed_at' => now(),
            'risk_level' => 'high', 'risk_score' => 70,
        ]);

        $this->actingAs($this->staff())
            ->post(route('admin.interventions.store'), [
                'farmer_id'  => $this->farmer->id,
                'factor_key' => 'frequent_flooding',
                'climate_risk_assessment_id' => $assessment->id,
            ])
            ->assertRedirect();

        $intervention = AgriculturalIntervention::firstOrFail();

        $this->assertSame('drainage_assessment', $intervention->type);
        $this->assertSame(AgriculturalIntervention::STATUS_PENDING, $intervention->status);
        $this->assertNotEmpty($intervention->reason);
        $this->assertNull($intervention->action_taken, 'Opening one records no action');
        $this->assertSame($this->staff()->id, $intervention->created_by);
    }

    public function test_the_reason_is_frozen_at_the_moment_it_is_opened(): void
    {
        // The office revises the wording in config. A reason that silently
        // reworded itself afterwards would misreport why a visit was made.
        $this->actingAs($this->staff())->post(route('admin.interventions.store'), [
            'farmer_id' => $this->farmer->id, 'factor_key' => 'frequent_flooding',
        ]);

        $stored = AgriculturalIntervention::firstOrFail()->reason;

        config(['climate_risk.interventions.frequent_flooding.reason' => 'Something else entirely']);

        $this->assertSame($stored, AgriculturalIntervention::firstOrFail()->reason);
    }

    public function test_a_factor_with_no_configured_plan_cannot_be_opened(): void
    {
        $this->actingAs($this->staff())
            ->post(route('admin.interventions.store'), [
                'farmer_id' => $this->farmer->id,
                'factor_key' => 'a_factor_nobody_configured',
            ])
            ->assertSessionHasErrors('factor_key');

        $this->assertSame(0, AgriculturalIntervention::count());
    }

    public function test_a_parcel_must_belong_to_the_farmer_it_is_opened_against(): void
    {
        $other = Farmer::create([
            'first_name' => 'Mayumi', 'last_name' => 'Telan', 'sex' => 'Female',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        $theirParcel = $other->parcels()->create([
            'barangay' => 'Antagan', 'total_area_ha' => 1, 'commodity' => 'Corn',
        ]);

        $this->actingAs($this->staff())
            ->post(route('admin.interventions.store'), [
                'farmer_id' => $this->farmer->id,
                'factor_key' => 'frequent_flooding',
                'farm_parcel_id' => $theirParcel->id,
            ])
            ->assertSessionHasErrors('farm_parcel_id');
    }

    // ------------------------------------------------------------- working it

    public function test_staff_can_assign_it(): void
    {
        $intervention = $this->open();

        $technician = tap(User::create([
            'name' => 'Technician', 'email' => 'tech@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Staff'));

        $this->actingAs($this->staff())
            ->put(route('admin.interventions.update', $intervention), [
                'status'      => AgriculturalIntervention::STATUS_ASSIGNED,
                'assigned_to' => $technician->id,
                'target_date' => now()->addWeek()->toDateString(),
            ])
            ->assertRedirect();

        $intervention->refresh();

        $this->assertSame(AgriculturalIntervention::STATUS_ASSIGNED, $intervention->status);
        $this->assertSame($technician->id, $intervention->assigned_to);
        $this->assertTrue($intervention->is_open);
    }

    // ------------------------------------------ the rule that matters most

    public function test_it_cannot_be_completed_without_recording_what_was_done(): void
    {
        $intervention = $this->open();

        $this->actingAs($this->staff())
            ->put(route('admin.interventions.update', $intervention), [
                'status' => AgriculturalIntervention::STATUS_COMPLETED,
            ])
            ->assertSessionHasErrors('action_taken');

        $this->assertSame(
            AgriculturalIntervention::STATUS_PENDING,
            $intervention->refresh()->status,
            'A visit with nothing written down has not happened',
        );
    }

    public function test_completing_it_records_who_did_it_and_when(): void
    {
        $intervention = $this->open();

        $this->actingAs($this->staff())
            ->put(route('admin.interventions.update', $intervention), [
                'status'       => AgriculturalIntervention::STATUS_COMPLETED,
                'action_taken' => 'Drainage assessed and technical guidance given to the farmer.',
                'follow_up_date' => now()->addMonth()->toDateString(),
            ])
            ->assertRedirect();

        $intervention->refresh();

        $this->assertSame(AgriculturalIntervention::STATUS_COMPLETED, $intervention->status);
        $this->assertStringContainsString('Drainage assessed', $intervention->action_taken);
        $this->assertSame($this->staff()->id, $intervention->completed_by);
        $this->assertNotNull($intervention->completed_at);
        $this->assertFalse($intervention->is_open);
    }

    public function test_nothing_completes_itself(): void
    {
        // The suggestion exists, the recommendation exists, and the farmer was
        // told. None of that is an action. Only a person writing down what they
        // did closes a record.
        $this->open();

        $this->assertSame(
            0,
            AgriculturalIntervention::where('status', AgriculturalIntervention::STATUS_COMPLETED)->count(),
        );

        $this->assertSame(
            0,
            AgriculturalIntervention::whereNotNull('action_taken')->count(),
        );
    }

    public function test_cancelling_needs_no_action_but_keeps_the_record(): void
    {
        $intervention = $this->open();

        $this->actingAs($this->staff())
            ->put(route('admin.interventions.update', $intervention), [
                'status' => AgriculturalIntervention::STATUS_CANCELLED,
                'notes'  => 'Farmer has moved to another municipality.',
            ])
            ->assertRedirect();

        $intervention->refresh();

        $this->assertSame(AgriculturalIntervention::STATUS_CANCELLED, $intervention->status);
        $this->assertNull($intervention->action_taken, 'Cancelling is not an action taken');
        $this->assertNull($intervention->completed_at);
    }

    // ---------------------------------------------------------------- queue

    public function test_the_queue_leads_with_high_priority_work(): void
    {
        $this->open(['priority' => 'low', 'reason' => 'Low one']);
        $this->open(['priority' => 'high', 'reason' => 'High one']);
        $this->open(['priority' => 'medium', 'reason' => 'Medium one']);

        $this->actingAs($this->staff())
            ->get(route('admin.interventions.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Interventions/Index')
                ->where('interventions.data.0.reason', 'High one')
                ->where('interventions.data.2.reason', 'Low one'));
    }

    public function test_completed_work_leaves_the_open_queue(): void
    {
        $done = $this->open();
        $done->update([
            'status' => AgriculturalIntervention::STATUS_COMPLETED,
            'action_taken' => 'Visited.',
            'completed_at' => now(),
        ]);

        $this->open(['reason' => 'Still open']);

        $this->actingAs($this->staff())
            ->get(route('admin.interventions.index'))
            ->assertInertia(fn ($page) => $page
                ->has('interventions.data', 1)
                ->where('interventions.data.0.reason', 'Still open'));
    }

    public function test_the_queue_can_show_everything_including_closed_work(): void
    {
        $done = $this->open();
        $done->update([
            'status' => AgriculturalIntervention::STATUS_COMPLETED,
            'action_taken' => 'Visited.', 'completed_at' => now(),
        ]);

        $this->actingAs($this->staff())
            ->get(route('admin.interventions.index', ['status' => 'completed']))
            ->assertInertia(fn ($page) => $page->has('interventions.data', 1));
    }

    public function test_an_overdue_item_is_flagged_but_only_while_open(): void
    {
        $late = $this->open(['target_date' => now()->subWeek()->toDateString()]);

        $this->assertTrue($late->is_overdue);

        $late->update([
            'status' => AgriculturalIntervention::STATUS_COMPLETED,
            'action_taken' => 'Done, late.', 'completed_at' => now(),
        ]);

        $this->assertFalse($late->refresh()->is_overdue, 'Closed work is not outstanding');
    }

    // -------------------------------------------------------- authorisation

    public function test_a_farmer_account_cannot_reach_the_queue(): void
    {
        $account = tap(User::create([
            'name' => 'A Farmer', 'email' => 'farmer@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        $this->actingAs($account)->get(route('admin.interventions.index'))->assertForbidden();
    }

    public function test_a_signed_out_visitor_cannot_open_one(): void
    {
        $this->post(route('admin.interventions.store'), [
            'farmer_id' => $this->farmer->id, 'factor_key' => 'frequent_flooding',
        ])->assertRedirect('/login');
    }
}
