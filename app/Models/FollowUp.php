<?php

namespace App\Models;

use App\Services\WorkflowIntegrity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A scheduled check after a visit or a hand-out.
 *
 * agricultural_interventions.follow_up_date and follow_up_notes are untouched
 * and still work: they are the intervention's own shorthand for "when to look
 * again". This is the log — several checks over time, each with an assignee,
 * an outcome and a status, each able to point at the next.
 *
 * There is no 'due' status and there is no due column.
 *
 * Due is not a decision anybody makes; it is a scheduled check whose date has
 * passed. Storing it would need something to run every night, and any night
 * that job did not run the table would quietly be wrong. It is derived instead,
 * by isDue() and scopeDue(), so it is correct at the moment it is read.
 */
class FollowUp extends Model
{
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_MISSED    = 'missed';
    public const STATUS_CANCELLED = 'cancelled';

    /** The four stored statuses. 'due' is deliberately absent — see the class docblock. */
    public const STATUSES = [
        self::STATUS_SCHEDULED,
        self::STATUS_COMPLETED,
        self::STATUS_MISSED,
        self::STATUS_CANCELLED,
    ];

    /** How far a chain is walked before it is called circular. */
    public const MAX_CHAIN_DEPTH = 50;

    protected $fillable = [
        'farmer_id',
        'agricultural_intervention_id',
        'assistance_distribution_id',
        'farm_parcel_id',
        'scheduled_for',
        'status',
        'assigned_to',
        'observations',
        'outcome',
        'notes',
        'completed_at',
        'completed_by',
        'created_by',
        'next_follow_up_id',
    ];

    protected $casts = [
        'scheduled_for' => 'date',
        'completed_at'  => 'datetime',
    ];

    /**
     * Mirrors the column default so a freshly made model agrees with a stored
     * one.
     *
     * The database default alone is not enough: Eloquent does not know about it,
     * so status is null in memory until the row is read back, and is_due — which
     * tests status — would quietly answer false for a follow-up that is plainly
     * overdue.
     */
    protected $attributes = [
        'status' => self::STATUS_SCHEDULED,
    ];

    protected $appends = ['is_due'];

    protected static function booted(): void
    {
        /*
         * Ownership, scope and chain safety are enforced on the model rather
         * than in a form request, so no controller can write a follow-up that
         * points at another farmer's records by forgetting a rule.
         */
        static::saving(function (self $model) {
            app(WorkflowIntegrity::class)->assertFollowUpConsistency($model);
        });
    }

    /**
     * Overdue, worked out now rather than stored.
     *
     * A check that has been completed, missed or cancelled is never due, however
     * old it is — only something still scheduled can fall behind.
     */
    public function getIsDueAttribute(): bool
    {
        return $this->status === self::STATUS_SCHEDULED
            && $this->scheduled_for !== null
            && $this->scheduled_for->startOfDay()->isBefore(now()->startOfDay());
    }

    /** Scheduled, and the date has passed. */
    public function scopeDue(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SCHEDULED)
            ->whereDate('scheduled_for', '<', now()->toDateString());
    }

    /** Scheduled, and still ahead of us. */
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SCHEDULED)
            ->whereDate('scheduled_for', '>=', now()->toDateString());
    }

    public function farmer(): BelongsTo       { return $this->belongsTo(Farmer::class); }
    public function intervention(): BelongsTo { return $this->belongsTo(AgriculturalIntervention::class, 'agricultural_intervention_id'); }
    public function parcel(): BelongsTo       { return $this->belongsTo(FarmParcel::class, 'farm_parcel_id'); }
    public function assignee(): BelongsTo     { return $this->belongsTo(User::class, 'assigned_to'); }
    public function completer(): BelongsTo    { return $this->belongsTo(User::class, 'completed_by'); }
    public function creator(): BelongsTo      { return $this->belongsTo(User::class, 'created_by'); }
    public function next(): BelongsTo         { return $this->belongsTo(self::class, 'next_follow_up_id'); }

    /** The hand-out this check follows, when it follows one. */
    public function assistanceRecord(): BelongsTo
    {
        return $this->belongsTo(AssistanceDistribution::class, 'assistance_distribution_id');
    }

    /** Checks that point at this one as their next step. */
    public function previous(): HasMany
    {
        return $this->hasMany(self::class, 'next_follow_up_id');
    }
}
