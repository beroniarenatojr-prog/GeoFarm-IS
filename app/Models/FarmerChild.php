<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FarmerChild extends Model
{
    /**
     * Named explicitly rather than left to Eloquent's inflector, which turns
     * "FarmerChild" into "farmer_children" only because it knows this
     * particular irregular plural. Too subtle to rely on.
     */
    protected $table = 'farmer_children';

    /**
     * What a child may be recorded as doing.
     *
     * Kept here rather than as a database enum so the office can revise the
     * list without a migration, and so the form and the validation read from
     * one source instead of two that can drift.
     *
     * "Other" is last and is the only one that expects a second field: the
     * list cannot cover every livelihood in Tumauini, and picking the nearest
     * wrong answer is worse than writing the right one down.
     */
    public const OCCUPATIONS = [
        'Student',
        'Farmer / Agricultural Worker',
        'Government Employee',
        'Private Employee',
        'Self-Employed / Business Owner',
        'Overseas Filipino Worker (OFW)',
        'Unemployed',
        'Other',
    ];

    protected $fillable = [
        'farmer_id', 'name', 'sex', 'birthdate',
        'occupation', 'occupation_other', 'current_location',
    ];

    protected $casts = ['birthdate' => 'date'];

    /**
     * The occupation as it should be read, with "Other" resolved.
     *
     * Saves every caller from repeating the same two-line check, and keeps
     * "Other" from ever being shown on its own — which tells the reader
     * nothing at all.
     */
    public function getOccupationLabelAttribute(): ?string
    {
        if ($this->occupation === 'Other') {
            return $this->occupation_other ?: 'Other';
        }

        return $this->occupation;
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
