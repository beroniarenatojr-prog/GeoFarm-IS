<?php

namespace Tests\Feature;

use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use App\Models\InventoryDistribution;
use App\Models\InventoryItem;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The per-programme distribution report, and the filters on the programme list.
 *
 * The report answers one question for the office: who got what, when, and where
 * are they. So the tests check the figures are actually in the rendered
 * document rather than that a template was returned — a report that renders
 * without its amounts is worse than one that errors, because it gets signed.
 *
 * The peso sign assertion is not cosmetic. DomPDF's built-in fonts carry no
 * glyph for U+20B1, so a "₱" prints as a hollow box on a report that goes to
 * the DA.
 */
class AssistanceProgramReportTest extends TestCase
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
            'name'      => $role,
            'email'     => strtolower(str_replace(' ', '-', $role)) . '@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $u) => $u->assignRole($role));
    }

    private function program(array $overrides = []): FinancialAssistance
    {
        $type = AssistanceType::firstOrCreate(
            ['type_name' => 'Cash Assistance'],
            ['category' => 'crop', 'distribution_type' => 'financial'],
        );

        return FinancialAssistance::create(array_merge([
            'program_name'         => 'Assistance for Corn Farmer',
            'assistance_type_id'   => $type->id,
            'status'               => 'active',
            'total_budget'         => 100000,
            'standard_cash_amount' => 2500,
            'start_date'           => '2026-09-21',
            'end_date'             => '2026-09-22',
        ], $overrides));
    }

    private function farmer(array $overrides = []): Farmer
    {
        static $n = 0;
        $n++;

        return Farmer::create(array_merge([
            'first_name'          => 'Juan',
            'last_name'           => 'Dela Cruz' . $n,
            'sex'                 => 'Male',
            'barangay'            => 'Antagan I',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ], $overrides));
    }

    private function html(FinancialAssistance $program, string $role = 'Admin'): string
    {
        return $this->actingAs($this->user($role))
            ->get(route('admin.assistance.report', [$program, 'format' => 'html']))
            ->assertOk()
            ->getContent();
    }

    // ---------------------------------------------------------- the report

    public function test_the_report_shows_the_farmer_barangay_date_and_amount(): void
    {
        $program = $this->program();

        AssistanceDistribution::create([
            'assistance_id'     => $program->id,
            'farmer_id'         => $this->farmer([
                'first_name' => 'Mariano', 'last_name' => 'Reyes', 'barangay' => 'Caligayan',
            ])->id,
            'status'            => 'claimed',
            'amount_given'      => 2500,
            'distribution_date' => '2026-09-21',
        ]);

        $html = $this->html($program);

        // The five things the office asked to see, each read out of the
        // rendered report rather than assumed from the payload.
        $this->assertStringContainsString('Mariano Reyes', $html);
        $this->assertStringContainsString('Caligayan', $html);
        $this->assertStringContainsString('Sep 21, 2026', $html);
        $this->assertStringContainsString('2,500.00', $html);
        $this->assertStringContainsString('Received', $html);
    }

    public function test_the_report_lists_the_items_given(): void
    {
        $program = $this->program();
        $farmer = $this->farmer();

        $item = InventoryItem::create([
            'item_name' => 'Urea Fertilizer', 'unit' => 'sack',
            'quantity'  => 100, 'category' => 'fertilizer',
        ]);

        $distribution = AssistanceDistribution::create([
            'assistance_id'     => $program->id,
            'farmer_id'         => $farmer->id,
            'status'            => 'claimed',
            'distribution_date' => '2026-09-21',
        ]);

        InventoryDistribution::create([
            'inventory_item_id'          => $item->id,
            'assistance_distribution_id' => $distribution->id,
            'farmer_id'                  => $farmer->id,
            'quantity'                   => 2,
            'distribution_date'          => '2026-09-21',
        ]);

        $html = $this->html($program);

        // "2 sack Urea Fertilizer", not "2.00 sack" — the trailing zeros on a
        // whole number of sacks read as a measurement error.
        $this->assertStringContainsString('Urea Fertilizer', $html);
        $this->assertStringContainsString('2 sack', $html);
        $this->assertStringNotContainsString('2.00 sack', $html);
    }

    public function test_a_whole_number_of_sacks_is_not_mangled_by_the_trimming(): void
    {
        $program = $this->program();
        $farmer = $this->farmer();

        $item = InventoryItem::create([
            'item_name' => 'Urea Fertilizer', 'unit' => 'sack',
            'quantity'  => 500, 'category' => 'fertilizer',
        ]);

        $distribution = AssistanceDistribution::create([
            'assistance_id'     => $program->id,
            'farmer_id'         => $farmer->id,
            'status'            => 'claimed',
            'distribution_date' => '2026-09-21',
        ]);

        InventoryDistribution::create([
            'inventory_item_id'          => $item->id,
            'assistance_distribution_id' => $distribution->id,
            'farmer_id'                  => $farmer->id,
            'quantity'                   => 100,
            'distribution_date'          => '2026-09-21',
        ]);

        $html = $this->actingAs($this->user('Admin'))
            ->get(route('admin.reports.assistance', ['format' => 'html']))
            ->getContent();

        /*
         * 100 sacks, not 1.
         *
         * rtrim('100.00', '0.') strips every trailing '0' AND '.' — the second
         * argument is a set of characters, not a suffix — so a hundred sacks
         * was reported as one, and a thousand as "1,". The zeros have to be
         * trimmed before the point, each in its own pass.
         */
        $this->assertMatchesRegularExpression('/>\s*100\s+sack/', $html);
        $this->assertDoesNotMatchRegularExpression('/>\s*1\s+sack/', $html);
    }

    public function test_the_report_carries_no_peso_sign(): void
    {
        $program = $this->program();

        AssistanceDistribution::create([
            'assistance_id'     => $program->id,
            'farmer_id'         => $this->farmer()->id,
            'status'            => 'claimed',
            'amount_given'      => 2500,
            'distribution_date' => '2026-09-21',
        ]);

        $html = $this->html($program);

        /*
         * DomPDF's built-in fonts have no U+20B1 glyph, so this prints as a
         * hollow box on the PDF. The unit belongs in the column heading.
         */
        $this->assertStringNotContainsString('₱', $html);
        $this->assertStringContainsString('Amount (PHP)', $html);
    }

    public function test_the_municipality_wide_report_carries_no_peso_sign_either(): void
    {
        $program = $this->program();

        AssistanceDistribution::create([
            'assistance_id'     => $program->id,
            'farmer_id'         => $this->farmer()->id,
            'status'            => 'claimed',
            'amount_given'      => 2500,
            'distribution_date' => '2026-09-21',
        ]);

        // The same sign was on the Reports page version of this report.
        $html = $this->actingAs($this->user('Admin'))
            ->get(route('admin.reports.assistance', ['format' => 'html']))
            ->getContent();

        $this->assertStringNotContainsString('₱', $html);
        $this->assertStringContainsString('Barangay', $html);
        $this->assertStringContainsString('Item given', $html);
    }

    public function test_a_goods_only_handout_shows_a_dash_rather_than_zero(): void
    {
        $program = $this->program();

        AssistanceDistribution::create([
            'assistance_id'     => $program->id,
            'farmer_id'         => $this->farmer()->id,
            'status'            => 'claimed',
            // No cash at all, which is normal for a seed or fertiliser round.
            'amount_given'      => null,
            'distribution_date' => '2026-09-21',
        ]);

        $html = $this->html($program);

        /*
         * "0.00" would state that the farmer was paid nothing, when in fact
         * they were not paid at all — and a column of zeroes totals the same
         * either way, which is how a goods programme comes to look unfunded.
         *
         * This caught a real one: the row cell was already a dash, but the
         * total row printed "Total released 0.00" underneath it.
         */
        $this->assertStringNotContainsString('0.00', $html);
        $this->assertStringContainsString('Total released', $html);
    }

    public function test_the_totals_count_only_what_was_actually_handed_over(): void
    {
        $program = $this->program();

        foreach ([['claimed', 2500], ['pending', 2500], ['forfeited', 2500]] as [$status, $amount]) {
            AssistanceDistribution::create([
                'assistance_id'     => $program->id,
                'farmer_id'         => $this->farmer()->id,
                'status'            => $status,
                'amount_given'      => $amount,
                'distribution_date' => '2026-09-21',
            ]);
        }

        $html = $this->html($program);

        /*
         * One claimed row, so 2,500.00 and not 7,500.00: the pending allocation
         * is still in the office and the forfeited one went back on the shelf.
         * A report that totalled all three would overstate what the programme
         * has spent.
         */
        $this->assertStringContainsString('2,500.00', $html);
        $this->assertStringNotContainsString('7,500.00', $html);

        // And it says so, rather than leaving the reader to wonder.
        $this->assertStringContainsString('awaiting collection', $html);
    }

    public function test_a_programme_with_no_distributions_says_so(): void
    {
        $html = $this->html($this->program());

        // Not a blank table. An empty programme is an ordinary state.
        $this->assertStringContainsString('No distributions have been recorded', $html);
    }

    public function test_the_report_downloads_as_a_pdf_named_after_the_programme(): void
    {
        $program = $this->program(['program_name' => 'Assistance for Corn Farmer']);

        $response = $this->actingAs($this->user('Admin'))
            ->get(route('admin.assistance.report', [$program, 'format' => 'pdf']));

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString(
            'assistance-for-corn-farmer-distributions.pdf',
            $response->headers->get('Content-Disposition'),
        );
    }

    public function test_a_locked_programme_can_still_be_reported_on(): void
    {
        $program = $this->program(['is_locked' => true]);

        // Locking freezes a programme against edits. Reporting on it is exactly
        // what a frozen programme is for.
        $this->actingAs($this->user('Admin'))
            ->get(route('admin.assistance.report', [$program, 'format' => 'html']))
            ->assertOk();
    }

    public function test_a_farmer_account_cannot_open_a_programme_report(): void
    {
        $program = $this->program();

        // The report lists every beneficiary on the programme by name and
        // barangay — it is office-only whatever the farmer's own portal shows.
        $this->actingAs($this->user('Farmer'))
            ->get(route('admin.assistance.report', [$program, 'format' => 'html']))
            ->assertForbidden();
    }

    // --------------------------------------------------------- the filters

    /** @return array<int, string> the programme names the list returned */
    private function listed(array $query, string $role = 'Admin'): array
    {
        $page = $this->actingAs($this->user($role))
            ->get('/admin/assistance?' . http_build_query($query))
            ->viewData('page');

        return collect($page['props']['programs']['data'])
            ->pluck('program_name')->sort()->values()->all();
    }

    public function test_programmes_can_be_filtered_by_status(): void
    {
        $this->program(['program_name' => 'Running', 'status' => 'active']);
        $this->program(['program_name' => 'Finished', 'status' => 'completed']);

        $this->assertSame(['Running'], $this->listed(['status' => 'active']));
        $this->assertSame(['Finished'], $this->listed(['status' => 'completed']));
        $this->assertSame(['Finished', 'Running'], $this->listed([]));
    }

    public function test_programmes_can_be_searched_by_name_and_by_type(): void
    {
        $cash = AssistanceType::firstOrCreate(
            ['type_name' => 'Cash Assistance'],
            ['category' => 'crop', 'distribution_type' => 'financial'],
        );
        $seed = AssistanceType::firstOrCreate(
            ['type_name' => 'Seed Distribution'],
            ['category' => 'crop', 'distribution_type' => 'material'],
        );

        $this->program(['program_name' => 'Corn Farmer Support', 'assistance_type_id' => $cash->id]);
        $this->program(['program_name' => 'Fertilizer Round', 'assistance_type_id' => $seed->id]);

        $this->assertSame(['Corn Farmer Support'], $this->listed(['search' => 'Corn']));

        // The type is a column on this list, so it is a reasonable thing to
        // type into the search box.
        $this->assertSame(['Fertilizer Round'], $this->listed(['search' => 'Seed Distribution']));
    }

    public function test_programmes_can_be_filtered_by_type(): void
    {
        $cash = AssistanceType::firstOrCreate(
            ['type_name' => 'Cash Assistance'],
            ['category' => 'crop', 'distribution_type' => 'financial'],
        );
        $seed = AssistanceType::create([
            'type_name' => 'Seed Distribution', 'category' => 'crop',
            'distribution_type' => 'material',
        ]);

        $this->program(['program_name' => 'Cash Round', 'assistance_type_id' => $cash->id]);
        $this->program(['program_name' => 'Seed Round', 'assistance_type_id' => $seed->id]);

        $this->assertSame(['Seed Round'], $this->listed(['type' => $seed->id]));
    }

    public function test_the_locked_filter_separates_locked_from_unlocked(): void
    {
        $this->program(['program_name' => 'Frozen', 'is_locked' => true]);
        $this->program(['program_name' => 'Open', 'is_locked' => false]);

        $this->assertSame(['Frozen'], $this->listed(['locked' => 'yes']));

        // The case a truthiness check would break: 'no' is a non-empty string
        // but means false, and treating it as "no filter" would return both.
        $this->assertSame(['Open'], $this->listed(['locked' => 'no']));
    }

    public function test_filters_combine_rather_than_replace_each_other(): void
    {
        $this->program(['program_name' => 'Active Corn', 'status' => 'active']);
        $this->program(['program_name' => 'Finished Corn', 'status' => 'completed']);
        $this->program(['program_name' => 'Active Rice', 'status' => 'active']);

        $this->assertSame(
            ['Active Corn'],
            $this->listed(['status' => 'active', 'search' => 'Corn']),
        );
    }

    public function test_an_unknown_status_is_rejected_rather_than_ignored(): void
    {
        // Silently dropping it would show the full list under a filter the user
        // believes is applied.
        $this->actingAs($this->user('Admin'))
            ->get('/admin/assistance?status=not-a-status')
            ->assertSessionHasErrors('status');
    }
}
