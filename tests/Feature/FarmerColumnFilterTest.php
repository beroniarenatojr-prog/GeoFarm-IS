<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The per-column filters on the farmer registry.
 *
 * The yes/no ones carry the real risk: an unset filter arrives as null and
 * "No" arrives as the string '0', and both are falsy. Testing truthiness would
 * silently turn "show me those who are NOT 4Ps" into "no filter at all" — a
 * filter that appears to work while returning everybody.
 */
class FarmerColumnFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private ?User $admin = null;

    /** Memoised: surnames() calls this per request, and the email is unique. */
    private function admin(): User
    {
        return $this->admin ??= tap(User::create([
            'name' => 'Registry Admin', 'email' => 'registry@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));
    }

    private function farmer(array $attributes): Farmer
    {
        return Farmer::create(array_merge([
            'first_name' => 'Test', 'last_name' => 'Farmer', 'sex' => 'Male',
            'barangay' => 'Antagan I', 'verification_status' => Farmer::STATUS_VERIFIED,
        ], $attributes));
    }

    /** @return array<int, string> the surnames the registry returned */
    private function surnames(array $query): array
    {
        $page = $this->actingAs($this->admin())
            ->get('/admin/farmers?' . http_build_query($query))
            ->viewData('page');

        return collect($page['props']['farmers']['data'])->pluck('last_name')->sort()->values()->all();
    }

    public function test_the_four_ps_filter_separates_yes_from_no(): void
    {
        $this->farmer(['last_name' => 'Receiving', 'is_4ps' => true]);
        $this->farmer(['last_name' => 'Notreceiving', 'is_4ps' => false]);

        $this->assertSame(['Receiving'], $this->surnames(['is_4ps' => '1']));

        // The case that a truthiness check would break: '0' is falsy, so the
        // filter would be skipped and both farmers returned.
        $this->assertSame(['Notreceiving'], $this->surnames(['is_4ps' => '0']));

        // And with no filter at all, both.
        $this->assertSame(['Notreceiving', 'Receiving'], $this->surnames([]));
    }

    public function test_ip_and_pwd_filters_behave_the_same_way(): void
    {
        $this->farmer(['last_name' => 'Indigenous', 'is_indigenous' => true]);
        $this->farmer(['last_name' => 'Disabled', 'pwd' => true]);
        $this->farmer(['last_name' => 'Neither']);

        $this->assertSame(['Indigenous'], $this->surnames(['is_indigenous' => '1']));
        $this->assertSame(['Disabled'], $this->surnames(['pwd' => '1']));
        $this->assertSame(['Disabled', 'Neither'], $this->surnames(['is_indigenous' => '0']));
    }

    public function test_category_and_sex_filter_exactly(): void
    {
        $this->farmer(['last_name' => 'Youngster', 'livelihood_type' => 'Agri-Youth', 'sex' => 'Female']);
        $this->farmer(['last_name' => 'Grower', 'livelihood_type' => 'Farmer', 'sex' => 'Male']);

        $this->assertSame(['Youngster'], $this->surnames(['category' => 'Agri-Youth']));
        $this->assertSame(['Grower'], $this->surnames(['sex' => 'Male']));
    }

    public function test_birthdate_is_a_range_with_either_end_optional(): void
    {
        $this->farmer(['last_name' => 'Elder', 'birthdate' => '1955-03-01']);
        $this->farmer(['last_name' => 'Middle', 'birthdate' => '1985-06-15']);
        $this->farmer(['last_name' => 'Younger', 'birthdate' => '2004-09-20']);

        $this->assertSame(['Elder'], $this->surnames(['born_to' => '1960-01-01']));
        $this->assertSame(['Younger'], $this->surnames(['born_from' => '2000-01-01']));
        $this->assertSame(['Middle'], $this->surnames([
            'born_from' => '1980-01-01', 'born_to' => '1990-01-01',
        ]));
    }

    public function test_rsbsa_name_and_contact_match_partially(): void
    {
        $this->farmer(['last_name' => 'Matched', 'rsbsa_no' => '02-31-23-027-900006', 'mobile_no' => '09170000078']);
        $this->farmer(['last_name' => 'Other', 'rsbsa_no' => '02-31-23-027-900015', 'mobile_no' => '09170000195']);

        $this->assertSame(['Matched'], $this->surnames(['rsbsa_no' => '900006']));
        $this->assertSame(['Matched'], $this->surnames(['contact' => '0078']));
        $this->assertSame(['Matched'], $this->surnames(['name' => 'Matche']));
    }

    public function test_the_search_box_finds_a_category_and_a_barangay(): void
    {
        $this->farmer(['last_name' => 'Youngster', 'livelihood_type' => 'Agri-Youth', 'barangay' => 'Caligayan']);
        $this->farmer(['last_name' => 'Grower', 'livelihood_type' => 'Farmer', 'barangay' => 'Antagan I']);

        /*
         * The reported fault: typing "Agri" into the search box returned "No
         * farmers found" from a registry that plainly held Agri-Youth, because
         * the search covered only names, RSBSA number and mobile.
         */
        $this->assertSame(['Youngster'], $this->surnames(['search' => 'Agri']));

        // A barangay name typed straight into the same box, for the same reason.
        $this->assertSame(['Grower'], $this->surnames(['search' => 'Antagan']));

        // And the original columns still work.
        $this->assertSame(['Grower'], $this->surnames(['search' => 'Grower']));
    }

    public function test_filters_combine_rather_than_replace_each_other(): void
    {
        $this->farmer(['last_name' => 'Both', 'sex' => 'Female', 'is_4ps' => true]);
        $this->farmer(['last_name' => 'Onlyfemale', 'sex' => 'Female', 'is_4ps' => false]);
        $this->farmer(['last_name' => 'Onlyfourps', 'sex' => 'Male', 'is_4ps' => true]);

        $this->assertSame(['Both'], $this->surnames(['sex' => 'Female', 'is_4ps' => '1']));
    }
}
