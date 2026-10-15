<?php

namespace Tests\Feature;

use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Barangay;
use App\Models\Farmer;
use App\Models\FarmerMessage;
use App\Models\FarmParcel;
use App\Models\FinancialAssistance;
use App\Models\Recommendation;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The farmer portal's own screens: My Farms, Assistance, Advisory and Profile.
 *
 * The question every test here asks is the same one: can a farmer see anything
 * that is not theirs. These routes carry no farmer id — the record is resolved
 * from the signed-in account — so the ownership boundary is the whole security
 * model, and it is worth pinning from the outside rather than trusting that the
 * controller remembered.
 *
 * The second theme is honesty: a programme listed on a farmer's own screen must
 * not read as something they have been granted, and a verification status must
 * not be something they can set for themselves.
 */
class FarmerPortalScreensTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function account(string $role, string $email): User
    {
        return tap(User::create([
            'name'      => $role . ' Account',
            'email'     => $email,
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $u) => $u->assignRole($role));
    }

    /** A Farmer account with its own farmer record attached. */
    private function farmer(string $email, array $attributes = []): Farmer
    {
        $user = $this->account('Farmer', $email);

        return Farmer::create(array_merge([
            'first_name'          => 'Test',
            'last_name'           => 'Farmer',
            'sex'                 => 'Male',
            'barangay'            => 'Antagan I',
            'user_id'             => $user->id,
            'verification_status' => Farmer::STATUS_VERIFIED,
        ], $attributes));
    }

    private function parcelFor(Farmer $farmer, array $attributes = []): FarmParcel
    {
        return FarmParcel::create(array_merge([
            'farmer_id'     => $farmer->id,
            'parcel_number' => '1',
            'barangay'      => $farmer->barangay,
            'total_area_ha' => 1.5,
            'commodity'     => 'Rice',
        ], $attributes));
    }

    /** A square boundary, so "mapped" means something in these tests. */
    private function boundary(): string
    {
        return json_encode([
            'type'        => 'Polygon',
            'coordinates' => [[
                [121.80, 17.26], [121.81, 17.26], [121.81, 17.27], [121.80, 17.27], [121.80, 17.26],
            ]],
        ]);
    }

    private function props(Farmer $farmer, string $path): array
    {
        return $this->actingAs($farmer->user)
            ->get($path)
            ->viewData('page')['props'];
    }

    // ------------------------------------------------------------- access

    public function test_every_new_screen_is_behind_the_farmer_role(): void
    {
        $paths = ['/farmer/farms', '/farmer/assistance', '/farmer/advisory', '/farmer/profile'];

        /*
         * The two checks are run as separate passes, not interleaved.
         * actingAs() persists for the rest of the test, so a single loop would
         * sign in as the office account on the first iteration and then assert
         * "a signed-out visitor" against an authenticated request for every
         * path after it.
         */
        foreach ($paths as $path) {
            // A signed-out visitor is sent to log in, not refused — they may
            // well be a farmer who simply is not signed in yet.
            $this->get($path)->assertRedirect('/login');
        }

        $office = $this->account('Admin', 'office@example.test');

        foreach ($paths as $path) {
            // An office account has no farmer record and no business here.
            $this->actingAs($office)->get($path)->assertForbidden();
        }
    }

    public function test_a_farmer_account_without_a_farmer_record_gets_a_404_not_an_error(): void
    {
        // A Farmer role with nothing encoded behind it. firstOrFail is the
        // intended outcome: there is genuinely no record to show.
        $orphan = $this->account('Farmer', 'orphan@example.test');

        $this->actingAs($orphan)->get('/farmer/farms')->assertNotFound();
    }

    // -------------------------------------------------------- my farms

    public function test_my_farms_shows_only_the_signed_in_farmers_parcels(): void
    {
        $mine = $this->farmer('mine@example.test', ['last_name' => 'Mine']);
        $theirs = $this->farmer('theirs@example.test', ['last_name' => 'Theirs']);

        $this->parcelFor($mine, ['parcel_number' => 'MINE-1', 'geojson_data' => $this->boundary()]);
        $this->parcelFor($theirs, ['parcel_number' => 'THEIRS-1', 'geojson_data' => $this->boundary()]);

        $props = $this->props($mine, '/farmer/farms');

        $numbers = collect($props['parcels'])->pluck('parcel_number')->all();

        $this->assertSame(['MINE-1'], $numbers);

        /*
         * And the map data too, which is the easier one to get wrong: the admin
         * GIS endpoint returns every parcel in the municipality, and reusing it
         * here would hand a farmer their neighbours' boundaries.
         */
        $mapped = collect($props['parcelGeoJson']['features'])
            ->pluck('properties.parcel_number')->all();

        $this->assertSame(['MINE-1'], $mapped);
    }

    public function test_a_parcel_without_a_boundary_is_listed_but_not_drawn(): void
    {
        $farmer = $this->farmer('mapped@example.test');

        $this->parcelFor($farmer, ['parcel_number' => 'DRAWN', 'geojson_data' => $this->boundary()]);
        $this->parcelFor($farmer, ['parcel_number' => 'UNSURVEYED']);

        $props = $this->props($farmer, '/farmer/farms');

        /*
         * Both in the list. A parcel the office has not surveyed is an ordinary
         * state, and dropping it would show a farmer fewer parcels than they
         * hold — the screen says so instead.
         */
        $this->assertCount(2, $props['parcels']);
        $this->assertCount(1, $props['parcelGeoJson']['features']);
        $this->assertSame(2, $props['summary']['count']);
        $this->assertSame(1, $props['summary']['mapped']);
    }

    public function test_a_malformed_boundary_does_not_break_the_screen(): void
    {
        $farmer = $this->farmer('broken@example.test');

        $this->parcelFor($farmer, ['parcel_number' => 'BROKEN', 'geojson_data' => 'not json at all']);
        $this->parcelFor($farmer, ['parcel_number' => 'FINE', 'geojson_data' => $this->boundary()]);

        $props = $this->props($farmer, '/farmer/farms');

        // Skipped on the map, kept in the list.
        $this->assertCount(1, $props['parcelGeoJson']['features']);
        $this->assertCount(2, $props['parcels']);
    }

    public function test_my_farms_totals_the_area_across_parcels(): void
    {
        $farmer = $this->farmer('area@example.test');

        $this->parcelFor($farmer, ['parcel_number' => '1', 'total_area_ha' => 1.25, 'commodity' => 'Rice']);
        $this->parcelFor($farmer, ['parcel_number' => '2', 'total_area_ha' => 2.5, 'commodity' => 'Corn']);
        $this->parcelFor($farmer, ['parcel_number' => '3', 'total_area_ha' => 0.25, 'commodity' => 'Rice']);

        $summary = $this->props($farmer, '/farmer/farms')['summary'];

        $this->assertSame(4.0, $summary['total_area']);
        // Deduplicated: three parcels, two crops.
        $this->assertEqualsCanonicalizing(['Rice', 'Corn'], $summary['commodities']);
    }

    // ------------------------------------------------------ assistance

    private function program(array $overrides = []): FinancialAssistance
    {
        $type = AssistanceType::firstOrCreate(
            ['type_name' => 'Seed Subsidy'],
            ['category' => 'crop', 'distribution_type' => 'financial'],
        );

        return FinancialAssistance::create(array_merge([
            'program_name'         => 'Rice Input Support',
            'assistance_type_id'   => $type->id,
            'status'               => 'active',
            'total_budget'         => 100000,
            'standard_cash_amount' => 2500,
            'start_date'           => '2026-01-01',
            'end_date'             => '2026-12-31',
        ], $overrides));
    }

    public function test_a_farmer_sees_only_their_own_distributions(): void
    {
        $mine = $this->farmer('dmine@example.test');
        $theirs = $this->farmer('dtheirs@example.test');

        $program = $this->program();

        AssistanceDistribution::create([
            'assistance_id' => $program->id, 'farmer_id' => $mine->id,
            'status' => 'claimed', 'amount_given' => 2500,
            'distribution_date' => '2026-03-01', 'reference_no' => 'MINE-REF',
        ]);

        AssistanceDistribution::create([
            'assistance_id' => $program->id, 'farmer_id' => $theirs->id,
            'status' => 'claimed', 'amount_given' => 9999,
            'distribution_date' => '2026-03-01', 'reference_no' => 'THEIRS-REF',
        ]);

        $props = $this->props($mine, '/farmer/assistance');

        $this->assertSame(['MINE-REF'], collect($props['distributions'])->pluck('reference_no')->all());

        // And the totals are theirs alone, not the programme's.
        $this->assertSame(2500.0, $props['summary']['cash_total']);
        $this->assertSame(1, $props['summary']['received']);
    }

    public function test_forfeited_handouts_are_not_counted_as_received(): void
    {
        $farmer = $this->farmer('forfeit@example.test');
        $program = $this->program();

        foreach (['claimed', 'pending', 'forfeited'] as $status) {
            AssistanceDistribution::create([
                'assistance_id' => $program->id, 'farmer_id' => $farmer->id,
                'status' => $status, 'amount_given' => 1000,
                'distribution_date' => '2026-03-01',
            ]);
        }

        $summary = $this->props($farmer, '/farmer/assistance')['summary'];

        // The same rule the office applies: forfeited goods went back.
        $this->assertSame(1, $summary['received']);
        $this->assertSame(1, $summary['awaiting']);
        $this->assertSame(1, $summary['forfeited']);
        $this->assertSame(1000.0, $summary['cash_total']);
    }

    public function test_only_active_programmes_are_listed(): void
    {
        $farmer = $this->farmer('status@example.test');

        $this->program(['program_name' => 'Running', 'status' => 'active']);
        $this->program(['program_name' => 'Still A Draft', 'status' => 'draft']);
        $this->program(['program_name' => 'Called Off', 'status' => 'cancelled']);

        $names = collect($this->props($farmer, '/farmer/assistance')['programs'])
            ->pluck('program_name')->all();

        /*
         * A draft is not an announcement. A farmer who read one as a programme
         * they could turn up for would arrive at the office for something that
         * does not exist yet.
         */
        $this->assertSame(['Running'], $names);
    }

    public function test_programmes_are_filtered_to_the_farmers_area(): void
    {
        $farmer = $this->farmer('area2@example.test', ['barangay' => 'Antagan I']);

        $here = $this->program(['program_name' => 'For Antagan']);
        $here->barangays()->sync([Barangay::create([
            'name' => 'Antagan I', 'municipality' => 'Tumauini',
            'province' => 'Isabela', 'is_active' => true,
        ])->id]);

        $elsewhere = $this->program(['program_name' => 'For Caligayan']);
        $elsewhere->barangays()->sync([Barangay::create([
            'name' => 'Caligayan', 'municipality' => 'Tumauini',
            'province' => 'Isabela', 'is_active' => true,
        ])->id]);

        // No barangays at all means municipality-wide, the common case.
        $this->program(['program_name' => 'For Everyone']);

        $names = collect($this->props($farmer, '/farmer/assistance')['programs'])
            ->pluck('program_name')->sort()->values()->all();

        $this->assertSame(['For Antagan', 'For Everyone'], $names);
    }

    public function test_a_programme_covering_land_the_farmer_holds_elsewhere_is_listed(): void
    {
        // Lives in one barangay, farms in another — which is why the office's
        // own targeting rule looks at both.
        $farmer = $this->farmer('split@example.test', ['barangay' => 'Antagan I']);
        $this->parcelFor($farmer, ['barangay' => 'Caligayan']);

        $program = $this->program(['program_name' => 'For Caligayan']);
        $program->barangays()->sync([Barangay::create([
            'name' => 'Caligayan', 'municipality' => 'Tumauini',
            'province' => 'Isabela', 'is_active' => true,
        ])->id]);

        $names = collect($this->props($farmer, '/farmer/assistance')['programs'])
            ->pluck('program_name')->all();

        $this->assertSame(['For Caligayan'], $names);
    }

    public function test_the_programme_list_never_exposes_the_office_budget(): void
    {
        $farmer = $this->farmer('budget@example.test');
        $this->program(['total_budget' => 500000]);

        $program = $this->props($farmer, '/farmer/assistance')['programs'][0];

        /*
         * The total budget is the office's planning figure, not a farmer's
         * entitlement. On a farmer's own screen it would read as money owed to
         * them.
         */
        $this->assertArrayNotHasKey('total_budget', $program);
        $this->assertArrayHasKey('standard_cash_amount', $program);
    }

    public function test_the_screen_says_whether_the_farmer_is_already_on_a_programme(): void
    {
        $farmer = $this->farmer('already@example.test');
        $program = $this->program();

        $before = $this->props($farmer, '/farmer/assistance')['programs'][0];
        $this->assertFalse($before['already_on']);

        AssistanceDistribution::create([
            'assistance_id' => $program->id, 'farmer_id' => $farmer->id,
            'status' => 'pending', 'distribution_date' => '2026-03-01',
        ]);

        $after = $this->props($farmer, '/farmer/assistance')['programs'][0];
        $this->assertTrue($after['already_on']);
    }

    public function test_a_farmer_cannot_put_themselves_on_a_programme(): void
    {
        $farmer = $this->farmer('selfserve@example.test');
        $program = $this->program();

        /*
         * The portal is read-only about eligibility, and the office route that
         * assigns beneficiaries is gated on "edit assistance" — which the
         * Farmer role does not hold. Approving your own eligibility is the one
         * thing this module must never allow.
         */
        $this->actingAs($farmer->user)
            ->post("/admin/assistance/{$program->id}/beneficiaries", [
                'farmer_ids' => [$farmer->id],
            ])
            ->assertForbidden();

        $this->assertSame(0, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    // -------------------------------------------------------- advisory

    public function test_a_farmer_sees_only_their_own_advisories_and_messages(): void
    {
        $mine = $this->farmer('amine@example.test');
        $theirs = $this->farmer('atheirs@example.test');

        foreach ([[$mine, 'Mine'], [$theirs, 'Theirs']] as [$farmer, $title]) {
            Recommendation::create([
                'farmer_id' => $farmer->id,
                'scope_type' => 'farmer',
                'title'     => $title,
                'reason'    => 'Because.',
                'priority'  => 'medium',
                'status'    => Recommendation::STATUS_NEW,
            ]);

            FarmerMessage::create([
                'farmer_id' => $farmer->id,
                // Required by the table: the address the office actually wrote
                // to, kept so a message can be traced after the farmer's
                // contact details change.
                'sent_to'   => $farmer->user->email,
                'subject'   => $title . ' message',
                'body'      => 'Body text.',
            ]);
        }

        $props = $this->props($mine, '/farmer/advisory');

        $this->assertSame(['Mine'], collect($props['advisories'])->pluck('title')->all());
        $this->assertSame(['Mine message'], collect($props['messages'])->pluck('subject')->all());
    }

    public function test_the_advisory_screen_carries_the_reason_not_a_missing_field(): void
    {
        $farmer = $this->farmer('reason@example.test');

        Recommendation::create([
            'farmer_id'  => $farmer->id,
            'scope_type' => 'farmer',
            'title'      => 'Raise the dykes',
            'reason'     => 'This parcel flooded in two of the last three wet seasons.',
            'priority'   => 'high',
            'status'     => Recommendation::STATUS_NEW,
        ]);

        $advisory = $this->props($farmer, '/farmer/advisory')['advisories'][0];

        /*
         * 'reason' is the body column on this table. An earlier draft of the
         * controller read $r->recommendation, which does not exist — and
         * because PHP returns null for an unknown attribute rather than
         * throwing, the screen would have rendered every advisory as a bare
         * title with no explanation and no error anywhere.
         */
        $this->assertSame(
            'This parcel flooded in two of the last three wet seasons.',
            $advisory['reason'],
        );
    }

    // --------------------------------------------------------- profile

    public function test_the_profile_shows_the_farmers_own_record(): void
    {
        $farmer = $this->farmer('profile@example.test', [
            'first_name' => 'Renato',
            'last_name'  => 'Beronia',
            'rsbsa_no'   => '02-31-23-027-900006',
            'barangay'   => 'Caligayan',
            'is_4ps'     => true,
        ]);

        $props = $this->props($farmer, '/farmer/profile');

        $this->assertSame('Renato Beronia', $props['farmer']['name']);
        $this->assertSame('02-31-23-027-900006', $props['farmer']['rsbsa_no']);
        $this->assertSame('verified', $props['farmer']['verification_status']);
        $this->assertTrue($props['farmer']['is_4ps']);
        $this->assertSame('profile@example.test', $props['account']['email']);
    }

    public function test_the_profile_never_sends_a_credential(): void
    {
        $farmer = $this->farmer('creds@example.test');

        $props = $this->props($farmer, '/farmer/profile');

        /*
         * Checked explicitly because the obvious implementation — handing the
         * User model straight to the view — would serialise the password hash,
         * the remember token and the lock password with it. The hash is not a
         * password, but it is a thing to crack offline, and none of it has any
         * business reaching a browser.
         */
        foreach (['password', 'remember_token', 'lock_password', 'active_session_id'] as $secret) {
            $this->assertArrayNotHasKey($secret, $props['account']);
        }

        $encoded = json_encode($props);

        $this->assertStringNotContainsString('$2y$', $encoded, 'a bcrypt hash reached the page');
    }

    public function test_a_farmer_cannot_change_their_own_verification_status(): void
    {
        $farmer = $this->farmer('verify@example.test', [
            'verification_status' => Farmer::STATUS_PENDING,
        ]);

        /*
         * There is no portal route that writes to the farmer record, and the
         * office routes that do are gated on "edit farmers". Self-verification
         * would make the whole verification step decorative — assistance
         * eligibility rests on it.
         */
        $this->actingAs($farmer->user)
            ->post("/admin/farmer-verification/{$farmer->id}/approve")
            ->assertForbidden();

        $this->assertSame(
            Farmer::STATUS_PENDING,
            $farmer->fresh()->verification_status,
        );
    }
}
