<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FarmParcel;
use App\Models\Farmer;
use App\Models\FarmType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ParcelController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Parcels/Index', [
            'parcels' => FarmParcel::with(['farmer', 'farmType'])->paginate(20),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Parcels/Form', [
            'farmers'   => Farmer::select('id', 'first_name', 'last_name')->orderBy('last_name')->get(),
            'farmTypes' => FarmType::all(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'farmer_id'         => 'required|exists:farmers,id',
            'parcel_number'     => 'nullable|string|max:20',
            'location_address'  => 'nullable|string',
            'barangay'          => 'nullable|string|max:50',
            'city_municipality' => 'nullable|string|max:50',
            'province'          => 'nullable|string|max:50',
            'total_area_ha'     => 'nullable|numeric',
            'farm_type_id'      => 'nullable|exists:farm_types,id',
            'ownership_type'    => 'nullable|in:Registered Owner,Lessee,Tenant,Other',
            'land_owner_name'   => 'nullable|string|max:100',
            'within_ancestral'  => 'boolean',
            'arb'               => 'boolean',
            'geojson'           => 'nullable|string', // GeoJSON from Leaflet
        ]);

        $parcel = FarmParcel::create($data);

        // Store geometry from GeoJSON if provided
        if (!empty($data['geojson'])) {
            DB::statement(
                "UPDATE farm_parcels SET geom = ST_GeomFromGeoJSON(?) WHERE id = ?",
                [$data['geojson'], $parcel->id]
            );
        }

        return redirect()->route('admin.parcels.index')->with('success', 'Parcel added.');
    }

    public function edit(FarmParcel $parcel)
    {
        // Get GeoJSON from geometry for Leaflet
        $geo = DB::selectOne("SELECT ST_AsGeoJSON(geom) as geojson FROM farm_parcels WHERE id = ?", [$parcel->id]);

        return Inertia::render('Admin/Parcels/Form', [
            'parcel'    => $parcel->load('farmer'),
            'geojson'   => $geo?->geojson,
            'farmers'   => Farmer::select('id', 'first_name', 'last_name')->orderBy('last_name')->get(),
            'farmTypes' => FarmType::all(),
        ]);
    }

    public function update(Request $request, FarmParcel $parcel)
    {
        $data = $request->validate([
            'farmer_id'        => 'required|exists:farmers,id',
            'total_area_ha'    => 'nullable|numeric',
            'farm_type_id'     => 'nullable|exists:farm_types,id',
            'ownership_type'   => 'nullable|in:Registered Owner,Lessee,Tenant,Other',
            'within_ancestral' => 'boolean',
            'arb'              => 'boolean',
            'geojson'          => 'nullable|string',
        ]);

        $parcel->update($data);

        if (!empty($data['geojson'])) {
            DB::statement(
                "UPDATE farm_parcels SET geom = ST_GeomFromGeoJSON(?) WHERE id = ?",
                [$data['geojson'], $parcel->id]
            );
        }

        return redirect()->route('admin.parcels.index')->with('success', 'Parcel updated.');
    }

    public function destroy(FarmParcel $parcel)
    {
        $parcel->delete();
        return redirect()->route('admin.parcels.index')->with('success', 'Parcel deleted.');
    }

    // Returns all parcels as GeoJSON for the map
    public function geojson()
    {
        $parcels = DB::select("
            SELECT fp.id, fp.parcel_number, fp.barangay, fp.total_area_ha,
                   CONCAT(f.first_name, ' ', f.last_name) as farmer_name,
                   ST_AsGeoJSON(fp.geom) as geometry
            FROM farm_parcels fp
            JOIN farmers f ON f.id = fp.farmer_id
            WHERE fp.geom IS NOT NULL
        ");

        $features = collect($parcels)->map(fn($p) => [
            'type'       => 'Feature',
            'geometry'   => json_decode($p->geometry),
            'properties' => [
                'id'           => $p->id,
                'parcel_number'=> $p->parcel_number,
                'barangay'     => $p->barangay,
                'farmer_name'  => $p->farmer_name,
                'area_ha'      => $p->total_area_ha,
            ],
        ]);

        return response()->json(['type' => 'FeatureCollection', 'features' => $features]);
    }
}
