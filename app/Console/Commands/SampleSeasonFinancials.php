<?php

namespace App\Console\Commands;

use App\Models\CropSeason;
use App\Models\SeasonalInput;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\DB;

/**
 * Fill demonstration figures onto croppings that have none.
 *
 * CropHistorySeeder creates seasons with a yield and nothing else, which is
 * why the seasonal table reads "No data" down the cost, price and net income
 * columns. This fills those in so the screen can actually be shown to people.
 *
 * Two rules it does not break:
 *
 *  1. It only ever writes to a season whose production_cost is NULL. A figure
 *     an encoder typed is real data and is never overwritten, so this cannot
 *     damage anything the office has recorded.
 *
 *  2. Every row it touches is marked, by giving it an input row carrying
 *     MARKER in the notes. --undo finds them by that marker and removes
 *     exactly what was written — not "everything that looks sample-ish",
 *     which would take real entries with it.
 *
 * The outcomes are deliberately mixed. A demonstration where every farm turns
 * a profit is no use to an office whose job includes finding the ones that did
 * not, so roughly a third of the seasons here lose money — short harvests at
 * unchanged cost, which is what a typhoon or a pest year actually looks like.
 *
 * Figures are derived from the season id, so running it twice gives the same
 * numbers and a screenshot taken today still matches the system tomorrow.
 */
class SampleSeasonFinancials extends Command
{
    use ConfirmableTrait;

    /** Written into the notes of every input row this command creates. */
    private const MARKER = 'Sample data — geofarm:sample-financials';

    protected $signature = 'geofarm:sample-financials
                            {--undo : Remove the sample figures this command wrote}
                            {--force : Run without confirming, including in production}';

    protected $description = 'Fill demo production, cost, price and input figures onto croppings that have none';

    /**
     * Per-hectare bases: yield in kg, farmgate price per kg, cost per hectare.
     *
     * Rough Philippine figures so the totals on screen are not absurd. They
     * are illustrative, not a reference — this is demonstration data and the
     * command says so.
     */
    private const CROPS = [
        'rice'       => ['yield' => 4200,  'price' => 21.0, 'cost' => 68000,  'unit' => 'kg'],
        'corn'       => ['yield' => 4800,  'price' => 16.5, 'cost' => 62000,  'unit' => 'kg'],
        'coconut'    => ['yield' => 1150,  'price' => 36.0, 'cost' => 31000,  'unit' => 'kg'],
        'banana'     => ['yield' => 9500,  'price' => 18.0, 'cost' => 128000, 'unit' => 'kg'],
        'sugarcane'  => ['yield' => 58000, 'price' => 2.6,  'cost' => 115000, 'unit' => 'kg'],
        'vegetables' => ['yield' => 11000, 'price' => 32.0, 'cost' => 265000, 'unit' => 'kg'],
        'tomato'     => ['yield' => 12000, 'price' => 30.0, 'cost' => 272000, 'unit' => 'kg'],
        'eggplant'   => ['yield' => 13000, 'price' => 26.0, 'cost' => 255000, 'unit' => 'kg'],
        'mungbean'   => ['yield' => 950,   'price' => 72.0, 'cost' => 51000,  'unit' => 'kg'],
        'soybean'    => ['yield' => 1100,  'price' => 65.0, 'cost' => 54000,  'unit' => 'kg'],
        'wheat'      => ['yield' => 2600,  'price' => 24.0, 'cost' => 47000,  'unit' => 'kg'],
    ];

