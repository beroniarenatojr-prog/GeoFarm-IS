<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('farm_parcels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->string('parcel_number', 20)->nullable();
            $table->string('location_address', 255)->nullable();
            $table->string('barangay', 50)->nullable();
            $table->string('city_municipality', 50)->nullable();
            $table->string('province', 50)->nullable();
            $table->decimal('total_area_ha', 10, 2)->nullable();
            $table->foreignId('farm_type_id')->nullable()->constrained('farm_types')->nullOnDelete();
            $table->enum('ownership_type', ['Registered Owner', 'Lessee', 'Tenant', 'Other'])->nullable();
            $table->string('land_owner_name', 100)->nullable();
            $table->boolean('within_ancestral')->default(false);
            $table->boolean('arb')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('farmer_id', 'idx_parcels_farmer');
        });

        // Add geometry column via raw SQL (Blueprint doesn't support GEOMETRY natively)
        // Note: SPATIAL INDEX requires NOT NULL; add it manually once data is populated
        if (!Schema::hasColumn('farm_parcels', 'geom')) {
            DB::statement('ALTER TABLE `farm_parcels` ADD COLUMN `geom` GEOMETRY NULL');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_parcels');
    }
};
