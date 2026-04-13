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

    public function parcel() { return $this->belongsTo(FarmParcel::class, 'parcel_id'); }
    public function crop()   { return $this->belongsTo(Crop::class); }
}
