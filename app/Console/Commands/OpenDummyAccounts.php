<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\DummyFarmersSeeder;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\Hash;

/**
 * Make the dummy farmer accounts signable-in for testing.
 *
 * The seeder creates them with is_active = false, matching a real online
 * registration that waits for the office to verify documents. That is correct
 * behaviour and should stay — but it also means nobody can log in as one to
 * look at the farmer portal, which is what these records exist for.
 *
 * Re-running the seeder would set the password but also delete and rebuild
 * every dummy farmer, losing any parcel, boundary or crop data added to them
 * since. This touches two columns on accounts that already exist and nothing
 * else.
 *
 * SCOPE, and the whole safety of this command: it matches only
 * dummy.farmer%@example.test. A real farmer's account cannot be reached by it,
 * whatever is passed. Nothing else about the accounts is altered —
 * verification_status in particular is left alone, because marking dummy
 * farmers verified would add them to Farmer::verified(), which is the count
 * the public landing page prints.
 */
class OpenDummyAccounts extends Command
{
    use ConfirmableTrait;

    protected $signature = 'geofarm:open-dummy-accounts
                            {--deactivate : Lock the dummy accounts again instead}
                            {--force : Run without confirming, including in production}';

    protected $description = 'Reset the dummy farmer accounts to the shared test password and let them sign in';

    public function handle(): int
    {
        // Prompts before acting when APP_ENV=production. These accounts are
        // fabricated, but the server they sit on may not be a test one.
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $accounts = User::where('email', 'like', DummyFarmersSeeder::EMAIL_PATTERN);
        $count = (clone $accounts)->count();

        if ($count === 0) {
            $this->warn('No dummy accounts found matching ' . DummyFarmersSeeder::EMAIL_PATTERN);
            $this->line('Run: php artisan db:seed --class=DummyFarmersSeeder');

            return self::FAILURE;
        }

        if ($this->option('deactivate')) {
            (clone $accounts)->update(['is_active' => false]);
            $this->info("Locked {$count} dummy account(s). They can no longer sign in.");

            return self::SUCCESS;
        }

        /*
         * Hashed once and reused.
         *
         * Hash::make is bcrypt and deliberately slow; calling it per row would
         * make this take noticeably long for no benefit, since every dummy
         * account is meant to share one password anyway.
         */
        (clone $accounts)->update([
            'password'  => Hash::make(DummyFarmersSeeder::DUMMY_PASSWORD),
            'is_active' => true,
        ]);

        $this->info("Opened {$count} dummy account(s).");
        $this->newLine();

        $sample = (clone $accounts)->orderBy('email')->limit(3)->pluck('email');
        $this->line('Sign in with any of these:');
        foreach ($sample as $email) {
            $this->line("  {$email}");
        }
        $this->line('  password: ' . DummyFarmersSeeder::DUMMY_PASSWORD);

        $this->newLine();
        $this->warn('These accounts are now signable-in by anyone who knows that password,');
        $this->warn('which is in the repository. Lock them again when you are done:');
        $this->line('  php artisan geofarm:open-dummy-accounts --deactivate');

        return self::SUCCESS;
    }
}
