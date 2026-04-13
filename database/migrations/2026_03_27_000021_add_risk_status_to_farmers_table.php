<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->enum('risk_status', ['low', 'medium', 'high', 'critical'])->nullable()->after('is_4ps');
            $table->timestamp('risk_updated_at')->nullable()->after('risk_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->dropColumn(['risk_status', 'risk_updated_at']);
        });
    }
};

