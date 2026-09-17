<?php

namespace App\Models;

use App\Services\WorkflowIntegrity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * A generated recommendation the office can review, act on and close.
 *
 * This does not replace ClimateRiskAssessment::$recommendations. That JSON
 * column stays exactly as it is — it is the snapshot shown beside an
 * assessment, rebuilt from config whenever the analysis runs. What it cannot
 * hold is a decision: once staff accept or reject advice, that has to survive
 * the next run, and a cached array regenerated from the current config would
 * lose it. Hence a row.
 *
 * Two principles are enforced here rather than left to callers:
 *
 *   1. The wording is a historical snapshot. title, reason, priority and the
 *      evidence fields are written once, at generation, and are never rewritten
 *      when the config wording is revised. A recommendation that silently
 *      reworded itself would misreport why a decision was made months ago.
 *
 *   2. Generation is idempotent. See fingerprintFor() and remember().
 */
class Recommendation extends Model
{
    /** Mirrors ClimateRiskAssessment::SCOPES — the same four things can be advised on. */
    public const SCOPE_FARMER      = 'farmer';
    public const SCOPE_PARCEL      = 'parcel';
    public const SCOPE_LIVESTOCK   = 'livestock';
    public const SCOPE_AQUACULTURE = 'aquaculture';

    public const SCOPES = [
        self::SCOPE_FARMER,
        self::SCOPE_PARCEL,
        self::SCOPE_LIVESTOCK,
        self::SCOPE_AQUACULTURE,
    ];

    /** Scopes that name one activity rather than the whole holding. */
    public const ACTIVITY_SCOPES = [
        self::SCOPE_PARCEL,
        self::SCOPE_LIVESTOCK,
        self::SCOPE_AQUACULTURE,
    ];

    public const PRIORITIES = ['low', 'medium', 'high'];

    public const EVIDENCE_SOURCES = ['assessment', 'history', 'baseline', 'missing_evidence'];

    /**
     * How much evidence stood behind this.
     *
     * ProductionHistory — which is where this value comes from — spells the
     * empty case 'none'. The workflow spells it 'insufficient'. Rather than
     * change either, normaliseSufficiency() maps the one onto the other at the
     * boundary, so neither vocabulary has to move.
     */
    public const SUFFICIENCY_SUFFICIENT   = 'sufficient';
    public const SUFFICIENCY_LIMITED      = 'limited';
    public const SUFFICIENCY_INSUFFICIENT = 'insufficient';

    public const SUFFICIENCIES = [
        self::SUFFICIENCY_SUFFICIENT,
        self::SUFFICIENCY_LIMITED,
        self::SUFFICIENCY_INSUFFICIENT,
    ];

    public const STATUS_NEW       = 'new';
    public const STATUS_REVIEWED  = 'reviewed';
    public const STATUS_ACCEPTED  = 'accepted';
    public const STATUS_REJECTED  = 'rejected';
    public const STATUS_CONVERTED = 'converted';
    public const STATUS_CLOSED    = 'closed';

    public const STATUSES = [
        self::STATUS_NEW,
        self::STATUS_REVIEWED,
        self::STATUS_ACCEPTED,
        self::STATUS_REJECTED,
        self::STATUS_CONVERTED,
        self::STATUS_CLOSED,
    ];

    /**
     * Statuses that mean a person has already dealt with this.
     *
     * Re-generation must never disturb a row in one of these — that is the
     * "do not resurrect a rejected recommendation" rule, and remember() honours
     * it by never writing to a row that already exists.
     */
    public const SETTLED_STATUSES = [
        self::STATUS_ACCEPTED,
        self::STATUS_REJECTED,
        self::STATUS_CONVERTED,
        self::STATUS_CLOSED,
    ];

    /** The version tag inside the fingerprint. Bump only to deliberately re-key. */
    private const FINGERPRINT_VERSION = 'v1';

    protected $fillable = [
        'farmer_id', 'climate_risk_assessment_id', 'farm_parcel_id', 'fishpond_id',
        'scope_type', 'factor_key',
        'title', 'reason', 'priority', 'category',
        'evidence_source', 'data_sufficiency',
        'status', 'reviewed_by', 'reviewed_at', 'intervention_id',
        'generated_at', 'fingerprint',
    ];

    protected $casts = [
        'reviewed_at'  => 'datetime',
        'generated_at' => 'datetime',
    ];

