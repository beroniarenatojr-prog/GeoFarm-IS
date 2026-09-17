<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One thing a staff member actually did, on one day.
 *
 * The intervention carries `reason` — why the system suggested the work — and
 * `action_taken`, a single closing summary. This table is the record of the
 * work itself: a drought concern is rarely one visit, and the second and third
 * need to be their own events rather than appended to one another inside a
 * textarea.
 *
 * Nothing here is ever written by the system. A row exists because a person
 * recorded something they did.
 */
class InterventionAction extends Model
{
    protected $fillable = [
        'agricultural_intervention_id',
        'action_date',
        'performed_by',
        'action',
        'result',
        'farmer_response',
        'resources_provided',
        'next_action',
    ];

    protected $casts = [
        // A date, not a datetime: staff record the day a visit happened, often
        // afterwards, and the hour is neither known nor useful.
        'action_date' => 'date',
    ];

    public function intervention(): BelongsTo
    {
        return $this->belongsTo(AgriculturalIntervention::class, 'agricultural_intervention_id');
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
