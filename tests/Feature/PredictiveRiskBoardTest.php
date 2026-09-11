<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The office board on the predictive analytics page.
 *
 * Its job is to answer one question — which farms need attention — and the
 * trap it must avoid is counting the farms nobody has assessed as safe ones.
 * A dashboard that folds "unknown" into "low" sends staff to the wrong
 * villages while the unvisited ones stay green.
 */
class PredictiveRiskBoardTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function admin(): User
    {
        return $this->staff ??= tap(User::create([
            'name' => 'Office Admin', 'email' => 'admin@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));
    }

    private function farmer(string $last, string $barangay = 'Caligayan'): Farmer
    {
        return Farmer::create([
            'first_name' => 'Test', 'last_name' => $last, 'sex' => 'Male',
            'barangay' => $barangay, 'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function assess(Farmer $farmer, string $level, int $score, array $extra = []): ClimateRiskAssessment
    {
        return ClimateRiskAssessment::create($extra + [
            'farmer_id'   => $farmer->id,
            'assessed_at' => now(),
            'risk_level'  => $level,
            'risk_score'  => $score,
            'risk_factors' => [
                ['key' => 'frequent_flooding', 'weight' => 15, 'label' => 'Flooding was reported as frequent'],
                ['key' => 'declining_yield', 'weight' => 5, 'label' => 'Yield has fallen'],
            ],
        ]);
    }

    /**
     * The board's props, from the second request the browser makes.
     *
     * The board is wrapped in Inertia::defer() so the page paints before these
     * aggregates land, which means the first response does not carry them at
     * all. This is the partial reload that actually runs those queries; the
     * asset version has to match or Inertia answers 409 before touching the
     * database (mirrors Middleware::version()).
     *
     * Asserted against the decoded JSON rather than through assertInertia(),
     * which reads the page out of the Blade view and so only ever works on the
     * initial HTML response.
     */
    private function board(array $query = []): array
    {
        $response = $this->actingAs($this->admin())->get(route('admin.analytics.predictive', $query), [
            'X-Inertia'                   => 'true',
            'X-Inertia-Version'           => hash_file('xxh128', public_path('build/manifest.json')),
            'X-Inertia-Partial-Component' => 'Admin/Analytics/Predictive',
            'X-Inertia-Partial-Data'      => 'riskBoard,priorityFarmers,recentAnalyses,upcoming,method',
        ]);

        $response->assertOk();

        return $response->json('props');
    }

    public function test_unassessed_farmers_are_counted_as_insufficient_never_as_low(): void
    {
        $this->assess($this->farmer('Assessed'), 'low', 10);
        $this->farmer('NeverAssessed');
        $this->farmer('AlsoNever');

        $board = $this->board()['riskBoard'];

        $this->assertSame(1, $board['low']);
        $this->assertSame(2, $board['insufficient'], 'Unvisited farms must never be counted as safe ones');
        $this->assertSame(3, $board['verified']);
    }

    public function test_each_band_is_counted_from_the_latest_assessment_only(): void
    {
        $farmer = $this->farmer('Reassessed');

        $this->assess($farmer, 'high', 80, ['assessed_at' => now()->subYear()]);
        $this->assess($farmer, 'moderate', 40);

        $board = $this->board()['riskBoard'];

        $this->assertSame(0, $board['high'], 'A superseded result must not still be counted');
        $this->assertSame(1, $board['moderate']);
    }

    public function test_the_priority_list_leads_with_the_highest_risk(): void
    {
        $this->assess($this->farmer('Moderate'), 'moderate', 45);
        $this->assess($this->farmer('Worst'), 'high', 85);
        $this->assess($this->farmer('Bad'), 'high', 65);
        $this->assess($this->farmer('Fine'), 'low', 5);

        $rows = $this->board()['priorityFarmers'];

        $this->assertSame(['high', 'high', 'moderate'], array_column($rows, 'risk_level'));
        $this->assertSame(85, $rows[0]['risk_score']);
        $this->assertStringContainsString('Worst', $rows[0]['farmer']);
    }

    public function test_the_priority_card_names_the_heaviest_factor_not_a_paraphrase(): void
    {
        $this->assess($this->farmer('Flooded'), 'high', 70);

        $this->assertSame(
            'Flooding was reported as frequent',
            $this->board()['priorityFarmers'][0]['main_concern'],
        );
    }

    public function test_low_risk_farmers_are_not_on_the_priority_list(): void
    {
        $this->assess($this->farmer('Fine'), 'low', 5);

        $this->assertSame([], $this->board()['priorityFarmers']);
    }

    public function test_recent_analyses_say_whether_records_backed_the_result(): void
    {
        $this->assess($this->farmer('NoSeason'), 'moderate', 35);

        $this->assertSame('Assessment only', $this->board()['recentAnalyses'][0]['evidence']);
    }

    public function test_the_board_narrows_to_a_barangay(): void
    {
        $this->assess($this->farmer('Here', 'Caligayan'), 'high', 80);
        $this->assess($this->farmer('Elsewhere', 'Antagan'), 'high', 90);

        $props = $this->board(['barangay' => 'Caligayan']);

        $this->assertSame(1, $props['riskBoard']['high']);
        $this->assertCount(1, $props['priorityFarmers']);
        $this->assertSame('Caligayan', $props['priorityFarmers'][0]['barangay']);
    }

    public function test_the_page_names_the_upcoming_season_and_its_method(): void
    {
        $props = $this->board();

        $this->assertNotEmpty($props['upcoming']['label']);
        $this->assertSame('rule_based', $props['method']['type']);
        $this->assertSame(config('climate_risk.version'), $props['method']['version']);
    }

    public function test_the_board_opens_on_an_empty_register(): void
    {
        $props = $this->board();

        $this->assertSame(0, $props['riskBoard']['insufficient']);
        $this->assertSame([], $props['priorityFarmers']);
    }
}
