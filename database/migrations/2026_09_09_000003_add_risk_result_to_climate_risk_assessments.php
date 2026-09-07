<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The risk result, stored on the assessment that produced it.
 *
 * Stored rather than derived - the opposite of how net farm income is handled
 * on crop_seasons, and for a reason worth stating.
 *
 * Net income is derived because its inputs are stored figures: recompute it
 * any time and you get the same answer. A risk score's inputs include the
 * weights in config/climate_risk.php, which the panel is expected to revise.
 * Deriving it on read would mean an assessment from March silently reports a
 * different level in June because a weight changed - and a research record
 * that rewrites itself cannot be cited.
 *
 * scoring_version records which rule set produced the number, so results from
 * different revisions are never compared as though they were the same measure.
 *
 * risk_score is a transparent sum of stated rules out of 100. It is NOT a
 * probability and must not be presented as one: nothing has been fitted
 * against outcomes, so it carries no statistical meaning.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('climate_risk_assessments', function (Blueprint $table) {
            $table->string('risk_level', 20)->nullable()->after('anticipated_factors');
            $table->unsignedTinyInteger('risk_score')->nullable()->after('risk_level');

            // Which rules fired, and the figures behind each. This is what
            // makes a single result auditable rather than a bare number.
            $table->json('risk_factors')->nullable()->after('risk_score');

            $table->string('scoring_version', 30)->nullable()->after('risk_factors');
        });
    }

    public function down(): void
    {
        Schema::table('climate_risk_assessments', function (Blueprint $table) {
            $table->dropColumn(['risk_level', 'risk_score', 'risk_factors', 'scoring_version']);
        });
    }
};
