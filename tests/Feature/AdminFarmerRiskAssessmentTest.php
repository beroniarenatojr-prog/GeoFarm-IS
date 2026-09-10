<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The office can read what a farmer answered.
 *
 * Farmers fill in the climate and financial risk questionnaire on the portal,
 * and until now the admin side could only count them: the dashboard knew how
 * many farmers had been assessed and nothing about any one of them. Staff
 * advising a farmer at the counter had no way to see the risk level they were
 * advising against.
 *
 * The whole history travels, not just the current round. Re-assessing adds a
 * row rather than replacing one, and a farmer who moved from high to moderate
 * is exactly what the office wants to see.
 */
class AdminFarmerRiskAssessmentTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function staff(string $role = 'Admin'): User
    {
        return $this->staff ??= tap(User::create([
            'name'      => 'Office Encoder',
            'email'     => 'encoder@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $user) => $user->assignRole($role));
    }

    private function farmer(): Farmer
    {
        return Farmer::create([
            'first_name'          => 'Renato',
            'last_name'           => 'Beronia',
            'sex'                 => 'Male',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function assess(Farmer $farmer, array $attributes = []): ClimateRiskAssessment
    {
        return ClimateRiskAssessment::create($attributes + [
            'farmer_id'       => $farmer->id,
            'assessed_at'     => now(),
            'flood_frequency' => 'frequently',
            'worst_effect'    => 'severe',
            'risk_level'      => 'high',
            'risk_score'      => 72,
            'risk_factors'    => [['key' => 'flooding', 'label' => 'Frequent flooding']],
            'recommendations' => [['key' => 'drainage', 'text' => 'Improve field drainage']],
        ]);
    }

    public function test_the_profile_carries_the_latest_assessment(): void
    {
        $farmer = $this->farmer();
        $this->assess($farmer);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $farmer))
            ->assertInertia(fn ($page) => $page
                ->where('farmer.latest_risk_assessment.risk_level', 'high')
                ->where('farmer.latest_risk_assessment.risk_score', 72)
                ->where('farmer.latest_risk_assessment.risk_factors.0.label', 'Frequent flooding')
                ->where('farmer.latest_risk_assessment.recommendations.0.text', 'Improve field drainage'));
    }

    public function test_the_answers_themselves_travel_not_only_the_score(): void
    {
        // Staff advising a farmer need to see what was actually reported, not
        // just the number the rules produced from it.
        $farmer = $this->farmer();
        $this->assess($farmer, [
            'climate_events'       => ['flooding', 'strong_winds'],
            'adaptation_practices' => ['improve_drainage'],
            'perceived_risk'       => 'likely',
        ]);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $farmer))
            ->assertInertia(fn ($page) => $page
                ->where('farmer.latest_risk_assessment.climate_events', ['flooding', 'strong_winds'])
                ->where('farmer.latest_risk_assessment.adaptation_practices', ['improve_drainage'])
                ->where('farmer.latest_risk_assessment.perceived_risk', 'likely')
                ->where('farmer.latest_risk_assessment.flood_frequency', 'frequently'));
    }

    public function test_previous_rounds_are_kept_so_a_change_is_visible(): void
    {
        $farmer = $this->farmer();

        $this->assess($farmer, [
            'assessed_at' => now()->subYear(),
            'risk_level'  => 'moderate',
            'risk_score'  => 40,
        ]);
        $this->assess($farmer, ['risk_level' => 'high', 'risk_score' => 72]);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $farmer))
            ->assertInertia(fn ($page) => $page
                ->has('farmer.risk_assessments', 2)
                // Newest first, so the current round reads at the top.
                ->where('farmer.risk_assessments.0.risk_score', 72)
                ->where('farmer.risk_assessments.1.risk_score', 40));
    }

    public function test_staleness_is_reported_so_an_old_round_is_not_read_as_current(): void
    {
        $farmer = $this->farmer();
        $this->assess($farmer, ['assessed_at' => now()->subYears(2)]);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $farmer))
            ->assertInertia(fn ($page) => $page
                ->where('farmer.latest_risk_assessment.is_stale', true));
    }

    public function test_a_farmer_who_has_never_been_assessed_is_not_an_error(): void
    {
        // Most farmers have not filled this in. The panel must say so rather
        // than the profile failing to load.
        $farmer = $this->farmer();

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $farmer))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('farmer.latest_risk_assessment', null)
                ->has('farmer.risk_assessments', 0));
    }

    public function test_staff_can_read_it_too(): void
    {
        // Staff are the ones at the counter. The profile is guarded by
        // "view farmers", and the assessment is part of that record.
        $farmer = $this->farmer();
        $this->assess($farmer);

        $this->actingAs($this->staff('Staff'))
            ->get(route('admin.farmers.show', $farmer))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('farmer.latest_risk_assessment.risk_level', 'high'));
    }

    public function test_one_farmers_assessment_never_appears_on_another_profile(): void
    {
        $assessed = $this->farmer();
        $this->assess($assessed);

        $other = Farmer::create([
            'first_name'          => 'Mayumi',
            'last_name'           => 'Telan',
            'sex'                 => 'Female',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $other))
            ->assertInertia(fn ($page) => $page
                ->where('farmer.latest_risk_assessment', null)
                ->has('farmer.risk_assessments', 0));
    }
}
