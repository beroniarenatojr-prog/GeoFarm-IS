<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmParcel extends Model
{
    protected $fillable = [
        'farmer_id','parcel_number','location_address','barangay','city_municipality',
        'province','total_area_ha','geom','geojson_data','farm_type_id','ownership_type',
        'land_owner_name','within_ancestral','arb',
        // RSBSA Additional Fields
        'cropping_schedule','commodity','no_of_heads_trees','is_organic','proof_of_ownership',
    ];

    protected $casts = [
        'within_ancestral' => 'boolean', 
        'arb' => 'boolean',
        'is_organic' => 'boolean',
    ];

    public function farmer()   { return $this->belongsTo(Farmer::class); }
    public function farmType() { return $this->belongsTo(FarmType::class); }
    public function seasons()  { return $this->hasMany(CropSeason::class, 'parcel_id'); }
}
