<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FarmParcel;
use App\Services\ParcelBoundaryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class GISController extends Controller
{
    public function index()
    {
        $parcels = FarmParcel::with('farmer')
            ->select('id', 'parcel_number', 'farmer_id', 'barangay', 'total_area_ha', 'geojson_data')
            ->get();

        return Inertia::render('Admin/GIS/MapIndex', [
            'parcels' => $parcels,
        ]);
    }

    /**
     * Everything worth knowing about one parcel, fetched when it is clicked.
     *
     * Deliberately not folded into the parcels GeoJSON: that col6ction is
     * loaded in full on every map open, and carrying each farmer's crops,
     * livestock and assistance history in it would grow the payload with the
     * registry while almost none of it is ever looked at.
     *
     * Sections come back only when they hold something. The panel renders what
     * it is given, so an empty array is simply a section that does not appear -
     * a farmer with no fishpond should not see an empty Fishpond heading.
     */
    public function show(FarmParcel $parcel)
    {
        // One query per relationship rather than one per row. Crop seasons hang
        // off the parcel; the livestock and asset records hang off the farmer.
        $parcel->load([
            'farmType',
            'seasons.crop',
            'farmer.livestock.livestockType',
            'farmer.treeCrops',
            'farmer.fishponds',
            'farmer.associations',
            'farmer.distributions.program',
        ]);

        $farmer = $parcel->farmer;

        return response()->json([
            'parcel' => [
                'id'            => $parcel->id,
                'parcel_number' => $parcel->parcel_number,
                'barangay'      => $parcel->barangay,
                'recorded_area' => $parcel->total_area_ha,
                'farm_type'     => $parcel->farmType?->type_name,
                'commodity'     => $parcel->commodity,
                'ownership'     => $parcel->ownership_type,
            ],

            'farmer' => $farmer ? [
                'id'       => $farmer->id,
                'name'     => $farmer->full_name,
                'sex'      => $farmer->sex,
                'contact'  => $farmer->mobile_no,
                'barangay' => $farmer->barangay,
                'rsbsa_no' => $farmer->rsbsa_no,
                // A web path, never a filesystem one: the column stores the
                // path relative to the public disk, which is served through
                // the storage symlink.
                'photo_url' => $farmer->photo_path ? '/storage/' . $farmer->photo_path : null,
            ] : null,

            'crop_seasons' => $parcel->seasons->map(fn ($season) => [
                'crop'          => $season->crop?->crop_name,
                'season'        => $season->season,
                'year'          => $season->cropping_year,
                'area_planted'  => $season->area_planted_ha,
                'yield_kg'      => $season->yield_kg,
            ])->values(),

            'livestock' => $farmer?->livestock->map(fn ($animal) => [
                'type'   => $animal->livestockType?->type_name,
                'breed'  => $animal->breed,
                'count'  => $animal->count,
            ])->values() ?? [],

            'tree_crops' => $farmer?->treeCrops->map(fn ($tree) => [
                'crop'     => $tree->crop_type,
                'quantity' => $tree->quantity,
                'area'     => $tree->area_hectares,
            ])->values() ?? [],

            'fishponds' => $farmer?->fishponds->map(fn ($pond) => [
                'species' => $pond->species,
                'area'    => $pond->area_hectares,
            ])->values() ?? [],

            'associations' => $farmer?->associations->pluck('association_name')->values() ?? [],

            'assistance' => $farmer?->distributions->map(fn ($given) => [
                'program'  => $given->program?->program_name,
                'status'   => $given->status,
                'quantity' => $given->quantity_given,
                'date'     => $given->distribution_date,
            ])->values() ?? [],
        ]);
    }

    /**
     * Save a boundary drawn by hand on the map.
     *
     * Goes through ParcelBoundaryService so a drawn outline lands in exactly
     * the same places an imported one does: the spatial `geom` column that is
     * the source of truth, the `geojson_data` mirror the overlay reads, the
     * recorded area, and the provenance.
     *
     * This previously wrote geojson_data alone. Once geom became the source of
     * truth that left a drawn boundary invisible to the parcel form and to
     * overlap checking — it looked as though drawing had not worked at all.
     */
    public function saveGeometry(Request $request, $id, ParcelBoundaryService $boundaries)
    {
        $request->validate([
            'geojson' => 'required|json',
        ]);

        $geometry = json_decode($request->input('geojson'), true);

        try {
            $boundaries->validateGeometry($geometry);
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $parcel = FarmParcel::findOrFail($id);

        $boundaries->store($parcel, $geometry, [
            'source' => 'drawn',
            'file'   => null,
            // A sketch must not overwrite an area that may have come off a
            // land title; the sidebar shows drawn area separately.
            'overwrite_area' => false,
        ], $request->user()?->id);

        $area = $boundaries->areaHectares($geometry);

        return back()->with('success', "Farm boundary saved — {$area} ha.");
    }

    public function getParcelsGeoJSON()
    {
        // farmType is loaded for the popup's crop line. geojson_data is kept in
        // step with the spatial geom column by ParcelBoundaryService, so an
        // imported boundary appears here without a second write path.
        $parcels = FarmParcel::with(['farmer', 'farmType'])
            ->whereNotNull('geojson_data')
            ->get();

        $features = [];
        foreach ($parcels as $parcel) {
            if ($parcel->geojson_data) {
                $geometry = json_decode($parcel->geojson_data, true);
                
                $features[] = [
                    'type' => 'Feature',
                    // Top-level id as well as the one in properties: this is
                    // what setFeatureState addresses a feature by, and giving
                    // it here is the plain GeoJSON way. The alternative,
                    // promoteId on the source, lifts the property instead but
                    // is one more thing that has to be right for a parcel to
                    // draw at all.
                    'id' => $parcel->id,
                    'geometry' => $geometry,
                    'properties' => [
                        'id' => $parcel->id,
                        'parcel_number' => $parcel->parcel_number ?? 'N/A',
                        // null, not 'Unknown' — the map needs to tell an
                        // unassigned parcel from one whose farmer failed to
                        // load, and only one of those is a job for staff.
                        'farmer_id'   => $parcel->farmer_id,
                        'farmer_name' => $parcel->farmer
                            ? trim($parcel->farmer->first_name . ' ' . $parcel->farmer->last_name)
                            : null,
                        'rsbsa_no'    => $parcel->farmer?->rsbsa_no,
                        'barangay' => $parcel->barangay,
                        'area_ha' => $parcel->total_area_ha,
                        'commodity' => $parcel->commodity,
                        'farm_type' => $parcel->farmType?->type_name,
                        // Lets the popup say whether this outline was surveyed
                        // or sketched by hand — they should not read alike.
                        'boundary_source' => $parcel->boundary_source,
                    ],
                ];
            }
        }

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }

    public function deleteGeometry($id)
    {
        $parcel = FarmParcel::findOrFail($id);
        $parcel->geojson_data = null;
        $parcel->save();

        return back()->with('success', 'Farm boundary deleted successfully.');
    }
}
