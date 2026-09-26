<?php

namespace App\Console\Commands;

use App\Models\CropSeason;
use App\Models\FarmParcel;
use App\Services\ForecastService;
use App\Services\YieldPredictionService;
use Illuminate\Console\Command;
use Throwable;

/**
 * Why is the Predictive Analytics page empty?
 *
 * Read-only. It runs the SAME calls the page's deferred props run, but from
 * the console — no HTTP, no session, no middleware and no cache. That is the
 * whole point: it separates the two explanations that look identical in a
 * browser.
 *
 *   Data here, empty in the browser  -> the figures are fine and the problem
 *                                       is delivery: a cached empty result, a
 *                                       middleware redirect on the deferred
 *                                       request, or a failing partial reload.
 *
 *   Empty here too                   -> the records genuinely do not satisfy
 *                                       the queries, and the per-condition
 *                                       counts below show exactly which one.
 *
 * Each call is wrapped, because an exception inside one deferred callback is
 * itself a leading explanation: Inertia fetches deferred props in batches, so
 * one throw empties the whole group at once, which is what "everything is
 * blank except readiness" looks like.
 */
class AnalyticsCheck extends Command
{
    protected $signature = 'geofarm:analytics-check';

    protected $description = 'Diagnose why the Predictive Analytics page shows no data';

    public function handle(ForecastService $forecast, YieldPredictionService $predictor): int
    {
        $this->newLine();
        $this->info('1. What the records hold');

        $seasons = CropSeason::query()->count();
        $verified = CropSeason::forVerifiedFarmers()->count();
        $withYield = CropSeason::query()->whereNotNull('yield_kg')->where('yield_kg', '>', 0)->count();
        $withArea = CropSeason::query()->whereNotNull('area_planted_ha')->where('area_planted_ha', '>', 0)->count();
        $usable = CropSeason::query()
            ->whereNotNull('yield_kg')->where('yield_kg', '>', 0)
            ->whereNotNull('area_planted_ha')->where('area_planted_ha', '>', 0)
            ->count();
        $usableVerified = CropSeason::forVerifiedFarmers()
            ->whereNotNull('yield_kg')->where('yield_kg', '>', 0)
            ->whereNotNull('area_planted_ha')->where('area_planted_ha', '>', 0)
            ->count();

        $this->table(['check', 'rows'], [
            ['crop_seasons, all', $seasons],
            ['crop_seasons, verified farmers only', $verified],
            ['...with yield_kg > 0', $withYield],
            ['...with area_planted_ha > 0', $withArea],
            ['...with BOTH (any farmer)', $usable],
            ['...with BOTH (verified only)', $usableVerified],
            ['farm_parcels', FarmParcel::query()->count()],
            ['parcels with a barangay set', FarmParcel::query()->whereNotNull('barangay')->where('barangay', '!=', '')->count()],
            ['parcels referenced by a cropping', CropSeason::query()->distinct()->count('parcel_id')],
        ]);

        if ($usableVerified === 0 && $usable > 0) {
            $this->warn('Croppings are usable, but NOT for verified farmers. Every analytics query filters');
            $this->warn('on verified farmers, so unverified ones are invisible here. Verify the farmers,');
            $this->warn('or that is the reason the page is blank.');
        }

        /*
         * Orphaned rows would make every join-based query empty while a plain
         * count still reported plenty — exactly the contradiction reported.
         */
        $orphans = CropSeason::query()
            ->leftJoin('farm_parcels', 'farm_parcels.id', '=', 'crop_seasons.parcel_id')
            ->whereNull('farm_parcels.id')
            ->count();

        if ($orphans > 0) {
            $this->error("{$orphans} cropping(s) point at a parcel that does not exist.");
            $this->line('Every analytics query joins farm_parcels, so those rows are invisible to all of them.');
        }

        $this->newLine();
        $this->info('2. The exact calls the page makes');

        $this->probe('readiness-style count (works on your page)', fn () => $usableVerified);
        $this->probe('commodityOutlook()', fn () => count($forecast->commodityOutlook(null)));
        $this->probe('barangayComparison()', fn () => count($forecast->barangayComparison(null)));
        $this->probe('harvestCalendar()', fn () => count($forecast->harvestCalendar(12, null)));
        $this->probe('atRiskParcels()', fn () => count($forecast->atRiskParcels(null)));
        $this->probe('nextCroppingTargets() [new]', fn () => $predictor->nextCroppingTargets()->count());

        $this->probe('predictMany() predictable [new]', function () use ($predictor) {
            $targets = $predictor->nextCroppingTargets();
            if ($targets->isEmpty()) {
                return 0;
            }

            return $predictor->predictMany($targets)
                ->filter(fn ($p) => $p['predicted_yield_kg'] !== null)
                ->count();
        });

        $this->newLine();
        $this->info('3. What this means');
        $this->line('Any row above showing a count > 0 is data the page SHOULD be showing.');
        $this->line('If those same sections are blank in the browser, the figures are fine and the');
        $this->line('problem is delivery. Clear the cached aggregates and reload:');
        $this->newLine();
        $this->line('    php artisan cache:clear');
        $this->newLine();
        $this->line('Any row showing ERROR is the cause: one exception empties every deferred');
        $this->line('prop in its batch, which is why the whole page goes blank at once.');
        $this->newLine();

        return self::SUCCESS;
    }

    /**
     * Run one call and report a count, or the exception it threw.
     *
     * Catching is the point. An uncaught throw here would stop the run at the
     * first failure and hide the rest, when the useful output is the full
     * picture of which calls work and which do not.
     */
    private function probe(string $label, callable $call): void
    {
        try {
            $count = $call();
            $rendered = $count > 0
                ? "<fg=green>{$count} row(s)</>"
                : '<fg=yellow>empty</>';
            $this->line(sprintf('  %-42s %s', $label, $rendered));
        } catch (Throwable $e) {
            $this->line(sprintf('  %-42s <fg=red>ERROR</>', $label));
            $this->line('      ' . get_class($e) . ': ' . $e->getMessage());
            $this->line('      at ' . $e->getFile() . ':' . $e->getLine());
        }
    }
}
