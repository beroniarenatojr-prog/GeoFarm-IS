<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            // Birth & Family Details
            if (!Schema::hasColumn('farmers', 'birth_city_municipality')) {
                $table->string('birth_city_municipality', 100)->nullable()->after('birthdate');
            }
            if (!Schema::hasColumn('farmers', 'birth_province')) {
                $table->string('birth_province', 100)->nullable()->after('birth_city_municipality');
            }
            if (!Schema::hasColumn('farmers', 'mother_first_name')) {
                $table->string('mother_first_name', 50)->nullable()->after('mother_maiden_name');
            }
            if (!Schema::hasColumn('farmers', 'mother_middle_name')) {
                $table->string('mother_middle_name', 50)->nullable()->after('mother_first_name');
            }
            if (!Schema::hasColumn('farmers', 'mother_last_name')) {
                $table->string('mother_last_name', 50)->nullable()->after('mother_middle_name');
            }
            
            // Contact & Identification
            if (!Schema::hasColumn('farmers', 'valid_id_type')) {
                $table->string('valid_id_type', 50)->nullable()->after('email');
            }
            if (!Schema::hasColumn('farmers', 'id_number')) {
                $table->string('id_number', 100)->nullable()->after('valid_id_type');
            }
            
            // Address Details
            if (!Schema::hasColumn('farmers', 'house_lot_number')) {
                $table->string('house_lot_number', 100)->nullable()->after('barangay');
            }
            if (!Schema::hasColumn('farmers', 'street_sitio')) {
                $table->string('street_sitio', 100)->nullable()->after('house_lot_number');
            }
            if (!Schema::hasColumn('farmers', 'region')) {
                $table->string('region', 100)->nullable()->after('province');
            }
            
            // Classification & Membership (is_indigenous already exists)
            if (!Schema::hasColumn('farmers', 'indigenous_community')) {
                $table->string('indigenous_community', 100)->nullable()->after('is_indigenous');
            }
            if (!Schema::hasColumn('farmers', 'organization_name')) {
                $table->string('organization_name', 200)->nullable()->after('indigenous_community');
            }
            if (!Schema::hasColumn('farmers', 'organization_name_2')) {
                $table->string('organization_name_2', 200)->nullable()->after('organization_name');
            }
            if (!Schema::hasColumn('farmers', 'organization_name_3')) {
                $table->string('organization_name_3', 200)->nullable()->after('organization_name_2');
            }
            
            // Livelihood Profile
            if (!Schema::hasColumn('farmers', 'livelihood_type')) {
                $table->enum('livelihood_type', ['Farmer', 'Farm Worker', 'Fisher', 'Agri-Youth'])->default('Farmer')->after('organization_name_3');
            }
            
            // Supporting Documents
            if (!Schema::hasColumn('farmers', 'id_proof_path')) {
                $table->string('id_proof_path', 255)->nullable()->after('photo_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $columns = [
                'birth_city_municipality',
                'birth_province',
                'mother_first_name',
                'mother_middle_name',
                'mother_last_name',
                'valid_id_type',
                'id_number',
                'house_lot_number',
                'street_sitio',
                'region',
                'indigenous_community',
                'organization_name',
                'organization_name_2',
                'organization_name_3',
                'livelihood_type',
                'id_proof_path',
            ];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('farmers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
