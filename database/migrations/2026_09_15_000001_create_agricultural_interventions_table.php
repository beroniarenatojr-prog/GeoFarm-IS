<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Work the Agriculture Office decides to do for a farmer.
 *
 * The one table this feature needs, and it is needed: a workflow with an
 * assignee, a status, a target date, what was actually done and a follow-up
 * has to persist somewhere, and none of the existing tables can hold it
 * without being turned into something it is not. assistance_distributions
 * records goods handed over, farmer_messages is a message log, and audit_logs
 * is append-only history rather than a live queue.
 *
 * The distinction the columns exist to enforce:
 *
 *   reason        - why the system suggested this
 *   action_taken  - what a person actually did
 *
 * They are separate, and action_taken is filled only by a staff member closing
 * the record. A recommendation must never stand as evidence that anything
 * happened, which is exactly what one shared column would allow.
 *
 * Nothing here is created automatically. A suggestion becomes a row only when
 * staff choose to open it, so the queue always reflects decisions people made.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agricultural_interventions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();

            // Nullable: a livestock or aquaculture concern may belong to the
            // holding rather than to one surveyed parcel.
            $table->foreignId('farm_parcel_id')->nullable()->constrained('farm_parcels')->nullOnDelete();

            /*
             * What prompted this.
             *
             * The assessment is kept so the reasoning can be traced back, and
             * nullOnDelete rather than cascade: if an assessment is ever
             * removed, the record of the office's visit must survive it.
             */
            $table->foreignId('climate_risk_assessment_id')->nullable()
                ->constrained('climate_risk_assessments')->nullOnDelete();

            // The configured factor key that raised it — 'frequent_flooding'
            // and so on. Stored so a closed intervention can still be matched
            // back to the rule, even after the wording is revised.
            $table->string('factor_key', 60)->nullable();

            $table->string('type', 40);
            $table->string('priority', 10)->default('medium');

            /*
             * Frozen at creation, deliberately.
             *
             * The office revises the wording in config, and a reason that
             * silently reworded itself afterwards would misreport why a visit
             * was made months ago.
             */
            $table->string('reason', 255);

            $table->string('status', 20)->default('pending');

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('target_date')->nullable();
            $table->text('notes')->nullable();

            // Only a person writes these two.
            $table->text('action_taken')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();

            $table->date('follow_up_date')->nullable();
            $table->text('follow_up_notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // The queue is read by status and by who it is on.
            $table->index(['status', 'priority'], 'idx_interventions_queue');
            $table->index(['farmer_id', 'status'], 'idx_interventions_farmer');
            $table->index('assigned_to', 'idx_interventions_assignee');
            $table->index('follow_up_date', 'idx_interventions_followup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agricultural_interventions');
    }
};
