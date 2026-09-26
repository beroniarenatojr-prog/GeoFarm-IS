<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ten idle minutes ends an administrative session — enforced here, on the server.
 *
 * This is the security mechanism. useInactivityTimeout in the browser provides
 * the warning and the countdown, which are courtesy: disabling JavaScript
 * removes the dialog and changes nothing about when the session dies, because
 * the decision is made here on every admin request.
 *
 * WHY NOT SESSION_LIFETIME=10
 * ---------------------------
 * Because that setting is global. It would also expire farmers on the farmer
 * portal and anyone halfway through the public RSBSA registration wizard —
 * losing a long form they are still filling in. The brief was explicit that
 * farmers and public pages must be unaffected, so the window is enforced where
 * it belongs: on the admin route group, and nowhere else. SESSION_LIFETIME
 * stays at its existing 120 minutes as the outer bound for everyone.
 *
 * The stamp is kept in the session rather than on the users table, so no
 * migration is needed and two people signed in as the same account on
 * different machines cannot expire each other.
 */
class EnforceAdminIdleTimeout
{
    /** When this session was last seen doing something. */
    public const SESSION_KEY = 'admin_last_activity_at';

    /** Idle minutes allowed. Matches the ten used by the browser-side hook. */
    private const IDLE_MINUTES = 10;

    public function handle(Request $request, Closure $next): Response
    {
        // Anonymous requests are the `auth` middleware's business, not this
        // one's. Answering them here as well would only add a second redirect.
        if (! Auth::check()) {
            return $next($request);
        }

        $session = $request->session();
        $lastSeen = $session->get(self::SESSION_KEY);
        $deadline = self::IDLE_MINUTES * 60;

        if ($lastSeen !== null && (time() - (int) $lastSeen) > $deadline) {
            return $this->expire($request);
        }

        /*
         * Stamp AFTER the check, so this request is what starts the next
         * window. Stamping first would make every request — including the one
         * that arrives eleven minutes late — look like fresh activity, and the
         * session would never expire at all.
         */
        $session->put(self::SESSION_KEY, time());

        return $next($request);
    }

    /**
     * End the session the same way the Log out button does.
     *
     * Deliberately mirrors LoginController::destroy rather than inventing a
     * second teardown: clearing active_session_id keeps PreventConcurrentLogins
     * honest, and clearHistory() is what stops the browser Back button
     * replaying a dashboard out of Inertia's history state after the session
     * has gone.
     */
    private function expire(Request $request): Response
    {
        $user = Auth::user();
        $user?->forceFill(['active_session_id' => null])->save();

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        Inertia::clearHistory();

        $message = 'Your session expired due to inactivity. Please log in again.';

        /*
         * A fetch() or a JSON client gets a 401 and its own message. Handing
         * those a redirect would have them render the login page inside a
         * panel, which is how a timeout ends up looking like corrupted data.
         */
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $message], 401);
        }

        /*
         * 303, not 302, when answering a PUT/PATCH/DELETE — the same rule
         * bootstrap/app.php applies to every other redirect, and the reason a
         * DELETE once arrived at /login as a DELETE and produced a 405.
         */
        $redirect = redirect()->route('login')->with('error', $message);

        if (in_array($request->method(), ['PUT', 'PATCH', 'DELETE'], true)) {
            $redirect->setStatusCode(303);
        }

        return $redirect;
    }
}
