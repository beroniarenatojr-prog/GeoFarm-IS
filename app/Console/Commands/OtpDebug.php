<?php

namespace App\Console\Commands;

use App\Models\LoginOtpVerification;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Why was a correct-looking code refused?
 *
 * Diagnostic only — it changes nothing. It answers the one question that
 * cannot be answered from the browser: which verification row does the code
 * you typed actually belong to, if any.
 *
 * The usual cause of a refusal is that several rows exist for one account — a
 * second sign-in, a resend, a console recovery — and the email being read
 * belongs to a row the browser is no longer bound to. Listing every row with
 * its age and testing the code against all of them makes that visible at once.
 *
 * Hashes are never printed. --code is compared in memory and the result shown
 * as a yes or no per row. Running this needs shell access, which is already
 * enough access to read the table directly.
 */
class OtpDebug extends Command
{
    protected $signature = 'geofarm:otp-debug
                            {email : The administrative account to inspect}
                            {--code= : A code to test against every row for that account}';

    protected $description = 'Show the login verification rows for an account, and optionally test a code against them';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::where('email', $email)->first();

        if (! $user) {
            $this->error("No account found for {$email}.");

            return self::FAILURE;
        }

        $rows = LoginOtpVerification::where('user_id', $user->id)
            ->latest('id')
            ->limit(10)
            ->get();

        if ($rows->isEmpty()) {
            $this->warn('No verification rows exist for this account.');
            $this->line('That means no administrative sign-in has reached the verification step yet.');

            return self::SUCCESS;
        }

        $code = $this->option('code');

        $this->newLine();
        $this->info("Verification rows for {$user->email} (newest first)");
        $this->line('Server time is now ' . now()->toDateTimeString() . ' (' . config('app.timezone') . ')');
        $this->newLine();

        $matched = null;

        $this->table(
            ['id', 'created', 'expires', 'expired?', 'attempts', 'verified?', $code ? 'code matches?' : 'match'],
            $rows->map(function (LoginOtpVerification $row) use ($code, &$matched) {
                $hit = null;

                if ($code !== null && $code !== '' && $row->otp_hash !== '') {
                    $hit = Hash::check($code, $row->otp_hash);
                    if ($hit && $matched === null) {
                        $matched = $row->id;
                    }
                }

                return [
                    $row->id,
                    $row->created_at?->toDateTimeString(),
                    $row->expires_at?->toDateTimeString(),
                    $row->isExpired() ? 'EXPIRED' : 'live',
                    $row->attempts . '/' . config('geofarm.admin_otp.max_attempts', 5),
                    $row->verified_at ? 'yes' : 'no',
                    $code ? ($hit ? '>>> YES <<<' : 'no') : '-',
                ];
            })->all(),
        );

        if ($code) {
            $this->newLine();

            if ($matched === null) {
                $this->error('That code does not match ANY row for this account.');
                $this->line('So the code being typed was never the one stored — it is from an older email,');
                $this->line('a different account, or it was mistyped. Compare it against the newest email.');
            } else {
                $this->info("That code belongs to row #{$matched}.");
                $this->line('If the browser is bound to a DIFFERENT row id, that is the fault: the email being');
                $this->line('read belongs to an earlier attempt. Press Resend and use the email that arrives after it.');
            }
        }

        $this->newLine();
        $this->line('The browser is bound to one row via its session. If several rows are live at once,');
        $this->line('only the one the session holds can complete that sign-in.');
        $this->newLine();

        return self::SUCCESS;
    }
}
