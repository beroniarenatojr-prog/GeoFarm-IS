<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The recommendations issued with an assessment.
 *
 * Stored for the same reason the risk result is: the wording lives in config
 * and the office is expected to revise it. Deriving on read would mean an
 * assessment quietly showing different advice than the farmer was actually
 * given - and what was advised, on the day it was advised, is the part that
 * matters if anyone asks later.
 *
 * The scoring_version already on the row covers this too: the advice and the
 * score come from the same config file and move together.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('climate_risk_assessments', function (Blueprint $table) {
            $table->json('recommendations')->nullable()->after('scoring_version');
        });
    }

    public function down(): void
    {
        Schema::table('climate_risk_assessments', function (Blueprint $table) {
            $table->dropColumn('recommendations');
        });
    }
};