    /**
     * Mirrors the column defaults, for the same reason FollowUp does: Eloquent
     * does not read database defaults, so without these a new model carries
     * nulls in memory and anything inspecting it before a reload sees a
     * recommendation with no scope, priority or status.
     */
    protected $attributes = [
        'scope_type' => self::SCOPE_FARMER,
        'priority'   => 'medium',
        'status'     => self::STATUS_NEW,
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            $model->fingerprint ??= static::fingerprintFor($model->attributesToArray());
            $model->generated_at ??= now();
        });

        /*
         * Ownership and scope are checked on the model, not in a form request.
         *
         * A controller can forget a rule; a saving hook cannot be gone round.
         * Every path that writes a recommendation passes through here.
         */
        static::saving(function (self $model) {
            app(WorkflowIntegrity::class)->assertRecommendationScope($model);
        });
    }

    /**
     * The deterministic identity of one piece of advice.
     *
     * Everything that makes two recommendations genuinely different goes in,
     * farmer_id included: without it, the same factor raised for two farmers
     * with no assessment behind it would collide and the second farmer would
     * silently get no recommendation.
     *
     * A new assessment yields a new fingerprint, which is what allows a fresh
     * assessment to raise the same advice again as a new snapshot.
     *
     * Flattened into one string because the equivalent composite UNIQUE index
     * does not work: three of these columns are nullable and MySQL treats every
     * NULL as distinct, so identical farmer-scope rows would not collide.
     */
    public static function fingerprintFor(array $attributes): string
    {
        $parts = [
            self::FINGERPRINT_VERSION,
            $attributes['farmer_id'] ?? '',
            $attributes['climate_risk_assessment_id'] ?? '',
            $attributes['scope_type'] ?? self::SCOPE_FARMER,
            $attributes['farm_parcel_id'] ?? '',
            $attributes['fishpond_id'] ?? '',
            $attributes['factor_key'] ?? '',
        ];

        return hash('sha256', implode('|', $parts));
    }

    /**
     * Record this advice once, and only once.
     *
     * Returns the existing row untouched when one is already there — which is
     * what keeps a rejected or closed recommendation from being resurrected,
     * and what keeps the snapshot wording from being rewritten when the config
     * text changes.
     *
     * The catch covers two callers racing on the same fingerprint: the unique
     * index refuses the second, and it reads back what the first wrote.
     */
    public static function remember(array $attributes): self
    {
        $fingerprint = static::fingerprintFor($attributes);

        if ($existing = static::where('fingerprint', $fingerprint)->first()) {
            return $existing;
        }

        try {
            return static::create($attributes + ['fingerprint' => $fingerprint]);
        } catch (UniqueConstraintViolationException) {
            return static::where('fingerprint', $fingerprint)->firstOrFail();
        }
    }

    /**
     * Translate ProductionHistory's vocabulary into this table's.
     *
     * Its 'none' and this table's 'insufficient' name the same condition: no
     * usable history. Mapping here means neither side has to change.
     */
    public static function normaliseSufficiency(?string $value): ?string
    {
        return match ($value) {
            null, ''                     => null,
            'none'                       => self::SUFFICIENCY_INSUFFICIENT,
            default                      => in_array($value, self::SUFFICIENCIES, true) ? $value : null,
        };
    }

    /**
     * Open this advice as work for the office.
     *
     * The two records stay separate concepts: the recommendation is what the
     * analysis suggested, the intervention is what the office decided to do.
     * Converting links them and marks the advice dealt with; it does not make
     * the advice into the work, and it does not pretend the work happened.
     *
     * The new intervention opens at STATUS_PENDING and nothing here writes
     * action_taken, completed_at or completed_by. Only a staff member closing
     * the record does that — a suggestion must never stand as evidence that
     * somebody went out.
     *
     * Already-converted advice returns its existing intervention rather than
     * opening a second one.
     */
    public function convertToIntervention(array $attributes = [], ?User $by = null): AgriculturalIntervention
    {
        if ($this->intervention_id && $existing = $this->intervention) {
            return $existing;
        }

        $intervention = AgriculturalIntervention::create(array_merge([
            'farmer_id'                  => $this->farmer_id,
            'farm_parcel_id'             => $this->farm_parcel_id,
            'climate_risk_assessment_id' => $this->climate_risk_assessment_id,
            'factor_key'                 => $this->factor_key,
            'type'                       => 'farm_visit',
            'priority'                   => $this->priority ?? 'medium',
            // Frozen from the recommendation that prompted it, so the queue can
            // still say why months later even after the config wording moves on.
            'reason'                     => $this->reason,
            'created_by'                 => $by?->id,
        ], $attributes));

        $this->forceFill([
            'intervention_id' => $intervention->id,
            'status'          => self::STATUS_CONVERTED,
            'reviewed_by'     => $by?->id ?? $this->reviewed_by,
            'reviewed_at'     => $this->reviewed_at ?? now(),
        ])->save();

        return $intervention;
    }

    /** Still waiting on somebody. */
    public function scopeOutstanding(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_NEW, self::STATUS_REVIEWED]);
    }

    public function scopeForFarmer(Builder $query, int $farmerId): Builder
    {
        return $query->where('farmer_id', $farmerId);
    }

    public function farmer(): BelongsTo       { return $this->belongsTo(Farmer::class); }
    public function assessment(): BelongsTo   { return $this->belongsTo(ClimateRiskAssessment::class, 'climate_risk_assessment_id'); }
    public function parcel(): BelongsTo       { return $this->belongsTo(FarmParcel::class, 'farm_parcel_id'); }
    public function fishpond(): BelongsTo     { return $this->belongsTo(Fishpond::class); }
    public function intervention(): BelongsTo { return $this->belongsTo(AgriculturalIntervention::class, 'intervention_id'); }
    public function reviewer(): BelongsTo     { return $this->belongsTo(User::class, 'reviewed_by'); }
}
