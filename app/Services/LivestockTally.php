<?php

namespace App\Services;

use App\Models\LargeRuminant;
use App\Models\NativePig;
use App\Models\Poultry;
use App\Models\SmallRuminant;
use App\Models\SwineHybrid;

/**
 * Counts the animals the office actually holds records for.
 *
 * There are two livestock systems in this database and only one of them is
 * real. `livestock` + `livestock_types` is the older pair: nothing in the
 * application has ever written to it — there is no Livestock::create anywhere
 * — so every figure read from it is zero and always will be. The RSBSA tables
 * superseded it: large_ruminants, small_ruminants, native_pigs, swine_hybrid
 * and poultry, each written by its own controller and by the registration
 * form.
 *
 * The dashboard was reading the empty one, which is why it reported 0 heads
 * and "no livestock records yet" while Farm Inventory — which reads the five —
 * showed hundreds.
 *
 * The list of tables lives here so the dashboard and anything else that needs
 * a herd total share one definition. total_heads is a STORED GENERATED column
 * (male_count + female_count) on all five, so it is summed, never written.
 */
class LivestockTally
{
    /**
     * The five RSBSA animal tables, with the column that discriminates each.
     *
     * `category` is the grouping the office reports by.
     */
    public const TABLES = [
        ['model' => LargeRuminant::class, 'field' => 'animal_type', 'category' => 'Large Ruminant'],
        ['model' => SmallRuminant::class, 'field' => 'animal_type', 'category' => 'Small Ruminant'],
        // native_pigs has no discriminator column: every row is a native pig,
        // so it counts as exactly one kind of animal.
        ['model' => NativePig::class,     'field' => null,          'category' => 'Swine'],
        ['model' => SwineHybrid::class,   'field' => 'variety',     'category' => 'Swine'],
        ['model' => Poultry::class,       'field' => 'bird_type',   'category' => 'Poultry'],
    ];

    /**
     * Total heads, and how many distinct kinds of animal are on record.
     *
     * Poultry is included in the head count here because the caller asks for
     * "livestock heads" as one figure; where the office needs birds separately
     * it groups by category instead — see categories().
     */
    public function totals(): array
    {
        $heads = 0;
        $kinds = 0;

        foreach (self::TABLES as $table) {
            $heads += (int) $table['model']::sum('total_heads');

            // A table with no discriminator is one kind of animal, and only
            // counts at all if it holds a record.
            $kinds += $table['field']
                ? (int) $table['model']::distinct($table['field'])->count($table['field'])
                : ($table['model']::exists() ? 1 : 0);
        }

        return ['heads' => $heads, 'kinds' => $kinds];
    }

    /**
     * Heads grouped by the categories the office reports by.
     *
     * "193 heads" answers nothing on its own — the question is 193 of what.
     * Swine deliberately merges native pigs and hybrids: they are two tables
     * for one animal, and the office counts them together.
     */
    public function categories(): array
    {
        $grouped = [];

        foreach (self::TABLES as $table) {
            $heads = (int) $table['model']::sum('total_heads');

            if ($heads === 0) {
                continue;
            }

            $kinds = $table['field']
                ? (int) $table['model']::distinct($table['field'])->count($table['field'])
                : 1;

            $name = $table['category'];

            $grouped[$name] ??= ['name' => $name, 'heads' => 0, 'types' => 0];
            $grouped[$name]['heads'] += $heads;
            $grouped[$name]['types'] += $kinds;
        }

        $rows = array_values($grouped);
        usort($rows, fn ($a, $b) => $b['heads'] <=> $a['heads']);

        return [
            'total'      => array_sum(array_column($rows, 'heads')),
            'categories' => $rows,
        ];
    }
}
