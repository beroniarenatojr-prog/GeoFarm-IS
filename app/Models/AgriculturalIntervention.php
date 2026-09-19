<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Work the office decided to do, and what came of it.
 *
 * The point of this record is the gap between two things the rest of the
 * system keeps carefully apart:
 *
 *   a recommendation  - what the rules say should happen
 *   an intervention   - what the office chose to do about it
 *   action_taken      - what a person actually did
 *
 * Nothing here is ever written by the analysis. A suggestion becomes a row
 * only when staff open it, and only a staff member can close it, because a
 * system that marked its own advice as carried out would report visits that
 * never happened.
 */
class AgriculturalIntervention extends Model
{
    /** Opened, but nobody is on it yet. */
    public const STATUS_PENDING = 'pending';

    /** Someone is named. */
    public const STATUS_ASSIGNED = 'assigned';

    /** Being worked now. */
    public const STATUS_IN_PROGRESS = 'in_progress';

    /** Done, and what was done is recorded. Never reached automatically. */
    public const STATUS_COMPLETED = 'completed';

    /** Dropped, with a reason in the notes. */
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_ASSIGNED,
        self::STATUS_IN_PROGRESS,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    /** Statuses that still want somebody's attention. */
    public const OPEN_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_ASSIGNED,
        self::STATUS_IN_PROGRESS,
    ];

    public const PRIORITIES = ['high', 'medium', 'low'];

    protected $fillable = [
        'farmer_id', 'farm_parcel_id', 'climate_risk_assessment_id', 'factor_key',
        'title',
        'type', 'priority', 'reason', 'status',
        'assigned_to', 'target_date', 'notes',
        'action_taken', 'completed_at', 'completed_by',
        'follow_up_date', 'follow_up_notes', 'created_by',
    ];

    protected $casts = [
        'target_date'    => 'date',
        'follow_up_date' => 'date',
        'completed_at'   => 'datetime',
    ];

    /**
     * Mirrors the column defaults.
     *
     * Eloquent does not read database defaults, so without these a freshly
     * created intervention carries status = null in memory until it is read
     * back — and is_open, which tests status against OPEN_STATUSES, answers
     * false for a record that was just opened.
     */
    protected $attributes = [
        'status'   => self::STATUS_PENDING,
        'priority' => 'medium',
    ];

    protected $appends = ['is_open', 'is_overdue', 'type_label', 'source', 'display_title'];

    /** Raised from the risk analysis. */
    public const SOURCE_ANALYSIS = 'analysis';

    /** Raised directly by staff who already knew what was needed. */
    public const SOURCE_MANUAL = 'manual';

    /**
     * Where this intervention came from.
     *
     * Derived, not stored, for the same reason is_open is: a `source` column
     * would be free to disagree with the foreign keys that actually describe
     * the origin. An intervention raised from the analysis carries the
     * assessment it came from and the risk factor it answers; a manual one
     * carries neither, because there was no analysis to carry.
     */
    public function getSourceAttribute(): string
    {
        return ($this->climate_risk_assessment_id || $this->factor_key)
            ? self::SOURCE_ANALYSIS
            : self::SOURCE_MANUAL;
    }

    /**
     * What to call this intervention on screen.
     *
     * Manual ones are named by the staff member who raised them. Ones raised
     * from the analysis have no typed name and never did, so they keep reading
     * as they always have — "Farm visit — frequent flooding" — rather than
     * being retitled by a backfill that would put words in the office's mouth.
     */
    public function getDisplayTitleAttribute(): string
    {
        if (filled($this->title)) {
            return $this->title;
        }

        return trim($this->type_label . ' — ' . ($this->reason ?: 'no reason recorded'));
    }

    /**
     * Still on somebody's list.
     *
     * Derived rather than stored: a second column holding the same fact is a
     * column free to disagree with the status beside it.
     */
    public function getIsOpenAttribute(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    /** Past its target date and still open. A closed one is never overdue. */
    public function getIsOverdueAttribute(): bool
    {
        return $this->is_open
            && $this->target_date !== null
            && $this->target_date->isPast();
    }

    /** The office's wording for the type, from config. */
    public function getTypeLabelAttribute(): string
    {
        return config("climate_risk.intervention_types.{$this->type}.label", ucfirst(str_replace('_', ' ', (string) $this->type)));
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }

    /** Highest priority first, then the oldest target date. */
    public function scopeInWorkOrder($query)
    {
        return $query
            ->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
            ->orderByRaw('target_date IS NULL, target_date')
            ->orderBy('id');
    }

    /**
     * Every recorded visit, call or piece of work, in order.
     *
     * This does not replace action_taken, which stays as the single closing
     * summary the intervention screen already reads and writes. These are the
     * individual events that led up to it.
     */
    public function actions(): HasMany
    {
        return $this->hasMany(InterventionAction::class)->orderBy('action_date');
    }

    /**
     * Scheduled checks after the work.
     *
     * follow_up_date and follow_up_notes on this table are untouched and still
     * drive the existing screen; this is the multi-row log beside them.
     */
    public function followUps(): HasMany
    {
        return $this->hasMany(FollowUp::class)->orderBy('scheduled_for');
    }

    /** Goods or cash handed over because of this intervention, if any were. */
    public function assistanceRecords(): HasMany
    {
        return $this->hasMany(AssistanceDistribution::class, 'intervention_id');
    }

    /** The advice this was opened from, when it was opened from one. */
    public function recommendation(): HasOne
    {
        return $this->hasOne(Recommendation::class, 'intervention_id');
    }

    public function farmer(): BelongsTo     { return $this->belongsTo(Farmer::class); }
    public function parcel(): BelongsTo     { return $this->belongsTo(FarmParcel::class, 'farm_parcel_id'); }
    public function assessment(): BelongsTo { return $this->belongsTo(ClimateRiskAssessment::class, 'climate_risk_assessment_id'); }
    public function assignee(): BelongsTo   { return $this->belongsTo(User::class, 'assigned_to'); }
    public function completer(): BelongsTo  { return $this->belongsTo(User::class, 'completed_by'); }
    public function creator(): BelongsTo    { return $this->belongsTo(User::class, 'created_by'); }
}
