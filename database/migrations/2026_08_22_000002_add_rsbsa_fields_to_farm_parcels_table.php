<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('farm_parcels', function (Blueprint $table) {
            // RSBSA Farm Parcel Fields
            $table->string('cropping_schedule', 100)->nullable()->after('total_area_ha');
            $table->string('commodity', 100)->nullable()->after('cropping_schedule');
            $table->integer('no_of_heads_trees')->nullable()->after('commodity');
            $table->boolean('is_organic')->default(false)->after('no_of_heads_trees');
            $table->string('proof_of_ownership', 100)->nullable()->after('land_owner_name');
        });
    }

    public function down(): void
    {
        Schema::table('farm_parcels', function (Blueprint $table) {
            $table->dropColumn([
                'cropping_schedule',
                'commodity',
                'no_of_heads_trees',
                'is_organic',
                'proof_of_ownership',
            ]);
        });
    }
};
