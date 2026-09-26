<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Services\WeightedYieldPredictor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The weighted moving average, checked against worked examples.
 *
 * Every expected figure here was calculated by hand from the rule, not read
 * back out of the code — a test that asserts whatever the implementation
 * happens to produce proves only that it is consistent.
 */
class WeightedYieldPredictorTest extends TestCase
{
    use RefreshDatabase;

    private WeightedYieldPredictor $predictor;
    private Crop $rice;
    private Farmer $farmerA;
    private Farmer $farmerB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->predictor = app(WeightedYieldPredictor::class);
        $this->rice = Crop::create(['crop_name' => 'Rice', 'category' => 'Cereal']);

        $this->farmerA = $this->farmer('Juan', 'Dela Cruz', 'San Pedro');
        $this->farmerB = $this->farmer('Maria', 'Santos', 'San Pedro');
    }

    private function farmer(string $first, string $last, string $barangay): Farmer
    {
        return Farmer::create([
            'first_name'          => $first,
            'last_name'           => $last,
            'sex'                 => 'Male',
            'barangay'            => $barangay,
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    /**
     * A parcel inserted straight through the query builder.
     *
     * FarmParcel has an observer that opens croppings automatically. Those
     * extra rows would be counted as history by the predictor and quietly
     * change every expected figure below.
     */
    private function parcel(Farmer $farmer, string $barangay): int
    {
        return FarmParcel::insertGetId([
            'farmer_id'     => $farmer->id,
            'parcel_number' => 'P-' . $farmer->id,
            'barangay'      => $barangay,
            'total_area_ha' => 2.0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }

    /** One completed cropping. Area defaults to 1 ha so yield_kg reads as kg/ha. */
    private function season(int $parcelId, int $year, float $yieldKg, float $areaHa = 1.0, array $extra = []): CropSeason
    {
        return CropSeason::create(array_merge([
            'parcel_id'         => $parcelId,
            'crop_id'           => $this->rice->id,
            'season'            => 'wet',
            'cropping_year'     => $year,
            'area_planted_ha'   => $areaHa,
            'harvested_area_ha' => $areaHa,
            'harvest_date'      => "{$year}-10-15",
            'yield_kg'          => $yieldKg,
        ], $extra));
    }

    // ── The worked example ────────────────────────────────────────────────

    public function test_three_seasons_give_the_weighted_average_at_high_confidence(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');

        // 0.5*4200 + 0.3*4000 + 0.2*3800 = 2100 + 1200 + 760 = 4060
        $this->season($parcel, 2025, 4200);
        $this->season($parcel, 2024, 4000);
        $this->season($parcel, 2023, 3800);

        $result = $this->predictor->predictYield($this->farmerA->id, $this->rice->id, 'wet', 'San Pedro');

        $this->assertSame(4060.00, $result['yield_kg_ha']);
        $this->assertSame(WeightedYieldPredictor::CONFIDENCE_HIGH, $result['confidence']);
        $this->assertSame(WeightedYieldPredictor::BASIS_FARMER, $result['basis']);
        $this->assertSame(3, $result['records']);

        // 4060 * 1.5 ha
        $this->assertSame(6090.00, $this->predictor->predictedHarvest(4060.00, 1.5));
    }

    public function test_prediction_error_is_measured_against_the_actual_harvest(): void
    {
        // |6090 - 5700| / 5700 * 100 = 6.842105... -> 6.84
        $this->assertSame(6.84, $this->predictor->errorPercent(6090.00, 5700.00));
    }

    public function test_a_second_farmer_predicted_total_uses_their_own_area(): void
    {
        // 3500 kg/ha on 0.5 ha
        $this->assertSame(1750.00, $this->predictor->predictedHarvest(3500.00, 0.5));
    }

    public function test_the_barangay_predicted_aggregate_is_area_weighted(): void
    {
        // (6090 + 1750) / (1.5 + 0.5) = 7840 / 2.0 = 3920
        $aggregate = $this->predictor->aggregatePredictedYield([
            ['predicted_harvest_kg' => 6090.00, 'expected_harvested_area_ha' => 1.5],
            ['predicted_harvest_kg' => 1750.00, 'expected_harvested_area_ha' => 0.5],
        ]);

        $this->assertSame(3920.00, $aggregate);

        /*
         * The mean of the two yields would be (4060 + 3500) / 2 = 3780, which
         * is a different and wrong answer. Asserted so nobody "simplifies"
         * this into averaging the ratios later.
         */
        $this->assertNotSame(3780.00, $aggregate);
    }

    // ── Yield gap and flagging ────────────────────────────────────────────

    public function test_a_shortfall_past_the_threshold_is_flagged_as_performance(): void
    {
        // (4100 - 2900) / 4100 * 100 = 29.268... -> 29.27
        $gap = $this->predictor->yieldGapPercent(4100.00, 2900.00);
        $this->assertSame(29.27, $gap);

        $flag = $this->predictor->assessmentFlag(4100.00, 2900.00, false);
        $this->assertTrue($flag['flagged']);
        $this->assertSame(29.27, $flag['gap_percent']);
        $this->assertSame('performance', $flag['reason']);
    }

    public function test_the_same_shortfall_in_a_calamity_season_is_flagged_as_calamity(): void
    {
        $flag = $this->predictor->assessmentFlag(4100.00, 2900.00, true);

        $this->assertTrue($flag['flagged']);
        $this->assertSame(29.27, $flag['gap_percent'], 'the gap is still real and still reported');

        // Different reason, so the office is pointed at assistance rather than
        // at training a farmer whose field was under water.
        $this->assertSame('calamity', $flag['reason']);
    }

    public function test_a_small_shortfall_is_not_flagged(): void
    {
        $flag = $this->predictor->assessmentFlag(4000.00, 3800.00, false);

        $this->assertFalse($flag['flagged']);
        $this->assertSame(5.00, $flag['gap_percent']);
        $this->assertNull($flag['reason']);
    }

    // ── Thin history ──────────────────────────────────────────────────────

    public function test_two_seasons_renormalise_the_weights(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');
        $this->season($parcel, 2025, 4200);
        $this->season($parcel, 2024, 4000);

        // (0.5*4200 + 0.3*4000) / 0.8 = (2100 + 1200) / 0.8 = 4125
        $result = $this->predictor->predictYield($this->farmerA->id, $this->rice->id, 'wet', 'San Pedro');

        $this->assertSame(4125.00, $result['yield_kg_ha']);
        $this->assertSame(WeightedYieldPredictor::CONFIDENCE_MEDIUM, $result['confidence']);
        $this->assertSame(2, $result['records']);
    }

    public function test_one_season_is_used_as_is_at_low_confidence(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');
        $this->season($parcel, 2025, 4200);

        $result = $this->predictor->predictYield($this->farmerA->id, $this->rice->id, 'wet', 'San Pedro');

        $this->assertSame(4200.00, $result['yield_kg_ha']);
        $this->assertSame(WeightedYieldPredictor::CONFIDENCE_LOW, $result['confidence']);
        $this->assertSame(1, $result['records']);
    }

    public function test_no_history_falls_back_to_the_barangay_and_says_so(): void
    {
        // Farmer B has history in the same barangay; farmer A has none.
        $theirs = $this->parcel($this->farmerB, 'San Pedro');
        $this->season($theirs, 2025, 6000, 2.0);   // 6000 kg over 2 ha = 3000 kg/ha
        $this->season($theirs, 2024, 3000, 1.0);   // 3000 kg over 1 ha = 3000 kg/ha

        // Area-weighted: (6000 + 3000) / (2 + 1) = 3000
        $result = $this->predictor->predictYield($this->farmerA->id, $this->rice->id, 'wet', 'San Pedro');

        $this->assertSame(3000.00, $result['yield_kg_ha']);
        $this->assertSame(WeightedYieldPredictor::CONFIDENCE_BASELINE, $result['confidence']);
        $this->assertSame(WeightedYieldPredictor::BASIS_BARANGAY, $result['basis']);
        $this->assertSame(0, $result['records']);
    }

    public function test_no_barangay_history_falls_back_to_the_municipality(): void
    {
        $elsewhere = $this->parcel($this->farmerB, 'Antagan I');
        $this->season($elsewhere, 2025, 2500);

        $result = $this->predictor->predictYield($this->farmerA->id, $this->rice->id, 'wet', 'San Pedro');

        $this->assertSame(2500.00, $result['yield_kg_ha']);
        $this->assertSame(WeightedYieldPredictor::BASIS_MUNICIPAL, $result['basis']);
    }

    public function test_nothing_anywhere_returns_null_with_a_reason_not_zero(): void
    {
        $result = $this->predictor->predictYield($this->farmerA->id, $this->rice->id, 'wet', 'San Pedro');

        $this->assertNull($result['yield_kg_ha'], 'zero would read as a predicted total crop failure');
        $this->assertNull($result['confidence']);
        $this->assertNotNull($result['reason']);
    }

    // ── Exclusions ────────────────────────────────────────────────────────

    public function test_a_calamity_season_is_left_out_of_the_average(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');

        $this->season($parcel, 2025, 4200);
        $ruined = $this->season($parcel, 2024, 900);    // flooded
        $this->season($parcel, 2023, 4000);

        ClimateRiskAssessment::create([
            'farmer_id'      => $this->farmerA->id,
            'crop_season_id' => $ruined->id,
            'assessed_at'    => now(),
            'climate_events' => ['flooding'],
        ]);

        $this->assertTrue($this->predictor->isCalamityAffected($ruined->fresh()));
        $this->assertSame('flood', $this->predictor->calamityType($ruined->fresh()));

        /*
         * With the flood season dropped, only 4200 and 4000 remain:
         * (0.5*4200 + 0.3*4000) / 0.8 = 4125.
         * Including it would give 0.5*4200 + 0.3*900 + 0.2*4000 = 3170.
         */
        $result = $this->predictor->predictYield($this->farmerA->id, $this->rice->id, 'wet', 'San Pedro');

        $this->assertSame(4125.00, $result['yield_kg_ha']);
        $this->assertSame(2, $result['records']);
    }

    public function test_an_assessment_reporting_none_is_not_a_calamity(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');
        $season = $this->season($parcel, 2025, 4200);

        ClimateRiskAssessment::create([
            'farmer_id'      => $this->farmerA->id,
            'crop_season_id' => $season->id,
            'assessed_at'    => now(),
            'climate_events' => ['none'],
        ]);

        $this->assertFalse($this->predictor->isCalamityAffected($season->fresh()));
    }

    public function test_a_season_recorded_in_sacks_is_excluded_from_kilogram_figures(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');
        $sacks = $this->season($parcel, 2025, 40, 1.0, ['production_unit' => 'sacks']);

        $this->assertNull(
            $this->predictor->actualYield($sacks->fresh()),
            '40 sacks must never be counted as 40 kilograms',
        );
    }

    // ── Division by zero ──────────────────────────────────────────────────

    public function test_zero_harvested_area_returns_null_without_error(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');

        $season = $this->season($parcel, 2025, 4200, 0.0);
        $season->forceFill(['area_planted_ha' => 0, 'harvested_area_ha' => 0])->save();

        $this->assertNull($this->predictor->actualYield($season->fresh()));
    }

    public function test_a_null_area_returns_null_without_error(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');

        $season = $this->season($parcel, 2025, 4200);
        $season->forceFill(['area_planted_ha' => null, 'harvested_area_ha' => null])->save();

        $this->assertNull($this->predictor->actualYield($season->fresh()));
    }

    public function test_predicted_harvest_is_null_when_either_side_is_unknown(): void
    {
        $this->assertNull($this->predictor->predictedHarvest(null, 1.5));
        $this->assertNull($this->predictor->predictedHarvest(4060.00, null));
        $this->assertNull($this->predictor->predictedHarvest(4060.00, 0.0));
    }

    public function test_error_and_gap_are_undefined_against_a_zero_harvest(): void
    {
        $this->assertNull($this->predictor->errorPercent(6090.00, 0.0));
        $this->assertNull($this->predictor->yieldGapPercent(0.0, 2900.00));
    }

    // ── Accuracy across many predictions ──────────────────────────────────

    public function test_mape_averages_the_absolute_errors(): void
    {
        // |110-100|/100 = 10 ; |80-100|/100 = 20 ; mean = 15
        $mape = $this->predictor->mape([
            ['predicted' => 110.0, 'actual' => 100.0],
            ['predicted' => 80.0,  'actual' => 100.0],
        ]);

        $this->assertSame(15.00, $mape);
    }

    public function test_mape_skips_unscorable_pairs_rather_than_counting_them_as_perfect(): void
    {
        $mape = $this->predictor->mape([
            ['predicted' => 110.0, 'actual' => 100.0],
            ['predicted' => null,  'actual' => 100.0],
            ['predicted' => 90.0,  'actual' => 0.0],
        ]);

        // Only the first pair is scorable, so the answer is its own error.
        $this->assertSame(10.00, $mape);
    }

    public function test_history_can_be_reconstructed_as_it_stood_before_a_harvest(): void
    {
        $parcel = $this->parcel($this->farmerA, 'San Pedro');
        $this->season($parcel, 2023, 3800);
        $this->season($parcel, 2024, 4000);
        $this->season($parcel, 2025, 4200);

        /*
         * The point of the cut-off: evaluating the 2025 prediction must not use
         * the 2025 harvest it is being judged against, or the forecast would
         * shift toward the outcome and always look accurate.
         */
        $before = $this->predictor->predictYield(
            $this->farmerA->id, $this->rice->id, 'wet', 'San Pedro', '2025-01-01',
        );

        // (0.5*4000 + 0.3*3800) / 0.8 = (2000 + 1140) / 0.8 = 3925
        $this->assertSame(3925.00, $before['yield_kg_ha']);
        $this->assertSame(2, $before['records']);
    }
}
