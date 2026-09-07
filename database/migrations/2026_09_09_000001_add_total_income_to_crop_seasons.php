<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the harvest sold for, beside what it cost to grow.
 *
 * production_cost answered half of the financial question; without income the
 * other half could only be guessed at. Together they give net farm income per
 * season, which is what separates a profitable cropping from a "palugi" one.
 *
 * It belongs on crop_seasons for the same reason the cost does: a row is
 * already one parcel x crop x season x year, so the outcome lands on the
 * farming operation rather than on the farmer. The same farmer can profit in
 * the dry season and lose in the wet, and a column on `farmers` could not
 * express that.
 *
 * Nullable, and deliberately distinct from zero. A season still being encoded
 * has no income yet; a total crop failure has an income of exactly zero. If
 * absent were read as zero, every half-entered record would report a loss.
 *
 * Nothing stores the outcome itself - it is derived on the model, so it cannot
 * fall out of step with the two figures it comes from.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            // Matches production_cost exactly, so the pair sort and total alike.
            $table->decimal('total_income', 12, 2)->nullable()->after('production_cost');
        });
    }

    public function down(): void
    {
        Schema::table('crop_seasons', function (Blueprint $table) {
            $table->dropColumn('total_income');
        });
    }
};
