<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cost of production and fertiliser use, per cropping season.
 *
 * A crop_seasons row is already one parcel x crop x season x year, so a single
 * cost on the row answers every question asked of it:
 *
 *   cost per year, wet vs dry  ->  SUM(production_cost) GROUP BY year, season
 *   cost per kilo              ->  production_cost / yield_kg
 *
 * Neither is stored. A stored per-kilo figure becomes wrong the moment someone
 * edits the cost or the yield, and nothing would flag the disagreement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            // Whole pesos are never enough for input costs; 2dp matches the
            // money columns elsewhere in the system.
            $table->decimal('production_cost', 12, 2)->nullable()->after('yield_kg');

            $table->string('fertilizer_type', 100)->nullable()->after('production_cost');
            $table->decimal('fertilizer_qty_kg', 10, 2)->nullable()->after('fertilizer_type');

            // "mixed" is here because a season commonly gets both — urea at
            // planting and compost as basal. Without it staff would have to
            // misreport one of the two.
            $table->enum('fertilizer_class', ['organic', 'inorganic', 'mixed'])
                ->nullable()
                ->after('fertilizer_qty_kg');
        });
    }

    public function down(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            $table->dropColumn([
                'production_cost',
                'fertilizer_type',
                'fertilizer_qty_kg',
                'fertilizer_class',
            ]);
        });
    }
};
