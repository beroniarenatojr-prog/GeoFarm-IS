<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Administrative outlines, kept well away from farm parcels.
 *
 * A barangay is not a farm. Storing its outline in farm_parcels would make it
 * a 4,000-hectare holding belonging to nobody, overlapping every real parcel
 * inside it — so these live in their own table with no farmer attached.
 *
 * One row per barangay: an outline is replaced when a newer file arrives, not
 * accumulated, so the unique key is the barangay itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('barangay_boundaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barangay_id')->unique()->constrained('barangays')->cascadeOnDelete();

            // Nullable so the table can be created before any file arrives;
            // every row that exists is expected to carry a shape.
            $table->geometry('geom')->nullable();

            $table->enum('source', ['shapefile', 'kml', 'geojson'])->nullable();
            $table->string('source_file')->nullable();
            $table->timestamp('imported_at')->nullable();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barangay_boundaries');
    }
};
