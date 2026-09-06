<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the `sex` column to farmer_children on databases created before it.
 *
 * 2026_09_08_000002 originally created the table without `sex`; the column was
 * folded into that same file afterwards, on the belief the table had not been
 * created anywhere yet. Production had already created it.
 *
 * Laravel records a migration by filename, not content, so the edited file
 * stays marked as run: `migrate` reports "Nothing to migrate" while the table
 * keeps its original shape, and every insert fails with "Unknown column 'sex'".
 * A migration that has run cannot be corrected by editing it - only by adding
 * another.
 *
 * enum('Male','Female') matches both the repo's own definition of this column
 * and `farmers.sex`, so the two stay consistent. Nullable, because a name
 * alone is worth recording when the detail is not to hand.
 *
 * Guarded on hasColumn so it is a no-op on a database built from the current
 * file - this repo has three remotes and the developers are not necessarily
 * in the same state.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('farmer_children', 'sex')) {
            return;
        }

        Schema::table('farmer_children', function (Blueprint $table) {
            $table->enum('sex', ['Male', 'Female'])->nullable()->after('name');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('farmer_children', 'sex')) {
            return;
        }

        Schema::table('farmer_children', function (Blueprint $table) {
            $table->dropColumn('sex');
        });
    }
};
