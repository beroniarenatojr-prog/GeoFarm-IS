<?php

namespace App\Console\Commands;

use App\Models\Farmer;
use App\Models\LargeRuminant;
use App\Models\NativePig;
use App\Models\Poultry;
use App\Models\SmallRuminant;
use App\Models\SwineHybrid;
use Database\Seeders\DummyFarmersSeeder;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\DB;

/**
 * Give the dummy farmers some animals.
 *
 * The Farm Inventory cards read the five RSBSA tables — large_ruminants,
 * small_ruminants, native_pigs, swine_hybrid and poultry — and every one of
 * them is empty, because no seeder has ever created an animal. The cards
 * showing 0 were telling the truth.
 *
 * Scoped to dummy.farmer%@example.test and nothing else. A real farmer's
 * record cannot be reached by this command, which is also what makes --undo
 * safe: it removes animals only from those same fabricated farmers.
 *
 * Herd sizes are Philippine smallholder scale — a few head of carabao, a
 * dozen goats, a few dozen chickens — not commercial figures, and they are
 * derived from the farmer id so re-running changes nothing.
 */
class SampleLivestock extends Command
{
    use ConfirmableTrait;

    protected $signature = 'geofarm:sample-livestock
                            {--undo : Remove the animals this command created}
                            {--force : Run without confirming, including in production}';

    protected $description = 'Give the dummy farmers sample livestock and poultry records';

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $farmers = Farmer::where('email', 'like', DummyFarmersSeeder::EMAIL_PATTERN)
            ->orderBy('id')
            ->get(['id']);

        if ($farmers->isEmpty()) {
            $this->warn('No dummy farmers found. Run: php artisan db:seed --class=DummyFarmersSeeder');

            return self::FAILURE;
        }

        return $this->option('undo')
            ? $this->undo($farmers->pluck('id'))
            : $this->fill($farmers);
    }

    private function undo($farmerIds): int
    {
        $removed = 0;

        DB::transaction(function () use ($farmerIds, &$removed) {
            foreach ([LargeRuminant::class, SmallRuminant::class, NativePig::class,
                SwineHybrid::class, Poultry::class] as $model) {
                $removed += $model::whereIn('farmer_id', $farmerIds)->delete();
            }
        });

        $this->info("Removed {$removed} animal record(s) from the dummy farmers.");

        return self::SUCCESS;
    }

    private function fill($farmers): int
    {
        $made = ['large' => 0, 'small' => 0, 'pigs' => 0, 'hybrid' => 0, 'poultry' => 0];
        $heads = 0;
        $birds = 0;

        DB::transaction(function () use ($farmers, &$made, &$heads, &$birds) {
            foreach ($farmers as $farmer) {
                $id = (int) $farmer->id;

                /*
                 * Not every farmer keeps animals, and a register where all of
                 * them do would be a poor thing to demonstrate against. Rough
                 * thirds: some keep nothing, most keep a little, a few keep
                 * enough to count as large raisers.
                 */
                if ($id % 5 === 0) {
                    continue;
                }

                // Large ruminants — carabao for draught, a little cattle.
                if ($id % 3 !== 0) {
                    $m = 1 + ($id % 2);
                    $f = 1 + ($id % 3);
                    $made['large'] += $this->make(LargeRuminant::class, $farmer->id, $m, $f, [
                        'animal_type' => $id % 2 === 0 ? 'Carabao' : 'Cattle',
                    ]);
                    $heads += $m + $f;
                }

                // Small ruminants — goats are the common smallholder animal.
                if ($id % 4 !== 0) {
                    $m = 2 + ($id % 4);
                    $f = 4 + ($id % 7);
                    $made['small'] += $this->make(SmallRuminant::class, $farmer->id, $m, $f, [
                        'animal_type' => $id % 7 === 0 ? 'Sheep' : 'Goat',
                    ]);
                    $heads += $m + $f;
                }

                // Native pigs — backyard, a sow and her litter.
                if ($id % 3 === 0) {
                    $m = 1 + ($id % 3);
                    $f = 2 + ($id % 4);
                    $made['pigs'] += $this->make(NativePig::class, $farmer->id, $m, $f);
                    $heads += $m + $f;
                }

                // Swine hybrid — the handful of farmers raising commercially.
                if ($id % 9 === 0) {
                    $m = 6 + ($id % 5);
                    $f = 9 + ($id % 8);
                    $made['hybrid'] += $this->make(SwineHybrid::class, $farmer->id, $m, $f, [
                        'variety' => $id % 2 === 0 ? 'White' : 'Brown',
                    ]);
                    $heads += $m + $f;
                }

                // Poultry — nearly everyone keeps some.
                if ($id % 6 !== 0) {
                    $m = 8 + ($id % 11);
                    $f = 18 + ($id % 23);
                    // Ducks, not Duck: the column is an enum and this is the
                    // spelling it holds.
                    $made['poultry'] += $this->make(Poultry::class, $farmer->id, $m, $f, [
                        'bird_type' => $id % 4 === 0 ? 'Ducks' : 'Chicken',
                    ]);
                    $birds += $m + $f;
                }
            }
        });

        $this->info('Sample livestock created for the dummy farmers:');
        $this->table(['Table', 'Records'], [
            ['large_ruminants', $made['large']],
            ['small_ruminants', $made['small']],
            ['native_pigs',     $made['pigs']],
            ['swine_hybrid',    $made['hybrid']],
            ['poultry',         $made['poultry']],
        ]);

        $this->line("Livestock heads: {$heads}   Poultry: {$birds}");
        $this->newLine();
        $this->line('Reverse it with:');
        $this->line('  php artisan geofarm:sample-livestock --undo');

        return self::SUCCESS;
    }

    /**
     * Create one animal row, unless that farmer already has one of its kind.
     *
     * @return int 1 when a row was written, 0 when one already existed
     */
    private function make(string $model, int $farmerId, int $male, int $female, array $extra = []): int
    {
        $exists = $model::where('farmer_id', $farmerId)
            ->when($extra, function ($q) use ($extra) {
                foreach ($extra as $column => $value) {
                    $q->where($column, $value);
                }
            })
            ->exists();

        if ($exists) {
            return 0;
        }

        /*
         * Only the two counts are written.
         *
         * total_heads is a STORED GENERATED column (male_count +
         * female_count); MySQL rejects any insert that supplies one.
         *
         * is_large_raiser is not set here either, though it is tempting: the
         * TracksHerdSize trait on all five models sets it on every save from
         * its own threshold. Writing it here would put a second copy of that
         * rule in the codebase, free to disagree with the first the day the
         * office changes what counts as a large raiser — and it is not
         * fillable, so it would have been dropped in silence anyway.
         */
        $model::create($extra + [
            'farmer_id'    => $farmerId,
            'male_count'   => $male,
            'female_count' => $female,
        ]);

        return 1;
    }
}
