<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A name for an intervention that was not raised by the risk analysis.
 *
 * Interventions have always been identified by `type` plus `reason` — "Farm
 * visit — frequent flooding" — which works because both come from
 * config/climate_risk.php and the office controls that wording. A manual
 * intervention has no configured factor behind it, so it needs a name someone
 * types: "Rice Production Support", "Agricultural Fuel Support Program 2026".
 *
 * Nullable, and deliberately so. Every existing row keeps working untouched:
 * where title is null the screens fall back to type + reason exactly as they
 * do today. Nothing is backfilled, because inventing titles for interventions
 * the office already raised would put words in its mouth.
 *
 * NOT added: a `source` column. Whether an intervention came from the analysis
 * is already answerable from data that is there —
 * climate_risk_assessment_id / factor_key are set by the analysis path and
 * null on the manual one — and a stored flag could drift out of step with the
 * foreign keys it is meant to describe.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agricultural_interventions', function (Blueprint $table) {
            if (! Schema::hasColumn('agricultural_interventions', 'title')) {
                $table->string('title', 150)->nullable()->after('factor_key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agricultural_interventions', function (Blueprint $table) {
            if (Schema::hasColumn('agricultural_interventions', 'title')) {
                $table->dropColumn('title');
            }
        });
    }
};