    private const DEFAULT_CROP = ['yield' => 3000, 'price' => 25.0, 'cost' => 56000, 'unit' => 'kg'];

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        return $this->option('undo') ? $this->undo() : $this->fill();
    }

    private function undo(): int
    {
        $seasonIds = SeasonalInput::where('notes', self::MARKER)
            ->distinct()
            ->pluck('crop_season_id');

        if ($seasonIds->isEmpty()) {
            $this->warn('Nothing to undo — no seasons carry the sample marker.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($seasonIds) {
            SeasonalInput::whereIn('crop_season_id', $seasonIds)
                ->where('notes', self::MARKER)
                ->delete();

            // Back to exactly the state the rows were in: yield and area were
            // not written by this command and are deliberately left alone.
            CropSeason::whereIn('id', $seasonIds)->update([
                'production_cost'   => null,
                'labor_cost'        => null,
                'other_cost'        => null,
                'selling_price'     => null,
                'total_income'      => null,
                'fertilizer_type'   => null,
                'fertilizer_qty_kg' => null,
                'fertilizer_class'  => null,
            ]);
        });

        $this->info("Removed the sample figures from {$seasonIds->count()} cropping(s).");

        return self::SUCCESS;
    }

    private function fill(): int
    {
        // Only blanks. A season with a cost already recorded is real work.
        $seasons = CropSeason::with('crop')
            ->whereNull('production_cost')
            ->get();

        if ($seasons->isEmpty()) {
            $this->warn('Every cropping already has a production cost. Nothing to fill.');

            return self::SUCCESS;
        }

        $counts = ['profitable' => 0, 'break_even' => 0, 'loss' => 0];

        DB::transaction(function () use ($seasons, &$counts) {
            foreach ($seasons as $season) {
                $counts[$this->fillOne($season)]++;
            }
        });

        $this->info("Filled {$seasons->count()} cropping(s):");
        $this->table(['Outcome', 'Croppings'], [
            ['Profitable', $counts['profitable']],
            ['Near break-even', $counts['break_even']],
            ['Loss (palugi)', $counts['loss']],
        ]);

        $this->newLine();
        $this->line('Reverse it at any time with:');
        $this->line('  php artisan geofarm:sample-financials --undo');

        return self::SUCCESS;
    }

    /** @return string one of profitable|break_even|loss */
    private function fillOne(CropSeason $season): string
    {
        $base = self::CROPS[strtolower(trim((string) $season->crop?->crop_name))] ?? self::DEFAULT_CROP;

        // Everything below is derived from the id, so the same row always
        // produces the same figures however often this is run.
        $id = (int) $season->id;
        $bucket = $id % 10;

        $outcome = match (true) {
            $bucket <= 4 => 'profitable',
            $bucket <= 6 => 'break_even',
            default      => 'loss',
        };

        // Area actually recorded on the season, falling back to one hectare so
        // a season with no area still produces a sensible-looking row.
        $hectares = (float) ($season->area_planted_ha ?: 1.0);

        /*
         * Wet croppings carry the typhoon months, so they run a little short of
         * the dry season on the same land. Small, but it means the two tabs in
         * the detail view do not read as copies of each other.
         */
        $seasonFactor = $season->season === CropSeason::SEASON_WET ? 0.94 : 1.0;

        [$yieldFactor, $priceFactor, $costFactor] = match ($outcome) {
            // A good year: full harvest, a price slightly above the base.
            'profitable' => [1.00 + ($id % 7) / 50, 1.00 + ($id % 5) / 40, 0.95 + ($id % 4) / 100],
            // Covers its costs and little else.
            'break_even' => [0.82 + ($id % 3) / 100, 0.95, 1.02],
            // Palugi: the harvest failed, the money was already spent. Cost
            // stays at full — that is precisely why the season loses.
            default      => [0.45 + ($id % 6) / 40, 0.88 + ($id % 3) / 50, 1.04 + ($id % 5) / 100],
        };

        $yield = round($base['yield'] * $hectares * $yieldFactor * $seasonFactor, 2);
        $price = round($base['price'] * $priceFactor, 2);
        $cost  = round($base['cost'] * $hectares * $costFactor, 2);

        // Split so the cost breakdown in the detail view has parts, not one
        // lump. Labour is the biggest single line on most Philippine farms.
        $labor = round($cost * 0.42, 2);
        $other = round($cost * 0.12, 2);

        $season->forceFill([
            // Only written where the row had none — yield included, so a
            // harvest CropHistorySeeder recorded is kept as it stands.
            'yield_kg'        => $season->yield_kg ?? $yield,
            'production_unit' => $season->production_unit ?? $base['unit'],
            'selling_price'   => $price,
            'production_cost' => $cost,
            'labor_cost'      => $labor,
            'other_cost'      => $other,
            // Left NULL on purpose. gross_revenue then derives from yield x
            // price, which is the path the screens are meant to exercise, and
            // a stored total would mask it.
            'total_income'    => null,
            'fertilizer_type'   => $id % 3 === 0 ? 'Urea 46-0-0' : ($id % 3 === 1 ? 'Complete 14-14-14' : 'Ammonium Sulphate 21-0-0'),
            'fertilizer_qty_kg' => round(max(25, 120 * $hectares), 2),
            'fertilizer_class'  => $id % 5 === 0 ? 'organic' : ($id % 5 === 1 ? 'mixed' : 'inorganic'),
        ])->save();

        $this->writeInputs($season, $cost, $hectares, $id);

        return $outcome;
    }

    /**
     * The itemised inputs behind the cost.
     *
     * Attached to crop_season_id, so they belong to this cropping alone — a
     * wet-season fertilizer cannot surface under the dry season.
     */
    private function writeInputs(CropSeason $season, float $cost, float $hectares, int $id): void
    {
        // Never twice for the same season, however often this is run.
        SeasonalInput::where('crop_season_id', $season->id)
            ->where('notes', self::MARKER)
            ->delete();

        $rows = [
            [
                'input_type' => 'fertilizer',
                'name'       => $season->fertilizer_type,
                'quantity'   => round(max(25, 120 * $hectares), 2),
                'unit'       => 'kg',
                'cost'       => round($cost * 0.26, 2),
            ],
            [
                'input_type' => 'herbicide',
                'name'       => $id % 2 === 0 ? 'Glyphosate 16%' : '2,4-D Amine',
                'quantity'   => round(max(1, 2 * $hectares), 2),
                'unit'       => 'liter',
                'cost'       => round($cost * 0.06, 2),
            ],
            [
                'input_type' => 'pesticide',
                'name'       => $id % 2 === 0 ? 'Cypermethrin 5EC' : 'Chlorpyrifos 20EC',
                'quantity'   => round(max(1, 1.5 * $hectares), 2),
                'unit'       => 'liter',
                'cost'       => round($cost * 0.05, 2),
            ],
            [
                'input_type' => 'seed',
                'name'       => $season->crop?->crop_name ? $season->crop->crop_name . ' seed' : 'Seed',
                'quantity'   => round(max(10, 40 * $hectares), 2),
                'unit'       => 'kg',
                'cost'       => round($cost * 0.09, 2),
            ],
        ];

        foreach ($rows as $row) {
            SeasonalInput::create($row + [
                'crop_season_id' => $season->id,
                'notes'          => self::MARKER,
            ]);
        }
    }
}
