<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Name of spouse, in the four parts the RSBSA form rules it into:
 * FIRST NAME / MIDDLE NAME / SURNAME / EXT NAME.
 *
 * Split rather than one free-text field because the printed form has a
 * captioned column for each, and RsbsaFormFiller writes into those columns by
 * coordinate - a single "Maria Santos Beronia" could not be placed back into
 * them. It also matches how the farmer's own name and their mother's maiden
 * name are already stored.
 *
 * All nullable: the columns arrive after farmers are on file, and requiring a
 * value would block staff from saving any edit to an existing married farmer
 * until they chased down a spouse's name.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->string('spouse_first_name', 50)->nullable()->after('civil_status');
            $table->string('spouse_middle_name', 50)->nullable()->after('spouse_first_name');
            $table->string('spouse_last_name', 50)->nullable()->after('spouse_middle_name');
            $table->string('spouse_ext_name', 10)->nullable()->after('spouse_last_name');
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->dropColumn([
                'spouse_first_name',
                'spouse_middle_name',
                'spouse_last_name',
                'spouse_ext_name',
            ]);
        });
    }
};
