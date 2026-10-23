<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Farmer;
use App\Models\FarmParcel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * The public landing page.
 *
 * It carries the municipal seal and is the first thing a farmer sees, so the
 * figures on it have to be counted rather than claimed. These tests pin that:
 * the barangay count excludes retired rows, the farmer count excludes anyone
 * the office has not verified, and nothing on the page states a figure the
 * registry cannot produce.
 *
 * The page is also cached, which is its own hazard — a cached payload from a
 * previous test would make any of the below pass for the wrong reason.
 */
class LandingPageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // config:clear does not touch Cache::remember; the landing stats are
        // cached for five minutes and would otherwise leak between tests.
        Cache::flush();
    }

    private function props(): array
    {
        return $this->get('/')->assertOk()->viewData('page')['props'];
    }

    public function test_the_landing_page_opens_for_a_signed_out_visitor(): void
    {
        // The whole point of it: a farmer who has never had an account.
        $this->get('/')->assertOk();
    }

    public function test_the_barangay_count_excludes_retired_barangays(): void
    {
        foreach (['Antagan I', 'Caligayan', 'Lanna'] as $name) {
            Barangay::create([
                'name' => $name, 'municipality' => 'Tumauini',
                'province' => 'Isabela', 'is_active' => true,
            ]);
        }

        Barangay::create([
            'name' => 'Renamed Long Ago', 'municipality' => 'Tumauini',
            'province' => 'Isabela', 'is_active' => false,
        ]);

        /*
         * The reason this test exists: the count used to be of the whole table,
         * so a public page serving a municipality of 46 barangays reported 75.
         * Retired rows are kept so the boundaries and programmes attached to
         * them survive — they are not barangays of Tumauini any more.
         */
        $props = $this->props();

        $this->assertSame(3, $props['stats']['barangays']);
        $this->assertCount(3, $props['barangays']);
        $this->assertNotContains('Renamed Long Ago', $props['barangays']);
    }

    public function test_the_farmer_count_is_verified_farmers_only(): void
    {
        Farmer::create([
            'first_name' => 'Checked', 'last_name' => 'Farmer', 'sex' => 'Male',
            'barangay' => 'Antagan I', 'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        Farmer::create([
            'first_name' => 'Unchecked', 'last_name' => 'Farmer', 'sex' => 'Male',
            'barangay' => 'Antagan I', 'verification_status' => Farmer::STATUS_PENDING,
        ]);

        /*
         * Someone who registered online and has not been reviewed is not a
         * registered farmer of Tumauini yet. Counting them would overstate the
         * registry on a page that represents the office.
         */
        $this->assertSame(1, $this->props()['stats']['farmers']);
    }

    public function test_the_hectares_figure_is_summed_from_real_parcels(): void
    {
        $farmer = Farmer::create([
            'first_name' => 'Land', 'last_name' => 'Holder', 'sex' => 'Male',
            'barangay' => 'Antagan I', 'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        foreach ([1.25, 2.5, 0.75] as $i => $area) {
            FarmParcel::create([
                'farmer_id' => $farmer->id, 'parcel_number' => (string) ($i + 1),
                'barangay' => 'Antagan I', 'total_area_ha' => $area,
            ]);
        }

        $this->assertSame(4.5, $this->props()['stats']['hectares']);
    }

    public function test_an_empty_registry_reports_zero_rather_than_breaking(): void
    {
        /*
         * A brand-new deployment has no farmers, no parcels and no barangays.
         * The page still has to render — this is what the office sees on day
         * one, and a 500 there is a bad first impression of the system.
         */
        $stats = $this->props()['stats'];

        $this->assertSame(0, $stats['barangays']);
        $this->assertSame(0, $stats['farmers']);
        $this->assertSame(0.0, $stats['hectares']);
        $this->assertSame(0, $stats['programs']);
    }

    public function test_the_page_states_no_figure_the_registry_cannot_produce(): void
    {
        /*
         * The About band was written with no population, land-area or
         * production figures in it, because inventing those on a page carrying
         * the municipal seal would be worse than saying less. The props carry
         * exactly four counted figures and nothing else.
         */
        $this->assertSame(
            ['barangays', 'farmers', 'hectares', 'programs'],
            array_keys($this->props()['stats']),
        );
    }
}
