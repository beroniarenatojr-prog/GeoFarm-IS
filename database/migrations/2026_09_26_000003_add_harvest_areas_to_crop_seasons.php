<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two area columns the yield module needs, and nothing else.
 *
 * `area_planted_ha` already exists and stays the authority for what went into
 * the ground. These separate two things it cannot express on its own:
 *
 *   harvested_area_ha           what was actually brought in. A season can be
 *                               partly lost to flood or pests, so yield per
 *                               hectare computed against the PLANTED area
 *                               understates how the surviving crop performed.
 *
 *   expected_harvested_area_ha  what an upcoming or current season expects to
 *                               harvest, for forecasting a total before there
 *                               is anything to measure.
 *
 * Both nullable, and both fall back to area_planted_ha when empty, so every
 * existing row keeps working unchanged and nothing has to be backfilled.
 *
 * Additive only. No column is altered or dropped, and down() removes just
 * these two.
 *
 * Deliberately NOT added here: is_calamity_affected and calamity_type. That
 * information is already collected on climate_risk_assessments, which links to
 * a cropping through crop_season_id. A second copy could only drift out of
 * step with the first.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            $table->decimal('harvested_area_ha', 10, 2)
                ->nullable()
                ->after('area_planted_ha');

            $table->decimal('expected_harvested_area_ha', 10, 2)
                ->nullable()
                ->after('harvested_area_ha');
        });
    }

    public function down(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            $table->dropColumn(['harvested_area_ha', 'expected_harvested_area_ha']);
        });
    }
};
