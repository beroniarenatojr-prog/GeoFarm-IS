<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('assistance_types', function (Blueprint $table) {
            $table->enum('distribution_type', ['financial', 'material', 'training', 'service'])->default('financial')->after('description');
        });

        // Update existing types with appropriate distribution types
        DB::table('assistance_types')->where('category', 'Financial & Credit')->update(['distribution_type' => 'financial']);
        DB::table('assistance_types')->where('category', 'Production Inputs')->update(['distribution_type' => 'material']);
        DB::table('assistance_types')->where('category', 'Machinery & Infrastructure')->update(['distribution_type' => 'material']);
        DB::table('assistance_types')->where('category', 'Crop & Asset Insurance')->update(['distribution_type' => 'service']);
        DB::table('assistance_types')->where('category', 'Training & Extension')->update(['distribution_type' => 'training']);
        DB::table('assistance_types')->where('category', 'Livelihood & Market Support')->update(['distribution_type' => 'material']);
        DB::table('assistance_types')->where('category', 'Special Programs')->update(['distribution_type' => 'financial']);
    }

    public function down(): void
    {
        Schema::table('assistance_types', function (Blueprint $table) {
            $table->dropColumn('distribution_type');
        });
    }
};
