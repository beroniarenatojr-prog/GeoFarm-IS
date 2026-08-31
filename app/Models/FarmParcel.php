<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmParcel extends Model
{
    /**
     * geom holds raw WKB — binary, not text, and not valid UTF-8. Any response
     * that serialises a parcel would otherwise fail with "Malformed UTF-8
     * characters", because json_encode cannot represent those bytes.
     *
     * The boundary reaches the front end as GeoJSON instead: geojson_data for
     * the map overlay, or ST_AsGeoJSON(geom) where the exact stored shape is
     * needed. Nothing should ever send the column itself.
     */
    protected $hidden = ['geom'];

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
