<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A prediction, kept exactly as it was made.
 *
 * NOT a cache of the analytics. Everything on the Predictive Analytics screen
 * is still computed live from crop_seasons through ForecastService, so no
 * figure on that page can drift from the records behind it. This table exists
 * for one question those live figures cannot answer honestly:
 *
 *     "How good was the prediction?"
 *
 * Predictions are derived from recorded yields. Once the actual yield for a
 * season is entered, recomputing that season's prediction would draw on the
 * very number it is being compared against — the prediction would quietly
 * shift towards the outcome, and the error would always look small. The
 * comparison would measure nothing.
 *
 * So a prediction is written down BEFORE its season is harvested, and never
 * updated afterwards. actual_yield_kg is filled in later from the crop_seasons
 * record; the predicted figures beside it are left untouched.
 *
 * Additive only. No existing table is altered, and nothing reads this to
 * render a prediction.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('yield_prediction_snapshots', function (Blueprint $table) {
            $table->id();

            /*
             * The target cropping, named by the same keys crop_seasons uses.
             *
             * parcel_id rather than farm_parcel_id: crop_seasons calls it
             * parcel_id, and a second spelling for the same relationship in an
             * adjacent table is how joins get written wrong.
             */
            $table->foreignId('parcel_id')->constrained('farm_parcels')->cascadeOnDelete();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->foreignId('crop_id')->constrained('crops')->restrictOnDelete();

            $table->year('cropping_year');
            $table->enum('season', ['dry', 'wet']);

            /*
             * Denormalised on purpose, and only this one field.
             *
             * A parcel's barangay can be corrected years later, and a
             * prediction's accuracy belongs to the place it was made for at
             * the time. Everything else is reachable through the keys above.
             */
            $table->string('barangay', 50)->nullable();

            $table->decimal('area_planted_ha', 10, 2)->nullable();

            // What the prediction said, at the moment it was made.
            $table->decimal('historical_average_kg', 12, 2)->nullable();
            $table->decimal('predicted_yield_kg', 12, 2)->nullable();
            $table->decimal('predicted_low_kg', 12, 2)->nullable();
            $table->decimal('predicted_high_kg', 12, 2)->nullable();
            $table->decimal('expected_change_pct', 8, 2)->nullable();
            $table->string('prediction_status', 40)->nullable();

            /*
             * How much history it rested on, and how wide a net it had to cast
             * to find it. Without these, a prediction made from two records for
             * a neighbouring barangay is indistinguishable from one made from
             * forty of the farmer's own — and they deserve very different
             * weight when the error is reviewed.
             */
            $table->string('confidence', 20)->nullable();
            $table->unsignedSmallInteger('data_points')->default(0);
            $table->string('basis', 40)->nullable();

            /*
             * Which version of the logic produced this.
             *
             * When the prediction rules change, old snapshots must not be read
             * as though the current rules made them.
             */
            $table->string('methodology', 40);

            $table->timestamp('generated_at')->useCurrent();

            /*
             * Filled in after harvest, from the crop_seasons record. The
             * predicted columns above are NEVER rewritten at that point.
             */
            $table->decimal('actual_yield_kg', 12, 2)->nullable();
            $table->timestamp('actual_recorded_at')->nullable();

            $table->timestamps();

            /*
             * One live snapshot per cropping per methodology. A second run of
             * the same generator updates its own row rather than laying down a
             * duplicate, while a future methodology gets a row of its own so
             * the two can be compared.
             */
            $table->unique(
                ['parcel_id', 'cropping_year', 'season', 'methodology'],
                'uniq_snapshot_target',
            );

            $table->index(['cropping_year', 'season'], 'idx_snapshot_period');
            $table->index(['barangay', 'crop_id'], 'idx_snapshot_place_crop');
            $table->index('farmer_id', 'idx_snapshot_farmer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('yield_prediction_snapshots');
    }
};
