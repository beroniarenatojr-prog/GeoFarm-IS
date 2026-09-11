<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Services\ParcelRiskAnalyser;
use App\Services\ProductionHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Per-parcel analysis for one farmer.
 *
 * The farm is not one thing. A farmer can work good land and poor land in the
 * same barangay, and a single whole-farm verdict hides exactly the parcel the
 * office needs to visit. This splits the judgement per parcel while keeping
 * the scoring methodology already in config/climate_risk.php — the weights are
 * not touched, so a figure produced here is comparable with one produced by
 * ClimateRiskScorer.
 *
 * The rule these tests exist to hold: LACK OF EVIDENCE IS NOT LOW RISK. A
 * parcel nothing is known about comes back with no level at all, never with a
 * green one.
 */
class ParcelRiskAnalyserTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;
    private Crop $rice;

    protected function setUp(): void
    {
        parent::setUp();

        $this->rice = Crop::create(['crop_name' => 'Rice', 'category' => 'Cereal']);
        LivestockType::create(['type_name' => 'Cattle', 'category' => 'Large ruminant']);

        $this->farmer = Farmer::create([
            'first_name'          => 'Renato',
            'last_name'           => 'Beronia',
            'sex'                 => 'Male',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function analyser(): ParcelRiskAnalyser
    {
        return app(ParcelRiskAnalyser::class);
    }

    private function parcel(array $attributes = [])
    {
        return $this->farmer->parcels()->create($attributes + [
            'barangay'      => 'Caligayan',
            'total_area_ha' => 2,
            'commodity'     => 'Rice',
        ]);
    }

    private function season($parcel, string $season, int $year, ?float $yield, float $area = 2.0, array $extra = [])
    {
        return CropSeason::create($extra + [
            'parcel_id'       => $parcel->id,
            'crop_id'         => $this->rice->id,
            'season'          => $season,
            'cropping_year'   => $year,
            'area_planted_ha' => $area,
            'yield_kg'        => $yield,
            'harvest_date'    => "{$year}-" . ($season === 'wet' ? '11' : '05') . "-01",
        ]);
    }

    private function assess(array $attributes = []): ClimateRiskAssessment
    {
        return ClimateRiskAssessment::create($attributes + [
            'farmer_id'   => $this->farmer->id,
            'assessed_at' => now(),
        ]);
    }

    /** Analyse for a fixed season so the test does not depend on today's date. */
    private function analyse(string $season = 'wet', int $year = 2026): array
    {
        return $this->analyser()->forFarmer($this->farmer, $season, $year);
    }

    // ------------------------------------------------------ the governing rule

    public function test_a_parcel_with_no_evidence_at_all_has_no_level_and_is_not_low(): void
    {
        $this->parcel();

        $unit = $this->analyse()['units'][0];

        $this->assertNull($unit['level'], 'Nothing is known, so nothing may be claimed');
        $this->assertNotSame('low', $unit['level']);
        $this->assertSame(ProductionHistory::SUFFICIENCY_NONE, $unit['data_sufficiency']);
    }

    public function test_insufficient_is_counted_apart_from_low(): void
    {
        $this->parcel();

        $counts = $this->analyse()['overall']['counts'];

        $this->assertSame(1, $counts['insufficient']);
        $this->assertSame(0, $counts['low']);
    }

    // -------------------------------------------------------- livestock ponds

    public function test_a_livestock_parcel_is_shown_but_never_scored(): void
    {
        $this->parcel(['commodity' => 'Cattle', 'no_of_heads_trees' => 8, 'total_area_ha' => null]);

        $unit = collect($this->analyse()['units'])->firstWhere('kind', ParcelRiskAnalyser::KIND_LIVESTOCK);

        $this->assertNotNull($unit, 'Livestock must remain visible, not hidden for lack of history');
        $this->assertNull($unit['level']);
        $this->assertSame('Cattle', $unit['commodity']);
        $this->assertSame(8.0, $unit['size']['value']);
        $this->assertSame('heads', $unit['size']['unit']);
        $this->assertStringContainsString('livestock', strtolower($unit['history']['summary']));
        $this->assertNull($unit['history']['trend']);
    }

    public function test_a_fishpond_is_shown_but_never_scored(): void
    {
        Fishpond::create([
            'farmer_id'     => $this->farmer->id,
            'species'       => 'Tilapia',
            'pond_type'     => 'freshwater',
            'area_hectares' => 0.5,
        ]);

        $unit = collect($this->analyse()['units'])->firstWhere('kind', ParcelRiskAnalyser::KIND_AQUACULTURE);

        $this->assertNotNull($unit, 'Aquaculture must remain visible');
        $this->assertNull($unit['level']);
        $this->assertSame('Tilapia', $unit['commodity']);
        $this->assertSame(0.5, $unit['size']['value']);
        $this->assertStringContainsString('aquaculture', strtolower($unit['history']['summary']));
    }

    // ------------------------------------------------------ crop parcels score

    public function test_a_declining_crop_parcel_raises_a_history_factor(): void
    {
        $parcel = $this->parcel();
        $this->season($parcel, 'wet', 2023, 4500);
        $this->season($parcel, 'wet', 2024, 4200);
        $this->season($parcel, 'wet', 2025, 3400);

        $unit = $this->analyse()['units'][0];

        $keys = array_column($unit['factors'], 'key');

        $this->assertContains('declining_yield', $keys);
        $this->assertSame(ProductionHistory::SUFFICIENCY_SUFFICIENT, $unit['data_sufficiency']);
        $this->assertSame(
            'history',
            collect($unit['factors'])->firstWhere('key', 'declining_yield')['source'],
            'A factor must say where it came from, so the page can separate record from report',
        );
    }

    public function test_a_recorded_loss_on_the_parcel_raises_its_own_factor(): void
    {
        $parcel = $this->parcel();
        $this->season($parcel, 'wet', 2025, 3000, 2.0, [
            'production_cost' => 50000,
            'total_income'    => 20000,
        ]);

        $unit = $this->analyse()['units'][0];

        $this->assertContains('previous_season_loss', array_column($unit['factors'], 'key'));
    }

    public function test_the_farms_climate_answers_apply_to_every_crop_parcel(): void
    {
        $this->parcel();
        $this->parcel(['barangay' => 'Antagan', 'total_area_ha' => 1]);

        $this->assess(['flood_frequency' => 'very_frequently']);

        foreach ($this->analyse()['units'] as $unit) {
            $keys = array_column($unit['factors'], 'key');

            $this->assertContains('frequent_flooding', $keys);
            $this->assertSame(
                'assessment',
                collect($unit['factors'])->firstWhere('key', 'frequent_flooding')['source'],
            );
        }
    }

    public function test_two_parcels_are_judged_separately(): void
    {
        $good = $this->parcel();
        $this->season($good, 'wet', 2023, 4000);
        $this->season($good, 'wet', 2024, 4100);
        $this->season($good, 'wet', 2025, 4200);

        $bad = $this->parcel(['barangay' => 'Antagan', 'total_area_ha' => 1]);
        $this->season($bad, 'wet', 2023, 4000, 1.0, ['production_cost' => 60000, 'total_income' => 10000]);
        $this->season($bad, 'wet', 2024, 3000, 1.0);
        $this->season($bad, 'wet', 2025, 1500, 1.0, ['production_cost' => 60000, 'total_income' => 10000]);

        $units = collect($this->analyse()['units'])->keyBy('label');

        $this->assertNotSame(
            $units->first()['level'],
            $units->last()['level'],
            'Land that performs differently must not be given one shared verdict',
        );
    }

    // ------------------------------------------------------ comparable seasons

    public function test_a_dry_season_prediction_reads_dry_season_history(): void
    {
        $parcel = $this->parcel();
        $this->season($parcel, 'wet', 2024, 4000);
        $this->season($parcel, 'wet', 2025, 3800);
        $this->season($parcel, 'dry', 2025, 900);

        $unit = $this->analyser()->forFarmer($this->farmer, 'dry', 2026)['units'][0];

        $this->assertSame(1, $unit['history']['comparable_seasons']);
        $this->assertNull($unit['history']['trend'], 'One dry record is not a dry-season trend');
    }

    // ------------------------------------------------------------ whole farm

    public function test_the_farm_verdict_is_the_worst_parcel_on_it(): void
    {
        $this->parcel();

        $bad = $this->parcel(['barangay' => 'Antagan', 'total_area_ha' => 1]);
        $this->season($bad, 'wet', 2024, 4000, 1.0);
        $this->season($bad, 'wet', 2025, 1000, 1.0, ['production_cost' => 90000, 'total_income' => 5000]);

        $this->assess([
            'flood_frequency'  => 'very_frequently',
            'drought_frequency' => 'frequently',
            'worst_effect'     => 'total_loss',
        ]);

        $result = $this->analyse();

        $this->assertSame('high', $result['overall']['level']);
        $this->assertNotNull($result['affected'], 'The page has to name which parcel is the problem');
        $this->assertSame('high', $result['affected']['level']);
    }

    public function test_the_period_is_named_so_the_reader_knows_what_is_predicted(): void
    {
        $this->parcel();

        $period = $this->analyse('wet', 2026)['period'];

        $this->assertSame('wet', $period['season']);
        $this->assertSame(2026, $period['year']);
        $this->assertStringContainsString('2026', $period['label']);
    }

    public function test_the_upcoming_period_follows_the_cropping_calendar(): void
    {
        // Wet runs June-November; the dry cropping that follows is recorded
        // against the next year.
        $this->assertSame(
            ['season' => 'dry', 'year' => 2027],
            collect($this->analyser()->upcomingPeriod(Carbon::parse('2026-09-11')))->only(['season', 'year'])->all(),
        );

        $this->assertSame(
            ['season' => 'wet', 'year' => 2026],
            collect($this->analyser()->upcomingPeriod(Carbon::parse('2026-03-01')))->only(['season', 'year'])->all(),
        );
    }

    // -------------------------------------------------------- honesty on method

    public function test_the_method_is_declared_rule_based_with_its_version(): void
    {
        $this->parcel();

        $method = $this->analyse()['method'];

        $this->assertSame('rule_based', $method['type']);
        $this->assertSame(config('climate_risk.version'), $method['version']);
        $this->assertStringNotContainsStringIgnoringCase('machine learning', json_encode($method));
        $this->assertArrayNotHasKey('probability', $method);
    }

    public function test_it_reports_what_was_used_and_what_was_missing(): void
    {
        $parcel = $this->parcel();
        $this->season($parcel, 'wet', 2024, 4000);
        $this->season($parcel, 'wet', 2025, 3800);

        Fishpond::create([
            'farmer_id' => $this->farmer->id, 'species' => 'Tilapia', 'area_hectares' => 0.5,
        ]);

        $this->assess(['flood_frequency' => 'frequently']);

        $used = $this->analyse()['data_used'];

        $this->assertNotEmpty($used['used']);
        $this->assertNotEmpty($used['missing'], 'The pond has no history, and that must be said out loud');

        $this->assertStringContainsString(
            'aquaculture',
            strtolower(implode(' ', $used['missing'])),
        );
    }

    // ------------------------------------------------------------ isolation

    public function test_another_farmers_parcels_are_never_included(): void
    {
        $this->parcel();

        $other = Farmer::create([
            'first_name' => 'Mayumi', 'last_name' => 'Telan', 'sex' => 'Female',
            'barangay' => 'Antagan', 'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
        $other->parcels()->create(['barangay' => 'Antagan', 'total_area_ha' => 9, 'commodity' => 'Corn']);

        $result = $this->analyse();

        $this->assertCount(1, $result['units']);
        $this->assertSame('Rice', $result['units'][0]['commodity']);
    }
}
