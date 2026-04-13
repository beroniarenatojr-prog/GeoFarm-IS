<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crops', function (Blueprint $table) {
            $table->decimal('seeding_rate_kg_per_ha', 8, 2)->nullable()->after('category');
            $table->decimal('fertilizer_bags_per_ha', 8, 2)->nullable()->after('seeding_rate_kg_per_ha');
        });
    }

    public function down(): void
    {
        Schema::table('crops', function (Blueprint $table) {
            $table->dropColumn(['seeding_rate_kg_per_ha', 'fertilizer_bags_per_ha']);
        });
    }
};
