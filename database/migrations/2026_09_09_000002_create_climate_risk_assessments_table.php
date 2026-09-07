<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One completed climate and financial risk questionnaire.
 *
 * A row is a point in time, not a farmer's standing: re-assessing writes a new
 * row and leaves the old one alone, so the office can see how a holding's
 * exposure changed and the research keeps its history. Nothing here is written
 * back onto the farmer.
 *
 * The financial figures the instrument asks for (production cost and income)
 * are deliberately NOT stored here. They already live on crop_seasons, which
 * is one parcel x crop x season x year; asking again would create a second
 * copy free to disagree with the first. The assessment points at the season
 * instead and reads them from there.
 *
 * Scale answers are plain strings rather than MySQL enums. This is a research
 * instrument: option lists get revised between rounds, and an enum makes each
 * revision a schema migration on a table that will already hold responses.
 * The allowed values live on the model, where the questionnaire and the
 * validation can share one definition.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('climate_risk_assessments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();

            // Which holding was assessed. Nullable because a farmer may be
            // assessed before their parcels have been encoded.
            $table->foreignId('farm_parcel_id')->nullable()->constrained('farm_parcels')->nullOnDelete();

            // The completed cropping this assessment speaks to. This is the
            // link to the financial outcome - cost, income, profit or loss -
            // so none of it is duplicated here.
            $table->foreignId('crop_season_id')->nullable()->constrained('crop_seasons')->nullOnDelete();

            // Who filled it in: the farmer themselves, or office staff sitting
            // with them. Needed to read a response honestly.
            $table->foreignId('assessed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assessed_at')->useCurrent();

            // A. Climate and weather experience, last three years
            $table->json('climate_events')->nullable();          // Q1
            $table->string('flood_frequency', 30)->nullable();    // Q2
            $table->string('drought_frequency', 30)->nullable();  // Q3
            $table->string('heat_frequency', 30)->nullable();     // Q4
            $table->string('storm_frequency', 30)->nullable();    // Q5

            // B. Effects on production
            $table->string('worst_effect', 40)->nullable();       // Q6
            $table->json('loss_types')->nullable();               // Q7
            $table->string('had_financial_loss', 20)->nullable(); // Q8
            $table->decimal('estimated_loss_amount', 12, 2)->nullable();
            $table->string('had_cost_increase', 20)->nullable();  // Q9
            $table->decimal('estimated_extra_cost', 12, 2)->nullable();

            // C. Q10 and Q11 are read from crop_seasons. Only the farmer's own
            // comparison of the season is theirs to give.
            $table->string('season_comparison', 30)->nullable();  // Q12

            // D. Adaptation
            $table->json('adaptation_practices')->nullable();      // Q13
            $table->string('adaptation_effectiveness', 30)->nullable(); // Q14
            $table->string('adaptation_barrier', 60)->nullable();  // Q15

            // E. Climate-related assistance
            $table->string('received_assistance', 20)->nullable(); // Q16
            $table->json('assistance_types')->nullable();          // Q17
            $table->string('assistance_helpfulness', 30)->nullable(); // Q18

            // F. The farmer's own expectation. Recorded as a response, never
            // used as the prediction target - it is what they believe, which
            // is a different thing from what the figures show.
            $table->string('perceived_risk', 30)->nullable();      // Q19
            $table->json('anticipated_factors')->nullable();       // Q20

            $table->timestamps();

            // "The latest assessment for this farmer" is the portal's only
            // question of this table, and it asks on every page load.
            $table->index(['farmer_id', 'assessed_at'], 'idx_assessments_farmer_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('climate_risk_assessments');
    }
};
