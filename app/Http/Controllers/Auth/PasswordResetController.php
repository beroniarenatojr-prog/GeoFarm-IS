<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Forgotten passwords.
 *
 * Until now the login page carried a "Forgot password?" link pointing at "#",
 * and there was no way back into an account at all — `geofarm:otp-recover`
 * covers an OTP lockout but needs shell access, which no farmer and few staff
 * have.
 *
 * Four decisions in here are security decisions rather than UX ones:
 *
 * 1. The confirmation never says whether the address is registered. Anything
 *    else turns this form into a way to test which email addresses belong to
 *    accounts — and the login form deliberately gives nothing away either.
 *
 * 2. A successful reset does NOT sign the user in. Laravel's scaffolding
 *    normally does, which would walk an administrator straight past the OTP
 *    check that the whole admin login model rests on. They are sent to the
 *    login page to sign in properly.
 *
 * 3. Every other session for that account is destroyed. Someone who reset a
 *    password because they suspect their account was used should not leave the
 *    other party still signed in.
 *
 * 4. Inactive accounts are treated exactly like active ones. A farmer awaiting
 *    verification owns their account and may set its password; the login step
 *    is where "not yet active" is explained. Refusing here would both leak
 *    account state and strand them.
 */
class PasswordResetController extends Controller
{
    /** The form that asks for an email address. */
    public function request()
    {
        return Inertia::render('Auth/ForgotPassword');
    }

    /**
     * Email a reset link, if that address belongs to an account.
     *
     * The response is identical either way. Laravel's broker returns distinct
     * statuses — INVALID_USER, RESET_THROTTLED, RESET_LINK_SENT — and
     * surfacing them would answer "does this address have an account here?"
     * to anyone who asks.
     */
    public function email(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:100',
        ]);

        $status = Password::sendResetLink([
            'email' => strtolower(trim($data['email'])),
        ]);

        /*
         * Logged whatever the outcome, because a burst of these against
         * addresses that do not exist is what enumeration looks like from the
         * server side — and it is invisible without a record.
         *
         * The address is recorded; no token ever is.
         */
        AuditService::log('password_reset_requested', 'users', null, null, [
            'email'  => $data['email'],
            'status' => $status,
        ]);

        if ($status === Password::RESET_LINK_SENT) {
            return back()->with('success', $this->sentMessage());
        }

        /*
         * RESET_THROTTLED also lands here. A second request inside the throttle
         * window gets the same reassuring message rather than "you already
         * asked", which would again confirm the account exists.
         *
         * A genuine send failure — SMTP down — is the one case worth telling
         * the truth about, because the user can do nothing but wait and would
         * otherwise sit watching an inbox forever.
         */
        if ($status === Password::INVALID_USER || $status === Password::RESET_THROTTLED) {
            return back()->with('success', $this->sentMessage());
        }

        return back()->withErrors([
            'email' => 'We could not send the reset email just now. Please try again, or ask the Municipal Agriculture Office to reset your password.',
        ]);
    }

    /** One wording, used for every outcome that is not an outright failure. */
    private function sentMessage(): string
    {
        return 'If that email address belongs to a GeoFarm-IS account, a reset link is on its way. '
            . 'It expires in an hour — check your spam folder if it does not arrive.';
    }

    /**
     * The form that takes a new password.
     *
     * The token is not validated here. It is checked when the new password is
     * submitted, by the broker, against the hash it stored — telling someone at
     * this point that a token is stale would only have them request another one
     * before typing anything, which is what the submit step does anyway.
     */
    public function reset(Request $request, string $token)
    {
        return Inertia::render('Auth/ResetPassword', [
            'token' => $token,
            'email' => (string) $request->query('email', ''),
        ]);
    }

    /**
     * Set the new password.
     *
     * The broker verifies the token, its age and that it belongs to this
     * address, then deletes it — so a link works exactly once.
     */
    public function store(Request $request)
    {
        $request->validate([
            'token'    => 'required|string',
            'email'    => 'required|email',
            // Matches the rule the profile screen already applies, so the
            // two places a password can be set agree on what is acceptable.
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ], [], ['password' => 'password']);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use ($request) {
                $user->forceFill([
                    // Hashed by the model's cast.
                    'password' => $password,
                    /*
                     * No remember_token is cycled here, which is the usual way
                     * to kill "remember me" cookies on a reset.
                     *
                     * This table has no such column: migration
                     * 2026_03_27_000013_create_geofarm_users_table drops
                     * Laravel's users table and recreates it without one.
                     * Setting it would throw "Unknown column 'remember_token'".
                     *
                     * Nothing is lost, because no remember cookie can exist
                     * without that column either — see the note on the login
                     * form's "Remember me" checkbox.
                     */

                    /*
                     * Clearing this evicts any other signed-in session:
                     * PreventConcurrentLogins compares the caller's session id
                     * against this column, so a null here means no session is
                     * the blessed one and the next request from an intruder is
                     * signed out. Someone resetting because they think their
                     * account was used must not leave the other party inside.
                     */
                    'active_session_id' => null,
                ])->save();

                event(new PasswordReset($user));

                AuditService::log('password_reset', 'users', $user->id, null, [
                    'event' => 'Password reset using an emailed link',
                    'ip'    => $request->ip(),
                ]);
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            /*
             * Expired, already used, or not matching the address. All three
             * are one message: the link is no good, ask for another. Naming
             * which it was would tell someone holding a stolen token whether
             * the address they guessed was right.
             */
            throw ValidationException::withMessages([
                'email' => 'This reset link is no longer valid. Please request a new one.',
            ]);
        }

        /*
         * Deliberately NOT logged in here.
         *
         * Laravel's scaffolding signs the user in at this point. For an
         * administrator that would hand out an authenticated session without a
         * verification code — the exact bypass EnsureAdminOtpVerified exists to
         * close, arrived at through the front door. Sending everyone to the
         * login page keeps one way in for every account.
         */
        return redirect()->route('login')->with(
            'success',
            'Your password has been changed. Please sign in with your new password.',
        );
    }
}
