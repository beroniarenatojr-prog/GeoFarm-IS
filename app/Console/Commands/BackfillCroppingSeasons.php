<?php

namespace App\Console\Commands;

use App\Models\CropSeason;
use App\Models\FarmParcel;
use App\Services\CroppingScheduleService;
use Illuminate\Console\Command;

/**
 * Opens the seasons that existing parcels should already have had.
 *
 * The observer that creates them only fires when a parcel is created or its
 * schedule changes, so every parcel registered before that existed has none —
 * which is why a registry full of farmers can show an empty Seasonal Tracking
 * page. This is the one-off catch-up for those.
 *
 * Safe to run more than once: it opens only what is missing, and never touches
 * a season that already holds recorded production.
 */
class BackfillCroppingSeasons extends Command
{
    protected $signature = 'seasons:backfill
        {--year= : The cropping year to open (defaults to the current year)}
        {--dry-run : Report what would be opened without writing anything}';

    protected $description = 'Open missing wet/dry croppings for parcels that already exist';

    public function handle(CroppingScheduleService $schedule): int
    {
        $year = (int) ($this->option('year') ?: now()->year);
        $dry  = (bool) $this->option('dry-run');

        $this->info("Cropping year: {$year}" . ($dry ? '  (dry run — nothing will be written)' : ''));
        $this->newLine();

        $parcels = FarmParcel::with('farmer')->get();

        if ($parcels->isEmpty()) {
            $this->warn('No farm parcels exist at all.');
            $this->line('Seasonal Tracking is built on parcels, so nothing can be opened until');
            $this->line('a farmer has at least one parcel recorded against them.');

            return self::SUCCESS;
        }

        $wouldOpen  = 0;
        $already    = 0;
        $noSchedule = [];

        foreach ($parcels as $parcel) {
            $seasons = $schedule->seasonsFor($parcel->cropping_schedule);

            // The one case this command cannot fix: without a schedule there is
            // nothing to infer, and guessing would put croppings on the books
            // that may never happen.
            if ($seasons === []) {
                $noSchedule[] = $parcel;
                continue;
            }

            $existing = CropSeason::where('parcel_id', $parcel->id)
                ->where('cropping_year', $year)
                ->pluck('season')
                ->all();

            $missing = array_diff($seasons, $existing);

            $already   += count($seasons) - count($missing);
            $wouldOpen += count($missing);

            if ($missing !== [] && !$dry) {
                $schedule->openFor($parcel, $year);
            }
        }

        $this->table(
            ['', 'Parcels'],
            [
                ['Total parcels', $parcels->count()],
                ['With a cropping schedule', $parcels->count() - count($noSchedule)],
                ['Without a schedule (cannot be opened)', count($noSchedule)],
            ],
        );

        $this->line("Croppings already present for {$year}: {$already}");
        $this->line(($dry ? 'Would open' : 'Opened') . ": {$wouldOpen}");

        if ($noSchedule !== []) {
            $this->newLine();
            $this->warn('These parcels have no Cropping Schedule, so no season can be opened:');

            foreach (array_slice($noSchedule, 0, 20) as $parcel) {
                $this->line(sprintf(
                    '  parcel %d — %s — %s',
                    $parcel->id,
                    $parcel->farmer?->full_name ?: 'unknown farmer',
                    $parcel->barangay ?: 'no barangay',
                ));
            }

            if (count($noSchedule) > 20) {
                $this->line('  … and ' . (count($noSchedule) - 20) . ' more.');
            }

            $this->newLine();
            $this->line('Set Cropping Schedule (Wet, Dry or Wet/Dry) on each parcel and their');
            $this->line('seasons open on save — no need to re-run this.');
        }

        if ($dry && $wouldOpen > 0) {
            $this->newLine();
            $this->info('Re-run without --dry-run to open them.');
        }

        return self::SUCCESS;
    }
}
