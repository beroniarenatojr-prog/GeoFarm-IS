<?php

namespace App\Models\Concerns;

/**
 * Maintains the large-raiser flag for the RSBSA animal tables.
 *
 * total_heads is deliberately NOT set here: it is a STORED GENERATED column
 * (male_count + female_count), so MySQL keeps it current and rejects any
 * INSERT that tries to supply a value. It is excluded from $fillable and from
 * $casts writes for the same reason — read it, never write it.
 */
trait TracksHerdSize
{
    /** Above this, a raiser is commercial rather than backyard. */
    public const LARGE_RAISER_THRESHOLD = 20;

    protected static function bootTracksHerdSize(): void
    {
        static::saving(function ($model) {
            $heads = (int) $model->male_count + (int) $model->female_count;
            $model->is_large_raiser = $heads > self::LARGE_RAISER_THRESHOLD;
        });
    }
}
