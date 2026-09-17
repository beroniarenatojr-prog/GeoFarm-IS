<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What staff actually did, each time they did something.
 *
 * agricultural_interventions already carries a single action_taken field,
 * written once when the record is closed. That is enough to say how a visit
 * ended and not enough to say how it went: a drought concern is rarely one
 * visit, and the office needs the second and third to be recorded as their own
 * events rather than appended to one another in a single textarea.
 *
 * Nothing in here is ever written by the system. A row exists because a person
 * recorded something they did, which is the distinction the whole workflow
 * turns on — a recommendation is what was advised, this is what happened.
 *
 * cascadeOnDelete, unlike most links in this feature: an action has no meaning
 * apart from the intervention it belongs to, so deleting the intervention
 * takes its actions with it rather than leaving them orphaned.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intervention_actions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('agricultural_intervention_id')
                ->constrained('agricultural_interventions')->cascadeOnDelete();

            // When the work happened, which is not when the row was typed —
            // staff record visits after the fact, so created_at will not do.
            $table->date('action_date');

            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();

            // What was done. The only required narrative field: a row that
            // cannot say what happened is not a record of anything.
            $table->text('action');

            $table->text('result')->nullable();
            $table->text('farmer_response')->nullable();
            $table->text('resources_provided')->nullable();
            $table->text('next_action')->nullable();

            $table->timestamps();

            // Read as a history, newest or oldest first, for one intervention.
            $table->index(['agricultural_intervention_id', 'action_date'], 'idx_actions_intervention');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intervention_actions');
    }
};
