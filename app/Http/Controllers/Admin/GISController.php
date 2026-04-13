<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FarmParcel;
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

    public function saveGeometry(Request $request, $id)
    {
        $request->validate([
            'geojson' => 'required|json',
        ]);

        $parcel = FarmParcel::findOrFail($id);
        $parcel->geojson_data = $request->input('geojson');
        $parcel->save();

        return back()->with('success', 'Farm boundary saved successfully.');
    }

    public function getParcelsGeoJSON()
    {
        $parcels = FarmParcel::with('farmer')
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
