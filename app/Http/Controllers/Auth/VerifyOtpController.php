<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\LoginOtpVerification;
use App\Models\User;
use App\Services\AuditService;
use App\Services\LoginOtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * The second half of an administrative sign-in.
 *
 * Everyone reaching this controller has given a correct password and is NOT
 * logged in — Auth::login is not called until verify() accepts a code. That is
 * the whole security model: there is no partially authorised session to
 * escape from, so /admin/* is closed by the ordinary `auth` middleware and
 * there is no bypass surface to get wrong.
 *
 * The only thing carrying a user between the two halves is two session keys
 * holding integer ids. No plaintext code, no user object, no role.
 */
class VerifyOtpController extends Controller
{
    public const SESSION_USER = 'pending_admin_otp_user_id';
    public const SESSION_OTP  = 'pending_admin_otp_id';

    /**
     * Marks a session that has completed verification.
     *
     * Checked by EnsureAdminOtpVerified on every administrative request. It
     * lives in the session and dies with it, which is what forces a new code
     * on the next sign-in and — importantly — what stops Laravel's remember-me
     * cookie re-authenticating an administrator without one.
     */
    public const SESSION_VERIFIED = 'admin_otp_verified_at';

    public function __construct(private readonly LoginOtpService $otps)
    {
    }

    /**
     * The pending attempt for THIS session, or null.
     *
     * Both ids must match: the row is looked up by its own id and then checked
     * against the user id the session recorded. A session cannot name another
     * session's row, and a row whose user has since changed is refused rather
     * than silently followed.
     */
    private function pending(Request $request): ?LoginOtpVerification
    {
        $userId = $request->session()->get(self::SESSION_USER);
        $otpId  = $request->session()->get(self::SESSION_OTP);

        if (! $userId || ! $otpId) {
            return null;
        }

        return LoginOtpVerification::where('id', $otpId)
            ->where('user_id', $userId)
            ->first();
    }

    private function forget(Request $request): void
    {
        $request->session()->forget([self::SESSION_USER, self::SESSION_OTP]);
    }

    public function show(Request $request)
    {
        $otp = $this->pending($request);

        if (! $otp) {
            return redirect()->route('login')
                ->with('error', 'Please sign in again to receive a verification code.');
        }

        return Inertia::render('Auth/VerifyOtp', [
            // Masked, never the whole address — see LoginOtpService::maskEmail.
            'email'           => LoginOtpService::maskEmail($otp->user?->email),
            'expiresIn'       => $otp->secondsRemaining(),
            'resendIn'        => $otp->resendCooldownRemaining(),
            'attemptsLeft'    => $otp->attemptsRemaining(),
            'codeLength'      => 6,
        ]);
    }

    public function verify(Request $request)
    {
        $otp = $this->pending($request);

        if (! $otp) {
            return redirect()->route('login')
                ->with('error', 'Please sign in again to receive a verification code.');
        }

        /*
         * Digits only, exactly six. `digits:6` rather than a numeric range so
         * a code with leading zeros is accepted — 000042 is a real code, and
         * `integer` would turn it into 42 and reject it.
         */
        $data = $request->validate([
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user   = $otp->user;
        $result = $this->otps->verify($otp, $data['code']);

        if ($result !== LoginOtpService::OK) {
            return back()->withErrors(['code' => $this->messageFor($result, $otp->fresh())]);
        }

        /*
         * Accepted. Only now does the session become an authenticated one.
         *
         * Deliberately without the "remember" flag: a remember-me cookie
         * re-authenticates on a later visit WITHOUT passing through the login
         * controller, which would skip verification entirely. Administrative
         * sessions therefore end when the browser session does.
         */
        Auth::login($user);

        // Session fixation: a new id for the newly privileged session, before
        // anything is written into it.
        $request->session()->regenerate();

        $request->session()->put(self::SESSION_VERIFIED, now()->toIso8601String());
        $this->forget($request);

        /*
         * Written AFTER regenerate(), or it would record the id of the session
         * that was just thrown away and PreventConcurrentLogins would log the
         * user straight back out.
         */
        $user->forceFill([
            'last_login'        => now(),
            'active_session_id' => $request->session()->getId(),
        ])->save();

        AuditService::log('otp_verified', 'login_otp_verifications', $otp->id, null, [
            'event'   => 'Administrative login completed after verification',
            'user_id' => $user->id,
        ]);

        // Honours an /admin/... address the user was sent away from, and falls
        // back to the dashboard when there was none.
        return redirect()->intended(route('admin.dashboard'));
    }

    public function resend(Request $request)
    {
        $otp = $this->pending($request);

        if (! $otp) {
            return redirect()->route('login')
                ->with('error', 'Please sign in again to receive a verification code.');
        }

        $wait = $otp->resendCooldownRemaining();

        if ($wait > 0) {
            return back()->withErrors([
                'code' => "Please wait {$wait} second" . ($wait === 1 ? '' : 's') . ' before requesting another code.',
            ]);
        }

        /*
         * The SAME row is reissued rather than a new one created. That is what
         * guarantees one live code per login attempt: the previous hash is
         * overwritten, so an old code cannot be used after a resend.
         */
        $sent = $this->otps->issue($otp->user, $otp);

        AuditService::log('otp_resent', 'login_otp_verifications', $otp->id, null, [
            'event'     => 'Verification code resent for administrative login',
            'user_id'   => $otp->user_id,
            'delivered' => $sent,
        ]);

        if (! $sent) {
            return back()->withErrors([
                'code' => "We couldn't send the verification code. Please try again or contact the system administrator.",
            ]);
        }

        return back()->with('success', 'A new verification code has been sent.');
    }

    /** Abandon the pending attempt and go back to the sign-in screen. */
    public function cancel(Request $request)
    {
        $otp = $this->pending($request);

        if ($otp) {
            $this->otps->abandon($otp);

            AuditService::log('otp_abandoned', 'login_otp_verifications', $otp->id, null, [
                'event'   => 'Administrative login verification abandoned',
                'user_id' => $otp->user_id,
            ]);
        }

        $this->forget($request);

        return redirect()->route('login');
    }

    /**
     * What to tell the user, and nothing more.
     *
     * Each outcome gets its own sentence because each needs a different
     * action: wait for a new code, ask for one, or try again. "Invalid code"
     * for all three would leave someone retyping an expired number.
     */
    private function messageFor(string $result, ?LoginOtpVerification $otp): string
    {
        return match ($result) {
            LoginOtpService::EXPIRED => 'This verification code has expired. Please request a new code.',
            LoginOtpService::LOCKED  => 'Too many verification attempts. Please request a new code.',
            LoginOtpService::USED    => 'This verification code has already been used. Please sign in again.',
            default => 'Incorrect verification code. You have '
                . ($otp?->attemptsRemaining() ?? 0)
                . ' attempt' . (($otp?->attemptsRemaining() ?? 0) === 1 ? '' : 's') . ' remaining.',
        };
    }
}
