<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TreeCrop extends Model
{
    public const STATUS_BEARING = 'bearing';
    public const STATUS_NON_BEARING = 'non_bearing';

    protected $fillable = [
        'farmer_id',
        'crop_type',
        'quantity',
        'area_hectares',
        'age_years',
        'status',
        'parcel_id',
        'notes',
    ];

    protected $casts = [
        'quantity'      => 'integer',
        'area_hectares' => 'decimal:2',
        'age_years'     => 'integer',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function parcel(): BelongsTo
    {
        return $this->belongsTo(FarmParcel::class, 'parcel_id');
    }

    /** Planted but not yet productive — excluded from harvest projections. */
    public function isBearing(): bool
    {
        return $this->status === self::STATUS_BEARING;
    }
}
