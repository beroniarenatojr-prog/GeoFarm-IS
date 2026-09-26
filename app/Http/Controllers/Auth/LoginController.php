<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\LoginOtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class LoginController extends Controller
{
    public function __construct(private readonly LoginOtpService $otps)
    {
    }

    public function show()
    {
        return Inertia::render('Auth/Login');
    }

    public function store(Request $request)
    {
        $email = strtolower(trim((string) $request->input('email')));

        $request->merge(['email' => $email]);

        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'Invalid credentials.']);
        }

        $user = Auth::user();

        // Farmers who registered online stay deactivated until staff verifies
        // their documents at the Agriculture Office.
        if (!$user->is_active) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return back()->withErrors([
                'email' => 'Your account is not yet active. Please visit the Agriculture Office with your documents so staff can verify your registration.',
            ]);
        }

        /*
         * Administrative accounts are NOT logged in by a correct password.
         *
         * Auth::attempt above established that the password is right, and the
         * session it created is undone here before any response leaves. There
         * is no window in which a half-authorised session exists: the user is
         * simply not signed in until a code is accepted, so /admin/* stays
         * closed by the ordinary `auth` middleware rather than by a guard that
         * has to be remembered on every route.
         *
         * Farmers fall through untouched, exactly as before this existed.
         */
        if ($this->otps->isRequiredFor($user)) {
            return $this->startVerification($request, $user);
        }

        $user->update(['last_login' => now()]);

        $request->session()->regenerate();

        // Prevent concurrent logins: store the current session ID AFTER regeneration
        // Any old sessions will be invalidated by the middleware
        $user->update(['active_session_id' => $request->session()->getId()]);
        
        // Redirect based on user role
        if ($user->hasRole('Farmer')) {
            return redirect()->route('farmer.dashboard');
        }
        
        return redirect()->route('admin.dashboard');
    }

    /**
     * Hand an administrator over to the verification screen.
     *
     * last_login and active_session_id are deliberately NOT written here. A
     * sign-in that has not been verified is not a login, and stamping
     * active_session_id now would let an unverified attempt on one computer
     * evict a fully verified session on another — PreventConcurrentLogins
     * would see a newer id and sign the working session out. Both are written
     * by VerifyOtpController once the code is accepted.
     */
    private function startVerification(Request $request, $user)
    {
        Auth::logout();

        /*
         * A new session id before the pending state goes in, so the id that
         * carries an unverified attempt is never the one an anonymous visitor
         * arrived with. regenerate() rather than invalidate(): the flash bag
         * and the intended URL have to survive, and the intended URL is what
         * sends the user back to /admin/assistance instead of the dashboard.
         */
        $request->session()->regenerate();

        [$otp, $sent] = $this->otps->start($user);

        $request->session()->put(VerifyOtpController::SESSION_USER, $user->id);
        $request->session()->put(VerifyOtpController::SESSION_OTP, $otp->id);

        AuditService::log('otp_issued', 'login_otp_verifications', $otp->id, null, [
            // Never the code itself — only that one was issued, and whether
            // the mail server accepted it.
            'event'     => 'Verification code issued for administrative login',
            'user_id'   => $user->id,
            'delivered' => $sent,
        ]);

        /*
         * A failed send still lands on the verification page, with the failure
         * stated. The alternative — refusing the login outright — would tell
         * an attacker at the form which addresses belong to administrators,
         * and would leave a real administrator with nothing to press. From the
         * verification page they can use Resend once the cooldown passes.
         *
         * last_sent_at was stamped regardless of the outcome, so a broken mail
         * server cannot be used to hammer SMTP from the login form.
         */
        if (! $sent) {
            return redirect()->route('admin.verify-otp')->with(
                'error',
                "We couldn't send the verification code. Please try again or contact the system administrator.",
            );
        }

        return redirect()->route('admin.verify-otp');
    }

    public function destroy(Request $request)
    {
        // Clear the active session ID so user can login again
        if (Auth::check()) {
            Auth::user()->update(['active_session_id' => null]);
        }

        /*
         * Any half-finished verification dies with the session too, so the
         * next sign-in always needs a fresh code. abandon() expires the row as
         * well as dropping the session keys — a code already in someone's
         * inbox must not still work after a logout.
         */
        $this->abandonPendingVerification($request);

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // Order matters: clearHistory() writes a session flag, so calling it
        // before invalidate() would throw the flag away and silently do nothing.
        //
        // This is the part that actually stops Back returning to the dashboard.
        // Inertia replays pages straight out of window.history.state without
        // issuing a request, so no Cache-Control header can reach it - the
        // client has to be told to drop that state.
        Inertia::clearHistory();

        return redirect()->route('login');
    }

    private function abandonPendingVerification(Request $request): void
    {
        $otpId = $request->session()->get(VerifyOtpController::SESSION_OTP);

        if ($otpId) {
            $this->otps->abandon(\App\Models\LoginOtpVerification::find($otpId));
        }

        $request->session()->forget([
            VerifyOtpController::SESSION_USER,
            VerifyOtpController::SESSION_OTP,
            VerifyOtpController::SESSION_VERIFIED,
        ]);
    }
}
