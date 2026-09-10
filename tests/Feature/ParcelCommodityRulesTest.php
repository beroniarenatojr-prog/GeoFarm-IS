<?php

namespace Tests\Feature;

use App\Models\Crop;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\LivestockType;
use App\Models\User;
use App\Services\CommodityCatalogue;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A parcel is a field or it is a herd, never both.
 *
 * The form greys out whichever does not apply to the chosen commodity, but a
 * disabled input is a courtesy to whoever is typing — it stops nothing that is
 * posted directly, and parcels arrive as one JSON blob that Laravel's validator
 * never unpacks. Without a server-side rule the register would end up holding
 * "Rice, 50 heads", and the annual production figures are built from exactly
 * those columns.
 *
 * The crop-or-livestock answer comes from WHICH LOOKUP TABLE holds the name,
 * not from matching against a list of animal words — so "Duck" stays livestock
 * on the day somebody adds "Duckweed" to crops.
 */
class ParcelCommodityRulesTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        foreach (['Rice', 'Corn', 'Coconut'] as $name) {
            Crop::create(['crop_name' => $name, 'category' => 'Test crop']);
        }

        foreach (['Cow', 'Carabao', 'Swine'] as $name) {
            LivestockType::create(['type_name' => $name, 'category' => 'Test livestock']);
        }
    }

    /** Memoised: the email is unique, so a loop over commodities must reuse it. */
    private function staff(): User
    {
        return $this->staff ??= tap(User::create([
            'name'      => 'Encoder',
            'email'     => 'encoder@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $user) => $user->assignRole('Admin'));
    }

    private function farmer(string $last = 'Beronia'): Farmer
    {
        return Farmer::create([
            'first_name'          => 'Renato',
            'last_name'           => $last,
            'sex'                 => 'Male',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    /** Post the edit form with one parcel, exactly as the browser sends it. */
    private function saveParcel(Farmer $farmer, array $parcel)
    {
        return $this->actingAs($this->staff())->put(route('admin.farmers.update', $farmer), [
            'first_name'      => $farmer->first_name,
            'last_name'       => $farmer->last_name,
            'sex'             => 'Male',
            'livelihood_type' => 'Farmer',
            'parcels'         => json_encode([$parcel + [
                'barangay'      => 'Caligayan',
                'total_area_ha' => '2.5',
            ]]),
        ]);
    }

    private function saved(Farmer $farmer): FarmParcel
    {
        return FarmParcel::where('farmer_id', $farmer->id)->firstOrFail();
    }

    // ------------------------------------------------ what the kind resolves to

    public function test_the_catalogue_reads_the_kind_from_the_table_the_name_lives_in(): void
    {
        $catalogue = app(CommodityCatalogue::class);

        $this->assertSame(CommodityCatalogue::KIND_CROP, $catalogue->kindOf('Rice'));
        $this->assertSame(CommodityCatalogue::KIND_LIVESTOCK, $catalogue->kindOf('Cow'));
    }

    public function test_the_kind_ignores_case_and_surrounding_spaces(): void
    {
        // The column is free text typed by hand for years before this existed.
        $catalogue = app(CommodityCatalogue::class);

        $this->assertSame(CommodityCatalogue::KIND_LIVESTOCK, $catalogue->kindOf('  cOW '));
        $this->assertSame(CommodityCatalogue::KIND_CROP, $catalogue->kindOf('rice'));
    }

    public function test_a_name_on_neither_list_is_unknown_rather_than_guessed(): void
    {
        $catalogue = app(CommodityCatalogue::class);

        $this->assertSame(CommodityCatalogue::KIND_UNKNOWN, $catalogue->kindOf('Tilapia'));
        $this->assertSame(CommodityCatalogue::KIND_UNKNOWN, $catalogue->kindOf(''));
        $this->assertSame(CommodityCatalogue::KIND_UNKNOWN, $catalogue->kindOf(null));
    }

    public function test_the_catalogue_lists_both_kinds_without_duplicates(): void
    {
        $all = app(CommodityCatalogue::class)->all();

        $this->assertCount(6, $all);
        $this->assertSame(
            ['Carabao', 'Coconut', 'Corn', 'Cow', 'Rice', 'Swine'],
            $all->pluck('name')->all(),
            'The picker offers one sorted list, so both lookups must be merged and ordered',
        );
    }

    public function test_a_name_in_both_tables_is_listed_once_as_livestock(): void
    {
        // Should not happen, but the stricter reading has to win: offering the
        // same word twice under different rules is worse than choosing.
        Crop::create(['crop_name' => 'Cow', 'category' => 'Mistake']);

        $rows = app(CommodityCatalogue::class)->all()->where('name', 'Cow');

        $this->assertCount(1, $rows);
        $this->assertSame(CommodityCatalogue::KIND_LIVESTOCK, $rows->first()['kind']);
    }

    // ------------------------------------------------------ TEST 1, 2 — crops

    public function test_a_crop_parcel_keeps_its_schedule_and_stores_no_heads(): void
    {
        foreach (['Rice', 'Corn'] as $crop) {
            $farmer = $this->farmer("Crop{$crop}");

            $this->saveParcel($farmer, [
                'commodity'         => $crop,
                'cropping_schedule' => 'Wet/Dry',
                'no_of_heads_trees' => '50',
            ])->assertSessionHasNoErrors();

            $parcel = $this->saved($farmer);

            $this->assertSame('Wet/Dry', $parcel->cropping_schedule, "{$crop} is planted, so it has a schedule");
            $this->assertNull($parcel->no_of_heads_trees, "{$crop} must never be stored with a head count");
        }
    }

    // -------------------------------------------------- TEST 3, 4 — livestock

    public function test_a_livestock_parcel_keeps_its_heads_and_stores_no_schedule(): void
    {
        foreach (['Cow', 'Swine'] as $animal) {
            $farmer = $this->farmer("Herd{$animal}");

            $this->saveParcel($farmer, [
                'commodity'         => $animal,
                'cropping_schedule' => 'Wet',
                'no_of_heads_trees' => '25',
            ])->assertSessionHasNoErrors();

            $parcel = $this->saved($farmer);

            $this->assertNull($parcel->cropping_schedule, "{$animal} is not planted, so it has no season");
            $this->assertEquals(25, $parcel->no_of_heads_trees, "{$animal} must keep its head count");
        }
    }

    // ------------------------------------------- TEST 5, 6 — stale values drop

    public function test_switching_from_livestock_to_a_crop_drops_the_head_count(): void
    {
        $farmer = $this->farmer();

        $this->saveParcel($farmer, ['commodity' => 'Cow', 'no_of_heads_trees' => '20']);
        $this->assertEquals(20, $this->saved($farmer)->no_of_heads_trees);

        // The browser clears the box when the commodity changes; this is the
        // same save arriving with the old figure still attached.
        $this->saveParcel($farmer, [
            'commodity'         => 'Rice',
            'cropping_schedule' => 'Wet',
            'no_of_heads_trees' => '20',
        ])->assertSessionHasNoErrors();

        $parcel = $this->saved($farmer);

        $this->assertNull($parcel->no_of_heads_trees);
        $this->assertSame('Wet', $parcel->cropping_schedule);
    }

    public function test_switching_from_a_crop_to_livestock_drops_the_schedule(): void
    {
        $farmer = $this->farmer();

        $this->saveParcel($farmer, ['commodity' => 'Rice', 'cropping_schedule' => 'Wet/Dry']);
        $this->assertSame('Wet/Dry', $this->saved($farmer)->cropping_schedule);

        $this->saveParcel($farmer, [
            'commodity'         => 'Carabao',
            'cropping_schedule' => 'Wet/Dry',
            'no_of_heads_trees' => '3',
        ])->assertSessionHasNoErrors();

        $parcel = $this->saved($farmer);

        $this->assertNull($parcel->cropping_schedule);
        $this->assertEquals(3, $parcel->no_of_heads_trees);
    }

    // ---------------------------------------------- TEST 7 — parcels are apart

    public function test_two_parcels_on_one_farmer_are_judged_separately(): void
    {
        $farmer = $this->farmer();

        $this->actingAs($this->staff())->put(route('admin.farmers.update', $farmer), [
            'first_name'      => 'Renato',
            'last_name'       => 'Beronia',
            'sex'             => 'Male',
            'livelihood_type' => 'Farmer',
            'parcels'         => json_encode([
                [
                    'barangay'          => 'Caligayan',
                    'total_area_ha'     => '2',
                    'commodity'         => 'Rice',
                    'cropping_schedule' => 'Wet',
                    'no_of_heads_trees' => '99',
                ],
                [
                    'barangay'          => 'Antagan',
                    'total_area_ha'     => '1',
                    'commodity'         => 'Cow',
                    'cropping_schedule' => 'Dry',
                    'no_of_heads_trees' => '12',
                ],
            ]),
        ])->assertSessionHasNoErrors();

        $parcels = FarmParcel::where('farmer_id', $farmer->id)->orderBy('id')->get();

        $this->assertSame('Wet', $parcels[0]->cropping_schedule);
        $this->assertNull($parcels[0]->no_of_heads_trees);

        $this->assertNull($parcels[1]->cropping_schedule);
        $this->assertEquals(12, $parcels[1]->no_of_heads_trees);
    }

    // ------------------------------------ TEST 8 — bypassing the form changes nothing

    public function test_public_registration_is_held_to_the_same_rules(): void
    {
        // The bug this mirrors lived in two copies of one normaliser, which is
        // why it broke both flows at once. Both go through sanitiseInput now.
        $this->post('/farmer-registration', [
            'email'                 => 'newfarmer@example.test',
            'password'              => 'a-long-enough-password',
            'password_confirmation' => 'a-long-enough-password',
            'first_name'            => 'Mayumi',
            'last_name'             => 'Telan',
            'sex'                   => 'Female',
            'barangay'              => 'Caligayan',
            'livelihood_type'       => 'Farmer',
            'parcels'               => json_encode([[
                'barangay'          => 'Caligayan',
                'total_area_ha'     => '1.5',
                'commodity'         => 'Corn',
                'cropping_schedule' => 'Dry',
                'no_of_heads_trees' => '40',
            ]]),
        ])->assertSessionHasNoErrors();

        $parcel = FarmParcel::firstOrFail();

        $this->assertSame('Dry', $parcel->cropping_schedule);
        $this->assertNull($parcel->no_of_heads_trees, 'Corn with 40 heads must not be storable by any route');
    }

    public function test_an_unrecognised_commodity_clears_nothing(): void
    {
        /*
         * Deliberately permissive. The register holds free text entered over
         * years, and a commodity this system has never heard of is not licence
         * to discard the figures somebody recorded beside it.
         */
        $farmer = $this->farmer();

        $this->saveParcel($farmer, [
            'commodity'         => 'Tilapia',
            'cropping_schedule' => 'Wet',
            'no_of_heads_trees' => '500',
        ])->assertSessionHasNoErrors();

        $parcel = $this->saved($farmer);

        $this->assertSame('Wet', $parcel->cropping_schedule);
        $this->assertEquals(500, $parcel->no_of_heads_trees);
    }

    // ------------------------------------------------- what the form is handed

    public function test_the_forms_are_given_the_catalogue_to_suggest_from(): void
    {
        // Without this prop the commodity box has nothing to offer and the
        // form cannot tell a crop from an animal, so the whole thing degrades
        // silently to a plain text input.
        $this->actingAs($this->staff())
            ->get(route('admin.farmers.create'))
            ->assertInertia(fn ($page) => $page
                ->where('commodities.0.name', 'Carabao')
                ->where('commodities.0.kind', CommodityCatalogue::KIND_LIVESTOCK));

        $this->get('/farmer-registration')
            ->assertInertia(fn ($page) => $page->has('commodities', 6));
    }
}
