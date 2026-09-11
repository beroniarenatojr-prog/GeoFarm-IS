<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\Farmer;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Services\ParcelRiskAnalyser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * One answer belongs to one activity.
 *
 * The fault this fixes: a farmer had a single assessment and the analysis
 * applied it to everything they farm. A rice grower reporting frequent
 * flooding had that counted against their carabao as well, because nothing
 * recorded which activity the answer described.
 *
 * The rule now: an assessment written about a specific activity applies to
 * that activity and to nothing else. A whole-farm assessment still applies to
 * everything, because that is genuinely what it describes — and because every
 * assessment recorded before scoping existed is one.
 */
class ScopedAssessmentTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;

    protected function setUp(): void
    {
        parent::setUp();

        Crop::create(['crop_name' => 'Rice', 'category' => 'Cereal']);
        LivestockType::create(['type_name' => 'Carabao', 'category' => 'Large ruminant']);

        $this->farmer = Farmer::create([
            'first_name' => 'Renato', 'last_name' => 'Beronia', 'sex' => 'Male',
            'barangay' => 'Caligayan', 'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function rice()
    {
        return $this->farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2,
            'commodity' => 'Rice', 'parcel_number' => '1',
        ]);
    }

    private function carabao()
    {
        return $this->farmer->parcels()->create([
            'barangay' => 'Antagan I', 'no_of_heads_trees' => 80,
            'commodity' => 'Carabao', 'parcel_number' => '2',
        ]);
    }

    private function pond()
    {
        return Fishpond::create([
            'farmer_id' => $this->farmer->id, 'species' => 'Tilapia',
            'pond_type' => 'freshwater', 'area_hectares' => 0.5,
        ]);
    }

    private function assess(string $scope, array $attributes = []): ClimateRiskAssessment
    {
        return ClimateRiskAssessment::create($attributes + [
            'farmer_id'   => $this->farmer->id,
            'scope_type'  => $scope,
            'assessed_at' => now(),
        ]);
    }

    private function units(): array
    {
        return collect(app(ParcelRiskAnalyser::class)->forFarmer($this->farmer, 'wet', 2026)['units'])
            ->keyBy('label')
            ->all();
    }

    // ------------------------------------------------------- the actual fault

    public function test_a_rice_assessment_does_not_raise_factors_against_the_carabao(): void
    {
        $rice = $this->rice();
        $this->carabao();

        $this->assess(ClimateRiskAssessment::SCOPE_PARCEL, [
            'farm_parcel_id'  => $rice->id,
            'flood_frequency' => 'very_frequently',
        ]);

        $units = $this->units();

        $this->assertContains(
            'frequent_flooding',
            array_column($units['Parcel #1']['factors'], 'key'),
            'The rice parcel it was written about must carry it',
        );

        $this->assertNotContains(
            'frequent_flooding',
            array_column($units['Parcel #2']['factors'], 'key'),
            'A rice answer must never become a livestock risk factor',
        );
    }

    public function test_one_parcels_assessment_does_not_reach_another_parcel(): void
    {
        $first = $this->rice();

        $second = $this->farmer->parcels()->create([
            'barangay' => 'Lanna', 'total_area_ha' => 1,
            'commodity' => 'Rice', 'parcel_number' => '3',
        ]);

        $this->assess(ClimateRiskAssessment::SCOPE_PARCEL, [
            'farm_parcel_id'  => $first->id,
            'drought_frequency' => 'very_frequently',
        ]);

        $units = $this->units();

        $this->assertContains('frequent_drought', array_column($units['Parcel #1']['factors'], 'key'));
        $this->assertNotContains('frequent_drought', array_column($units['Parcel #3']['factors'], 'key'));
    }

    public function test_a_livestock_assessment_stays_on_the_livestock(): void
    {
        $rice = $this->rice();
        $carabao = $this->carabao();

        $this->assess(ClimateRiskAssessment::SCOPE_LIVESTOCK, [
            'farm_parcel_id' => $carabao->id,
            'heat_frequency' => 'very_frequently',
            'worst_effect'   => 'severe',
        ]);

        $units = $this->units();

        $this->assertContains('severe_climate_damage', array_column($units['Parcel #2']['factors'], 'key'));
        $this->assertNotContains('severe_climate_damage', array_column($units['Parcel #1']['factors'], 'key'));
    }

    public function test_an_aquaculture_assessment_stays_on_the_pond(): void
    {
        $this->rice();
        $pond = $this->pond();

        $this->assess(ClimateRiskAssessment::SCOPE_AQUACULTURE, [
            'fishpond_id'     => $pond->id,
            'flood_frequency' => 'very_frequently',
        ]);

        $units = $this->units();

        $pondUnit = collect($units)->firstWhere('kind', 'aquaculture');

        $this->assertContains('frequent_flooding', array_column($pondUnit['factors'], 'key'));
        $this->assertNotContains('frequent_flooding', array_column($units['Parcel #1']['factors'], 'key'));
    }

    // ------------------------------------------------- backward compatibility

    public function test_an_old_farmer_level_assessment_still_applies_to_everything(): void
    {
        // Every assessment recorded before scoping existed is one of these,
        // and it genuinely did describe the whole holding.
        $this->rice();
        $this->carabao();

        $this->assess(ClimateRiskAssessment::SCOPE_FARMER, ['flood_frequency' => 'very_frequently']);

        foreach ($this->units() as $unit) {
            $this->assertContains(
                'frequent_flooding',
                array_column($unit['factors'], 'key'),
                "{$unit['label']} should carry a whole-farm answer",
            );
        }
    }

    public function test_a_row_written_before_scoping_existed_defaults_to_farmer(): void
    {
        $this->rice();

        $assessment = ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id,
            'assessed_at' => now(),
            'flood_frequency' => 'very_frequently',
        ]);

        $this->assertSame(ClimateRiskAssessment::SCOPE_FARMER, $assessment->refresh()->scope_type);
        $this->assertFalse($assessment->is_scoped);
    }

    public function test_a_specific_assessment_beats_the_general_one(): void
    {
        $rice = $this->rice();

        $this->assess(ClimateRiskAssessment::SCOPE_FARMER, ['flood_frequency' => 'never']);
        $this->assess(ClimateRiskAssessment::SCOPE_PARCEL, [
            'farm_parcel_id' => $rice->id, 'flood_frequency' => 'very_frequently',
        ]);

        $this->assertContains(
            'frequent_flooding',
            array_column($this->units()['Parcel #1']['factors'], 'key'),
            'The assessment written about this parcel is the better evidence',
        );
    }

    public function test_a_parcel_falls_back_to_the_general_assessment_when_it_has_none(): void
    {
        $rice = $this->rice();
        $this->carabao();

        $this->assess(ClimateRiskAssessment::SCOPE_FARMER, ['flood_frequency' => 'very_frequently']);
        $this->assess(ClimateRiskAssessment::SCOPE_PARCEL, [
            'farm_parcel_id' => $rice->id, 'flood_frequency' => 'never',
        ]);

        $units = $this->units();

        $this->assertNotContains('frequent_flooding', array_column($units['Parcel #1']['factors'], 'key'));
        $this->assertContains('frequent_flooding', array_column($units['Parcel #2']['factors'], 'key'));
    }

    // -------------------------------------------------------- what was used

    public function test_each_unit_names_the_assessment_behind_it(): void
    {
        $rice = $this->rice();
        $this->carabao();

        $this->assess(ClimateRiskAssessment::SCOPE_FARMER);
        $this->assess(ClimateRiskAssessment::SCOPE_PARCEL, ['farm_parcel_id' => $rice->id]);

        $units = $this->units();

        $this->assertSame('Crop Parcel Assessment', $units['Parcel #1']['assessment']['scope_label']);
        $this->assertSame('Whole-Farm Assessment', $units['Parcel #2']['assessment']['scope_label']);
    }

    public function test_a_unit_with_no_assessment_says_so(): void
    {
        $this->rice();

        $this->assertNull($this->units()['Parcel #1']['assessment']);
    }

    public function test_bestFor_never_borrows_another_activitys_assessment(): void
    {
        $rice = $this->rice();
        $carabao = $this->carabao();

        $this->assess(ClimateRiskAssessment::SCOPE_PARCEL, ['farm_parcel_id' => $rice->id]);

        $this->assertNull(
            ClimateRiskAssessment::bestFor(
                $this->farmer->id,
                ClimateRiskAssessment::SCOPE_LIVESTOCK,
                $carabao->id,
            ),
            'A rice assessment is not evidence about a carabao',
        );
    }
}
