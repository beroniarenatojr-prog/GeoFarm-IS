<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What an assessment is actually about.
 *
 * Until now a farmer had one assessment and the analysis applied it to
 * everything they farm. A rice grower answering "my main barrier is no water"
 * had that counted against their carabao as well, because nothing recorded
 * which activity the answer described.
 *
 * Two columns, and no more than two:
 *
 *   scope_type   farmer | parcel | livestock | aquaculture
 *   fishpond_id  the pond, when the scope is aquaculture
 *
 * Livestock needs no column of its own. A livestock holding is declared on
 * farm_parcels — commodity "Carabao", a barangay and a head count — and that
 * table is already referenced here by farm_parcel_id. Adding a second way to
 * point at the same thing would create two answers to "which herd is this".
 *
 * Backward compatible by construction. scope_type defaults to 'farmer', so
 * every assessment recorded before today is valid as it stands and reads as a
 * whole-farm assessment, which is exactly what it was. No existing row is
 * rewritten and no scope is guessed from old answers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('climate_risk_assessments', function (Blueprint $table) {
            /*
             * Deliberately a string, not an enum.
             *
             * The office may yet assess things this system has no table for.
             * An enum would need a migration to admit each one; the model's
             * SCOPES constant and the controller's validation already stop
             * anything unrecognised being written.
             */
            $table->string('scope_type', 20)->default('farmer')->after('farmer_id');

            $table->foreignId('fishpond_id')->nullable()->after('farm_parcel_id')
                ->constrained('fishponds')->nullOnDelete();

            // The analysis asks "the newest assessment for this unit" once per
            // unit on a farm, so this is the index that matters.
            $table->index(['farmer_id', 'scope_type'], 'idx_assessments_scope');
        });
    }

    public function down(): void
    {
        Schema::table('climate_risk_assessments', function (Blueprint $table) {
            $table->dropIndex('idx_assessments_scope');
            $table->dropConstrainedForeignId('fishpond_id');
            $table->dropColumn('scope_type');
        });
    }
};
