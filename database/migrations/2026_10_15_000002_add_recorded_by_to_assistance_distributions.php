<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who assigned a farmer to a programme, and who handed the goods over.
 *
 * Two different acts by two different people. Selecting forty farmers as
 * beneficiaries is a planning decision; confirming that one of them actually
 * received a sack of fertiliser is a custody decision — and when a hand-out is
 * later queried, "who recorded this" is the first question asked. Until now
 * the table answered neither.
 *
 * Both nullable and nullOnDelete: every distribution recorded before today has
 * no attribution and must stay valid, and a staff member leaving the office
 * must not cascade away the record of what a farmer received.
 *
 * NO UNIQUE INDEX ON (assistance_id, farmer_id), deliberately.
 *
 * It looks like the obvious guard against assigning the same farmer twice, and
 * it would break a workflow this module already relies on: a forfeited record
 * means the goods went back on the shelf, so that farmer MAY be served again
 * under the same programme, and a second row is the correct outcome. The
 * existing check in AssistanceController::distribute() already refuses a
 * duplicate while ignoring forfeited rows, which is the rule the office
 * actually works to. MySQL has no partial unique index to express "unique
 * except where forfeited", so the constraint stays in the application where it
 * can be stated precisely.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assistance_distributions', function (Blueprint $table) {
            // Who put this farmer on the list.
            $table->foreignId('assigned_by')
                ->nullable()
                ->after('status')
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('assigned_at')->nullable()->after('assigned_by');

            // Who confirmed the farmer actually received it.
            $table->foreignId('recorded_by')
                ->nullable()
                ->after('assigned_at')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assistance_distributions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_by');
            $table->dropConstrainedForeignId('recorded_by');
            $table->dropColumn('assigned_at');
        });
    }
};
