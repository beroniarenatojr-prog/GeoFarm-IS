<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\FarmType;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "N/A" is a label on a form, not a farm type.
 *
 * farm_type_id is an integer foreign key, and the RSBSA form's N/A option sent
 * the literal string. Because parcels travel as one JSON blob, Laravel's
 * validator never saw the field, so the string went straight to MySQL and every
 * farmer save carrying such a parcel died with:
 *
 *   SQLSTATE[22007] Incorrect integer value: 'N/A' for column farm_type_id
 *
 * The same normalising existed in two copies — the admin controller and public
 * registration — which is why one bug broke both flows at once. These tests
 * cover both, and every option the form offers.
 */
class FarmTypeNotApplicableTest extends TestCase
{
    use RefreshDatabase;

    private array $types = [];
    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        foreach (['Irrigated', 'Rainfed Upland', 'Rainfed Lowland', 'Urban/Peri-Urban'] as $name) {
            $this->types[$name] = FarmType::create(['type_name' => $name])->id;
        }
    }

    /** Memoised: the email is unique, so a loop over farm types must reuse it. */
    private function staff(): User
    {
        return $this->staff ??= tap(User::create([
            'name'      => 'Encoder',
            'email'     => 'encoder@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $user) => $user->assignRole('Admin'));
    }

    private function farmer(): Farmer
    {
        return Farmer::create([
            'first_name'          => 'Renato',
            'last_name'           => 'Beronia',
            'sex'                 => 'Male',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    /** The edit form's payload, with one parcel carrying the given farm type. */
    private function updateWith(Farmer $farmer, mixed $farmType)
    {
        return $this->actingAs($this->staff())->put(route('admin.farmers.update', $farmer), [
            'first_name'      => 'Renato',
            'last_name'       => 'Beronia',
            'sex'             => 'Male',
            'livelihood_type' => 'Farmer',
            'parcels'         => json_encode([[
                'barangay'      => 'Caligayan',
                'total_area_ha' => '2.5',
                'commodity'     => 'Rice',
                'farm_type_id'  => $farmType,
            ]]),
        ]);
    }

    // ------------------------------------------------- the reported failure

    public function test_updating_a_farmer_with_farm_type_na_no_longer_errors(): void
    {
        $farmer = $this->farmer();

        $this->updateWith($farmer, 'N/A')
            ->assertRedirect(route('admin.farmers.index'))
            ->assertSessionHasNoErrors();

        $this->assertNull(
            FarmParcel::where('farmer_id', $farmer->id)->value('farm_type_id'),
            'N/A must be stored as NULL, not as a string or a stray id',
        );
    }

    public function test_an_empty_farm_type_is_also_stored_as_null(): void
    {
        $farmer = $this->farmer();

        $this->updateWith($farmer, '')->assertSessionHasNoErrors();

        $this->assertNull(FarmParcel::where('farmer_id', $farmer->id)->value('farm_type_id'));
    }

    public function test_any_other_label_is_refused_rather_than_passed_to_the_database(): void
    {
        // A label is not a key. Letting one through only moves the failure into
        // MySQL, where it reads as a crash instead of as missing data.
        $farmer = $this->farmer();

        $this->updateWith($farmer, 'Irrigated')->assertSessionHasNoErrors();

        $this->assertNull(FarmParcel::where('farmer_id', $farmer->id)->value('farm_type_id'));
    }

    // ------------------------------------------- every option the form offers

    public function test_each_real_farm_type_is_still_saved_as_its_integer_id(): void
    {
        foreach ($this->types as $name => $id) {
            $farmer = Farmer::create([
                'first_name'          => 'Test',
                'last_name'           => str_replace(['/', ' '], '', $name),
                'sex'                 => 'Male',
                'verification_status' => Farmer::STATUS_VERIFIED,
            ]);

            $this->updateWith($farmer, (string) $id)->assertSessionHasNoErrors();

            $this->assertSame(
                $id,
                FarmParcel::where('farmer_id', $farmer->id)->value('farm_type_id'),
                "{$name} must still store its own id",
            );
        }
    }

    public function test_the_farm_type_relationship_still_resolves(): void
    {
        $farmer = $this->farmer();
        $this->updateWith($farmer, (string) $this->types['Irrigated']);

        $parcel = FarmParcel::where('farmer_id', $farmer->id)->with('farmType')->firstOrFail();

        $this->assertSame('Irrigated', $parcel->farmType->type_name);
    }

    public function test_a_parcel_with_no_type_has_a_null_relationship_not_an_error(): void
    {
        // Seasonal Tracking reads the farm type through this relationship, so
        // a parcel with N/A must render as blank rather than throwing.
        $farmer = $this->farmer();
        $this->updateWith($farmer, 'N/A');

        $parcel = FarmParcel::where('farmer_id', $farmer->id)->with('farmType')->firstOrFail();

        $this->assertNull($parcel->farmType);
        $this->assertNull($parcel->farmType?->type_name);
    }

    // ------------------------------------------------ the registration flow

    public function test_public_registration_has_the_same_protection(): void
    {
        // The bug lived in two copies of one normaliser, so it broke both
        // flows. Both now go through FarmParcel::sanitiseInput().
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
                'barangay'      => 'Caligayan',
                'total_area_ha' => '1.5',
                'farm_type_id'  => 'N/A',
            ]]),
        ])->assertSessionHasNoErrors();

        $farmer = Farmer::where('last_name', 'Telan')->firstOrFail();

        $this->assertNull(FarmParcel::where('farmer_id', $farmer->id)->value('farm_type_id'));
    }

    // ------------------------------------------------------- the normaliser

    public function test_the_normaliser_answers_each_case_directly(): void
    {
        $cases = [
            'N/A'  => null,
            ''     => null,
            null   => null,
            'abc'  => null,
            '3'    => 3,
            4      => 4,
        ];

        foreach ($cases as $given => $expected) {
            $this->assertSame(
                $expected,
                FarmParcel::sanitiseInput(['farm_type_id' => $given])['farm_type_id'],
                'farm_type_id ' . var_export($given, true) . ' should normalise to ' . var_export($expected, true),
            );
        }
    }

    public function test_blank_numbers_do_not_reach_decimal_columns_as_empty_strings(): void
    {
        $clean = FarmParcel::sanitiseInput([
            'total_area_ha'     => '',
            'no_of_heads_trees' => 'N/A',
        ]);

        $this->assertNull($clean['total_area_ha']);
        $this->assertNull($clean['no_of_heads_trees']);
    }
}
