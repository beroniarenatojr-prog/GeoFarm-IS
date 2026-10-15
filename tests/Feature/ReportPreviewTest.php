<?php

namespace Tests\Feature;

use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Previewing a report before downloading it.
 *
 * The preview exists so nobody sends the DA a report they have not read, which
 * only works if the preview and the file are the same document. Both are
 * rendered from one Blade view with one set of figures, and these tests hold
 * that together: a second rendering path that drifted from the PDF would be
 * worse than no preview, because it would be trusted.
 */
class ReportPreviewTest extends TestCase
{
    use RefreshDatabase;

    /** Every report, as route name => the view it renders. */
    private const REPORTS = [
        'admin.reports.demographics'        => 'Farmer Demographics',
        'admin.reports.crops'               => 'Crop Production',
        'admin.reports.livestock'           => 'Livestock Inventory',
        'admin.reports.assistance'          => 'Assistance',
        'admin.reports.agricultural-assets' => 'Agricultural Assets',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private ?User $admin = null;

    private function admin(): User
    {
        return $this->admin ??= tap(User::create([
            'name' => 'Reports Admin', 'email' => 'reports@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));
    }

    public function test_every_report_renders_a_preview_as_html(): void
    {
        foreach (array_keys(self::REPORTS) as $route) {
            $response = $this->actingAs($this->admin())
                ->get(route($route, ['format' => 'html']));

            $response->assertOk();

            /*
             * A document, not a download. If this came back as a PDF or as JSON
             * the iframe would offer to save it instead of showing it, which
             * looks exactly like a broken preview.
             */
            $this->assertStringContainsString(
                'text/html',
                $response->headers->get('Content-Type'),
                "$route did not render the preview as HTML",
            );

            $this->assertStringContainsString('<!DOCTYPE html', $response->getContent());
        }
    }

    public function test_the_preview_carries_the_reports_own_title(): void
    {
        foreach (self::REPORTS as $route => $heading) {
            $html = $this->actingAs($this->admin())
                ->get(route($route, ['format' => 'html']))
                ->getContent();

            // Checks the right view was rendered, not merely that something was.
            $this->assertStringContainsString(
                $heading,
                $html,
                "the $route preview does not look like the $heading report",
            );
        }
    }

    public function test_the_preview_shows_the_same_figures_the_pdf_would(): void
    {
        $crop = Crop::create(['crop_name' => 'Rice Preview Probe']);

        $farmer = Farmer::create([
            'first_name' => 'Preview', 'last_name' => 'Probe', 'sex' => 'Male',
            'barangay' => 'Antagan I', 'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        $parcel = FarmParcel::create([
            'farmer_id' => $farmer->id, 'parcel_number' => '1',
            'barangay' => 'Antagan I', 'total_area_ha' => 2, 'commodity' => 'Rice',
        ]);

        CropSeason::create([
            // parcel_id on this table, not farm_parcel_id — seasons hang off
            // the parcel and predate the farm_parcel_id naming used elsewhere.
            'parcel_id'      => $parcel->id,
            'crop_id'        => $crop->id,
            'season'         => 'wet',
            'cropping_year'  => 2026,
            'area_planted_ha' => 2,
            'yield_kg'       => 6000,
        ]);

        $html = $this->actingAs($this->admin())
            ->get(route('admin.reports.crops', ['format' => 'html']))
            ->getContent();

        /*
         * The figure itself, in the preview. This is the assertion that makes
         * the preview worth having — it is reading the real aggregate out of
         * the rendered document rather than trusting that a template was
         * returned.
         */
        $this->assertStringContainsString('Rice Preview Probe', $html);
        $this->assertStringContainsString('6000', $html);
    }

    public function test_the_pdf_still_downloads_as_a_file(): void
    {
        $response = $this->actingAs($this->admin())
            ->get(route('admin.reports.livestock', ['format' => 'pdf']));

        $response->assertOk();

        // The refactor that added the preview rewrote all five of these, so the
        // download is worth re-pinning rather than assuming.
        $this->assertStringContainsString('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString(
            'livestock-inventory.pdf',
            $response->headers->get('Content-Disposition'),
        );
    }

    public function test_an_unknown_format_still_returns_the_raw_figures(): void
    {
        // The JSON response is no longer linked from the page — the "View JSON"
        // buttons are gone — but the default is left in place rather than
        // removed, because nothing says it is unused elsewhere.
        $this->actingAs($this->admin())
            ->get(route('admin.reports.livestock'))
            ->assertOk()
            ->assertHeader('Content-Type', 'application/json');
    }

    public function test_the_preview_is_behind_the_same_permission_as_the_download(): void
    {
        $farmer = tap(User::create([
            'name' => 'Farmer', 'email' => 'nope@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        /*
         * A preview is the whole report on screen. Guarding the download while
         * leaving the preview open would be a permission that protects the file
         * and not the figures in it.
         */
        foreach (array_keys(self::REPORTS) as $route) {
            $this->actingAs($farmer)
                ->get(route($route, ['format' => 'html']))
                ->assertForbidden();
        }
    }

    public function test_a_signed_out_visitor_cannot_reach_a_preview(): void
    {
        $this->get(route('admin.reports.demographics', ['format' => 'html']))
            ->assertRedirect('/login');
    }
}
