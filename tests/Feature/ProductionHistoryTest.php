<?php

namespace Tests\Feature;

use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Services\ProductionHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What counts as evidence, and what does not.
 *
 * This class exists to make one decision in one place: whether there is enough
 * recorded history to say anything about a parcel. Every screen that shows a
 * trend asks it, so "insufficient data" cannot mean one thing on the farmer's
 * portal and another on the office's analysis page.
 *
 * The rule it enforces throughout: absence of evidence is reported as absence
 * of evidence. A parcel with no records is never described as improving, never
 * described as declining, and never quietly treated as low risk.
 */
class ProductionHistoryTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;
    private FarmParcel $parcel;
    private Crop $rice;

    protected function setUp(): void
    {
        parent::setUp();

        $this->rice = Crop::create(['crop_name' => 'Rice', 'category' => 'Cereal']);

        $this->farmer = Farmer::create([
            'first_name'          => 'Renato',
            'last_name'           => 'Beronia',
            'sex'                 => 'Male',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        $this->parcel = $this->farmer->parcels()->create([
            'barangay'      => 'Caligayan',
            'total_area_ha' => 2,
            'commodity'     => 'Rice',
        ]);
    }

    private function season(string $season, int $year, ?float $yield, float $area = 2.0, array $extra = []): CropSeason
    {
        return CropSeason::create($extra + [
            'parcel_id'       => $this->parcel->id,
            'crop_id'         => $this->rice->id,
            'season'          => $season,
            'cropping_year'   => $year,
            'area_planted_ha' => $area,
            'yield_kg'        => $yield,
            'harvest_date'    => "{$year}-" . ($season === 'wet' ? '11' : '05') . "-01",
        ]);
    }

    private function history(): ProductionHistory
    {
        return app(ProductionHistory::class);
    }

    // ------------------------------------------------- comparable seasons only

    public function test_a_wet_season_is_compared_only_with_wet_seasons(): void
    {
        // The whole point of the rule: a dry-season figure describes a
        // different crop cycle and mixing them invents a trend that never
        // happened on the ground.
        $this->season('wet', 2024, 4200);
        $this->season('wet', 2025, 3800);
        $this->season('dry', 2025, 900);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertCount(2, $result['records']);
        $this->assertSame([4200.0, 3800.0], array_column($result['records'], 'yield'));
    }

    public function test_another_parcels_history_is_never_borrowed(): void
    {
        $other = $this->farmer->parcels()->create([
            'barangay' => 'Antagan', 'total_area_ha' => 1, 'commodity' => 'Rice',
        ]);

        CropSeason::create([
            'parcel_id' => $other->id, 'crop_id' => $this->rice->id,
            'season' => 'wet', 'cropping_year' => 2025,
            'area_planted_ha' => 1, 'yield_kg' => 9999,
        ]);

        $this->season('wet', 2024, 4200);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertCount(1, $result['records']);
        $this->assertSame(4200.0, $result['records'][0]['yield']);
    }

    public function test_a_season_with_no_recorded_yield_is_not_evidence(): void
    {
        $this->season('wet', 2024, 4200);
        $this->season('wet', 2025, null);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertCount(1, $result['records']);
    }

    public function test_records_in_a_different_unit_are_not_compared(): void
    {
        // 40 sacks against 4,000 kg is a hundredfold difference in this column
        // alone. Mixing them would manufacture a collapse or a boom.
        $this->season('wet', 2024, 4000, 2.0);
        $this->season('wet', 2025, 40, 2.0, ['production_unit' => 'sacks']);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertCount(1, $result['records'], 'Only the kilogram rows are comparable with each other');
    }

    // -------------------------------------------------------- data sufficiency

    public function test_no_records_reports_none_and_no_trend(): void
    {
        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertSame(ProductionHistory::SUFFICIENCY_NONE, $result['sufficiency']);
        $this->assertNull($result['trend'], 'A trend from nothing would be invented');
        $this->assertSame(0, $result['comparable_seasons']);
    }

    public function test_one_record_is_limited_and_still_has_no_trend(): void
    {
        $this->season('wet', 2025, 4200);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertSame(ProductionHistory::SUFFICIENCY_LIMITED, $result['sufficiency']);
        $this->assertNull($result['trend'], 'One point is not a direction');
    }

    public function test_two_records_give_a_direction_but_stay_limited(): void
    {
        $this->season('wet', 2024, 4200);
        $this->season('wet', 2025, 3800);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertSame(ProductionHistory::SUFFICIENCY_LIMITED, $result['sufficiency']);
        $this->assertSame(ProductionHistory::TREND_DECLINING, $result['trend']);
    }

    public function test_three_records_are_sufficient(): void
    {
        $this->season('wet', 2023, 4500);
        $this->season('wet', 2024, 4200);
        $this->season('wet', 2025, 3800);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertSame(ProductionHistory::SUFFICIENCY_SUFFICIENT, $result['sufficiency']);
        $this->assertSame(ProductionHistory::TREND_DECLINING, $result['trend']);
    }

    public function test_a_rising_run_reads_as_improving(): void
    {
        $this->season('wet', 2023, 3000);
        $this->season('wet', 2024, 3500);
        $this->season('wet', 2025, 4100);

        $this->assertSame(
            ProductionHistory::TREND_IMPROVING,
            $this->history()->forParcel($this->parcel, 'wet')['trend'],
        );
    }

    public function test_a_flat_run_reads_as_steady_not_as_a_direction(): void
    {
        $this->season('wet', 2023, 4000);
        $this->season('wet', 2024, 4020);
        $this->season('wet', 2025, 3990);

        $this->assertSame(
            ProductionHistory::TREND_STEADY,
            $this->history()->forParcel($this->parcel, 'wet')['trend'],
        );
    }

    // ------------------------------------------------------ comparing per area

    public function test_the_trend_is_measured_per_hectare_not_by_raw_weight(): void
    {
        // Half the land producing nearly the same weight is a better season,
        // not a worse one. Raw totals would report it backwards.
        $this->season('wet', 2024, 4000, 2.0);   // 2,000 kg/ha
        $this->season('wet', 2025, 3000, 1.0);   // 3,000 kg/ha

        $this->assertSame(
            ProductionHistory::TREND_IMPROVING,
            $this->history()->forParcel($this->parcel, 'wet')['trend'],
        );
    }

    // ------------------------------------------------------------ what it says

    public function test_it_describes_its_own_evidence_for_display(): void
    {
        $this->season('wet', 2024, 4200);
        $this->season('wet', 2025, 3800);

        $result = $this->history()->forParcel($this->parcel, 'wet');

        $this->assertNotEmpty($result['summary']);
        $this->assertStringContainsString('2', $result['summary']);
    }

    public function test_livestock_and_aquaculture_report_their_own_absence(): void
    {
        // Neither has a dated production table in this schema, so the honest
        // answer is that no time series exists — not a trend, and not a level.
        foreach (['livestock', 'aquaculture'] as $kind) {
            $result = $this->history()->none($kind);

            $this->assertSame(ProductionHistory::SUFFICIENCY_NONE, $result['sufficiency']);
            $this->assertNull($result['trend']);
            $this->assertSame([], $result['records']);
            $this->assertStringContainsString($kind, strtolower($result['summary']));
        }
    }
}
