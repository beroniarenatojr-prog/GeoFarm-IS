<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('crop_seasons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parcel_id')->constrained('farm_parcels')->cascadeOnDelete();
            $table->enum('season', ['dry', 'wet']);
            $table->year('cropping_year');
            $table->foreignId('crop_id')->constrained('crops')->restrictOnDelete();
            $table->decimal('area_planted_ha', 10, 2)->nullable();
            $table->date('planting_date')->nullable();
            $table->date('harvest_date')->nullable();
            $table->decimal('yield_kg', 10, 2)->nullable();
            $table->json('inputs_used')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('parcel_id', 'idx_seasons_parcel');
            $table->index('cropping_year', 'idx_seasons_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crop_seasons');
    }
};
