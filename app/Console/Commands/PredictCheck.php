<?php

namespace App\Console\Commands;

use App\Models\CropSeason;
use App\Models\YieldPredictionSnapshot;
use App\Services\YieldPredictionService;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Collection;

/**
 * Run the yield prediction over the real cropping history and report on it.
 *
 * Read-only unless --snapshot is passed. It exists because the arithmetic can
 * be proven in isolation but the DATA cannot: how many parcels actually have
 * three comparable harvests, how many fall back to barangay figures, and how
 * many cannot be predicted at all are questions only this database answers.
 *
 * Run it before trusting anything the analytics screen shows.
 */
class PredictCheck extends Command
{
    use ConfirmableTrait;

    protected $signature = 'geofarm:predict-check
                            {--year= : Cropping year to predict for (default: next year)}
                            {--season=wet : dry or wet}
                            {--snapshot : Also WRITE the predictions to yield_prediction_snapshots}
                            {--force : Skip the production confirmation}';

    protected $description = 'Run crop yield prediction against real data and report coverage and totals';

    public function handle(YieldPredictionService $predictor): int
    {
        $season = strtolower((string) $this->option('season'));
        if (! in_array($season, ['dry', 'wet'], true)) {
            $this->error('--season must be dry or wet.');

            return self::FAILURE;
        }

        $year = (int) ($this->option('year') ?: (int) date('Y') + 1);

        /*
         * What to predict for.
         *
         * The most recent cropping of each parcel, carried forward: "if this
         * parcel plants what it planted last time, on the same area, this is
         * what to expect." It does NOT assume a farmer will plant again — that
         * is the caller's premise, stated plainly here rather than hidden.
         */
        $latest = CropSeason::query()
            ->join('farm_parcels', 'farm_parcels.id', '=', 'crop_seasons.parcel_id')
            ->select([
                'crop_seasons.parcel_id', 'crop_seasons.crop_id',
                'crop_seasons.area_planted_ha', 'crop_seasons.cropping_year',
                'farm_parcels.farmer_id', 'farm_parcels.barangay',
            ])
            ->orderBy('crop_seasons.parcel_id')
            ->orderByDesc('crop_seasons.cropping_year')
            ->get()
            ->unique('parcel_id')
            ->values();

        if ($latest->isEmpty()) {
            $this->warn('No cropping records exist, so there is nothing to predict from.');

            return self::SUCCESS;
        }

        $targets = $latest->map(fn ($r) => [
            'parcel_id'       => (int) $r->parcel_id,
            'farmer_id'       => (int) $r->farmer_id,
            'crop_id'         => (int) $r->crop_id,
            'barangay'        => $r->barangay,
            'area_planted_ha' => (float) $r->area_planted_ha,
        ]);

        $this->info("Predicting {$season} season {$year} for {$targets->count()} parcels…");
        $predictions = $predictor->predictMany($targets);

        $this->reportCoverage($predictions);
        $this->reportAggregates($predictor, $predictions);
        $this->crossCheck($predictor, $predictions);

        if ($this->option('snapshot')) {
            if (! $this->confirmToProceed()) {
                return self::FAILURE;
            }
            $this->writeSnapshots($predictions, $year, $season);
        } else {
            $this->newLine();
            $this->line('Nothing was written. Pass --snapshot to record these for later predicted-vs-actual comparison.');
        }

        return self::SUCCESS;
    }

    /** How much of the municipality can actually be predicted at all. */
    private function reportCoverage(Collection $predictions): void
    {
        $with = $predictions->filter(fn ($p) => $p['predicted_yield_kg'] !== null);

        $this->newLine();
        $this->info('Coverage');
        $this->table(['', 'parcels'], [
            ['predictable', $with->count()],
            ['insufficient data', $predictions->count() - $with->count()],
            ['total', $predictions->count()],
        ]);

        $this->info('What each prediction rests on');
        $this->table(
            ['basis', 'parcels', 'meaning'],
            collect(['farmer' => "the farmer's own record", 'barangay' => 'neighbours in the same barangay',
                     'municipal' => 'the whole municipality', 'none' => 'nothing — no prediction made'])
                ->map(fn ($meaning, $basis) => [
                    $basis,
                    $predictions->where('basis', $basis)->count(),
                    $meaning,
                ])->values()->all(),
        );

        $this->info('Confidence');
        $this->table(
            ['confidence', 'parcels'],
            collect(['high', 'moderate', 'low', 'none'])
                ->map(fn ($c) => [$c, $predictions->where('confidence', $c)->count()])
                ->all(),
        );
    }

