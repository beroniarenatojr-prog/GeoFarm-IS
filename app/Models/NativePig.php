<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NativePig extends Model
{
    protected $fillable = [
        'farmer_id',
        'male_count',
        'female_count',
        'is_large_raiser',
    ];

    protected $casts = [
        'male_count' => 'integer',
        'female_count' => 'integer',
        'total_heads' => 'integer',
        'is_large_raiser' => 'boolean',
    ];

    protected $appends = ['total_heads'];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function getTotalHeadsAttribute(): int
    {
        return $this->male_count + $this->female_count;
    }

    protected static function booted(): void
    {
        static::saving(function (NativePig $pig) {
            $total = $pig->male_count + $pig->female_count;
            $pig->is_large_raiser = $total > 20;
        });
    }
}
