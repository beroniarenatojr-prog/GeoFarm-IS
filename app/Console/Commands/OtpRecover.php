<?php

namespace App\Console\Commands;

use App\Models\LoginOtpVerification;
use App\Models\User;
use App\Services\AuditService;
use App\Services\LoginOtpService;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\Hash;

/**
 * The way back in when email stops working.
 *
 * Administrative sign-in now depends on an emailed code, so a broken mail
 * server locks every administrator out of GeoFarm-IS with nothing to press in
 * the browser. This command is the answer to that, and it is deliberately the
 * ONLY answer: there is no web route, no query string and no account flag that
 * skips verification, because anything reachable from a browser is reachable
 * by an attacker.
 *
 * Running it requires shell access to the server, which is already enough
 * access to read the database directly — so it grants nothing that a person
 * at that terminal did not already have. Every use is written to the audit log.
 *
 *   php artisan geofarm:otp-recover admin@example.com
 *       Print a code, valid for the usual few minutes, for that account.
 *
 *   php artisan geofarm:otp-recover admin@example.com --clear
 *       Cancel any pending verification for that account instead.
 *
 * The code is printed to the console and nowhere else. It is not mailed, not
 * logged and not stored — only its hash reaches the database, exactly as a
 * normal code would.
 */
class OtpRecover extends Command
{
    use ConfirmableTrait;

    protected $signature = 'geofarm:otp-recover
                            {email : The administrative account that cannot receive its code}
                            {--clear : Cancel any pending verification instead of issuing a code}
                            {--force : Run without confirmation in production}';

    protected $description = 'Issue or clear an administrative login code from the console, for when email is unavailable';

    public function handle(LoginOtpService $otps): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::where('email', $email)->first();

        if (! $user) {
            $this->error("No account found for {$email}.");

            return self::FAILURE;
        }

        if (! $otps->isAdministrative($user)) {
            // Farmers are not subject to verification, so there is nothing
            // here to recover — and issuing one would imply otherwise.
            $this->error("{$email} is not an administrative account, so it does not use login verification.");

            return self::FAILURE;
        }

        if ($this->option('clear')) {
            return $this->clear($user, $otps);
        }

        return $this->issue($user);
    }

    private function clear(User $user, LoginOtpService $otps): int
    {
        $rows = LoginOtpVerification::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->where('expires_at', '>', now())
            ->get();

        foreach ($rows as $row) {
            $otps->abandon($row);
        }

        AuditService::log('otp_recovery_cleared', 'users', $user->id, null, [
            'event'    => 'Pending login verification cleared from the console',
            'cleared'  => $rows->count(),
        ]);

        $this->info("Cleared {$rows->count()} pending verification(s) for {$user->email}.");
        $this->line('They can now sign in again from the start.');

        return self::SUCCESS;
    }

    /**
     * Mint a code and print it, without going anywhere near the mail system.
     *
     * A brand new row rather than reusing a pending one: the person at the
     * console may not be the person at the browser, and overwriting a live
     * attempt would invalidate a code somebody is mid-way through typing.
     *
     * The row is NOT tied to a session here — the browser session records its
     * own row id when the user signs in. So the sequence is: sign in with
     * email and password first, reach the verification screen, THEN type the
     * code this prints.
     */
    private function issue(User $user): int
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $minutes = (int) config('geofarm.admin_otp.ttl_minutes', 5);

        /*
         * Every pending row for this user is pointed at the same code, so
         * whichever attempt the browser is holding will accept it. Without
         * this the console code would only work for a row the browser is not
         * looking at, and the screen would keep saying "incorrect".
         */
        $pending = LoginOtpVerification::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->get();

        $hash = Hash::make($code);

        foreach ($pending as $row) {
            $row->forceFill([
                'otp_hash'   => $hash,
                'expires_at' => now()->addMinutes($minutes),
                'attempts'   => 0,
            ])->save();
        }

        // And one fresh row, in case no sign-in is in progress yet.
        $fresh = LoginOtpVerification::create([
            'user_id'      => $user->id,
            'otp_hash'     => $hash,
            'expires_at'   => now()->addMinutes($minutes),
            'last_sent_at' => now(),
        ]);

        AuditService::log('otp_recovery_issued', 'login_otp_verifications', $fresh->id, null, [
            // The event, never the code.
            'event'   => 'Login verification code issued from the console',
            'user_id' => $user->id,
            'updated' => $pending->count(),
        ]);

        $this->newLine();
        $this->info("Verification code for {$user->email}");
        $this->line('');
        $this->line('    ' . $code);
        $this->line('');
        $this->warn("Valid for {$minutes} minutes. Do not share it, and do not paste it anywhere but the verification screen.");
        $this->line('Sign in with email and password first, then enter this code.');
        $this->newLine();

        return self::SUCCESS;
    }
}
