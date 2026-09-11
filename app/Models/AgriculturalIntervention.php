<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    protected $appends = ['is_open', 'is_overdue', 'type_label'];

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

    public function farmer(): BelongsTo     { return $this->belongsTo(Farmer::class); }
    public function parcel(): BelongsTo     { return $this->belongsTo(FarmParcel::class, 'farm_parcel_id'); }
    public function assessment(): BelongsTo { return $this->belongsTo(ClimateRiskAssessment::class, 'climate_risk_assessment_id'); }
    public function assignee(): BelongsTo   { return $this->belongsTo(User::class, 'assigned_to'); }
    public function completer(): BelongsTo  { return $this->belongsTo(User::class, 'completed_by'); }
    public function creator(): BelongsTo    { return $this->belongsTo(User::class, 'created_by'); }
}
