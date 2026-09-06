<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Name of spouse, as the RSBSA enrolment form asks for it.
 *
 * Nullable rather than required-when-married: the column arrives after farmers
 * are already on file, and forcing a value would block staff from saving any
 * edit to an existing married farmer until they chase down a spouse's name.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->string('spouse_name', 150)->nullable()->after('civil_status');
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->dropColumn('spouse_name');
        });
    }
};
