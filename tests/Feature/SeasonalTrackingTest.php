<?php

namespace Tests\Feature;

use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\SeasonalInput;
use App\Models\User;
use App\Services\CroppingScheduleService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * Farmer -> parcel -> cropping.
 *
 * The rule the whole feature rests on is that a parcel's cropping schedule
 * decides how many seasons exist. A Wet/Dry parcel worked twice a year that
 * only ever had one seasonal record reported half its real annual cost, and
 * nothing on screen showed the other half was missing.
 */
class SeasonalTrackingTest extends TestCase
{
    use RefreshDatabase;

    private Farmer $farmer;
    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        $this->farmer = Farmer::create([
            'first_name'          => 'Juan',
            'last_name'           => 'Dela Cruz',
            'sex'                 => 'Male',
            'barangay'            => 'Annafunan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    /** Memoised: the email is unique, so a second call must reuse the first. */
    private function staff(): User
    {
        return $this->staff ??= tap(User::create([
            'name'      => 'Encoder',
            'email'     => 'encoder@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $user) => $user->assignRole('Admin'));
    }

    private function parcel(array $overrides = []): FarmParcel
    {
        return $this->farmer->parcels()->create(array_merge([
            'parcel_number'     => 'SAKAHAN-1',
            'barangay'          => 'Annafunan',
            'city_municipality' => 'Tumauini',
            'province'          => 'Isabela',
            'total_area_ha'     => 2.5,
            'commodity'         => 'Rice',
            'is_organic'        => true,
        ], $overrides));
    }

    // ------------------------------------------- automatic season creation

    public function test_a_wet_parcel_opens_one_wet_season(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);

        $seasons = CropSeason::where('parcel_id', $parcel->id)->get();

        $this->assertCount(1, $seasons);
        $this->assertSame('wet', $seasons->first()->season);
        $this->assertSame((int) now()->year, (int) $seasons->first()->cropping_year);
    }

    public function test_a_dry_parcel_opens_one_dry_season(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Dry']);

        $this->assertSame(
            ['dry'],
            CropSeason::where('parcel_id', $parcel->id)->pluck('season')->all(),
        );
    }

    public function test_a_wet_dry_parcel_opens_both_on_the_same_parcel(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        $seasons = CropSeason::where('parcel_id', $parcel->id)->orderBy('season')->get();

        $this->assertCount(2, $seasons);
        $this->assertSame(['dry', 'wet'], $seasons->pluck('season')->all());

        // The point of the spec: one farmer, one parcel, two croppings.
        $this->assertSame(1, Farmer::count());
        $this->assertSame(1, FarmParcel::count());
        $this->assertSame([$parcel->id, $parcel->id], $seasons->pluck('parcel_id')->all());
    }

    public function test_a_parcel_with_no_schedule_opens_nothing(): void
    {
        // Silence is right here: the office has not said how this land is
        // worked, and guessing would put a cropping on the books that may
        // never happen.
        $parcel = $this->parcel(['cropping_schedule' => null]);

        $this->assertSame(0, CropSeason::where('parcel_id', $parcel->id)->count());
    }

    public function test_the_opened_season_inherits_the_parcels_own_figures(): void
    {
        Crop::create(['crop_name' => 'Rice']);

        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        $season = CropSeason::where('parcel_id', $parcel->id)->firstOrFail();

        $this->assertSame('2.50', (string) $season->area_planted_ha);
        $this->assertTrue($season->is_organic);
        // Commodity matched a crop on file, so the row is not left blank.
        $this->assertNotNull($season->crop_id);
    }

    public function test_an_unrecognised_commodity_leaves_the_crop_unset(): void
    {
        // Better than inventing a crop from a typo: "Ricce" would become a
        // category every yield report is grouped by.
        $parcel = $this->parcel(['cropping_schedule' => 'Wet', 'commodity' => 'Ricce']);

        $this->assertNull(CropSeason::where('parcel_id', $parcel->id)->value('crop_id'));
    }

    public function test_editing_a_parcel_does_not_duplicate_its_seasons(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        $parcel->update(['total_area_ha' => 3.0]);
        $parcel->update(['commodity' => 'Corn']);

        $this->assertSame(2, CropSeason::where('parcel_id', $parcel->id)->count());
    }

    public function test_widening_the_schedule_opens_the_missing_season(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        $this->assertSame(1, CropSeason::where('parcel_id', $parcel->id)->count());

        $parcel->update(['cropping_schedule' => 'Wet/Dry']);

        $this->assertSame(2, CropSeason::where('parcel_id', $parcel->id)->count());
    }

    public function test_narrowing_the_schedule_never_deletes_recorded_production(): void
    {
        // A correction to a dropdown is not authority to destroy a harvest.
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);
        CropSeason::where('parcel_id', $parcel->id)->update(['yield_kg' => 5000]);

        $parcel->update(['cropping_schedule' => 'Wet']);

        $this->assertSame(2, CropSeason::where('parcel_id', $parcel->id)->count());
    }

    // ------------------------------------------------------ duplicate guard

    public function test_the_same_parcel_year_and_season_cannot_be_encoded_twice(): void
    {
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);

        $this->actingAs($this->staff())
            ->post(route('admin.seasonal.store'), [
                'parcel_id'     => $parcel->id,
                'season'        => 'wet',
                'cropping_year' => now()->year,
                'crop_id'       => $crop->id,
            ])
            ->assertSessionHasErrors('season');

        $this->assertSame(1, CropSeason::where('parcel_id', $parcel->id)->count());
    }

    public function test_the_other_season_of_the_same_year_is_still_allowed(): void
    {
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);

        $this->actingAs($this->staff())
            ->post(route('admin.seasonal.store'), [
                'parcel_id'     => $parcel->id,
                'season'        => 'dry',
                'cropping_year' => now()->year,
                'crop_id'       => $crop->id,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(2, CropSeason::where('parcel_id', $parcel->id)->count());
    }

    // --------------------------------------------- production and finances

    public function test_revenue_is_quantity_times_price_when_no_total_was_typed(): void
    {
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Dry']);
        $season = CropSeason::where('parcel_id', $parcel->id)->firstOrFail();

        $this->actingAs($this->staff())
            ->put(route('admin.seasonal.update', $season), [
                'season'        => 'dry',
                'cropping_year' => $season->cropping_year,
                'crop_id'       => $crop->id,
                'yield_kg'      => 4500,
                'selling_price' => 24,
            ])
            ->assertSessionHasNoErrors();

        // 4,500 x P24 = P108,000, the spec's own dry-season example.
        $this->assertSame('108000.00', (string) $season->fresh()->total_income);
    }

    public function test_itemised_inputs_add_up_to_the_production_cost(): void
    {
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        $season = CropSeason::where('parcel_id', $parcel->id)->firstOrFail();

        $this->actingAs($this->staff())
            ->put(route('admin.seasonal.update', $season), [
                'season'        => 'wet',
                'cropping_year' => $season->cropping_year,
                'crop_id'       => $crop->id,
                'labor_cost'    => 20000,
                'other_cost'    => 5000,
                'inputs'        => [
                    ['input_type' => 'fertilizer', 'name' => 'Urea', 'quantity' => 20, 'unit' => 'bags', 'cost' => 30000],
                    ['input_type' => 'herbicide',  'name' => 'Round', 'quantity' => 5,  'unit' => 'liters', 'cost' => 4500],
                    ['input_type' => 'pesticide',  'name' => 'Cyper', 'quantity' => 3,  'unit' => 'liters', 'cost' => 3600],
                ],
            ])
            ->assertSessionHasNoErrors();

        $season->refresh()->load('inputs');

        $this->assertCount(3, $season->inputs);
        // 30,000 + 4,500 + 3,600 + 20,000 labour + 5,000 other
        $this->assertSame('63100.00', (string) $season->production_cost);
    }

    public function test_a_season_may_carry_more_than_one_of_the_same_input(): void
    {
        // The reason inputs are rows rather than fertilizer_type columns.
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        $season = CropSeason::where('parcel_id', $parcel->id)->firstOrFail();

        $this->actingAs($this->staff())
            ->put(route('admin.seasonal.update', $season), [
                'season'        => 'wet',
                'cropping_year' => $season->cropping_year,
                'crop_id'       => $crop->id,
                'inputs'        => [
                    ['input_type' => 'fertilizer', 'name' => 'Urea',      'cost' => 30000],
                    ['input_type' => 'fertilizer', 'name' => 'Complete',  'cost' => 12000],
                ],
            ]);

        $this->assertSame(2, SeasonalInput::where('crop_season_id', $season->id)->count());
        $this->assertSame(42000.0, $season->fresh()->load('inputs')->input_cost_breakdown['fertilizer']);
    }

    public function test_resubmitting_replaces_inputs_rather_than_appending(): void
    {
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        $season = CropSeason::where('parcel_id', $parcel->id)->firstOrFail();

        $payload = fn (array $inputs) => [
            'season'        => 'wet',
            'cropping_year' => $season->cropping_year,
            'crop_id'       => $crop->id,
            'inputs'        => $inputs,
        ];

        $staff = $this->staff();

        $this->actingAs($staff)->put(route('admin.seasonal.update', $season),
            $payload([['input_type' => 'seed', 'cost' => 4000]]));
        $this->actingAs($staff)->put(route('admin.seasonal.update', $season),
            $payload([['input_type' => 'seed', 'cost' => 4500]]));

        $this->assertSame(1, SeasonalInput::where('crop_season_id', $season->id)->count());
        $this->assertSame('4500.00', (string) SeasonalInput::where('crop_season_id', $season->id)->value('cost'));
    }

    public function test_organic_practice_is_recorded_per_season_not_per_parcel(): void
    {
        // The spec's own case: 2026 wet organic, 2026 dry not.
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        $dry = CropSeason::where('parcel_id', $parcel->id)->where('season', 'dry')->firstOrFail();

        $this->actingAs($this->staff())
            ->put(route('admin.seasonal.update', $dry), [
                'season'        => 'dry',
                'cropping_year' => $dry->cropping_year,
                'crop_id'       => $crop->id,
                'is_organic'    => false,
            ]);

        $wet = CropSeason::where('parcel_id', $parcel->id)->where('season', 'wet')->firstOrFail();

        $this->assertTrue($wet->grown_organically, 'the wet season keeps the parcel practice');
        $this->assertFalse($dry->fresh()->grown_organically, 'the dry season carries its own');
    }

    // ------------------------------------------------------- yearly totals

    public function test_the_year_adds_both_seasons_together(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        // The worked example from the spec.
        CropSeason::where('parcel_id', $parcel->id)->where('season', 'wet')
            ->update(['production_cost' => 85000, 'total_income' => 110000, 'yield_kg' => 5000]);
        CropSeason::where('parcel_id', $parcel->id)->where('season', 'dry')
            ->update(['production_cost' => 78000, 'total_income' => 108000, 'yield_kg' => 4500]);

        $response = $this->actingAs($this->staff())->get(route('admin.seasonal.index'));

        $year = collect($response->viewData('page')['props']['costByYear'])->firstOrFail();

        $this->assertSame(163000.0, $year['total_cost']);      // 85,000 + 78,000
        $this->assertSame(218000.0, $year['total_revenue']);   // 110,000 + 108,000
        $this->assertSame(55000.0, $year['net_income']);       // 218,000 - 163,000
    }

    public function test_a_single_season_year_totals_that_season_alone(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        CropSeason::where('parcel_id', $parcel->id)
            ->update(['production_cost' => 85000, 'total_income' => 110000]);

        $response = $this->actingAs($this->staff())->get(route('admin.seasonal.index'));
        $year = collect($response->viewData('page')['props']['costByYear'])->firstOrFail();

        $this->assertSame(85000.0, $year['total_cost']);
        $this->assertNull($year['dry']);
    }

    // ------------------------------------------------------------- filters

    public function test_a_failure_to_open_seasons_never_takes_down_the_parcel_save(): void
    {
        /*
         * The parcel is what the office came to enter; the seasons are a
         * convenience derived from it. When this was not guarded, a server
         * whose seasonal migrations had not run returned a 500 for every
         * attempt to edit a farmer, because the observer wrote to a column
         * that did not exist yet.
         */
        Log::spy();

        $this->mock(CroppingScheduleService::class, function ($mock) {
            $mock->shouldReceive('openFor')
                ->andThrow(new \RuntimeException("Unknown column 'is_organic'"));
        });

        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        $this->assertTrue($parcel->exists, 'the parcel must still be saved');
        $this->assertDatabaseHas('farm_parcels', ['id' => $parcel->id]);

        Log::shouldHaveReceived('error')
            ->withArgs(fn (string $message) => str_contains($message, 'Could not open cropping seasons'))
            ->once();
    }

    public function test_the_add_form_is_given_the_parcels_it_needs_to_offer(): void
    {
        // Without this prop the Add Season form has no farmer or parcel to
        // choose, and store() rejects every submission for a missing
        // parcel_id with nothing on screen to fix.
        $this->parcel(['cropping_schedule' => 'Wet']);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->has('parcels', 1)
                ->where('parcels.0.farmer', 'Juan Dela Cruz')
                ->where('parcels.0.label', 'Parcel #SAKAHAN-1 · Annafunan · Rice'));
    }

    public function test_a_season_cannot_be_added_without_a_parcel(): void
    {
        $crop = Crop::create(['crop_name' => 'Rice']);

        $this->actingAs($this->staff())
            ->post(route('admin.seasonal.store'), [
                'season'        => 'wet',
                'cropping_year' => now()->year,
                'crop_id'       => $crop->id,
            ])
            ->assertSessionHasErrors('parcel_id');
    }

    public function test_a_wet_dry_parcel_is_one_row_holding_both_croppings(): void
    {
        /*
         * Two records, one line.
         *
         * The wet and dry seasons keep their own production, price and cost —
         * that is what makes annual cost = wet + dry work — but listed
         * separately they read as duplicates of each other.
         */
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        CropSeason::where('parcel_id', $parcel->id)->where('season', 'wet')
            ->update(['production_cost' => 85000, 'total_income' => 110000, 'yield_kg' => 5000]);
        CropSeason::where('parcel_id', $parcel->id)->where('season', 'dry')
            ->update(['production_cost' => 78000, 'total_income' => 108000, 'yield_kg' => 4500]);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->has('rows.data', 1)
                ->has('rows.data.0.seasons', 2)
                // The spec's own worked example.
                ->where('rows.data.0.annual.cost', 163000)
                ->where('rows.data.0.annual.revenue', 218000)
                ->where('rows.data.0.annual.net_income', 55000)
                ->where('rows.data.0.annual.yield', 9500)
                // The same land worked twice is not twice the land.
                ->where('rows.data.0.annual.area', 2.5));
    }

    public function test_a_single_season_parcel_is_still_one_row(): void
    {
        $this->parcel(['cropping_schedule' => 'Wet']);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->has('rows.data', 1)
                ->has('rows.data.0.seasons', 1));
    }

