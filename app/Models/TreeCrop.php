<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TreeCrop extends Model
{
    protected $fillable = [
        'farmer_id',
        'crop_type',
        'quantity',
        'area_hectares',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'area_hectares' => 'decimal:2',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
