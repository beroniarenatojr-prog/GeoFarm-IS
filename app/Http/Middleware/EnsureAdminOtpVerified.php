<?php

namespace App\Http\Middleware;

use App\Http\Controllers\Auth\VerifyOtpController;
use App\Services\LoginOtpService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * No administrative page without a verified session.
 *
 * This is not belt-and-braces for the login controller, which already refuses
 * to authenticate an administrator before verification. It closes a hole that
 * controller cannot see: Laravel's remember-me cookie.
 *
 * A recaller cookie re-authenticates on a later visit WITHOUT passing through
 * LoginController at all. Left alone, an administrator who had ticked
 * "remember me" would be signed straight back into /admin with no code ever
 * requested — verification skipped entirely, which is precisely what this
 * feature exists to prevent. VerifyOtpController deliberately does not set
 * that cookie, but one issued before this feature shipped, or by any future
 * code calling Auth::login, would still be honoured.
 *
 * So the test is on the SESSION, not on the user or on any database row: this
 * particular session must have completed verification. A session that has not
 * is ended and sent back to sign in properly.
 *
 * Farmers are never affected. The check runs only for accounts holding one of
 * the administrative roles, and only while the feature is switched on.
 */
class EnsureAdminOtpVerified
{
    public function __construct(private readonly LoginOtpService $otps)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('geofarm.admin_otp.enabled', false)) {
            return $next($request);
        }

        $user = Auth::user();

        // Not signed in: the `auth` middleware on the same group answers this,
        // and answering it here as well would only add a second redirect.
        if (! $user) {
            return $next($request);
        }

        if (! $this->otps->isAdministrative($user)) {
            return $next($request);
        }

        if ($request->session()->has(VerifyOtpController::SESSION_VERIFIED)) {
            return $next($request);
        }

        /*
         * Authenticated, administrative, unverified. The only way to be here
         * is a session that never passed through verification — a remember-me
         * cookie, or a session that predates this feature being switched on.
         *
         * Ending it is the honest response. Redirecting to the verification
         * page instead would be a dead end: there is no pending attempt to
         * verify against, so that page would bounce straight back here and
         * loop. Signing out and starting again always works.
         */
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->with(
            'error',
            'Please sign in again to receive a verification code.',
        );
    }
}
