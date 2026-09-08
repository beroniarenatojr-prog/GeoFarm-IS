<?php

namespace App\Models;

use App\Observers\FarmParcelObserver;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Model;

#[ObservedBy(FarmParcelObserver::class)]
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

    /**
     * Clean one parcel row posted by the RSBSA form.
     *
     * The form sends its parcels as a JSON blob, so Laravel's validator never
     * sees the individual fields — which is how the string "N/A" reached
     * farm_type_id, an integer foreign key, and killed every farmer save that
     * carried such a parcel with "Incorrect integer value: 'N/A'".
     *
     * Shared by the admin controller and the public registration controller
     * because both held their own copy of this normalising, and that is
     * precisely why the same bug existed in both flows at once.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function sanitiseInput(array $row): array
    {
        /*
         * A foreign key is an id or it is nothing.
         *
         * "N/A" and "" both mean the office did not choose a type, and both
         * become null. Anything non-numeric is refused for the same reason: a
         * label is not a key, and letting one through only moves the failure
         * to the database where it reads as a crash rather than as missing
         * data.
         */
        foreach (['farm_type_id'] as $key) {
            $value = $row[$key] ?? null;

            $row[$key] = is_numeric($value) ? (int) $value : null;
        }

        // Empty strings would otherwise reach decimal columns as ''.
        foreach (['total_area_ha', 'no_of_heads_trees'] as $key) {
            $value = $row[$key] ?? null;

            $row[$key] = is_numeric($value) ? $value : null;
        }

        return $row;
    }

    public function farmer()   { return $this->belongsTo(Farmer::class); }
    public function farmType() { return $this->belongsTo(FarmType::class); }
    public function seasons()  { return $this->hasMany(CropSeason::class, 'parcel_id'); }
}
