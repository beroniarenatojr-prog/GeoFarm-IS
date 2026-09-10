<?php

namespace App\Models;

use App\Observers\FarmParcelObserver;
use App\Services\CommodityCatalogue;
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

        return static::applyCommodityRules($row);
    }

    /**
     * A parcel cannot be both a field and a herd.
     *
     * Heads belong to livestock; a cropping schedule describes planting. The
     * form disables whichever does not apply, but a disabled input is a
     * courtesy to the person typing — it stops nothing that is posted
     * directly, and the register would end up holding "Rice, 50 heads".
     *
     * Enforced by clearing rather than by rejecting. The incompatible value is
     * always the stale one left behind by changing the commodity, never
     * something the user meant; refusing the save would block a correction
     * over a field they cannot even see.
     *
     * An unrecognised commodity clears nothing. The register holds free text
     * entered over years, and a name this system does not know is not licence
     * to discard the figures recorded beside it.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function applyCommodityRules(array $row): array
    {
        $catalogue = app(CommodityCatalogue::class);
        $kind = $catalogue->kindOf($row['commodity'] ?? null);

        if ($kind === CommodityCatalogue::KIND_CROP) {
            $row['no_of_heads_trees'] = null;
        }

        if ($kind === CommodityCatalogue::KIND_LIVESTOCK) {
            $row['cropping_schedule'] = null;
        }

        return $row;
    }

    /**
     * Number a farmer's parcels 1, 2, 3 … in the order they were declared.
     *
     * Part 3 of the RSBSA form numbers the parcels down the page and the
     * office refers to them that way, but the form never filled the column —
     * which is why Seasonal Tracking labels parcels "No parcel no." and the
     * GIS popup reads "Parcel N/A".
     *
     * Applied to the parcels that survive the blank-row filter, never to the
     * raw rows: a discarded empty row must not leave a hole, or staff go
     * looking for a parcel 2 that was never declared.
     *
     * The number is a position on one person's form, not a serial number
     * across the municipality — two farmers both have a parcel 1. It is also
     * reassigned on every save, because the RSBSA flow replaces a farmer's
     * parcels wholesale; deleting the second of three has to renumber the
     * third rather than leave 1, 3.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    public static function numberSequentially(array $rows): array
    {
        $rows = array_values($rows);

        foreach ($rows as $position => $row) {
            $row['parcel_number'] = (string) ($position + 1);
            $rows[$position] = $row;
        }

        return $rows;
    }

    public function farmer()   { return $this->belongsTo(Farmer::class); }
    public function farmType() { return $this->belongsTo(FarmType::class); }
    public function seasons()  { return $this->hasMany(CropSeason::class, 'parcel_id'); }
}
