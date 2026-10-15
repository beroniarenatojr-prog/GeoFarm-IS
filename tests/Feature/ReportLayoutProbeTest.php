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
 * Column alignment on the assistance reports.
 *
 * Alignment is not decoration on a document that goes to the DA: a heading that
 * sits over one column while its figures sit under another is how a reader
 * attributes an amount to the wrong farmer. These pin the three things that had
 * actually drifted — the heading and its cells agreeing on alignment, the
 * columns having declared widths so they do not resize per row, and the total
 * label sitting beside its own figure.
 */
class ReportLayoutProbeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function admin(): User
    {
        return tap(User::create([
            'name' => 'Admin', 'email' => 'layout@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));
    }

    private function seedOneDistribution(): FinancialAssistance
    {
        $type = AssistanceType::create([
            'type_name' => 'Cash Assistance', 'category' => 'crop',
            'distribution_type' => 'financial',
        ]);

        $program = FinancialAssistance::create([
            'program_name' => 'Assistance for Corn Farmer',
            'assistance_type_id' => $type->id, 'status' => 'completed',
            'total_budget' => 100000, 'standard_cash_amount' => 3500,
            'start_date' => '2026-09-21', 'end_date' => '2026-09-22',
        ]);

        // A long name and a long barangay, which is what made the auto-layout
        // columns shift in the first place.
        $farmer = Farmer::create([
            'first_name' => 'Consuelo', 'middle_name' => 'Addun', 'last_name' => 'Castillo',
            'sex' => 'Female', 'barangay' => 'Antagan II',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        $distribution = AssistanceDistribution::create([
            'assistance_id' => $program->id, 'farmer_id' => $farmer->id,
            'status' => 'claimed', 'amount_given' => 3500,
            'distribution_date' => '2026-09-21',
        ]);

        $item = InventoryItem::create([
            'item_name' => 'Urea Fertilizer', 'unit' => 'sack',
            'quantity' => 500, 'category' => 'fertilizer',
        ]);

        InventoryDistribution::create([
            'inventory_item_id' => $item->id,
            'assistance_distribution_id' => $distribution->id,
            'farmer_id' => $farmer->id, 'quantity' => 3,
            'distribution_date' => '2026-09-21',
        ]);

        return $program;
    }

    public function test_both_reports_use_fixed_layout_with_declared_widths(): void
    {
        $program = $this->seedOneDistribution();
        $admin = $this->admin();

        $pages = [
            'per-programme' => route('admin.assistance.report', [$program, 'format' => 'html']),
            'municipal'     => route('admin.reports.assistance', ['format' => 'html']),
        ];

        foreach ($pages as $name => $url) {
            $html = $this->actingAs($admin)->get($url)->assertOk()->getContent();

            /*
             * Without fixed layout the columns size themselves from their
             * contents, so no two rows line up and the PDF disagrees with the
             * preview — DomPDF does not measure the way a browser does.
             */
            $this->assertStringContainsString(
                'table-layout: fixed',
                $html,
                "the $name report is still on auto layout",
            );

            // Every column declares its share, so a long farmer name wraps
            // instead of stealing width from the columns beside it.
            $this->assertMatchesRegularExpression(
                '/<th style="width:\d+%"/',
                $html,
                "the $name report's columns have no declared widths",
            );
        }
    }

    public function test_the_amount_heading_and_its_figures_are_aligned_the_same_way(): void
    {
        $program = $this->seedOneDistribution();
        $admin = $this->admin();

        foreach ([
            route('admin.assistance.report', [$program, 'format' => 'html']),
            route('admin.reports.assistance', ['format' => 'html']),
        ] as $url) {
            $html = $this->actingAs($admin)->get($url)->getContent();

            /*
             * The heading carries the same .num class as the cells under it. A
             * right-aligned column of figures under a left-aligned heading is
             * the specific thing that looked broken on screen.
             */
            $this->assertMatchesRegularExpression(
                '/<th[^>]*class="num"[^>]*>\s*Amount \(PHP\)/',
                $html,
                'the Amount heading is not aligned with its column',
            );

            $this->assertStringContainsString('<td class="num">', $html);
        }
    }

    public function test_the_total_label_sits_beside_its_own_figure(): void
    {
        $program = $this->seedOneDistribution();

        $html = $this->actingAs($this->admin())
            ->get(route('admin.assistance.report', [$program, 'format' => 'html']))
            ->getContent();

        /*
         * Right-aligned across its three columns, so "Total released" ends where
         * the Amount column begins. Left-aligned it read as a caption at the far
         * edge of the page with an unrelated number three columns away.
         */
        $this->assertMatchesRegularExpression(
            '/<td colspan="3" class="num">\s*Total released/',
            $html,
        );
    }

    public function test_a_long_farmer_name_does_not_widen_its_column(): void
    {
        $program = $this->seedOneDistribution();

        $html = $this->actingAs($this->admin())
            ->get(route('admin.assistance.report', [$program, 'format' => 'html']))
            ->getContent();

        // The name and the item list wrap within their declared share rather
        // than forcing the table wider than the page.
        $this->assertStringContainsString('<td class="wrap">Consuelo Addun Castillo</td>', $html);
        $this->assertStringContainsString('word-wrap: break-word', $html);
    }

    public function test_the_meta_block_does_not_let_a_long_label_push_its_value(): void
    {
        $program = $this->seedOneDistribution();

        $html = $this->actingAs($this->admin())
            ->get(route('admin.assistance.report', [$program, 'format' => 'html']))
            ->getContent();

        /*
         * "Awaiting collection" is the widest label in the block and it shares a
         * column with "Status" and "Beneficiaries". Under auto layout it grew
         * its column and shoved the 0 beside it out of line with the values
         * above — which is visible in the header of the report on screen.
         */
        // The width itself, not a particular percentage — the point is that the
        // column is declared rather than sized from whichever label is longest.
        $this->assertMatchesRegularExpression(
            '/<td class="k" style="width:\d+%">\s*Status/',
            $html,
            'the meta block label column has no declared width',
        );

        $this->assertStringContainsString('Awaiting collection', $html);
    }
}
