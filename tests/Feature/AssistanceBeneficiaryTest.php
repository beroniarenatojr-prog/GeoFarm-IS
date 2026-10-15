<?php

namespace Tests\Feature;

use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Barangay;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\FinancialAssistance;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Choosing which individual farmers a programme is for.
 *
 * The weight of this screen is in what it refuses. Selecting beneficiaries is a
 * planning act, so a mistake here is cheap to make and expensive to find: an
 * unverified farmer committed to a programme, the same farmer added twice and
 * counted twice against the budget, or a batch half-written because one id in
 * forty was bad. Each of those is a test below.
 *
 * It also pins the one rule that is easy to get backwards: a forfeited record
 * does not count as assigned. Those goods went back on the shelf, so that
 * farmer may be put on the programme again — and the picker must offer them.
 */
class AssistanceBeneficiaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private array $users = [];

    private function user(string $role): User
    {
        return $this->users[$role] ??= tap(User::create([
            'name'      => $role . ' Account',
            'email'     => strtolower(str_replace(' ', '-', $role)) . '@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $u) => $u->assignRole($role));
    }

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
            'created_by'           => $this->user('Admin')->id,
        ], $overrides));
    }

    private function farmer(array $overrides = []): Farmer
    {
        static $n = 0;
        $n++;

        return Farmer::create(array_merge([
            'first_name'          => 'Farmer',
            'last_name'           => 'Number' . $n,
            'sex'                 => 'Male',
            'barangay'            => 'Antagan I',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ], $overrides));
    }

    /** @return array<string, int> barangay name => id */
    private function barangays(array $names): array
    {
        $made = [];

        foreach ($names as $name) {
            $made[$name] = Barangay::create([
                'name'         => $name,
                'municipality' => 'Tumauini',
                'province'     => 'Isabela',
                'is_active'    => true,
            ])->id;
        }

        return $made;
    }

    /** The props the picker screen renders with. */
    private function picker(FinancialAssistance $program, array $query = [], string $role = 'Admin'): array
    {
        return $this->actingAs($this->user($role))
            ->get("/admin/assistance/{$program->id}/beneficiaries?" . http_build_query($query))
            ->viewData('page')['props'];
    }

    /** @return array<int, string> the surnames the picker listed */
    private function listed(FinancialAssistance $program, array $query = []): array
    {
        return collect($this->picker($program, $query)['farmers']['data'])
            ->pluck('name')->sort()->values()->all();
    }

    private function assign(FinancialAssistance $program, array $payload, string $role = 'Admin')
    {
        return $this->actingAs($this->user($role))
            ->post("/admin/assistance/{$program->id}/beneficiaries", $payload);
    }

    // ------------------------------------------------------------ the picker

    public function test_only_verified_farmers_are_offered(): void
    {
        $program = $this->program();

        $this->farmer(['last_name' => 'Checked']);
        $this->farmer(['last_name' => 'Unchecked', 'verification_status' => 'pending']);

        /*
         * A farmer who registered online and has not been reviewed has had
         * nothing confirmed — not their land, not their identity. Committing
         * them to a programme would put public goods behind unchecked data.
         */
        $this->assertSame(['Farmer Checked'], $this->listed($program));
    }

    public function test_the_picker_filters_by_search_barangay_and_commodity(): void
    {
        $program = $this->program();

        $rice = $this->farmer(['last_name' => 'Ricegrower', 'barangay' => 'Caligayan', 'rsbsa_no' => '02-31-23-027-900006']);
        $corn = $this->farmer(['last_name' => 'Cornbrower', 'barangay' => 'Antagan I']);

        FarmParcel::create([
            'farmer_id' => $rice->id, 'parcel_number' => '1',
            'barangay'  => 'Caligayan', 'total_area_ha' => 1.5, 'commodity' => 'Rice',
        ]);
        FarmParcel::create([
            'farmer_id' => $corn->id, 'parcel_number' => '1',
            'barangay'  => 'Antagan I', 'total_area_ha' => 2.0, 'commodity' => 'Corn',
        ]);

        $this->assertSame(['Farmer Ricegrower'], $this->listed($program, ['search' => 'Ricegrow']));
        $this->assertSame(['Farmer Ricegrower'], $this->listed($program, ['search' => '900006']));
        $this->assertSame(['Farmer Ricegrower'], $this->listed($program, ['barangay' => 'Caligayan']));
        $this->assertSame(['Farmer Ricegrower'], $this->listed($program, ['commodity' => 'Rice']));
        $this->assertSame(['Farmer Cornbrower'], $this->listed($program, ['commodity' => 'Corn']));
    }

    public function test_a_farmer_with_several_parcels_is_listed_once(): void
    {
        $program = $this->program();
        $farmer = $this->farmer(['last_name' => 'Manyfields']);

        foreach ([1, 2, 3] as $i) {
            FarmParcel::create([
                'farmer_id' => $farmer->id, 'parcel_number' => (string) $i,
                'barangay'  => 'Antagan I', 'total_area_ha' => 1, 'commodity' => 'Rice',
            ]);
        }

        /*
         * whereHas, not a join. A join would return this farmer three times for
         * one commodity filter, and the "Showing 1–20 of N" count would stop
         * meaning farmers — which is also the number the office reads as how
         * many people a programme could cover.
         */
        $this->assertSame(['Farmer Manyfields'], $this->listed($program, ['commodity' => 'Rice']));

        $row = $this->picker($program)['farmers']['data'][0];
        $this->assertSame(3, $row['parcels']);
        $this->assertSame(3.0, $row['area_ha']);
        // Deduplicated: three rice parcels is one commodity, not three.
        $this->assertSame(['Rice'], $row['commodities']);
    }

    public function test_the_assigned_filter_separates_added_from_not_added(): void
    {
        $program = $this->program();
        $on = $this->farmer(['last_name' => 'Added']);
        $this->farmer(['last_name' => 'Notadded']);

        $this->assign($program, ['farmer_ids' => [$on->id]]);

        $this->assertSame(['Farmer Added'], $this->listed($program, ['assigned' => 'yes']));
        $this->assertSame(['Farmer Notadded'], $this->listed($program, ['assigned' => 'no']));
        $this->assertSame(['Farmer Added', 'Farmer Notadded'], $this->listed($program));
    }

    public function test_select_all_covers_the_filter_not_just_the_page(): void
    {
        $program = $this->program();

        // More than one page of twenty, so a header checkbox could not reach
        // them all.
        for ($i = 0; $i < 25; $i++) {
            $this->farmer(['barangay' => 'Caligayan']);
        }
        $this->farmer(['barangay' => 'Elsewhere']);

        $props = $this->picker($program, ['barangay' => 'Caligayan']);

        $this->assertCount(20, $props['farmers']['data'], 'the page itself is still paged');
        $this->assertCount(25, $props['selectAll']['ids'], 'select all reaches the whole filtered set');
        $this->assertFalse($props['selectAll']['truncated']);
    }

    public function test_select_all_leaves_out_farmers_already_added(): void
    {
        $program = $this->program();
        $on = $this->farmer();
        $off = $this->farmer();

        $this->assign($program, ['farmer_ids' => [$on->id]]);

        /*
         * Ticking someone the server will skip anyway only produces a
         * "1 added, 1 skipped" message for work the screen could have got
         * right before asking.
         */
        $this->assertSame([$off->id], $this->picker($program)['selectAll']['ids']);
    }

    // ------------------------------------------------------------- assigning

    public function test_a_batch_of_farmers_is_added_as_awaiting_collection(): void
    {
        $program = $this->program();
        $farmers = collect([$this->farmer(), $this->farmer(), $this->farmer()]);

        $this->assign($program, ['farmer_ids' => $farmers->pluck('id')->all()])
            ->assertSessionHas('success');

        $rows = AssistanceDistribution::where('assistance_id', $program->id)->get();

        $this->assertCount(3, $rows);

        foreach ($rows as $row) {
            /*
             * Pending, not claimed. Choosing a beneficiary is a plan; recording
             * that they received something is a separate act that moves stock.
             * Marking these as received would put hand-outs in the register that
             * never happened.
             */
            $this->assertSame('pending', $row->status);
            // Falls back to the programme's standard amount.
            $this->assertSame('2500.00', $row->amount_given);
            $this->assertSame($this->user('Admin')->id, $row->assigned_by);
            $this->assertNotNull($row->assigned_at);
            // Nothing has been handed over, so nobody recorded a hand-out.
            $this->assertNull($row->recorded_by);
        }
    }

    public function test_the_amount_can_be_overridden_for_the_batch(): void
    {
        $program = $this->program();
        $farmer = $this->farmer();

        $this->assign($program, ['farmer_ids' => [$farmer->id], 'amount' => 1800]);

        $this->assertSame(
            '1800.00',
            AssistanceDistribution::where('assistance_id', $program->id)->first()->amount_given,
        );
    }

    public function test_a_farmer_already_on_the_programme_is_not_added_twice(): void
    {
        $program = $this->program();
        $already = $this->farmer();
        $fresh = $this->farmer();

        $this->assign($program, ['farmer_ids' => [$already->id]]);
        $this->assign($program, ['farmer_ids' => [$already->id, $fresh->id]])
            ->assertSessionHas('success');

        /*
         * Two rows, not three. A duplicate would count twice against the budget
         * and show the programme reaching more households than it does.
         */
        $this->assertSame(2, AssistanceDistribution::where('assistance_id', $program->id)->count());
        $this->assertSame(
            1,
            AssistanceDistribution::where('assistance_id', $program->id)
                ->where('farmer_id', $already->id)->count(),
        );
    }

    public function test_the_message_says_how_many_were_skipped(): void
    {
        $program = $this->program();
        $already = $this->farmer();
        $fresh = $this->farmer();

        $this->assign($program, ['farmer_ids' => [$already->id]]);

        // Adding fewer than asked without saying so leaves the office believing
        // everyone they ticked is on the programme.
        $this->assign($program, ['farmer_ids' => [$already->id, $fresh->id]]);

        $this->assertStringContainsString('1 skipped', session('success'));
    }

    public function test_adding_only_farmers_already_on_the_programme_is_refused(): void
    {
        $program = $this->program();
        $farmer = $this->farmer();

        $this->assign($program, ['farmer_ids' => [$farmer->id]]);
        $this->assign($program, ['farmer_ids' => [$farmer->id]])
            ->assertSessionHas('error');

        $this->assertSame(1, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    public function test_an_unverified_farmer_is_refused_even_when_posted_directly(): void
    {
        $program = $this->program();
        $verified = $this->farmer();
        $pending = $this->farmer(['verification_status' => 'pending']);

        /*
         * The picker never lists the unverified farmer, but the validation rule
         * is exists:farmers,id — which accepts any id at all. The screen is not
         * the guard.
         */
        $this->assign($program, ['farmer_ids' => [$verified->id, $pending->id]]);

        $this->assertSame(
            [$verified->id],
            AssistanceDistribution::where('assistance_id', $program->id)->pluck('farmer_id')->all(),
        );
    }

    public function test_nothing_is_written_when_the_whole_batch_is_unverified(): void
    {
        $program = $this->program();
        $pending = $this->farmer(['verification_status' => 'pending']);

        $this->assign($program, ['farmer_ids' => [$pending->id]])->assertSessionHas('error');

        $this->assertSame(0, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    // ------------------------------------------------------------- forfeiting

    public function test_a_forfeited_record_does_not_block_adding_the_farmer_again(): void
    {
        $program = $this->program();
        $farmer = $this->farmer(['last_name' => 'Secondchance']);

        AssistanceDistribution::create([
            'assistance_id' => $program->id,
            'farmer_id'     => $farmer->id,
            'status'        => 'forfeited',
            'distribution_date' => '2026-02-01',
        ]);

        /*
         * Those goods went back on the shelf, so the farmer may be served again
         * — which is why there is no unique index on (assistance_id, farmer_id).
         */
        $this->assertSame(['Farmer Secondchance'], $this->listed($program, ['assigned' => 'no']));

        $this->assign($program, ['farmer_ids' => [$farmer->id]])->assertSessionHas('success');

        $this->assertSame(
            ['forfeited', 'pending'],
            AssistanceDistribution::where('assistance_id', $program->id)
                ->orderBy('id')->pluck('status')->all(),
        );
    }

    public function test_a_live_row_wins_over_a_forfeited_one_in_the_listing(): void
    {
        $program = $this->program();
        $farmer = $this->farmer(['last_name' => 'Servedlater']);

        // Claimed FIRST, forfeited second, deliberately. With the rows the
        // other way round a plain keyBy() would land on the right answer by
        // accident and this test would pass against the bug it exists for.
        foreach (['claimed', 'forfeited'] as $status) {
            AssistanceDistribution::create([
                'assistance_id' => $program->id,
                'farmer_id'     => $farmer->id,
                'status'        => $status,
                'distribution_date' => '2026-02-01',
            ]);
        }

        /*
         * Keying the rows by farmer id alone would show whichever came last.
         * Reporting this farmer as forfeited while they have in fact received
         * their allocation is the kind of error nobody notices until a hand-out
         * is queried.
         */
        $row = collect($this->picker($program)['farmers']['data'])->firstWhere('name', 'Farmer Servedlater');

        $this->assertSame('claimed', $row['status']);
        $this->assertTrue($row['assigned']);
    }

    public function test_the_summary_counts_forfeited_separately(): void
    {
        $program = $this->program();

        foreach (['pending', 'claimed', 'forfeited'] as $status) {
            AssistanceDistribution::create([
                'assistance_id' => $program->id,
                'farmer_id'     => $this->farmer()->id,
                'status'        => $status,
                'amount_given'  => 2500,
                'distribution_date' => '2026-02-01',
            ]);
        }

        $summary = $this->picker($program)['summary'];

        // Two on the programme, not three: the forfeited allocation was returned.
        $this->assertSame(2, $summary['assigned']);
        $this->assertSame(1, $summary['pending']);
        $this->assertSame(1, $summary['claimed']);
        $this->assertSame(1, $summary['forfeited']);
        $this->assertSame(5000.0, $summary['planned_allocation']);
        $this->assertSame(95000.0, $summary['remaining_budget']);
        $this->assertFalse($summary['over_budget']);
    }

    public function test_an_unbudgeted_programme_reports_no_remainder(): void
    {
        $program = $this->program(['total_budget' => null]);
        $this->assign($program, ['farmer_ids' => [$this->farmer()->id]]);

        $summary = $this->picker($program)['summary'];

        /*
         * Null, not zero and not the allocation. A programme with no budget has
         * no remainder, and printing one invites the figure to be read as money
         * that is available to spend.
         */
        $this->assertNull($summary['total_budget']);
        $this->assertNull($summary['remaining_budget']);
        $this->assertFalse($summary['over_budget']);
    }

    public function test_going_over_budget_is_reported_rather_than_blocked(): void
    {
        $program = $this->program(['total_budget' => 4000]);

        $this->assign($program, [
            'farmer_ids' => [$this->farmer()->id, $this->farmer()->id],
            'amount'     => 2500,
        ])->assertSessionHas('success');

        /*
         * Reported, not refused. Nothing has been handed out yet, and a budget
         * that is about to be raised is a normal state for an office planning a
         * round — but it must be visible, not silent.
         */
        $this->assertTrue($this->picker($program)['summary']['over_budget']);
    }

    // ------------------------------------------------------ target barangays

    public function test_a_farmer_outside_the_target_barangays_is_listed_and_flagged(): void
    {
        $program = $this->program();
        $program->barangays()->sync(array_values($this->barangays(['Antagan I'])));

        $this->farmer(['last_name' => 'Inside', 'barangay' => 'Antagan I']);
        $this->farmer(['last_name' => 'Outside', 'barangay' => 'Caligayan']);

        $rows = collect($this->picker($program)['farmers']['data'])->keyBy('name');

        // Listed, both of them: a farmer may live in one barangay and farm in
        // another, so a differing barangay is a flag, not a disqualification.
        $this->assertCount(2, $rows);
        $this->assertFalse($rows['Farmer Inside']['outside_target']);
        $this->assertTrue($rows['Farmer Outside']['outside_target']);
    }

    public function test_adding_a_farmer_outside_the_targets_needs_the_override(): void
    {
        $program = $this->program();
        $program->barangays()->sync(array_values($this->barangays(['Antagan I'])));

        $inside = $this->farmer(['barangay' => 'Antagan I']);
        $outside = $this->farmer(['barangay' => 'Caligayan']);

        $this->assign($program, ['farmer_ids' => [$inside->id, $outside->id]])
            ->assertSessionHas('error');

        /*
         * Nothing at all is written, including the farmer who did qualify. A
         * partial batch would leave staff unsure which of the two went on, and
         * re-ticking is cheaper than reconciling that.
         */
        $this->assertSame(0, AssistanceDistribution::where('assistance_id', $program->id)->count());

        $this->assign($program, [
            'farmer_ids'           => [$inside->id, $outside->id],
            'allow_outside_target' => true,
        ])->assertSessionHas('success');

        $this->assertSame(2, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    public function test_the_override_is_not_needed_when_a_programme_targets_everyone(): void
    {
        // No barangays on the programme means the whole municipality, which is
        // the common case — it must not be read as "nobody qualifies".
        $program = $this->program();

        $this->assign($program, ['farmer_ids' => [$this->farmer(['barangay' => 'Anywhere'])->id]])
            ->assertSessionHas('success');

        $this->assertSame(1, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    public function test_the_picker_reports_which_select_all_ids_are_outside_the_targets(): void
    {
        $program = $this->program();
        $program->barangays()->sync(array_values($this->barangays(['Antagan I'])));

        $inside = $this->farmer(['barangay' => 'Antagan I']);
        $outside = $this->farmer(['barangay' => 'Caligayan']);

        /*
         * The screen can only flag the rows it has on display, so Select All
         * needs the server's own list — otherwise the override prompt would
         * depend on which page happened to be open when it was pressed.
         */
        $selectAll = $this->picker($program)['selectAll'];

        $this->assertSame([$outside->id], $selectAll['outside']);
        $this->assertContains($inside->id, $selectAll['ids']);
    }

    // ------------------------------------------------------------ the guards

    public function test_a_locked_programme_takes_no_new_beneficiaries(): void
    {
        $program = $this->program(['is_locked' => true]);

        $this->assign($program, ['farmer_ids' => [$this->farmer()->id]])
            ->assertSessionHas('error');

        $this->assertSame(0, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    public function test_a_completed_or_cancelled_programme_takes_no_new_beneficiaries(): void
    {
        foreach (['completed', 'cancelled'] as $status) {
            $program = $this->program(['status' => $status]);

            $this->assign($program, ['farmer_ids' => [$this->farmer()->id]])
                ->assertSessionHas('error');

            $this->assertSame(
                0,
                AssistanceDistribution::where('assistance_id', $program->id)->count(),
                "a {$status} programme should not accept beneficiaries",
            );
        }
    }

    public function test_the_picker_is_readable_but_frozen_while_locked(): void
    {
        $program = $this->program(['is_locked' => true]);
        $this->farmer();

        /*
         * Still viewable. This is the only screen that lists who a programme is
         * for, and locking the figures should not hide its beneficiaries.
         */
        $props = $this->picker($program);

        $this->assertTrue($props['program']['is_locked']);
        $this->assertCount(1, $props['farmers']['data']);
    }

    public function test_staff_can_manage_beneficiaries_but_a_farmer_account_cannot(): void
    {
        $program = $this->program();
        $farmer = $this->farmer();

        // Staff hold "edit assistance" — recording who a programme serves is
        // their day-to-day work, unlike creating the programme itself.
        $this->assign($program, ['farmer_ids' => [$farmer->id]], 'Staff')
            ->assertSessionHas('success');

        $other = $this->farmer();
        $this->assign($program, ['farmer_ids' => [$other->id]], 'Farmer')
            ->assertForbidden();

        $this->assertSame(1, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    // ---------------------------------------------------------------- removal

    public function test_a_farmer_awaiting_collection_can_be_taken_off(): void
    {
        $program = $this->program();
        $farmer = $this->farmer();

        $this->assign($program, ['farmer_ids' => [$farmer->id]]);
        $row = AssistanceDistribution::where('assistance_id', $program->id)->firstOrFail();

        $this->actingAs($this->user('Admin'))
            ->delete("/admin/assistance/{$program->id}/beneficiaries/{$row->id}")
            ->assertSessionHas('success');

        $this->assertSame(0, AssistanceDistribution::where('assistance_id', $program->id)->count());
    }

    public function test_a_farmer_who_has_received_something_cannot_be_removed(): void
    {
        $program = $this->program();

        $row = AssistanceDistribution::create([
            'assistance_id' => $program->id,
            'farmer_id'     => $this->farmer()->id,
            'status'        => 'claimed',
            'amount_given'  => 2500,
            'distribution_date' => '2026-02-01',
        ]);

        $this->actingAs($this->user('Admin'))
            ->delete("/admin/assistance/{$program->id}/beneficiaries/{$row->id}")
            ->assertSessionHas('error');

        /*
         * The goods have left the store. Deleting the row would erase that from
         * the register; forfeiting is how a release is undone, and it is a
         * different act with its own reason.
         */
        $this->assertDatabaseHas('assistance_distributions', ['id' => $row->id]);
    }

    public function test_a_record_from_another_programme_cannot_be_removed_through_this_one(): void
    {
        $mine = $this->program();
        $theirs = $this->program(['program_name' => 'Fuel Subsidy']);

        $row = AssistanceDistribution::create([
            'assistance_id' => $theirs->id,
            'farmer_id'     => $this->farmer()->id,
            'status'        => 'pending',
            'distribution_date' => '2026-02-01',
        ]);

        $this->actingAs($this->user('Admin'))
            ->delete("/admin/assistance/{$mine->id}/beneficiaries/{$row->id}")
            ->assertSessionHas('error');

        $this->assertDatabaseHas('assistance_distributions', ['id' => $row->id]);
    }
}
