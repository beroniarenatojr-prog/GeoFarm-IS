<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Poultry extends Model
{
    protected $table = 'poultry';

    protected $fillable = [
        'farmer_id',
        'bird_type',
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
        static::saving(function (Poultry $poultry) {
            $total = $poultry->male_count + $poultry->female_count;
            $poultry->is_large_raiser = $total > 20;
        });
    }
}
