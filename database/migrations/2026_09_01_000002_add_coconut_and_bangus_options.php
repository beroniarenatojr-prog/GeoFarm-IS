<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The enums were copied straight off the RSBSA form, which omits coconut from
 * its tree-crop list and bangus from its fishpond list. Both are farmed in
 * Tumauini and both are named in the Farm Inventory spec, so the registry
 * could not record what is actually on the ground.
 *
 * Widening an enum only adds permitted values; no stored row changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE tree_crops MODIFY crop_type "
            . "ENUM('Coconut','Mango','Banana','Cacao','Pineapple') NOT NULL"
        );

        DB::statement(
            "ALTER TABLE fishponds MODIFY species ENUM('Tilapia','Hito','Bangus') NOT NULL"
        );
    }

    public function down(): void
    {
        // Rows on a value the narrowed enum cannot hold would be silently
        // blanked by MySQL, so move them to the nearest surviving option first.
        DB::table('tree_crops')->where('crop_type', 'Coconut')->update(['crop_type' => 'Mango']);
        DB::table('fishponds')->where('species', 'Bangus')->update(['species' => 'Tilapia']);

        DB::statement(
            "ALTER TABLE tree_crops MODIFY crop_type ENUM('Mango','Banana','Cacao','Pineapple') NOT NULL"
        );
        DB::statement("ALTER TABLE fishponds MODIFY species ENUM('Tilapia','Hito') NOT NULL");
    }
};
