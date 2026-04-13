<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Remove duplicates before adding unique constraint
        $duplicates = DB::table('barangays')
            ->select('name', 'municipality', 'province', DB::raw('MIN(id) as keep_id'))
            ->groupBy('name', 'municipality', 'province')
            ->having(DB::raw('COUNT(*)'), '>', 1)
            ->get();

        foreach ($duplicates as $duplicate) {
            // Delete all except the first one
            DB::table('barangays')
                ->where('name', $duplicate->name)
                ->where('municipality', $duplicate->municipality)
                ->where('province', $duplicate->province)
                ->where('id', '!=', $duplicate->keep_id)
                ->delete();
        }

        // Add unique constraint
        Schema::table('barangays', function (Blueprint $table) {
            $table->unique(['name', 'municipality', 'province'], 'unique_barangay_location');
        });
    }

    public function down(): void
    {
        Schema::table('barangays', function (Blueprint $table) {
            $table->dropUnique('unique_barangay_location');
        });
    }
};
