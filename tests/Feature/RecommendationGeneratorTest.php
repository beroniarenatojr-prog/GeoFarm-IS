<?php

namespace Tests\Feature;

use App\Models\AgriculturalIntervention;
use App\Models\ClimateRiskAssessment;
use App\Models\Crop;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\FinancialAssistance;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Models\Recommendation;
use App\Services\ParcelRiskAnalyser;
use App\Services\ProductionHistory;
use App\Services\RecommendationGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Recommendations generated from real answers and real records.
 *
 * What these pin down is mostly what must NOT happen: no advice without the
 * condition behind it, no trend without comparable seasons, no programme named
 * that nobody has created, no livestock claim about a commodity the register
 * cannot classify, and no risk score moved by advisory-only factors.
 */
class RecommendationGeneratorTest extends TestCase
{
    use RefreshDatabase;

    private RecommendationGenerator $generator;
    private Farmer $farmer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->generator = app(RecommendationGenerator::class);

        $this->farmer = Farmer::create([
            'first_name'          => 'Juan',
            'last_name'           => 'Dela Cruz',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    /** Whatever the config counts as a "frequent" answer, read rather than assumed. */
    private function frequentAnswer(): string
    {
        return config('climate_risk.thresholds.frequent_answers')[0];
    }

    private function cropParcel(string $number = 'P-1'): FarmParcel
    {
        Crop::firstOrCreate(['crop_name' => 'Rice'], ['category' => 'Cereal']);

        return FarmParcel::create([
            'farmer_id'     => $this->farmer->id,
            'parcel_number' => $number,
            'barangay'      => 'Caligayan',
            'total_area_ha' => 2.0,
            'commodity'     => 'Rice',
        ]);
    }

    private function livestockParcel(string $commodity = 'Carabao'): FarmParcel
    {
        LivestockType::firstOrCreate(['type_name' => 'Carabao'], ['category' => 'Large Ruminant']);

        return FarmParcel::create([
            'farmer_id'         => $this->farmer->id,
            'parcel_number'     => 'P-LIVE',
            'barangay'          => 'Caligayan',
            'commodity'         => $commodity,
            'no_of_heads_trees' => 80,
        ]);
    }

    private function pond(): Fishpond
    {
        return Fishpond::create([
            'farmer_id'     => $this->farmer->id,
            'species'       => 'Tilapia',
            'pond_type'     => 'freshwater',
            'area_hectares' => 0.30,
        ]);
    }

    private function assess(array $answers = [], string $scope = ClimateRiskAssessment::SCOPE_FARMER): ClimateRiskAssessment
    {
        return $this->farmer->riskAssessments()->create(array_merge([
            'scope_type'  => $scope,
            'assessed_at' => now(),
        ], $answers));
    }

    /** @return array<int, string> the factor keys behind the generated rows */
    private function generatedKeys(): array
    {
        return Recommendation::pluck('factor_key')->all();
    }

    // ------------------------------------------------------------ 1, 4, 5

    public function test_flooding_answer_produces_a_flooding_recommendation(): void
    {
        $this->cropParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);

        $this->generator->forFarmer($this->farmer);

        $this->assertContains('frequent_flooding', $this->generatedKeys());
        $this->assertNotContains('frequent_drought', $this->generatedKeys());
    }

    public function test_drought_answer_produces_a_drought_recommendation(): void
    {
        $this->cropParcel();
        $this->assess(['drought_frequency' => $this->frequentAnswer()]);

        $this->generator->forFarmer($this->farmer);

        $this->assertContains('frequent_drought', $this->generatedKeys());
        $this->assertNotContains('frequent_flooding', $this->generatedKeys());
    }

    // ------------------------------------------------------------ 2

    public function test_no_water_barrier_produces_water_management_advice(): void
    {
        $this->cropParcel();
        $this->assess(['adaptation_barrier' => 'no_water']);

        $this->generator->forFarmer($this->farmer);

        $row = Recommendation::where('factor_key', 'barrier_no_water')->first();

        $this->assertNotNull($row, 'A stated "no water" barrier should raise water advice.');
        $this->assertSame('water', $row->category);
        $this->assertStringContainsStringIgnoringCase('water', $row->title);
        // The reason is the farmer's own stated barrier, not a restatement.
        $this->assertStringContainsStringIgnoringCase('barrier', $row->reason);
        $this->assertSame('assessment', $row->evidence_source);
    }

    public function test_a_different_barrier_does_not_produce_water_advice(): void
    {
        $this->cropParcel();
        $this->assess(['adaptation_barrier' => 'no_knowledge']);

        $this->generator->forFarmer($this->farmer);

        $this->assertNotContains('barrier_no_water', $this->generatedKeys());
    }

    // ------------------------------------------------------------ 3

    public function test_seed_cost_expectation_produces_assistance_advice(): void
    {
        $this->cropParcel();
        $this->assess(['anticipated_factors' => ['seed_cost', 'flooding']]);

        $this->generator->forFarmer($this->farmer);

        $row = Recommendation::where('factor_key', 'anticipates_seed_cost')->first();

        $this->assertNotNull($row);
        $this->assertSame('assistance', $row->category);
        $this->assertStringContainsStringIgnoringCase('seed cost', $row->reason);
    }

    public function test_an_unmentioned_cost_produces_no_seed_advice(): void
    {
        $this->cropParcel();
        $this->assess(['anticipated_factors' => ['labour_cost']]);

        $this->generator->forFarmer($this->farmer);

        $this->assertNotContains('anticipates_seed_cost', $this->generatedKeys());
    }

    // ------------------------------------------------------------ 6

    public function test_absent_factors_produce_no_recommendations_for_them(): void
    {
        $this->cropParcel();

        // Every frequency answered at the calm end; nothing should be raised.
        $this->assess([
            'flood_frequency'    => 'never',
            'drought_frequency'  => 'never',
            'had_financial_loss' => 'no',
        ]);

        $this->generator->forFarmer($this->farmer);

        $keys = $this->generatedKeys();

        foreach (['frequent_flooding', 'frequent_drought', 'reported_financial_loss',
                  'barrier_no_water', 'anticipates_seed_cost'] as $absent) {
            $this->assertNotContains($absent, $keys, "[$absent] was raised without its condition.");
        }

        // Baseline upkeep advice still appears — a clean result is not an empty page.
        $this->assertGreaterThan(0, Recommendation::count());
        $this->assertNotEmpty(Recommendation::where('evidence_source', 'baseline')->get());
    }

    // ------------------------------------------------------------ 7, 8, 9

    public function test_repeated_generation_creates_no_duplicates(): void
    {
        $this->cropParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);

        $first = $this->generator->forFarmer($this->farmer);
        $count = Recommendation::count();

        $this->assertGreaterThan(0, $first['created']);

        for ($run = 0; $run < 3; $run++) {
            $again = $this->generator->forFarmer($this->farmer);
            $this->assertSame(0, $again['created'], 'A re-run created new rows.');
        }

        $this->assertSame($count, Recommendation::count());
    }

