<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The farm analysis screen, end to end.
 *
 * Covers the states the office will actually meet: a farm with real history, a
 * farm with none, and the livestock and aquaculture records that have no
 * history table at all and must still be visible.
 */
class FarmAnalysisPageTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;
    private Crop $rice;
    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        $this->rice = Crop::create(['crop_name' => 'Rice', 'category' => 'Cereal']);
        LivestockType::create(['type_name' => 'Cattle', 'category' => 'Large ruminant']);

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

    private function open(array $query = [])
    {
        return $this->actingAs($this->staff())
            ->get(route('admin.farmers.analysis', $this->farmer) . ($query ? '?' . http_build_query($query) : ''));
    }

    private function parcel(array $attributes = [])
    {
        return $this->farmer->parcels()->create($attributes + [
            'barangay' => 'Caligayan', 'total_area_ha' => 2, 'commodity' => 'Rice', 'parcel_number' => '1',
        ]);
    }

    private function season($parcel, string $season, int $year, float $yield, float $area = 2.0, array $extra = [])
    {
        return CropSeason::create($extra + [
            'parcel_id' => $parcel->id, 'crop_id' => $this->rice->id,
            'season' => $season, 'cropping_year' => $year,
            'area_planted_ha' => $area, 'yield_kg' => $yield,
            'harvest_date' => "{$year}-" . ($season === 'wet' ? '11' : '05') . "-01",
        ]);
    }

    // ------------------------------------------------------------ it opens

    public function test_the_page_opens_for_a_farm_with_nothing_recorded(): void
    {
        // The commonest case in a new deployment, and the one most likely to
        // divide by zero somewhere if the analysis assumed history existed.
        $this->open()
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Analytics/FarmAnalysis')
                ->where('analysis.overall.level', null)
                ->has('analysis.units', 0));
    }

    public function test_it_names_the_period_being_analysed(): void
    {
        $this->parcel();

        $this->open(['season' => 'wet', 'year' => 2026])
            ->assertInertia(fn ($page) => $page
                ->where('analysis.period.season', 'wet')
                ->where('analysis.period.year', 2026)
                ->where('analysis.period.label', 'Wet Season 2026'));
    }

    public function test_an_invalid_season_is_refused_rather_than_analysed(): void
    {
        $this->parcel();

        $this->open(['season' => 'monsoon'])->assertSessionHasErrors('season');
    }

    // -------------------------------------------------- the four result states

    public function test_a_farm_with_declining_history_and_reported_flooding_reads_high(): void
    {
        $parcel = $this->parcel();
        $this->season($parcel, 'wet', 2023, 4500);
        $this->season($parcel, 'wet', 2024, 3500);
        $this->season($parcel, 'wet', 2025, 2000, 2.0, ['production_cost' => 80000, 'total_income' => 20000]);

        ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id, 'assessed_at' => now(),
            'flood_frequency' => 'very_frequently', 'worst_effect' => 'total_loss',
        ]);

        $this->open(['season' => 'wet', 'year' => 2026])
            ->assertInertia(fn ($page) => $page
                ->where('analysis.overall.level', 'high')
                ->where('analysis.affected.commodity', 'Rice')
                ->has('analysis.why')
                ->has('topActions'));
    }

    public function test_a_clean_farm_reads_low_and_still_receives_maintenance_advice(): void
    {
        $parcel = $this->parcel();
        $this->season($parcel, 'wet', 2023, 4000);
        $this->season($parcel, 'wet', 2024, 4100);
        $this->season($parcel, 'wet', 2025, 4200);

        ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id, 'assessed_at' => now(),
            'flood_frequency' => 'never',
        ]);

        $this->open(['season' => 'wet', 'year' => 2026])
            ->assertInertia(fn ($page) => $page
                ->where('analysis.overall.level', 'low')
                // Low is not "nothing to do".
                ->has('topActions', 3));
    }

    public function test_livestock_and_aquaculture_are_visible_and_unscored(): void
    {
        $this->parcel(['commodity' => 'Cattle', 'no_of_heads_trees' => 8, 'parcel_number' => '2']);

        Fishpond::create([
            'farmer_id' => $this->farmer->id, 'species' => 'Tilapia',
            'pond_type' => 'freshwater', 'area_hectares' => 0.5,
        ]);

        $this->open(['season' => 'wet', 'year' => 2026])
            ->assertInertia(function ($page) {
                $units = collect($page->toArray()['props']['analysis']['units']);

                $livestock = $units->firstWhere('kind', 'livestock');
                $pond = $units->firstWhere('kind', 'aquaculture');

                $this->assertNotNull($livestock, 'Livestock must not be hidden');
                $this->assertNotNull($pond, 'The pond must not be hidden');

                $this->assertNull($livestock['level']);
                $this->assertNull($pond['level']);

                $this->assertStringContainsString('livestock', strtolower($livestock['note']));
                $this->assertStringContainsString('aquaculture', strtolower($pond['note']));
            });
    }

    // ------------------------------------------------------------ transparency

    public function test_the_page_states_its_method_and_never_claims_a_model(): void
    {
        $this->parcel();

        $this->open()->assertInertia(function ($page) {
            $props = $page->toArray()['props'];

            $this->assertSame('rule_based', $props['analysis']['method']['type']);

            // No trained model is claimed anywhere in the payload.
            $this->assertStringNotContainsStringIgnoringCase('machine learning', json_encode($props));
            $this->assertStringNotContainsStringIgnoringCase('artificial intelligence', json_encode($props));

            // And no field offers a probability or a confidence, which a
            // rule-based sum cannot produce. The disclaimer says the word;
            // nothing computes one.
            foreach ($props['analysis']['units'] as $unit) {
                $this->assertArrayNotHasKey('probability', $unit);
                $this->assertArrayNotHasKey('confidence', $unit);
            }

            $this->assertArrayNotHasKey('probability', $props['analysis']['overall']);
        });
    }

    public function test_the_farmers_own_answers_travel_with_the_analysis(): void
    {
        // The adviser needs to read what was actually reported, not infer it
        // backwards from the score it produced.
        $this->parcel();

        ClimateRiskAssessment::create([
            'farmer_id'            => $this->farmer->id,
            'assessed_at'          => now(),
            'flood_frequency'      => 'very_frequently',
            'drought_frequency'    => 'rarely',
            'worst_effect'         => 'severe',
            'climate_events'       => ['flooding', 'strong_winds'],
            'loss_types'           => ['reduced_yield'],
            'had_financial_loss'   => 'yes',
            'estimated_loss_amount' => 15000,
            'adaptation_practices' => ['improve_drainage'],
            'perceived_risk'       => 'likely',
        ]);

        $this->open()->assertInertia(fn ($page) => $page
            ->where('analysis.assessment.answers.flood_frequency', 'very_frequently')
            ->where('analysis.assessment.answers.drought_frequency', 'rarely')
            ->where('analysis.assessment.answers.worst_effect', 'severe')
            ->where('analysis.assessment.answers.climate_events', ['flooding', 'strong_winds'])
            ->where('analysis.assessment.answers.loss_types', ['reduced_yield'])
            ->where('analysis.assessment.answers.had_financial_loss', 'yes')
            ->where('analysis.assessment.answers.adaptation_practices', ['improve_drainage'])
            ->where('analysis.assessment.answers.perceived_risk', 'likely'));
    }

    public function test_the_answers_are_stored_as_instrument_keys_not_prose(): void
    {
        // Keys, because the labels get reworded — they were translated into
        // Tagalog this week — while the key is what the score was computed
        // from. The screen turns them back into words at display time.
        $this->parcel();

        ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id, 'assessed_at' => now(),
            'flood_frequency' => 'very_frequently',
        ]);

        $this->open()->assertInertia(fn ($page) => $page
            ->where('analysis.assessment.answers.flood_frequency', 'very_frequently'));
    }

    public function test_there_is_no_route_to_edit_a_farmers_answers_from_the_office(): void
    {
        // The questionnaire is the farmer's account of their own season. An
        // office edit would turn a survey response into an office opinion
        // while leaving the risk score attached to it.
        $routes = collect(app('router')->getRoutes())
            ->map(fn ($route) => $route->uri() . '|' . implode(',', $route->methods()))
            ->filter(fn (string $signature) => str_contains($signature, 'risk-assessment')
                || str_contains($signature, 'climate_risk'));

        foreach ($routes as $signature) {
            [$uri, $methods] = explode('|', $signature);

            if (str_starts_with($uri, 'admin/')) {
                $this->fail("The office has a route touching assessments: {$uri} ({$methods})");
            }
        }

        $this->assertTrue(true);
    }

    public function test_a_farmer_who_never_answered_shows_no_answers_rather_than_blanks(): void
    {
        $this->parcel();

        $this->open()->assertInertia(fn ($page) => $page
            ->where('analysis.assessment', null));
    }

    public function test_it_lists_what_was_used_and_what_was_missing(): void
    {
        $this->parcel();

        $this->open()->assertInertia(fn ($page) => $page
            ->has('analysis.data_used.used')
            ->has('analysis.data_used.missing'));
    }

    // ---------------------------------------------------------- authorisation

    public function test_a_signed_out_visitor_cannot_open_it(): void
    {
        $this->get(route('admin.farmers.analysis', $this->farmer))->assertRedirect('/login');
    }

    public function test_a_farmer_account_cannot_open_the_office_analysis(): void
    {
        $account = tap(User::create([
            'name' => 'A Farmer', 'email' => 'farmer@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        $this->actingAs($account)
            ->get(route('admin.farmers.analysis', $this->farmer))
            ->assertForbidden();
    }

    public function test_staff_may_open_it(): void
    {
        $this->parcel();

        $this->actingAs($this->staff('Staff'))
            ->get(route('admin.farmers.analysis', $this->farmer))
            ->assertOk();
    }
}
