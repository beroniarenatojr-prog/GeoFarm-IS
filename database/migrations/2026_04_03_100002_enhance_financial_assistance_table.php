<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_assistance', function (Blueprint $table) {
            // Add status column if it doesn't exist
            if (!Schema::hasColumn('financial_assistance', 'status')) {
                $table->enum('status', ['draft', 'active', 'completed', 'cancelled'])->default('draft')->after('end_date');
            }
            
            // Add indexes if they don't exist
            if (!Schema::hasColumn('financial_assistance', 'status')) {
                $table->index('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('financial_assistance', function (Blueprint $table) {
            if (Schema::hasColumn('financial_assistance', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
