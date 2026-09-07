<?php

namespace Tests\Feature;

use App\Models\CropSeason;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Whether a season made or lost money.
 *
 * The outcome belongs to the season - one parcel, one crop, one year - and not
 * to the farmer, because the same farmer can profit in the dry season and lose
 * in the wet. Nothing here writes a label onto a Farmer row.
 *
 * This is the historical target the risk scorer will later be measured
 * against, so it has to be derived from recorded figures rather than judged.
 */
class SeasonFinancialOutcomeTest extends TestCase
{
    use RefreshDatabase;

    private function season(array $attributes = []): CropSeason
    {
        return new CropSeason($attributes);
    }

    public function test_net_income_is_income_less_production_cost(): void
    {
        $season = $this->season(['total_income' => 150000, 'production_cost' => 90000]);

        $this->assertSame(60000.0, $season->net_farm_income);
    }

    public function test_income_above_cost_is_profitable(): void
    {
        $season = $this->season(['total_income' => 150000, 'production_cost' => 90000]);

        $this->assertSame(CropSeason::OUTCOME_PROFITABLE, $season->financial_outcome);
    }

    public function test_income_equal_to_cost_breaks_even(): void
    {
        $season = $this->season(['total_income' => 90000, 'production_cost' => 90000]);

        $this->assertSame(CropSeason::OUTCOME_BREAK_EVEN, $season->financial_outcome);
        $this->assertSame(0.0, $season->net_farm_income);
    }

    public function test_income_below_cost_is_a_loss(): void
    {
        $season = $this->season(['total_income' => 40000, 'production_cost' => 90000]);

        $this->assertSame(CropSeason::OUTCOME_LOSS, $season->financial_outcome);
        $this->assertSame(-50000.0, $season->net_farm_income);
    }

    public function test_a_season_with_no_income_recorded_has_no_outcome(): void
    {
        // Not break-even, and certainly not a loss: the office simply has not
        // recorded what the harvest sold for. Treating that as zero income
        // would manufacture a loss for every season still being encoded.
        $season = $this->season(['production_cost' => 90000]);

        $this->assertNull($season->net_farm_income);
        $this->assertNull($season->financial_outcome);
    }

    public function test_a_season_with_no_cost_recorded_has_no_outcome(): void
    {
        $season = $this->season(['total_income' => 150000]);

        $this->assertNull($season->net_farm_income);
        $this->assertNull($season->financial_outcome);
    }

    public function test_zero_income_against_a_real_cost_is_a_loss_not_missing(): void
    {
        // A total crop failure is a recorded zero, not an absent figure - this
        // is exactly the "palugi" case the research is looking for.
        $season = $this->season(['total_income' => 0, 'production_cost' => 90000]);

        $this->assertSame(CropSeason::OUTCOME_LOSS, $season->financial_outcome);
        $this->assertSame(-90000.0, $season->net_farm_income);
    }

    public function test_the_outcome_travels_with_the_row(): void
    {
        // The seasonal table renders it, so it has to survive serialisation
        // without the caller recomputing it.
        $season = $this->season(['total_income' => 150000, 'production_cost' => 90000])->toArray();

        $this->assertArrayHasKey('net_farm_income', $season);
        $this->assertArrayHasKey('financial_outcome', $season);
    }
}
