<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One agricultural input used during one cropping.
 *
 * A season has many of these. That is the whole point: a farmer routinely
 * applies two fertilizers and more than one chemical in a single season, and
 * the columns this replaces could hold exactly one of each.
 */
class SeasonalInput extends Model
{
    /** The categories the office records against a cropping. */
    public const TYPES = [
        'fertilizer', 'herbicide', 'pesticide', 'insecticide',
        'fungicide', 'seed', 'fuel', 'other',
    ];

    /**
     * Categories that are a chemical applied to the crop.
     *
     * Grouped because the RSBSA reporting line is "chemical / input cost"
     * rather than one line per chemical class.
     */
    public const CHEMICAL_TYPES = ['herbicide', 'pesticide', 'insecticide', 'fungicide'];

    protected $fillable = [
        'crop_season_id', 'input_type', 'name', 'quantity', 'unit', 'cost', 'notes',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'cost'     => 'decimal:2',
    ];

    public function season(): BelongsTo
    {
        return $this->belongsTo(CropSeason::class, 'crop_season_id');
    }
}
