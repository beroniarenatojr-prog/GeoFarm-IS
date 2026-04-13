<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('farm_parcels', function (Blueprint $table) {
            $table->text('geojson_data')->nullable()->after('arb');
        });
    }

    public function down(): void
    {
        Schema::table('farm_parcels', function (Blueprint $table) {
            $table->dropColumn('geojson_data');
        });
    }
};
