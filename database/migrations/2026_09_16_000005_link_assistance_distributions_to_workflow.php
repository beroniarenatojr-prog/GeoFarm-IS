<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ties assistance history into the support workflow, and repairs a live bug.
 *
 * assistance_distributions already IS the assistance record — farmer,
 * programme, date, quantity, amount, status. No second table is created for
 * it; splitting a farmer's hand-out history across two places would mean
 * neither could be trusted as the whole of it.
 *
 * Three columns:
 *
 *   intervention_id   which visit led to this hand-out, when one did. Most
 *                     assistance has no intervention behind it — a farmer can
 *                     simply be on a programme — so it is nullable and stays
 *                     that way.
 *
 *   farm_parcel_id    which holding the support was for. Also nullable: cash
 *                     assistance is often to the farmer, not to a parcel.
 *
 *   updated_at        a bug fix, not a feature.
 *
 * On updated_at: AssistanceDistribution sets $timestamps = false and writes
 * created_at and updated_at itself from boot() hooks, but the column was never
 * created. Every update therefore fails outright:
 *
 *     SQLSTATE[42S22]: Unknown column 'updated_at' in 'field list'
 *
 * which means marking a distribution claimed or forfeited is broken today.
 * Adding the column makes the existing hook work as it was written. The
 * model is deliberately left alone: switching it to Eloquent-managed
 * timestamps would change created_at behaviour on a table that already holds
 * records.
 *
 * Nullable with no default, on purpose. The rows already in the table have
 * never been updated, and NULL says that honestly; a default would stamp them
 * with a time at which nothing happened.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assistance_distributions', function (Blueprint $table) {
            $table->foreignId('intervention_id')->nullable()->after('farmer_id')
                ->constrained('agricultural_interventions')->nullOnDelete();

            $table->foreignId('farm_parcel_id')->nullable()->after('intervention_id')
                ->constrained('farm_parcels')->nullOnDelete();

            $table->timestamp('updated_at')->nullable()->after('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('assistance_distributions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('intervention_id');
            $table->dropConstrainedForeignId('farm_parcel_id');
            $table->dropColumn('updated_at');
        });
    }
};
