<?php

namespace Tests\Feature;

use App\Http\Middleware\PreventBackHistory;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Tests\TestCase;

/**
 * Signing out clears the session, but the browser keeps its own copy of every
 * page it rendered. Without these headers, Back then Forward puts the admin
 * dashboard back on screen without a request ever reaching Laravel.
 */
class PreventBackHistoryTest extends TestCase
{
    private function respondTo(?User $user): Response
    {
        $request = Request::create('/admin/dashboard');
        $request->setUserResolver(fn () => $user);

        return (new PreventBackHistory())
            ->handle($request, fn () => new Response('dashboard'));
    }

    public function test_signed_in_responses_forbid_the_browser_storing_them(): void
    {
        $response = $this->respondTo(new User(['name' => 'Staff']));

        // no-store is the load-bearing one: no-cache still allows the response
        // to be written to disk and revalidated, which Back can replay.
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('must-revalidate', $response->headers->get('Cache-Control'));
        $this->assertSame('no-cache', $response->headers->get('Pragma'));
    }

    public function test_guest_responses_are_left_alone(): void
    {
        $response = $this->respondTo(null);

        // The landing page and login screen hold nothing private and are the
        // most-requested pages on the site, so they stay cacheable.
        $this->assertStringNotContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertNull($response->headers->get('Pragma'));
    }
}
