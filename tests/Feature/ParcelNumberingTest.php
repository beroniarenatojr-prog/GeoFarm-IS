<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Every parcel a farmer declares carries its number on the RSBSA form.
 *
 * Part 3 numbers the parcels 1, 2, 3 down the page, and the office refers to
 * them that way — "the second parcel" is a thing staff say out loud. The
 * column has existed since the first migration and the form never filled it,
 * which is why Seasonal Tracking labels a parcel "No parcel no." and the GIS
 * popup reads "Parcel N/A".
 *
 * Numbered by position among the parcels actually declared, so the number
 * always matches what the farmer sees on screen. Deliberately not an id and
 * not a global counter: two different farmers both have a parcel 1.
 */
class ParcelNumberingTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

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

    /** Post the edit form with the given parcel rows, as the browser sends them. */
    private function declare(Farmer $farmer, array $parcels)
    {
        return $this->actingAs($this->staff())->put(route('admin.farmers.update', $farmer), [
            'first_name'      => $farmer->first_name,
            'last_name'       => $farmer->last_name,
            'sex'             => 'Male',
            'livelihood_type' => 'Farmer',
            'parcels'         => json_encode($parcels),
        ]);
    }

    /** The saved numbers, in the order the parcels were created. */
    private function numbers(Farmer $farmer): array
    {
        return FarmParcel::where('farmer_id', $farmer->id)
            ->orderBy('id')
            ->pluck('parcel_number')
            ->all();
    }

    public function test_parcels_are_numbered_from_one_in_declaration_order(): void
    {
        $farmer = $this->farmer();

        $this->declare($farmer, [
            ['barangay' => 'Caligayan', 'total_area_ha' => '2'],
            ['barangay' => 'Antagan',   'total_area_ha' => '1.5'],
            ['barangay' => 'Lanna',     'total_area_ha' => '3'],
        ])->assertSessionHasNoErrors();

        $this->assertSame(['1', '2', '3'], $this->numbers($farmer));
    }

    public function test_a_single_parcel_is_parcel_one(): void
    {
        $farmer = $this->farmer();

        $this->declare($farmer, [['barangay' => 'Caligayan', 'total_area_ha' => '2']])
            ->assertSessionHasNoErrors();

        $this->assertSame(['1'], $this->numbers($farmer));
    }

    public function test_an_untouched_blank_row_does_not_consume_a_number(): void
    {
        // The repeater can leave an empty row behind. It is dropped before
        // saving, so dropping it must not leave a hole in the numbering —
        // "1, 3" would send staff looking for a parcel 2 that never existed.
        $farmer = $this->farmer();

        $this->declare($farmer, [
            ['barangay' => 'Caligayan', 'total_area_ha' => '2'],
            ['barangay' => '',          'total_area_ha' => ''],
            ['barangay' => 'Lanna',     'total_area_ha' => '3'],
        ])->assertSessionHasNoErrors();

        $this->assertSame(['1', '2'], $this->numbers($farmer));
    }

    public function test_removing_a_parcel_closes_the_gap_on_the_next_save(): void
    {
        $farmer = $this->farmer();

        $this->declare($farmer, [
            ['barangay' => 'Caligayan', 'total_area_ha' => '2'],
            ['barangay' => 'Antagan',   'total_area_ha' => '1.5'],
            ['barangay' => 'Lanna',     'total_area_ha' => '3'],
        ]);

        // Staff deletes the middle parcel and saves again.
        $this->declare($farmer, [
            ['barangay' => 'Caligayan', 'total_area_ha' => '2'],
            ['barangay' => 'Lanna',     'total_area_ha' => '3'],
        ])->assertSessionHasNoErrors();

        $this->assertSame(['1', '2'], $this->numbers($farmer));

        $this->assertSame(
            'Lanna',
            FarmParcel::where('farmer_id', $farmer->id)->where('parcel_number', '2')->value('barangay'),
            'The parcel that moved up must take the number it moved into',
        );
    }

    public function test_the_number_belongs_to_the_farmer_not_to_the_register(): void
    {
        // Two farmers each have a parcel 1. The number is a position on one
        // person's form, not a serial number across the municipality.
        $one = $this->farmer('Beronia');
        $two = $this->farmer('Telan');

        $this->declare($one, [['barangay' => 'Caligayan', 'total_area_ha' => '2']]);
        $this->declare($two, [['barangay' => 'Antagan', 'total_area_ha' => '1']]);

        $this->assertSame(['1'], $this->numbers($one));
        $this->assertSame(['1'], $this->numbers($two));
    }

    public function test_public_registration_numbers_parcels_the_same_way(): void
    {
        $this->post('/farmer-registration', [
            'email'                 => 'newfarmer@example.test',
            'password'              => 'a-long-enough-password',
            'password_confirmation' => 'a-long-enough-password',
            'first_name'            => 'Mayumi',
            'last_name'             => 'Telan',
            'sex'                   => 'Female',
            'barangay'              => 'Caligayan',
            'livelihood_type'       => 'Farmer',
            'parcels'               => json_encode([
                ['barangay' => 'Caligayan', 'total_area_ha' => '1.5'],
                ['barangay' => 'Lanna',     'total_area_ha' => '2'],
            ]),
        ])->assertSessionHasNoErrors();

        $farmer = Farmer::where('last_name', 'Telan')->firstOrFail();

        $this->assertSame(['1', '2'], $this->numbers($farmer));
    }

    public function test_the_number_reaches_the_screens_that_had_none(): void
    {
        // Seasonal Tracking and the GIS popup both fall back to "no parcel
        // no." when this is null, which is what the office was seeing.
        $farmer = $this->farmer();

        $this->declare($farmer, [
            ['barangay' => 'Caligayan', 'total_area_ha' => '2', 'commodity' => 'Rice'],
        ]);

        $this->actingAs($this->staff())
            ->get(route('admin.seasonal.index'))
            ->assertInertia(fn ($page) => $page
                ->where('parcels.0.label', 'Parcel #1 · Caligayan · Rice'));
    }
}
