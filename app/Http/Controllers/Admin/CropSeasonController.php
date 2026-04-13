<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CropSeasonController extends Controller
{
    public function index(Request $request)
    {
        $parcels = FarmParcel::with('farmer')
            ->select('id', 'parcel_number', 'barangay', 'farmer_id')
            ->orderBy('parcel_number')
            ->get()
            ->map(fn($p) => [
                'id'    => $p->id,
                'label' => "Parcel #{$p->parcel_number} – {$p->farmer?->full_name} – {$p->barangay}",
            ]);

        // Show all seasons by default with filters
        $seasons = CropSeason::with(['crop', 'parcel.farmer'])
            ->when($request->parcel_id, fn($q, $p) => $q->where('parcel_id', $p))
            ->when($request->season, fn($q, $s) => $q->where('season', $s))
            ->when($request->year,   fn($q, $y) => $q->where('cropping_year', $y))
            ->when($request->crop_id, fn($q, $c) => $q->where('crop_id', $c))
            ->when($request->search, function($q, $search) {
                $q->whereHas('parcel.farmer', function($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('rsbsa_no', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('cropping_year')
            ->orderBy('season')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Seasonal/Index', [
            'parcels'        => $parcels,
            'seasons'        => $seasons,
            'crops'          => Crop::orderBy('crop_name')->get(['id', 'crop_name']),
            'filters'        => $request->only(['parcel_id', 'season', 'year', 'crop_id', 'search']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'parcel_id'       => 'required|exists:farm_parcels,id',
            'season'          => 'required|in:dry,wet',
            'cropping_year'   => 'required|integer|min:2000|max:2100',
            'crop_id'         => 'required|exists:crops,id',
            'area_planted_ha' => 'nullable|numeric|min:0',
            'planting_date'   => 'nullable|date',
            'harvest_date'    => 'nullable|date|after_or_equal:planting_date',
            'yield_kg'        => 'nullable|numeric|min:0',
            'inputs_used'     => 'nullable|array',
            'inputs_used.*.type'     => 'required|string',
            'inputs_used.*.name'     => 'required|string',
            'inputs_used.*.quantity' => 'nullable|numeric',
            'inputs_used.*.unit'     => 'nullable|string',
            'inputs_used.*.source'   => 'nullable|string',
        ]);

        CropSeason::create($data);

        return back()->with('success', 'Season entry added.');
    }

    public function update(Request $request, CropSeason $season)
    {
        $data = $request->validate([
            'season'          => 'required|in:dry,wet',
            'cropping_year'   => 'required|integer|min:2000|max:2100',
            'crop_id'         => 'required|exists:crops,id',
            'area_planted_ha' => 'nullable|numeric|min:0',
            'planting_date'   => 'nullable|date',
            'harvest_date'    => 'nullable|date|after_or_equal:planting_date',
            'yield_kg'        => 'nullable|numeric|min:0',
            'inputs_used'     => 'nullable|array',
            'inputs_used.*.type'     => 'required|string',
            'inputs_used.*.name'     => 'required|string',
            'inputs_used.*.quantity' => 'nullable|numeric',
            'inputs_used.*.unit'     => 'nullable|string',
            'inputs_used.*.source'   => 'nullable|string',
        ]);

        $season->update($data);

        return back()->with('success', 'Season entry updated.');
    }

    public function destroy(CropSeason $season)
    {
        $season->delete();
        return back()->with('success', 'Season entry deleted.');
    }
}
