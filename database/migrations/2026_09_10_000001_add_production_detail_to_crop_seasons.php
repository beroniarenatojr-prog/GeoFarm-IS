<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * What a season sold for, what it cost, and how it was grown.
 *
 * Three deliberate non-additions, because the columns already exist under
 * other names and a second copy could only ever disagree with the first:
 *
 *   - Production quantity is yield_kg. Only the unit was missing.
 *   - Gross revenue is total_income. selling_price is added so revenue can be
 *     worked out as yield x price, but the answer is still stored in
 *     total_income - the climate risk scorer, net_farm_income and the palugi
 *     classification all read that one column.
 *   - Farm type stays on the parcel. Irrigated or rainfed is a property of the
 *     land, not of a cropping, so the season reads it through the parcel.
 *
 * is_organic IS per season, because the practice genuinely changes: a farmer
 * can crop organically in the wet season and not in the dry. Null means "as
 * recorded on the parcel", so existing rows keep their current meaning.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            $table->string('production_unit', 20)->nullable()->after('yield_kg');
            $table->decimal('selling_price', 12, 2)->nullable()->after('production_unit');

            // Labour and "other" are the costs that are not an input you can
            // hold. Seed, fertilizer and chemical costs are summed from
            // seasonal_inputs instead, so an itemised list and a category
            // total can never contradict each other.
            $table->decimal('labor_cost', 12, 2)->nullable()->after('production_cost');
            $table->decimal('other_cost', 12, 2)->nullable()->after('labor_cost');

            $table->boolean('is_organic')->nullable()->after('fertilizer_class');
        });

        /*
         * A season the office has not encoded yet has no crop.
         *
         * Registering a parcel now opens its wet and/or dry rows automatically
         * from the cropping schedule, and at that moment the only thing known
         * about the crop is the parcel's free-text commodity. Where that
         * matches a crop on file it is used; where it does not, the row waits
         * for staff rather than inventing a crop from a typo.
         *
         * Manual entry still requires a crop - that rule lives in the
         * controller, where it belongs.
         */
        DB::statement('ALTER TABLE `crop_seasons` MODIFY `crop_id` BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            $table->dropColumn([
                'production_unit', 'selling_price',
                'labor_cost', 'other_cost', 'is_organic',
            ]);
        });

        // Only reinstate NOT NULL when nothing would violate it.
        if (!DB::table('crop_seasons')->whereNull('crop_id')->exists()) {
            DB::statement('ALTER TABLE `crop_seasons` MODIFY `crop_id` BIGINT UNSIGNED NOT NULL');
        }
    }
};
