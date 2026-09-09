<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gives financial_assistance the type column its own code already writes to.
 *
 * The controller validates assistance_type_id against the assistance_types
 * lookup, and FinancialAssistance lists it as fillable — but no migration in
 * this repository ever created the column. On a database built from these
 * migrations, saving a programme dies with:
 *
 *   Unknown column 'assistance_type_id' in 'field list'
 *
 * The live database evidently has it, added outside version control, so this
 * brings the two back into step. Both changes are guarded and additive: where
 * the column already exists nothing happens, and no data is touched.
 *
 * The original enum is left in place rather than dropped. It holds the type of
 * every programme recorded before the lookup table existed, and that history
 * is not ours to discard — it is only widened to nullable so it stops
 * rejecting rows that carry the foreign key instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('financial_assistance', 'assistance_type_id')) {
            Schema::table('financial_assistance', function (Blueprint $table) {
                // Nullable: the legacy rows have no lookup row to point at, and
                // restrictOnDelete so a type still in use cannot be removed
                // from under the programmes that cite it.
                $table->foreignId('assistance_type_id')
                    ->nullable()
                    ->after('program_name')
                    ->constrained('assistance_types')
                    ->restrictOnDelete();
            });
        }

        /*
         * The legacy enum blocked every insert.
         *
         * It is NOT NULL with no default, so a programme carrying the foreign
         * key had nothing to put here and MySQL refused the row outright.
         */
        // Read through information_schema rather than SHOW COLUMNS: the latter
        // takes no bound parameters, so "LIKE ?" is a syntax error.
        $legacy = DB::selectOne(
            'SELECT IS_NULLABLE, COLUMN_TYPE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            ['financial_assistance', 'assistance_type'],
        );

        if ($legacy && strtoupper($legacy->IS_NULLABLE) === 'NO') {
            // COLUMN_TYPE carries the whole enum definition, so the list of
            // allowed values is preserved exactly as it stands. It comes from
            // the schema itself, never from a request.
            DB::statement(
                'ALTER TABLE `financial_assistance` MODIFY `assistance_type` '
                . $legacy->COLUMN_TYPE . ' NULL'
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('financial_assistance', 'assistance_type_id')) {
            Schema::table('financial_assistance', function (Blueprint $table) {
                $table->dropForeign(['assistance_type_id']);
                $table->dropColumn('assistance_type_id');
            });
        }

        // The enum is deliberately left nullable. Restoring NOT NULL would
        // reject every row written since, which is not a rollback but a loss.
    }
};
