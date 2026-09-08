<?php

namespace Tests\Feature;

use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The catch-up for parcels that existed before seasons opened automatically.
 *
 * Without this, a registry full of farmers shows an empty Seasonal Tracking
 * page and nothing on screen explains why.
 */
class BackfillCroppingSeasonsTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->farmer = Farmer::create([
            'first_name'          => 'Mayumi',
            'last_name'           => 'Telan',
            'sex'                 => 'Female',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    /**
     * A parcel as it existed before the observer.
     *
     * Inserted straight through the query builder so the observer does not
     * fire — that is exactly the state this command exists to repair.
     */
    private function legacyParcel(array $overrides = []): int
    {
        return FarmParcel::insertGetId(array_merge([
            'farmer_id'         => $this->farmer->id,
            'parcel_number'     => 'SAKAHAN-1',
            'barangay'          => 'Caligayan',
            'total_area_ha'     => 2.0,
            'commodity'         => 'Rice',
            'cropping_schedule' => 'Wet/Dry',
            'created_at'        => now(),
            'updated_at'        => now(),
        ], $overrides));
    }

    public function test_a_dry_run_reports_without_writing_anything(): void
    {
        $this->legacyParcel();

        $this->artisan('seasons:backfill', ['--dry-run' => true])
            ->expectsOutputToContain('Would open: 2')
            ->assertSuccessful();

        $this->assertSame(0, CropSeason::count(), 'a dry run must not write');
    }

    public function test_it_opens_the_missing_croppings(): void
    {
        $parcel = $this->legacyParcel();

        $this->artisan('seasons:backfill')->assertSuccessful();

        $this->assertSame(
            ['dry', 'wet'],
            CropSeason::where('parcel_id', $parcel)->orderBy('season')->pluck('season')->all(),
        );
    }

    public function test_running_it_twice_does_not_duplicate(): void
    {
        $this->legacyParcel();

        $this->artisan('seasons:backfill')->assertSuccessful();
        $this->artisan('seasons:backfill')->assertSuccessful();

        $this->assertSame(2, CropSeason::count());
    }

    public function test_a_parcel_without_a_schedule_is_named_rather_than_guessed_at(): void
    {
        // The office has not said how this land is worked. Inventing a cropping
        // would put production on the books that may never happen, so the
        // command reports it as something a person has to answer.
        $this->legacyParcel(['cropping_schedule' => null]);

        $this->artisan('seasons:backfill')
            ->expectsOutputToContain('no Cropping Schedule')
            ->assertSuccessful();

        $this->assertSame(0, CropSeason::count());
    }

    public function test_it_says_so_when_there_are_no_parcels_at_all(): void
    {
        // The likeliest reason an office sees an empty Seasonal Tracking page:
        // farmers are registered but no land was ever recorded against them.
        $this->artisan('seasons:backfill')
            ->expectsOutputToContain('No farm parcels exist at all.')
            ->assertSuccessful();
    }

    public function test_an_earlier_year_can_be_opened_separately(): void
    {
        $parcel = $this->legacyParcel(['cropping_schedule' => 'Wet']);

        $this->artisan('seasons:backfill', ['--year' => 2025])->assertSuccessful();
        $this->artisan('seasons:backfill', ['--year' => 2026])->assertSuccessful();

        $this->assertSame(
            [2025, 2026],
            CropSeason::where('parcel_id', $parcel)
                ->orderBy('cropping_year')->pluck('cropping_year')
                ->map(fn ($y) => (int) $y)->all(),
        );
    }

    public function test_it_never_disturbs_a_season_that_already_holds_production(): void
    {
        $parcel = $this->legacyParcel(['cropping_schedule' => 'Wet/Dry']);

        CropSeason::create([
            'parcel_id' => $parcel, 'cropping_year' => now()->year, 'season' => 'wet',
            'yield_kg' => 5000, 'production_cost' => 85000,
        ]);

        $this->artisan('seasons:backfill')->assertSuccessful();

        $wet = CropSeason::where('parcel_id', $parcel)->where('season', 'wet')->firstOrFail();

        $this->assertSame('5000.00', (string) $wet->yield_kg);
        $this->assertSame('85000.00', (string) $wet->production_cost);
        $this->assertSame(2, CropSeason::where('parcel_id', $parcel)->count());
    }
}