    public function test_two_crops_on_one_parcel_stay_apart(): void
    {
        // Rice in the wet season and corn in the dry is two croppings, not one
        // "Wet/Dry rice" — so the crop is part of what groups a row.
        $rice   = Crop::create(['crop_name' => 'Rice']);
        $corn   = Crop::create(['crop_name' => 'Corn']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        CropSeason::where('parcel_id', $parcel->id)->where('season', 'wet')->update(['crop_id' => $rice->id]);
        CropSeason::where('parcel_id', $parcel->id)->where('season', 'dry')->update(['crop_id' => $corn->id]);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page->has('rows.data', 2));
    }

    public function test_mixed_units_are_flagged_rather_than_added(): void
    {
        $parcel = $this->parcel(['cropping_schedule' => 'Wet/Dry']);

        CropSeason::where('parcel_id', $parcel->id)->where('season', 'wet')
            ->update(['yield_kg' => 5000, 'production_unit' => 'kg']);
        CropSeason::where('parcel_id', $parcel->id)->where('season', 'dry')
            ->update(['yield_kg' => 40, 'production_unit' => 'sacks']);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->where('rows.data.0.annual.yield', null)
                ->where('rows.data.0.annual.mixed_units', true));
    }

    public function test_the_table_payload_carries_what_the_detail_modal_reads(): void
    {
        /*
         * The row detail is rendered from the same payload the table uses, so
         * anything it shows has to travel with the season. The inputs and the
         * farm type are the two that come through relationships — miss either
         * and the modal renders a column of dashes for data that exists.
         */
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $type   = \App\Models\FarmType::create(['type_name' => 'Irrigated']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet', 'farm_type_id' => $type->id]);
        $season = CropSeason::where('parcel_id', $parcel->id)->firstOrFail();

        $this->actingAs($this->staff())
            ->put(route('admin.seasonal.update', $season), [
                'season'        => 'wet',
                'cropping_year' => $season->cropping_year,
                'crop_id'       => $crop->id,
                'yield_kg'      => 5000,
                'selling_price' => 22,
                'labor_cost'    => 20000,
                'inputs'        => [
                    ['input_type' => 'fertilizer', 'name' => 'Urea', 'quantity' => 20, 'unit' => 'bags', 'cost' => 30000],
                ],
            ]);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->where('rows.data.0.parcel.farm_type.type_name', 'Irrigated')
                ->where('rows.data.0.parcel.barangay', 'Annafunan')
                ->has('rows.data.0.seasons.0.inputs', 1)
                ->where('rows.data.0.seasons.0.inputs.0.name', 'Urea')
                // Derived figures the modal shows without recomputing them.
                ->where('rows.data.0.seasons.0.gross_revenue', 110000)
                ->where('rows.data.0.seasons.0.input_cost_breakdown.fertilizer', 30000)
                ->has('rows.data.0.seasons.0.cost_per_hectare')
                ->has('rows.data.0.seasons.0.grown_organically'));
    }

    public function test_the_recorded_unit_survives_an_edit(): void
    {
        $crop   = Crop::create(['crop_name' => 'Rice']);
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        $season = CropSeason::where('parcel_id', $parcel->id)->firstOrFail();

        $this->actingAs($this->staff())
            ->put(route('admin.seasonal.update', $season), [
                'season'          => 'wet',
                'cropping_year'   => $season->cropping_year,
                'crop_id'         => $crop->id,
                'yield_kg'        => 40,
                'production_unit' => 'sacks',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('sacks', $season->fresh()->production_unit);
    }

    public function test_sacks_are_not_added_into_a_kilogram_total(): void
    {
        /*
         * yield_kg holds whatever quantity was recorded; production_unit says
         * what it counts. Adding 40 sacks to 5,000 kg would report 5,040 kg of
         * municipal production, which is not a number that means anything.
         */
        $inKg    = $this->parcel(['cropping_schedule' => 'Wet']);
        $inSacks = $this->parcel(['parcel_number' => 'SAKAHAN-2', 'cropping_schedule' => 'Wet']);

        CropSeason::where('parcel_id', $inKg->id)
            ->update(['yield_kg' => 5000, 'production_unit' => 'kg']);
        CropSeason::where('parcel_id', $inSacks->id)
            ->update(['yield_kg' => 40, 'production_unit' => 'sacks']);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->where('summary.yield_kg', 5000)
                // Not hidden: the tile says how many rows it left out.
                ->where('summary.other_units', 1));
    }

    public function test_a_row_with_no_unit_still_counts_as_kilograms(): void
    {
        // Everything encoded before the unit existed is kilograms, and must
        // keep counting toward the total.
        $parcel = $this->parcel(['cropping_schedule' => 'Wet']);
        CropSeason::where('parcel_id', $parcel->id)
            ->update(['yield_kg' => 3000, 'production_unit' => null]);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->where('summary.yield_kg', 3000)
                ->where('summary.other_units', 0));
    }

    public function test_seasons_can_be_filtered_by_barangay_and_commodity(): void
    {
        $this->parcel(['cropping_schedule' => 'Wet', 'barangay' => 'Annafunan', 'commodity' => 'Rice']);
        $this->parcel([
            'parcel_number' => 'SAKAHAN-2', 'cropping_schedule' => 'Wet',
            'barangay' => 'Ugad', 'commodity' => 'Corn',
        ]);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index', ['barangay' => 'Annafunan']))
            ->assertInertia(fn ($page) => $page->has('rows.data', 1));

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index', ['commodity' => 'Corn']))
            ->assertInertia(fn ($page) => $page->has('rows.data', 1));
    }
}
