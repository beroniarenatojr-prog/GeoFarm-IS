<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Repairs databases left with the single `spouse_name` column.
 *
 * 2026_09_08_000001 originally added one free-text `spouse_name`. It was later
 * rewritten to add the four columns the RSBSA form rules the spouse row into,
 * on the belief that it had not run anywhere yet. It had - production had
 * already deployed and migrated it.
 *
 * Laravel records a migration by filename, so the rewritten file is still
 * marked as run: `migrate` reports "Nothing to migrate" while the table keeps
 * the old shape, and every insert fails with "Unknown column
 * spouse_first_name". Editing a migration that has run cannot be undone by
 * editing it again; it takes a new one.
 *
 * Written so it is safe on any of the three shapes a database might be in -
 * old, new, or fresh - because the three developers on this repo are not
 * necessarily in the same state.
 */
return new class extends Migration
{
    /** The four columns, in form order, each placed after the previous. */
    private const COLUMNS = [
        'spouse_first_name'  => ['civil_status', 50],
        'spouse_middle_name' => ['spouse_first_name', 50],
        'spouse_last_name'   => ['spouse_middle_name', 50],
        'spouse_ext_name'    => ['spouse_last_name', 10],
    ];

    public function up(): void
    {
        foreach (self::COLUMNS as $column => [$after, $length]) {
            if (Schema::hasColumn('farmers', $column)) {
                continue;
            }

            Schema::table('farmers', function (Blueprint $table) use ($column, $after, $length) {
                $table->string($column, $length)->nullable()->after($after);
            });
        }

        if (! Schema::hasColumn('farmers', 'spouse_name')) {
            return;
        }

        // Carry anything already recorded into the first-name column rather
        // than dropping it. Nothing is stored today, but a teammate's database
        // is not something this migration can see.
        DB::table('farmers')
            ->whereNotNull('spouse_name')
            ->where('spouse_name', '!=', '')
            ->update(['spouse_first_name' => DB::raw('spouse_name')]);

        Schema::table('farmers', function (Blueprint $table) {
            $table->dropColumn('spouse_name');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('farmers', 'spouse_name')) {
            return;
        }

        Schema::table('farmers', function (Blueprint $table) {
            $table->string('spouse_name', 150)->nullable()->after('civil_status');
        });

        DB::table('farmers')
            ->whereNotNull('spouse_first_name')
            ->update(['spouse_name' => DB::raw('spouse_first_name')]);
    }
};
