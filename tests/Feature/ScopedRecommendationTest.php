<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\Farmer;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Services\ClimateRecommendationEngine;
use App\Services\ParcelRiskAnalyser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The same condition, different activities, different advice.
 *
 * "Flooding is frequent" on a rice parcel is about drainage and planting
 * schedules. On a carabao it is about shelter and clean feed. On a pond it is
 * about dykes and stock loss. One sentence covering all three would be wrong
 * for at least two of them, which is the point of scoped wording.
 */
class ScopedRecommendationTest extends TestCase
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

    private function engine(): ClimateRecommendationEngine
    {
        return app(ClimateRecommendationEngine::class);
    }

    private function flooding(): array
    {
        return [['key' => 'frequent_flooding', 'weight' => 15, 'label' => 'Flooding reported as frequent']];
    }

    // ------------------------------------------------------- the same factor

    public function test_one_factor_produces_three_different_sentences(): void
    {
        $crop = $this->engine()->for($this->flooding(), ClimateRiskAssessment::SCOPE_PARCEL)[0]['text'];
        $livestock = $this->engine()->for($this->flooding(), ClimateRiskAssessment::SCOPE_LIVESTOCK)[0]['text'];
        $pond = $this->engine()->for($this->flooding(), ClimateRiskAssessment::SCOPE_AQUACULTURE)[0]['text'];

        $this->assertNotSame($crop, $livestock);
        $this->assertNotSame($crop, $pond);
        $this->assertNotSame($livestock, $pond);
    }

    public function test_the_livestock_wording_talks_about_animals_not_fields(): void
    {
        $text = $this->engine()->for($this->flooding(), ClimateRiskAssessment::SCOPE_LIVESTOCK)[0]['text'];

        $this->assertStringContainsString('animals', $text);
        $this->assertStringNotContainsStringIgnoringCase('planting', $text);
        $this->assertStringNotContainsStringIgnoringCase('variet', $text);
    }

    public function test_the_aquaculture_wording_talks_about_the_pond(): void
    {
        $text = $this->engine()->for($this->flooding(), ClimateRiskAssessment::SCOPE_AQUACULTURE)[0]['text'];

        $this->assertStringContainsString('pond', $text);
    }

    public function test_an_unscoped_call_still_gets_the_general_wording(): void
    {
        // Backward compatibility: the scorer and existing callers pass no
        // scope, and the general line was written for crops.
        $this->assertSame(
            config('climate_risk.recommendations.frequent_flooding'),
            $this->engine()->for($this->flooding())[0]['text'],
        );
    }

    public function test_a_factor_with_no_activity_wording_falls_back_rather_than_vanishing(): void
    {
        $factors = [['key' => 'declining_yield', 'weight' => 5, 'label' => 'Yield has fallen']];

        $this->assertSame(
            config('climate_risk.recommendations.declining_yield'),
            $this->engine()->for($factors, ClimateRiskAssessment::SCOPE_LIVESTOCK)[0]['text'],
        );
    }

    // ---------------------------------------------- advice about the record

    public function test_an_empty_record_earns_advice_to_start_keeping_one(): void
    {
        foreach (['crop', 'livestock', 'aquaculture'] as $kind) {
            $item = $this->engine()->forMissingEvidence($kind);

            $this->assertNotNull($item, "{$kind} has no missing-evidence wording");
            $this->assertSame('low', $item['priority'], 'Nothing is wrong; something is merely unrecorded');
            $this->assertSame(0, $item['weight'], 'It must never reach a score');
        }
    }

    public function test_the_missing_evidence_line_names_the_activity(): void
    {
        $this->assertStringContainsString(
            'livestock',
            strtolower($this->engine()->forMissingEvidence('livestock')['text']),
        );

        $this->assertStringContainsString(
            'pond',
            strtolower($this->engine()->forMissingEvidence('aquaculture')['text']),
        );
    }

    // ------------------------------------------------- through the analyser

    public function test_each_unit_carries_advice_written_for_its_own_activity(): void
    {
        $rice = $this->farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2, 'commodity' => 'Rice', 'parcel_number' => '1',
        ]);

        $carabao = $this->farmer->parcels()->create([
            'barangay' => 'Antagan I', 'no_of_heads_trees' => 80, 'commodity' => 'Carabao', 'parcel_number' => '2',
        ]);

        Fishpond::create([
            'farmer_id' => $this->farmer->id, 'species' => 'Tilapia',
            'pond_type' => 'freshwater', 'area_hectares' => 0.5,
        ]);

        // The SAME answer, recorded separately against each activity.
        foreach ([
            [ClimateRiskAssessment::SCOPE_PARCEL, ['farm_parcel_id' => $rice->id]],
            [ClimateRiskAssessment::SCOPE_LIVESTOCK, ['farm_parcel_id' => $carabao->id]],
        ] as [$scope, $extra]) {
            ClimateRiskAssessment::create($extra + [
                'farmer_id' => $this->farmer->id,
                'scope_type' => $scope,
                'assessed_at' => now(),
                'flood_frequency' => 'very_frequently',
            ]);
        }

        $units = collect(app(ParcelRiskAnalyser::class)->forFarmer($this->farmer, 'wet', 2026)['units'])
            ->keyBy('label');

        $riceText = collect($units['Parcel #1']['recommendations'])->firstWhere('key', 'frequent_flooding')['text'];
        $herdText = collect($units['Parcel #2']['recommendations'])->firstWhere('key', 'frequent_flooding')['text'];

        $this->assertNotSame($riceText, $herdText, 'One answer per activity must not produce one sentence');
        $this->assertStringContainsString('animals', $herdText);
    }

    public function test_a_parcel_with_no_history_is_told_to_start_recording(): void
    {
        $this->farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2, 'commodity' => 'Rice', 'parcel_number' => '1',
        ]);

        $unit = app(ParcelRiskAnalyser::class)->forFarmer($this->farmer, 'wet', 2026)['units'][0];

        $this->assertContains(
            'missing_evidence_crop',
            array_column($unit['recommendations'], 'key'),
        );
    }

    public function test_the_missing_evidence_advice_never_becomes_a_risk_factor(): void
    {
        // It is advice about the record, not a finding about the farm. A farm
        // nobody has written down is not thereby a risky farm.
        $this->farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2, 'commodity' => 'Rice', 'parcel_number' => '1',
        ]);

        $unit = app(ParcelRiskAnalyser::class)->forFarmer($this->farmer, 'wet', 2026)['units'][0];

        $this->assertNotContains('missing_evidence_crop', array_column($unit['factors'], 'key'));
        $this->assertNull($unit['level'], 'No assessment and no history is still no level');
    }
}
