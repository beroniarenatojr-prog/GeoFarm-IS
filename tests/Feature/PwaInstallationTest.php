<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What makes GeoFarm-IS installable, and what it must not cache.
 *
 * The manifest, the service worker and the offline page are static files in
 * public/, so most of this is about their contents rather than their routing.
 * They are worth testing anyway: a typo in a manifest produces no error
 * anywhere — the browser simply declines to offer the install, and the only
 * symptom is an install button that never appears.
 *
 * The service worker assertions are the important ones. They pin the rules that
 * keep one farmer's records out of another's browser, and those rules live in a
 * file that no amount of PHP testing would otherwise touch.
 */
class PwaInstallationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function publicFile(string $name): string
    {
        $path = public_path($name);

        $this->assertFileExists($path, "$name is missing from public/");

        return (string) file_get_contents($path);
    }

    // ---------------------------------------------------------- manifest

    public function test_the_manifest_declares_what_an_install_needs(): void
    {
        $manifest = json_decode($this->publicFile('manifest.webmanifest'), true);

        $this->assertIsArray($manifest, 'the manifest is not valid JSON');

        $this->assertSame('GeoFarm-IS', $manifest['name']);
        $this->assertSame('GeoFarm', $manifest['short_name']);
        $this->assertSame('standalone', $manifest['display']);
        $this->assertSame('#006400', $manifest['theme_color']);
        $this->assertSame('/', $manifest['scope']);

        /*
         * Not "/" — the landing page is public marketing, and an installed app
         * that opens there every launch has failed at the first screen. /app
         * forwards by role.
         */
        $this->assertSame('/app', $manifest['start_url']);
    }

    public function test_the_manifest_offers_both_required_icon_sizes(): void
    {
        $manifest = json_decode($this->publicFile('manifest.webmanifest'), true);

        $sizes = collect($manifest['icons'])->pluck('sizes');

        // Chromium refuses to offer an install without both of these.
        $this->assertContains('192x192', $sizes);
        $this->assertContains('512x512', $sizes);

        // A maskable icon as well, or Android crops the square artwork to a
        // circle and clips the municipal seal's corners off.
        $this->assertContains(
            'maskable',
            collect($manifest['icons'])->pluck('purpose'),
        );

        foreach ($manifest['icons'] as $icon) {
            $this->assertFileExists(
                public_path(ltrim($icon['src'], '/')),
                "the manifest points at {$icon['src']}, which is not there",
            );
        }
    }

    public function test_the_icon_files_are_the_sizes_they_claim(): void
    {
        /*
         * Checked because a manifest that merely claims 512x512 is enough to
         * get the install offered and then produces a blurry launcher icon.
         */
        foreach ([['icons/icon-192.png', 192], ['icons/icon-512.png', 512]] as [$file, $expected]) {
            $this->assertFileExists(public_path($file));

            [$width, $height] = getimagesize(public_path($file));

            $this->assertSame($expected, $width, "$file is not {$expected}px wide");
            $this->assertSame($expected, $height, "$file is not {$expected}px tall");
        }
    }

    public function test_the_page_head_links_the_manifest_and_the_ios_metadata(): void
    {
        $head = (string) file_get_contents(resource_path('views/app.blade.php'));

        $this->assertStringContainsString('rel="manifest"', $head);
        $this->assertStringContainsString('theme-color', $head);

        // iOS ignores the manifest entirely; without these a home-screen launch
        // opens in a Safari tab with a screenshot for an icon.
        $this->assertStringContainsString('apple-touch-icon', $head);
        $this->assertStringContainsString('apple-mobile-web-app-capable', $head);

        // Required for the bottom navigation to pad itself clear of the iPhone
        // home indicator.
        $this->assertStringContainsString('viewport-fit=cover', $head);
    }

    // ----------------------------------------------------- the start URL

    public function test_the_start_url_sends_a_farmer_to_their_portal(): void
    {
        $user = tap(User::create([
            'name' => 'Farmer', 'email' => 'start-farmer@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        Farmer::create([
            'first_name' => 'Test', 'last_name' => 'Farmer', 'sex' => 'Male',
            'barangay' => 'Antagan I', 'user_id' => $user->id,
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        $this->actingAs($user)->get('/app')->assertRedirect(route('farmer.dashboard'));
    }

    public function test_the_start_url_sends_an_office_account_to_the_dashboard(): void
    {
        $admin = tap(User::create([
            'name' => 'Admin', 'email' => 'start-admin@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));

        /*
         * The case that makes this route worth having: an office account opening
         * the installed app must not land on the farmer portal, which refuses
         * them with a 403 that reads as a broken app.
         */
        $this->actingAs($admin)->get('/app')->assertRedirect(route('admin.dashboard'));
    }

    public function test_the_start_url_sends_a_signed_out_launch_to_the_login_page(): void
    {
        // Not a 403, and not into an auth-middleware redirect loop that would
        // stash /app as the intended URL and bounce straight back here.
        $this->get('/app')->assertRedirect(route('login'));
    }

    // ------------------------------------------------- the service worker

    public function test_the_service_worker_and_offline_page_are_published(): void
    {
        $worker = $this->publicFile('sw.js');

        // The offline page is precached by name; if it is renamed in one place
        // only, the fallback silently becomes a network error page.
        $this->assertStringContainsString('/offline.html', $worker);
        $this->assertFileExists(public_path('offline.html'));
    }

    public function test_the_offline_page_stands_on_its_own(): void
    {
        $page = $this->publicFile('offline.html');

        /*
         * It is shown exactly when the network is gone, so it must not reach
         * for the stylesheet or the JavaScript bundle — neither of which is
         * guaranteed to be in the cache. Inline styles and inline script only.
         */
        $this->assertStringNotContainsString('/build/assets/', $page);
        $this->assertStringContainsString('<style>', $page);
    }

    public function test_the_service_worker_refuses_to_cache_private_paths(): void
    {
        $worker = $this->publicFile('sw.js');

        /*
         * The heart of it. Every one of these paths returns a page built from
         * the signed-in user's own records, and Cache Storage is shared by
         * everyone who uses the device — so caching any of them would serve one
         * farmer's RSBSA number, parcels and assistance to whoever picks the
         * phone up next.
         */
        foreach (['/admin', '/farmer', '/login', '/logout'] as $path) {
            $this->assertStringContainsString(
                "'$path'",
                $worker,
                "$path is not on the service worker's never-cache list",
            );
        }
    }

    public function test_the_service_worker_only_handles_get_requests(): void
    {
        $worker = $this->publicFile('sw.js');

        /*
         * A POST is a state change — a recorded hand-out, a submitted
         * questionnaire. It must reach the server or fail loudly, never be
         * answered from a cache or replayed later.
         */
        $this->assertStringContainsString("request.method !== 'GET'", $worker);
    }

    public function test_the_service_worker_never_caches_a_document(): void
    {
        $worker = $this->publicFile('sw.js');

        /*
         * Navigations fall back to the offline page and to nothing else. The
         * usual app-shell trick — cache index.html and serve it offline — is
         * wrong for an Inertia app, because every document carries the user's
         * own props inside it.
         */
        $this->assertStringContainsString("request.mode === 'navigate'", $worker);
        $this->assertStringContainsString('caches.match(OFFLINE_URL', $worker);
    }

    public function test_the_service_worker_honours_no_store_responses(): void
    {
        $worker = $this->publicFile('sw.js');

        /*
         * ID proofs are served with "Cache-Control: private, no-store" by the
         * controller that guards them. A service worker is perfectly capable of
         * ignoring that header, so it is checked here instead.
         */
        $this->assertStringContainsString('no-store', $worker);
        $this->assertStringContainsString('private', $worker);
    }

    public function test_the_service_worker_leaves_other_origins_alone(): void
    {
        $worker = $this->publicFile('sw.js');

        // Basemap tiles belong to the provider and their caching rules are in
        // their own headers, which the browser's HTTP cache already applies.
        $this->assertStringContainsString('url.origin !== self.location.origin', $worker);
    }
}
