<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Fishpond extends Model
{
    protected $fillable = [
        'farmer_id',
        'species',
        'area_hectares',
    ];

    protected $casts = [
        'area_hectares' => 'decimal:2',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
