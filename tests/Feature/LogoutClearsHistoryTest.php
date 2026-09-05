<?php

namespace Tests\Feature;

use Inertia\Support\SessionKey;
use Tests\TestCase;

/**
 * Inertia restores each visited page from window.history.state, with no request
 * to the server. So after logging out, Back would put the admin dashboard back
 * on screen - the session was gone, but the client never asked for it.
 *
 * Cache-Control cannot reach that path; the client has to be told to drop the
 * state. LoginController::destroy() does so via Inertia::clearHistory(), which
 * writes this session flag for the redirect that follows.
 */
class LogoutClearsHistoryTest extends TestCase
{
    /**
     * Logout is a POST through the web group, so it needs a CSRF token. Without
     * one the request is rejected as a 419 and this app's handler redirects it
     * to the login screen - which looks exactly like a successful logout, and
     * would let a broken fix pass unnoticed.
     */
    private function logout(): \Illuminate\Testing\TestResponse
    {
        return $this->withSession(['_token' => 'test-token', 'sentinel' => 'present'])
            ->post('/logout', ['_token' => 'test-token']);
    }

    public function test_logout_tells_the_client_to_drop_its_page_history(): void
    {
        $response = $this->logout();

        $response->assertRedirect(route('login'));
        $this->assertTrue(session()->get(SessionKey::CLEAR_HISTORY));
    }

    public function test_the_flag_is_written_after_the_session_is_invalidated(): void
    {
        // The regression this guards: clearHistory() writes to the session, so
        // calling it before session()->invalidate() wipes the flag and the fix
        // stops working silently, with no error anywhere.
        $this->logout();

        $this->assertTrue(session()->get(SessionKey::CLEAR_HISTORY));
        $this->assertNull(session()->get('sentinel'), 'the session should still have been invalidated');
    }

    public function test_it_really_reached_the_logout_controller(): void
    {
        $this->logout();

        // The 419 handler also redirects to login, so assert we did not take
        // that path by mistake.
        $this->assertNotSame(
            'Your session expired because the page was open for a while. Please sign in again.',
            session()->get('error'),
        );
    }
}
