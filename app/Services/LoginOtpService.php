<?php

namespace App\Services;

use App\Models\LoginOtpVerification;
use App\Models\User;
use App\Notifications\AdminLoginOtp;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Every rule about administrative login codes, in one place.
 *
 * The controller decides what to show; this decides what is true. Keeping the
 * two apart is what stops the verify screen and the resend button disagreeing
 * about whether a code is still alive.
 *
 * Nothing in this file ever returns, logs or stores a plaintext code. The only
 * place the six digits exist is a local variable handed straight to the
 * notification, and — when the recovery command is used — the server console.
 */
class LoginOtpService
{
    /** Outcomes of a verification attempt. */
    public const OK        = 'ok';
    public const EXPIRED   = 'expired';
    public const LOCKED    = 'locked';
    public const INCORRECT = 'incorrect';
    public const USED      = 'used';

    /** Is OTP switched on, and does this user need it? */
    public function isRequiredFor(User $user): bool
    {
        if (! config('geofarm.admin_otp.enabled', false)) {
            return false;
        }

        return $this->isAdministrative($user);
    }

    /**
     * An administrative account, as this application already defines one.
     *
     * The list comes from config, which holds exactly the three roles the
     * admin route group names. Farmers are not in it and cannot be, which is
     * the guarantee that the farmer login flow is untouched.
     */
    public function isAdministrative(User $user): bool
    {
        $roles = (array) config('geofarm.admin_otp.roles', []);

        return $user->hasAnyRole($roles);
    }

    /**
     * Start a fresh verification for one login attempt.
     *
     * A new row per attempt, deliberately. Two people signing in to the same
     * account from two computers get two rows, and each session holds only its
     * own row's id — so one attempt can never complete the other, which is the
     * hazard concurrent logins create.
     */
    public function start(User $user): array
    {
        $otp = LoginOtpVerification::create([
            'user_id'    => $user->id,
            // Overwritten by issue() a line later; the column is NOT NULL and
            // an empty string is never a valid bcrypt hash, so a row that
            // somehow survived without a code cannot match any guess.
            'otp_hash'   => '',
            'expires_at' => now(),
        ]);

        $sent = $this->issue($user, $otp);

        return [$otp->refresh(), $sent];
    }

    /**
     * Put a new code on an existing attempt, replacing whatever was there.
     *
     * Used by both the first send and Resend, so there is only ever one live
     * code per attempt: the previous hash is overwritten, not kept alongside.
     * Attempts reset because the user is now guessing at a different number.
     */
    public function issue(User $user, LoginOtpVerification $otp): bool
    {
        $code = $this->generateCode();

        $otp->forceFill([
            'otp_hash'     => Hash::make($code),
            'expires_at'   => now()->addMinutes((int) config('geofarm.admin_otp.ttl_minutes', 5)),
            'attempts'     => 0,
            'verified_at'  => null,
            'last_sent_at' => now(),
        ])->save();

        return $this->deliver($user, $code);
    }

    /**
     * A cryptographically secure six-digit code.
     *
     * random_int draws from the OS CSPRNG and throws rather than falling back
     * to a weak source. str_pad keeps every code six characters, so 000042 is
     * a real code and not a four-digit one — dropping leading zeros would
     * quietly shrink the keyspace.
     */
    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Send the code, synchronously.
     *
     * notifyNow, never notify: see the note in AdminLoginOtp for why queuing
     * this one would lock every administrator out.
     *
     * A failure is caught and reported as false rather than thrown, because an
     * unhandled SMTP error on the login path would put a stack trace on the
     * sign-in screen. The log records that sending failed and the exception
     * message — never the code, and never the mail credentials.
     */
    private function deliver(User $user, string $code): bool
    {
        try {
            $user->notifyNow(new AdminLoginOtp($code));

            return true;
        } catch (Throwable $e) {
            Log::error('Administrative login OTP could not be sent', [
                'user_id' => $user->id,
                'reason'  => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Check one guess against one attempt.
     *
     * Order matters. Used, expired and locked are all decided before the hash
     * is compared, so a burned code cannot be brute-forced by continuing to
     * guess at it, and an expired code never reports "incorrect" — the user
     * needs to be told to ask for a new one, not to try harder.
     *
     * A wrong guess increments attempts BEFORE returning, so the counter is
     * accurate even if the response is abandoned.
     */
    public function verify(LoginOtpVerification $otp, string $code): string
    {
        if ($otp->isVerified()) {
            return self::USED;
        }

        if ($otp->isExpired()) {
            return self::EXPIRED;
        }

        if ($otp->isLocked()) {
            return self::LOCKED;
        }

        if (! Hash::check($code, $otp->otp_hash)) {
            $otp->increment('attempts');
            $otp->refresh();

            return $otp->isLocked() ? self::LOCKED : self::INCORRECT;
        }

        /*
         * Accepted. Stamping verified_at is what makes the code single-use:
         * isVerified() is the first thing checked above, so replaying the same
         * digits from another browser now returns USED.
         */
        $otp->forceFill(['verified_at' => now()])->save();

        return self::OK;
    }

    /** Burn an attempt without using it — on logout, or on a new sign-in. */
    public function abandon(?LoginOtpVerification $otp): void
    {
        $otp?->forceFill(['expires_at' => now()->subSecond()])->save();
    }

    /**
     * An email address with its middle removed, for display.
     *
     * Enough to recognise your own address, not enough to learn someone
     * else's from a screen left open at a counter. Short local parts are
     * masked entirely rather than half-revealed: "a@x.com" has nothing to
     * hide behind.
     */
    public static function maskEmail(?string $email): string
    {
        $email = (string) $email;

        if (! str_contains($email, '@')) {
            return '••••••';
        }

        [$local, $domain] = explode('@', $email, 2);

        if (mb_strlen($local) <= 2) {
            return str_repeat('*', max(2, mb_strlen($local))) . '@' . $domain;
        }

        return mb_substr($local, 0, 1)
            . str_repeat('*', max(1, mb_strlen($local) - 2))
            . mb_substr($local, -1)
            . '@' . $domain;
    }
}
