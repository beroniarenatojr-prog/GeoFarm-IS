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
    public function index(Request $request)
    {
        // Filtering and sorting run in SQL. The registry is sized for 8,000+
        // farmers, so a browser-side filter would only ever see one page.
        $sortable = ['parcel_number', 'barangay', 'total_area_ha', 'created_at'];
        $sort = in_array($request->sort, $sortable, true) ? $request->sort : 'parcel_number';
        $direction = $request->direction === 'desc' ? 'desc' : 'asc';
        $perPage = in_array((int) $request->per_page, [25, 50, 100], true) ? (int) $request->per_page : 25;

        $filtered = fn () => FarmParcel::query()
            ->when($request->search, fn ($q, $s) => $q->where(function ($query) use ($s) {
                $query->where('parcel_number', 'like', "%$s%")
                    ->orWhere('location_address', 'like', "%$s%")
                    ->orWhere('commodity', 'like', "%$s%")
                    ->orWhereHas('farmer', fn ($f) => $f
                        ->where('first_name', 'like', "%$s%")
                        ->orWhere('last_name', 'like', "%$s%")
                        ->orWhere('rsbsa_no', 'like', "%$s%"));
            }))
            ->when($request->barangay, fn ($q, $b) => $q->where('barangay', $b))
            ->when($request->farm_type_id, fn ($q, $t) => $q->where('farm_type_id', $t))
            ->when($request->ownership, fn ($q, $o) => $q->where('ownership_type', $o))
            // A parcel counts as mapped once geometry has been drawn for it.
            ->when($request->mapped === 'yes', fn ($q) => $q->whereNotNull('geojson_data'))
            ->when($request->mapped === 'no', fn ($q) => $q->whereNull('geojson_data'));

        $parcels = $filtered()
            ->with(['farmer:id,first_name,middle_name,last_name,suffix,rsbsa_no', 'farmType:id,type_name'])
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Admin/Parcels/Index', [
            'parcels'   => $parcels,
            'filters'   => $request->only(['search', 'barangay', 'farm_type_id', 'ownership', 'mapped', 'sort', 'direction', 'per_page']),
            'sort'      => ['column' => $sort, 'direction' => $direction],
            'perPage'   => $perPage,
            'barangays' => FarmParcel::distinct()->orderBy('barangay')->pluck('barangay')->filter()->values(),
            'farmTypes' => FarmType::orderBy('type_name')->get(['id', 'type_name']),
            // Totals follow the active filter, so the headline always describes
            // what is listed below it.
            'summary'   => [
                'parcels'  => $filtered()->count(),
                'hectares' => round((float) $filtered()->sum('total_area_ha'), 2),
                'mapped'   => (clone $filtered())->whereNotNull('geojson_data')->count(),
            ],
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