    public function test_a_rejected_recommendation_survives_regeneration(): void
    {
        $this->cropParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);

        $this->generator->forFarmer($this->farmer);

        $row = Recommendation::where('factor_key', 'frequent_flooding')->firstOrFail();
        $row->update(['status' => Recommendation::STATUS_REJECTED]);

        $this->generator->forFarmer($this->farmer);

        $this->assertSame(Recommendation::STATUS_REJECTED, $row->fresh()->status);
        $this->assertSame(1, Recommendation::where('factor_key', 'frequent_flooding')->count());
    }

    public function test_a_closed_recommendation_survives_regeneration(): void
    {
        $this->cropParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);
        $this->generator->forFarmer($this->farmer);

        $row = Recommendation::where('factor_key', 'frequent_flooding')->firstOrFail();
        $row->update(['status' => Recommendation::STATUS_CLOSED]);

        $this->generator->forFarmer($this->farmer);

        $this->assertSame(Recommendation::STATUS_CLOSED, $row->fresh()->status);
    }

    public function test_a_new_assessment_creates_a_new_snapshot(): void
    {
        $this->cropParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);
        $this->generator->forFarmer($this->farmer);

        $before = Recommendation::where('factor_key', 'frequent_flooding')->count();

        // A fresh assessment of the same activity, later.
        $this->travel(1)->days();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);
        $this->generator->forFarmer($this->farmer);

        $this->assertGreaterThan(
            $before,
            Recommendation::where('factor_key', 'frequent_flooding')->count(),
            'A new assessment should produce a new snapshot.'
        );
    }

    // ------------------------------------------------------------ 10

    public function test_crop_advice_stays_parcel_scoped_and_names_its_parcel(): void
    {
        $parcel = $this->cropParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);

        $this->generator->forFarmer($this->farmer);

        foreach (Recommendation::all() as $row) {
            $this->assertSame(Recommendation::SCOPE_PARCEL, $row->scope_type);
            $this->assertSame($parcel->id, $row->farm_parcel_id);
            $this->assertNull($row->fishpond_id);
        }
    }

    // ------------------------------------------------------------ 11, 15

    public function test_livestock_without_history_is_insufficient_and_has_no_trend(): void
    {
        $parcel = $this->livestockParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);

        $this->generator->forFarmer($this->farmer);

        $rows = Recommendation::where('scope_type', Recommendation::SCOPE_LIVESTOCK)->get();

        $this->assertNotEmpty($rows, 'A livestock holding should still receive advice.');

        foreach ($rows as $row) {
            $this->assertSame(Recommendation::SUFFICIENCY_INSUFFICIENT, $row->data_sufficiency);
            $this->assertSame($parcel->id, $row->farm_parcel_id);
            $this->assertNull($row->fishpond_id);
        }

        // No history-derived factor can appear, because there is no history.
        foreach (['declining_yield', 'yield_below_peers', 'cost_per_kilo_above_peers'] as $trend) {
            $this->assertNotContains($trend, $this->generatedKeys());
        }

        // And the analyser refuses to band it at all.
        $analysis = app(ParcelRiskAnalyser::class)->forFarmer($this->farmer->fresh());
        $unit = collect($analysis['units'])->firstWhere('kind', ParcelRiskAnalyser::KIND_LIVESTOCK);

        $this->assertNull($unit['level'], 'Missing history must not be banded.');
        $this->assertNull($unit['score']);
        $this->assertSame('Insufficient historical livestock data', $unit['note']);
    }

    // ------------------------------------------------------------ 12

    public function test_aquaculture_without_history_is_insufficient_and_has_no_trend(): void
    {
        $pond = $this->pond();
        $this->assess(['drought_frequency' => $this->frequentAnswer()]);

        $this->generator->forFarmer($this->farmer);

        $rows = Recommendation::where('scope_type', Recommendation::SCOPE_AQUACULTURE)->get();

        $this->assertNotEmpty($rows);

        foreach ($rows as $row) {
            $this->assertSame(Recommendation::SUFFICIENCY_INSUFFICIENT, $row->data_sufficiency);
            $this->assertSame($pond->id, $row->fishpond_id);
            $this->assertNull($row->farm_parcel_id);
        }

        $analysis = app(ParcelRiskAnalyser::class)->forFarmer($this->farmer->fresh());
        $unit = collect($analysis['units'])->firstWhere('kind', ParcelRiskAnalyser::KIND_AQUACULTURE);

        $this->assertNull($unit['level']);
        $this->assertSame('Insufficient historical aquaculture data', $unit['note']);
    }

    // ------------------------------------------------------------ 13

    public function test_an_unclassifiable_commodity_is_not_treated_as_livestock(): void
    {
        // Free text matching neither lookup table.
        $this->livestockParcel('Kalabaw na puti');
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);

        $this->generator->forFarmer($this->farmer);

        $this->assertSame(
            0,
            Recommendation::where('scope_type', Recommendation::SCOPE_LIVESTOCK)->count(),
            'An unrecognised commodity must not be guessed into livestock scope.'
        );
    }

    // ------------------------------------------------------------ 14

    public function test_no_recommendation_claims_a_programme_that_does_not_exist(): void
    {
        $this->cropParcel();
        $this->assess([
            'anticipated_factors' => ['seed_cost'],
            'had_financial_loss'  => 'yes',
        ]);

        $this->assertSame(0, FinancialAssistance::count(), 'Precondition: no programmes exist.');

        $this->generator->forFarmer($this->farmer);

        foreach (Recommendation::all() as $row) {
            $text = $row->title . ' ' . $row->reason;

            foreach (['apply for the', 'enrol in the', 'you qualify', 'has been approved'] as $claim) {
                $this->assertStringNotContainsStringIgnoringCase($claim, $text);
            }
        }

        $seed = Recommendation::where('factor_key', 'anticipates_seed_cost')->firstOrFail();
        $this->assertStringContainsStringIgnoringCase('check', $seed->title . ' ' . $seed->reason);
    }

    // ------------------------------------------------------------ 16

    public function test_a_recommendation_converts_to_an_intervention_without_completing_it(): void
    {
        $parcel = $this->cropParcel();
        $this->assess(['flood_frequency' => $this->frequentAnswer()]);
        $this->generator->forFarmer($this->farmer);

        $row = Recommendation::where('factor_key', 'frequent_flooding')->firstOrFail();

        $intervention = $row->convertToIntervention();

        $this->assertInstanceOf(AgriculturalIntervention::class, $intervention);
        $this->assertSame($this->farmer->id, $intervention->farmer_id);
        $this->assertSame($parcel->id, $intervention->farm_parcel_id);

        // Opened, not done.
        $this->assertSame(AgriculturalIntervention::STATUS_PENDING, $intervention->status);
        $this->assertNull($intervention->action_taken);
        $this->assertNull($intervention->completed_at);
        $this->assertNull($intervention->completed_by);

        // The advice is marked dealt with, and still points at the work.
        $this->assertSame(Recommendation::STATUS_CONVERTED, $row->fresh()->status);
        $this->assertSame($intervention->id, $row->fresh()->intervention_id);

        // Converting twice does not open a second visit.
        $this->assertSame($intervention->id, $row->fresh()->convertToIntervention()->id);
        $this->assertSame(1, AgriculturalIntervention::count());
    }

    // ------------------------------------------------------------ extra

    public function test_advisory_factors_do_not_move_the_risk_score(): void
    {
        $parcel = $this->cropParcel();
        $analyser = app(ParcelRiskAnalyser::class);

        $this->assess(['flood_frequency' => $this->frequentAnswer()]);
        $withoutAdvisory = collect($analyser->forFarmer($this->farmer->fresh())['units'])
            ->firstWhere('parcel_id', $parcel->id);

        // Same assessment plus the two advisory answers.
        $this->travel(1)->days();
        $this->assess([
            'flood_frequency'     => $this->frequentAnswer(),
            'adaptation_barrier'  => 'no_water',
            'anticipated_factors' => ['seed_cost'],
        ]);
        $withAdvisory = collect($analyser->forFarmer($this->farmer->fresh())['units'])
            ->firstWhere('parcel_id', $parcel->id);

        $this->assertSame($withoutAdvisory['score'], $withAdvisory['score'], 'Advisory factors changed the score.');
        $this->assertSame($withoutAdvisory['level'], $withAdvisory['level'], 'Advisory factors changed the band.');

        // But they did add advice.
        $keys = array_column($withAdvisory['factors'], 'key');
        $this->assertContains('barrier_no_water', $keys);
        $this->assertContains('anticipates_seed_cost', $keys);
    }

    public function test_production_history_none_is_recorded_as_insufficient(): void
    {
        $this->pond();
        $this->assess();

        $this->generator->forFarmer($this->farmer);

        // The analyser speaks ProductionHistory's vocabulary...
        $analysis = app(ParcelRiskAnalyser::class)->forFarmer($this->farmer->fresh());
        $unit = collect($analysis['units'])->firstWhere('kind', ParcelRiskAnalyser::KIND_AQUACULTURE);
        $this->assertSame(ProductionHistory::SUFFICIENCY_NONE, $unit['data_sufficiency']);

        // ...and the stored row speaks the workflow's, without either changing.
        $this->assertSame(
            Recommendation::SUFFICIENCY_INSUFFICIENT,
            Recommendation::where('scope_type', Recommendation::SCOPE_AQUACULTURE)->value('data_sufficiency')
        );
    }

    public function test_every_generated_row_carries_its_evidence(): void
    {
        $this->cropParcel();
        $this->assess([
            'flood_frequency'    => $this->frequentAnswer(),
            'adaptation_barrier' => 'no_water',
        ]);

        $this->generator->forFarmer($this->farmer);

        foreach (Recommendation::all() as $row) {
            $this->assertNotEmpty($row->title);
            $this->assertNotEmpty($row->reason, 'A recommendation must say why it was generated.');
            $this->assertContains($row->evidence_source, Recommendation::EVIDENCE_SOURCES);
            $this->assertContains($row->priority, Recommendation::PRIORITIES);
            $this->assertNotNull($row->generated_at);
            $this->assertNotNull($row->fingerprint);
        }
    }
}
