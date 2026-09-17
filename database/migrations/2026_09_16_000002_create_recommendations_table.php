<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A recommendation the office can act on, review and close.
 *
 * Recommendations were already being produced — ClimateRecommendationEngine
 * generates them from config/climate_risk.php and they are cached as JSON on
 * climate_risk_assessments.recommendations. That column stays exactly as it
 * is: it is the snapshot shown alongside an assessment, and nothing here
 * replaces it.
 *
 * What a JSON blob regenerated from config cannot hold is review state. Once
 * staff mark a recommendation accepted, rejected or converted, that decision
 * has to survive the next time the engine runs — and a cached array that is
 * rebuilt from the current config on every analysis would lose it. That is the
 * whole reason this table exists.
 *
 * The wording is frozen on insert, for the same reason
 * agricultural_interventions.reason is frozen: the office revises the config
 * text, and a recommendation that silently reworded itself months later would
 * misreport why a decision was made.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recommendations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();

            /*
             * What produced this. Nullable because a recommendation can come
             * from parcel analysis alone, with no questionnaire behind it.
             * nullOnDelete rather than cascade: if an assessment is removed,
             * the office's decision about the advice must outlive it.
             */
            $table->foreignId('climate_risk_assessment_id')->nullable()
                ->constrained('climate_risk_assessments')->nullOnDelete();

            // What the advice is about. Exactly one of these is set for an
            // activity-scoped recommendation; both are null at farmer scope.
            $table->foreignId('farm_parcel_id')->nullable()
                ->constrained('farm_parcels')->nullOnDelete();
            $table->foreignId('fishpond_id')->nullable()
                ->constrained('fishponds')->nullOnDelete();

            $table->string('scope_type', 20)->default('farmer');

            // The config rule that raised it — 'no_water', 'seed_cost' and so
            // on. Kept so a closed recommendation can still be traced to its
            // rule after the wording is revised.
            $table->string('factor_key', 60)->nullable();

            /*
             * Frozen at generation. See the class docblock.
             */
            $table->string('title', 255);
            $table->string('reason', 255);
            $table->string('priority', 10)->default('medium');
            $table->string('category', 40)->nullable();

            /*
             * Where the evidence came from, and how much of it there was.
             *
             * data_sufficiency carries ProductionHistory's own vocabulary —
             * sufficient / limited / none — so a recommendation raised on thin
             * evidence says so on its face rather than reading as settled.
             */
            $table->string('evidence_source', 40)->nullable();
            $table->string('data_sufficiency', 20)->nullable();

            // new | reviewed | accepted | rejected | converted | closed
            $table->string('status', 20)->default('new');

            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            // Set when staff turn this into work. nullOnDelete so removing an
            // intervention does not take the recommendation with it.
            $table->foreignId('intervention_id')->nullable()
                ->constrained('agricultural_interventions')->nullOnDelete();

            $table->timestamp('generated_at')->useCurrent();

            /*
             * Idempotency.
             *
             * Re-running the analysis for an assessment must not duplicate
             * advice that is already on the queue, and must never resurrect
             * something staff have already rejected or closed.
             *
             * The natural key is
             *   (assessment, factor_key, scope_type, parcel, fishpond)
             * but a composite UNIQUE over it does not work: three of those
             * columns are nullable, and MySQL treats every NULL as distinct,
             * so identical farmer-scope rows — where parcel and fishpond are
             * both NULL — insert freely. Measured on this database: three
             * identical rows, none blocked.
             *
             * So the natural key is flattened into one NOT NULL column and
             * made unique there. One column and one index is the smallest
             * thing that actually enforces the rule, and being a real database
             * constraint it also survives a double submit, which application
             * checks alone would not.
             *
             * A new assessment produces a different fingerprint, which is what
             * lets a fresh assessment raise the same advice again as a new
             * snapshot.
             */
            $table->char('fingerprint', 64)->unique('uq_recommendations_fingerprint');

            $table->timestamps();

            // The office reads its queue by farmer, and by what is outstanding.
            $table->index(['farmer_id', 'status'], 'idx_recommendations_farmer');
            $table->index(['status', 'priority'], 'idx_recommendations_queue');
            $table->index('climate_risk_assessment_id', 'idx_recommendations_assessment');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recommendations');
    }
};
