<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Scheduled checks after an intervention or a hand-out.
 *
 * agricultural_interventions.follow_up_date and follow_up_notes stay exactly
 * as they are and keep working — the intervention screen reads, validates and
 * writes them today. They hold one date and one note, which is the shorthand
 * for "when to look again". This table is the log: several checks over time,
 * each with its own assignee, outcome and status, and each able to point at
 * the next one.
 *
 * Deliberately NOT stored: a 'due' status.
 *
 * Due is not a decision anyone makes, it is just a scheduled check whose date
 * has passed. Storing it would mean something had to run every night to move
 * rows into it, and any night that job did not run the table would quietly
 * lie. Derived instead:
 *
 *     status = 'scheduled' AND scheduled_for < today
 *
 * so it is correct at the moment it is read, with no scheduler to maintain.
 * The four stored statuses are scheduled, completed, missed and cancelled.
 *
 * Nothing here completes itself. completed_at and completed_by are written
 * only by a staff member closing the check.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('follow_ups', function (Blueprint $table) {
            $table->id();

            /*
             * Held directly, not read through the intervention.
             *
             * A follow-up can hang off an intervention, off an assistance
             * record, off neither, or off both, so there is no single parent
             * to inherit the farmer from. The application checks that this
             * agrees with whichever parents are supplied.
             */
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();

            // Both optional, and not mutually exclusive: a check can follow a
            // visit, a hand-out, or a visit that led to a hand-out.
            $table->foreignId('agricultural_intervention_id')->nullable()
                ->constrained('agricultural_interventions')->nullOnDelete();
            $table->foreignId('assistance_distribution_id')->nullable()
                ->constrained('assistance_distributions')->nullOnDelete();

            $table->foreignId('farm_parcel_id')->nullable()
                ->constrained('farm_parcels')->nullOnDelete();

            $table->date('scheduled_for');

            // scheduled | completed | missed | cancelled — never 'due'.
            $table->string('status', 20)->default('scheduled');

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();

            $table->text('observations')->nullable();
            $table->text('outcome')->nullable();
            $table->text('notes')->nullable();

            // Written by a person, never by the system.
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // The two questions the office asks: what is outstanding, and
            // what is on me.
            $table->index(['status', 'scheduled_for'], 'idx_followups_due');
            $table->index(['farmer_id', 'status'], 'idx_followups_farmer');
            $table->index('assigned_to', 'idx_followups_assignee');
        });

        /*
         * The chain, added separately because a table cannot reference itself
         * in the same statement that creates it.
         *
         * A completed check that needs another one points forward to it, so a
         * monitoring sequence can be walked without inferring order from
         * dates. The application rejects self-reference and cycles; the
         * database can only enforce that the target exists.
         */
        Schema::table('follow_ups', function (Blueprint $table) {
            $table->foreignId('next_follow_up_id')->nullable()->after('created_by')
                ->constrained('follow_ups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // The self-reference has to go before the table it points into.
        Schema::table('follow_ups', function (Blueprint $table) {
            $table->dropConstrainedForeignId('next_follow_up_id');
        });

        Schema::dropIfExists('follow_ups');
    }
};