    private function reportAggregates(YieldPredictionService $predictor, Collection $predictions): void
    {
        $this->newLine();
        $this->info('Top barangays by predicted production');

        $rows = $predictor->aggregateBy($predictions, fn ($p) => $p['barangay'] ?: '(no barangay)')
            ->sortByDesc('predicted_total_kg')
            ->take(10);

        $this->table(
            ['barangay', 'farmers', 'parcels', 'area ha', 'historical kg', 'predicted kg', 'change %', 'no data'],
            $rows->map(fn ($r) => [
                $r['group'], $r['farmers'], $r['parcels'], $r['area_ha'],
                number_format($r['historical_total_kg'], 0),
                number_format($r['predicted_total_kg'], 0),
                $r['expected_change_pct'] === null ? '-' : $r['expected_change_pct'],
                $r['without_prediction'],
            ])->values()->all(),
        );
    }

    /**
     * The invariant that matters: every level must be the same rows summed.
     *
     * If the municipal total ever stops equalling the sum of the barangays,
     * some level has started predicting independently — which is exactly the
     * fault this service was built to prevent.
     */
    private function crossCheck(YieldPredictionService $predictor, Collection $predictions): void
    {
        $byBarangay = $predictor->aggregateBy($predictions, fn ($p) => $p['barangay'] ?: '(none)');
        $byCrop = $predictor->aggregateBy($predictions, fn ($p) => $p['crop_id']);
        $municipal = $predictor->aggregateBy($predictions, fn () => 'all')->first();

        $total = round((float) ($municipal['predicted_total_kg'] ?? 0), 2);
        $sumB = round($byBarangay->sum('predicted_total_kg'), 2);
        $sumC = round($byCrop->sum('predicted_total_kg'), 2);

        $this->newLine();
        $this->info('Aggregation cross-check');
        $this->table(['level', 'predicted kg'], [
            ['municipal', number_format($total, 2)],
            ['sum of barangays', number_format($sumB, 2)],
            ['sum of crops', number_format($sumC, 2)],
        ]);

        if (abs($total - $sumB) < 0.01 && abs($total - $sumC) < 0.01) {
            $this->info('OK — every level is the same predictions summed.');
        } else {
            $this->error('MISMATCH — a level is not derived from the parcel predictions. Do not trust the analytics.');
        }
    }

    /**
     * Record these predictions for later comparison against actual yields.
     *
     * updateOrCreate on the unique key, so re-running replaces the live
     * snapshot for a cropping rather than stacking duplicates. actual_yield_kg
     * is deliberately never touched here.
     */
    private function writeSnapshots(Collection $predictions, int $year, string $season): void
    {
        $written = 0;

        foreach ($predictions as $p) {
            // Nothing to evaluate later, so nothing worth storing.
            if ($p['predicted_yield_kg'] === null) {
                continue;
            }

            YieldPredictionSnapshot::updateOrCreate(
                [
                    'parcel_id'     => $p['parcel_id'],
                    'cropping_year' => $year,
                    'season'        => $season,
                    'methodology'   => YieldPredictionService::METHODOLOGY,
                ],
                [
                    'farmer_id'             => $p['farmer_id'],
                    'crop_id'               => $p['crop_id'],
                    'barangay'              => $p['barangay'],
                    'area_planted_ha'       => $p['area_planted_ha'],
                    'historical_average_kg' => $p['historical_average_kg'],
                    'predicted_yield_kg'    => $p['predicted_yield_kg'],
                    'predicted_low_kg'      => $p['predicted_low_kg'],
                    'predicted_high_kg'     => $p['predicted_high_kg'],
                    'expected_change_pct'   => $p['expected_change_pct'],
                    'prediction_status'     => $p['prediction_status'],
                    'confidence'            => $p['confidence'],
                    'data_points'           => $p['data_points'],
                    'basis'                 => $p['basis'],
                    'generated_at'          => now(),
                ],
            );

            $written++;
        }

        $this->newLine();
        $this->info("Recorded {$written} prediction snapshot(s) for {$season} {$year}.");
        $this->line('Actual yields are filled in separately, after harvest. These predicted figures are never rewritten.');
    }
}
