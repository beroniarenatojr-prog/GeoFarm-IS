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
                    'geometry' => $geometry,
                    'properties' => [
                        'id' => $parcel->id,
                        'parcel_number' => $parcel->parcel_number ?? 'N/A',
                        'farmer_name' => $parcel->farmer ? $parcel->farmer->first_name . ' ' . $parcel->farmer->last_name : 'Unknown',
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
