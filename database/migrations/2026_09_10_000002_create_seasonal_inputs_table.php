<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a farmer actually put on the land during one cropping.
 *
 * A row per input, not a column per category. A season commonly uses two
 * fertilizers and more than one chemical, so fertilizer_type / fertilizer_qty_kg
 * on crop_seasons could only ever hold the first of them; and the existing
 * inputs_used JSON has no cost field at all, which is the figure the office
 * most needs.
 *
 * Those two are left in place and untouched - they hold real recorded data.
 * New encoding goes here, and the season's input cost is summed from these
 * rows rather than retyped as a total that could drift from its own parts.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seasonal_inputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('crop_season_id')->constrained('crop_seasons')->cascadeOnDelete();

            // The RSBSA input categories. "other" is what keeps the list from
            // being a straitjacket the moment the office buys something the
            // enum never anticipated.
            $table->enum('input_type', [
                'fertilizer', 'herbicide', 'pesticide', 'insecticide',
                'fungicide', 'seed', 'fuel', 'other',
            ])->index();

            // The brand or variety, e.g. "Urea 46-0-0". Optional: the office
            // often knows it spent on fertilizer without recording which.
            $table->string('name', 120)->nullable();

            $table->decimal('quantity', 12, 2)->nullable();
            $table->string('unit', 20)->nullable();          // bags, liters, kg
            $table->decimal('cost', 12, 2)->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['crop_season_id', 'input_type'], 'idx_inputs_season_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seasonal_inputs');
    }
};
