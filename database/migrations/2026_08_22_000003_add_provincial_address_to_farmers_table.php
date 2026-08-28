<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            if (!Schema::hasColumn('farmers', 'provincial_house_lot')) {
                $table->string('provincial_house_lot', 100)->nullable()->after('region');
            }
            if (!Schema::hasColumn('farmers', 'provincial_street_sitio')) {
                $table->string('provincial_street_sitio', 100)->nullable()->after('provincial_house_lot');
            }
            if (!Schema::hasColumn('farmers', 'provincial_barangay')) {
                $table->string('provincial_barangay', 50)->nullable()->after('provincial_street_sitio');
            }
            if (!Schema::hasColumn('farmers', 'provincial_city_municipality')) {
                $table->string('provincial_city_municipality', 50)->nullable()->after('provincial_barangay');
            }
            if (!Schema::hasColumn('farmers', 'provincial_province')) {
                $table->string('provincial_province', 50)->nullable()->after('provincial_city_municipality');
            }
            if (!Schema::hasColumn('farmers', 'provincial_region')) {
                $table->string('provincial_region', 100)->nullable()->after('provincial_province');
            }
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $columns = [
                'provincial_house_lot',
                'provincial_street_sitio',
                'provincial_barangay',
                'provincial_city_municipality',
                'provincial_province',
                'provincial_region',
            ];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('farmers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
