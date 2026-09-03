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

        // Totals for the summary strip. Deliberately reflect the SAME filters
        // as the table, so the headline figures always describe what is on
        // screen rather than the whole database.
        $scoped = fn () => CropSeason::query()
            ->when($request->parcel_id, fn ($q, $p) => $q->where('parcel_id', $p))
            ->when($request->season, fn ($q, $s) => $q->where('season', $s))
            ->when($request->year, fn ($q, $y) => $q->where('cropping_year', $y))
            ->when($request->crop_id, fn ($q, $c) => $q->where('crop_id', $c))
            ->when($request->search, fn ($q, $search) => $q->whereHas(
                'parcel.farmer',
                fn ($f) => $f->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('rsbsa_no', 'like', "%{$search}%")
            ));

        return Inertia::render('Admin/Seasonal/Index', [
            'parcels'        => $parcels,
            'seasons'        => $seasons,
            'crops'          => Crop::orderBy('crop_name')->get(['id', 'crop_name']),
            'filters'        => $request->only(['parcel_id', 'season', 'year', 'crop_id', 'search']),
            'summary'        => [
                'seasons'   => $scoped()->count(),
                'hectares'  => round((float) $scoped()->sum('area_planted_ha'), 2),
                'yield_kg'  => round((float) $scoped()->sum('yield_kg'), 2),
                'harvested' => $scoped()->whereNotNull('harvest_date')->count(),
                'cost'      => round((float) $scoped()->sum('production_cost'), 2),
                // Averaged over the whole scope rather than by averaging each
                // row's own cost per kilo: a season that produced 5 t and one
                // that produced 50 kg must not count equally.
                'cost_per_kg' => $this->blendedCostPerKg($scoped()),
                'costed'    => $scoped()->whereNotNull('production_cost')->count(),
            ],
            // Cost of production by year, split wet and dry.
            'costByYear'     => $this->costByYear($scoped()),
        ]);
    }

    /**
     * Cost per kilo across a set of seasons.
     *
     * Total cost over total yield, not the mean of each row's ratio — a season
     * that produced five tonnes and one that produced fifty kilos would
     * otherwise carry equal weight and the answer would be meaningless.
     *
     * Only rows carrying BOTH a cost and a yield are counted; a costed season
     * still in the ground would otherwise inflate the price of everything
     * already harvested.
     */
    private function blendedCostPerKg($query): ?float
    {
        $row = (clone $query)
            ->whereNotNull('production_cost')
            ->where('yield_kg', '>', 0)
            ->selectRaw('SUM(production_cost) AS cost, SUM(yield_kg) AS kg')
            ->first();

        if (!$row || !$row->kg) {
            return null;
        }

        return round((float) $row->cost / (float) $row->kg, 2);
    }

    /**
     * Cost of production per year, wet against dry.
     *
     * Nothing here is stored — a season row already IS a year and a season, so
     * the split is a grouping rather than four more columns to keep in step.
     */
    private function costByYear($query): array
    {
        $rows = (clone $query)
            ->whereNotNull('production_cost')
            ->selectRaw('cropping_year, season')
            ->selectRaw('SUM(production_cost) AS cost')
            ->selectRaw('SUM(yield_kg) AS kg')
            ->selectRaw('SUM(area_planted_ha) AS ha')
            ->selectRaw('COUNT(*) AS seasons')
            ->groupBy('cropping_year', 'season')
            ->orderByDesc('cropping_year')
            ->get();

        $years = [];

        foreach ($rows as $row) {
            $year = (int) $row->cropping_year;

            $years[$year] ??= [
                'year' => $year,
                'dry'  => null,
                'wet'  => null,
                'total_cost' => 0.0,
            ];

            $years[$year][$row->season] = [
                'cost'        => round((float) $row->cost, 2),
                'kg'          => round((float) $row->kg, 2),
                'hectares'    => round((float) $row->ha, 2),
                'seasons'     => (int) $row->seasons,
                'cost_per_kg' => $row->kg > 0 ? round((float) $row->cost / (float) $row->kg, 2) : null,
            ];

            $years[$year]['total_cost'] += (float) $row->cost;
        }

        return array_values($years);
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
            'production_cost'   => 'nullable|numeric|min:0|max:99999999.99',
            'fertilizer_type'   => 'nullable|string|max:100',
            'fertilizer_qty_kg' => 'nullable|numeric|min:0|max:99999999.99',
            'fertilizer_class'  => 'nullable|in:organic,inorganic,mixed',
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
            'production_cost'   => 'nullable|numeric|min:0|max:99999999.99',
            'fertilizer_type'   => 'nullable|string|max:100',
            'fertilizer_qty_kg' => 'nullable|numeric|min:0|max:99999999.99',
            'fertilizer_class'  => 'nullable|in:organic,inorganic,mixed',
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
