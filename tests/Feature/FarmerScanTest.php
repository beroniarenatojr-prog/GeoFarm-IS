<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Scanning a farmer's ID card at the distribution counter.
 *
 * The QR on the back of the card holds the farmer's own page. Reading it saves
 * a clerk typing a name with a queue waiting, and removes the commonest error
 * at that counter: serving the wrong Dela Cruz.
 *
 * What it must not become is a way around anything. A scan is a faster way to
 * name a farmer the user could already look up — nothing more.
 */
class FarmerScanTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function staff(string $role = 'Admin'): User
    {
        return $this->staff ??= tap(User::create([
            'name'      => 'Counter Clerk',
            'email'     => 'clerk@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $user) => $user->assignRole($role));
    }

    private function farmer(array $overrides = []): Farmer
    {
        return Farmer::create(array_merge([
            'first_name'          => 'Renato',
            'last_name'           => 'Beronia',
            'suffix'              => 'Jr',
            'sex'                 => 'Male',
            'barangay'            => 'Caligayan',
            'rsbsa_no'            => '01-32-27-327-000002',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ], $overrides));
    }

    private function scan(string $code, array $query = [])
    {
        return $this->actingAs($this->staff())
            ->getJson(route('admin.farmer-scan', array_merge(['code' => $code], $query)));
    }

    public function test_the_card_url_resolves_to_its_farmer(): void
    {
        $farmer = $this->farmer();

        // Exactly what QrCode::generate writes onto the card.
        $this->scan(url("/admin/farmers/{$farmer->id}"))
            ->assertOk()
            ->assertJson([
                'id'       => $farmer->id,
                'label'    => 'Beronia, Renato Jr',
                'verified' => true,
            ]);
    }

    public function test_a_card_read_under_a_different_host_still_resolves(): void
    {
        // Cards are printed on the office server and may be scanned from a
        // laptop, so matching on the path rather than the whole URL matters.
        $farmer = $this->farmer();

        $this->scan("https://some-other-host.test/admin/farmers/{$farmer->id}")
            ->assertOk()
            ->assertJson(['id' => $farmer->id]);
    }

    public function test_a_scanner_configured_to_send_only_the_number_works(): void
    {
        $farmer = $this->farmer();

        $this->scan((string) $farmer->id)->assertOk()->assertJson(['id' => $farmer->id]);
    }

    public function test_a_qr_from_something_else_is_refused(): void
    {
        $this->farmer();

        foreach (['https://example.com/', 'PRODUCT-12345', 'https://geo-farm.test/admin/parcels/3'] as $junk) {
            $this->scan($junk)
                ->assertStatus(422)
                ->assertJsonPath('message', 'That does not look like a GeoFarm-IS farmer ID card.');
        }
    }

    public function test_a_card_for_a_deleted_farmer_says_so(): void
    {
        // Better than an empty box, which reads as the scanner misfiring.
        $this->scan(url('/admin/farmers/999999'))
            ->assertStatus(404)
            ->assertJsonPath('message', 'That card is for a farmer who is no longer on the register.');
    }

    public function test_an_unverified_farmer_is_refused_by_default(): void
    {
        /*
         * The ID card route issues cards only to verified farmers, so this
         * should not arise — but a scan must not become the way around
         * verification if one ever did.
         */
        $farmer = $this->farmer(['verification_status' => Farmer::STATUS_PENDING]);

        $this->scan(url("/admin/farmers/{$farmer->id}"))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Renato Beronia Jr is not verified yet, so they cannot be served.');
    }

    public function test_an_unverified_farmer_resolves_where_the_caller_allows_it(): void
    {
        // Matches the type-ahead, which some screens open to pending records.
        $farmer = $this->farmer(['verification_status' => Farmer::STATUS_PENDING]);

        $this->scan(url("/admin/farmers/{$farmer->id}"), ['include_unverified' => 1])
            ->assertOk()
            ->assertJson(['id' => $farmer->id, 'verified' => false]);
    }

    public function test_a_guest_cannot_scan(): void
    {
        $farmer = $this->farmer();

        $this->getJson(route('admin.farmer-scan', ['code' => url("/admin/farmers/{$farmer->id}")]))
            ->assertUnauthorized();
    }

    public function test_scanning_needs_the_same_permission_as_searching(): void
    {
        // A scan reaches exactly what "view farmers" already reaches.
        $farmer = $this->farmer();

        $outsider = User::create([
            'name'      => 'Farmer Account',
            'email'     => 'outsider@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $outsider->assignRole('Farmer');

        $this->actingAs($outsider)
            ->getJson(route('admin.farmer-scan', ['code' => url("/admin/farmers/{$farmer->id}")]))
            ->assertForbidden();
    }

    public function test_the_code_is_required(): void
    {
        $this->scan('')->assertStatus(422);
    }
}
