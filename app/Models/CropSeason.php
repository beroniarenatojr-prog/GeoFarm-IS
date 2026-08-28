<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CropSeason extends Model
{
    protected $fillable = [
        'parcel_id','season','cropping_year','crop_id',
        'area_planted_ha','planting_date','harvest_date','yield_kg','inputs_used',
    ];

    protected $casts = ['inputs_used' => 'array', 'planting_date' => 'date', 'harvest_date' => 'date'];

    /**
     * Only seasons on parcels belonging to verified farmers.
     *
     * Self-registered farmers awaiting verification must not influence
     * forecasts or municipal statistics - their data has not been checked.
     */
    public function scopeForVerifiedFarmers($query)
    {
        return $query->whereHas(
            'parcel.farmer',
            fn ($q) => $q->where('verification_status', Farmer::STATUS_VERIFIED)
        );
    }

    public function parcel() { return $this->belongsTo(FarmParcel::class, 'parcel_id'); }

    public function crop()   { return $this->belongsTo(Crop::class); }
}
