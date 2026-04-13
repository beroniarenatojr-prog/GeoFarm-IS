<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwineHybrid extends Model
{
    protected $table = 'swine_hybrid';

    protected $fillable = [
        'farmer_id',
        'variety',
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
        static::saving(function (SwineHybrid $swine) {
            $total = $swine->male_count + $swine->female_count;
            $swine->is_large_raiser = $total > 20;
        });
    }
}
