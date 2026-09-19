<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Prove that Laravel itself can reach the mail server.
 *
 * Deliberately an Artisan command rather than a temporary route. A route would
 * have to be added, remembered and removed again, and for as long as it existed
 * it would be one more way to make this server send mail. A command can only be
 * run by somebody who already has a shell on the machine.
 *
 * It takes the recipient as an argument so no real address is written into the
 * repository, and it never prints the mail password — only whether one is
 * configured and how long it is, which is enough to catch the two mistakes
 * that actually happen: an empty value, and a Gmail App Password pasted with
 * its spaces still in.
 *
 * Safe to leave in place. It sends nothing on its own and changes no data.
 */
class MailTest extends Command
{
    protected $signature = 'geofarm:mail-test
                            {email : Where to send the test message}';

    protected $description = 'Send a test email to prove the SMTP settings work';

    public function handle(): int
    {
        $to = (string) $this->argument('email');

        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error("Not a valid email address: {$to}");

            return self::FAILURE;
        }

        $password = (string) config('mail.mailers.smtp.password');

        $this->line('Mail configuration Laravel has actually loaded:');
        $this->table(['Setting', 'Value'], [
            ['MAIL_MAILER', config('mail.default')],
            ['host',        config('mail.mailers.smtp.host')],
            ['port',        config('mail.mailers.smtp.port')],
            ['scheme',      config('mail.mailers.smtp.scheme') ?: '(null — STARTTLS on 587)'],
            ['username',    config('mail.mailers.smtp.username')],
            // Never the value. Length alone distinguishes "not set" from
            // "set", and 16 from a pasted-with-spaces 19.
            ['password',    $password === '' ? 'NOT SET' : 'set, ' . strlen($password) . ' characters'],
            ['from',        config('mail.from.address') . ' (' . config('mail.from.name') . ')'],
            ['queue',       config('queue.default')],
        ]);

        if ($password === '') {
            $this->error('MAIL_PASSWORD is empty. Set a Gmail App Password in .env, then run: php artisan optimize:clear');

            return self::FAILURE;
        }

        if (strlen($password) !== 16) {
            // Not fatal — a different provider may use another length — but it
            // is the single most common cause of a Gmail authentication
            // failure, so it is worth saying out loud.
            $this->warn('A Gmail App Password is exactly 16 characters. Yours is ' . strlen($password)
                . '. If you pasted it with spaces, remove them.');
        }

        $this->newLine();
        $this->info("Sending a test message to {$to} …");

        try {
            /*
             * Mail::raw rather than the real notification: this is testing the
             * connection to Gmail, and a failure in a Blade template or a
             * notification class would otherwise look like an SMTP problem.
             *
             * Sent inline. A queued send would report success here and prove
             * nothing, which is the very fault this command exists to find.
             */
            Mail::raw(
                "GeoFarm-IS test email.\n\n"
                . 'If you are reading this, Laravel can reach the mail server and the '
                . "credentials are accepted.\n\n"
                . 'Sent ' . now()->toDayDateTimeString() . '.',
                fn ($message) => $message->to($to)->subject('GeoFarm-IS email test')
            );
        } catch (Throwable $e) {
            $this->newLine();
            $this->error('FAILED — ' . $e::class);
            $this->line($e->getMessage());
            $this->newLine();
            $this->line('Common causes:');
            $this->line('  • 535 Username and Password not accepted → the App Password is wrong or revoked.');
            $this->line('  • Connection could not be established    → port 587 blocked by the host or firewall.');
            $this->line('  • Expected response code 250             → check MAIL_FROM_ADDRESS matches the Gmail account.');

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Sent with no error from the mail server.');
        $this->line("Check the inbox for {$to}, including spam.");

        return self::SUCCESS;
    }
}
