<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crop;
use App\Models\Farmer;
use App\Services\ForecastService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CropEstimatorController extends Controller
{
    public function index()
    {
        // Only verified farmers can be forecast against.
        $farmers = Farmer::verified()
            ->select('id', DB::raw("CONCAT(first_name, ' ', last_name, ' (', COALESCE(rsbsa_no, id), ')') as name"))
            ->orderBy('first_name')
            ->get();

        $crops = Crop::select('id', 'crop_name', 'seeding_rate_kg_per_ha', 'fertilizer_bags_per_ha')
            ->orderBy('crop_name')
            ->get();

        return Inertia::render('Admin/CropEstimator/Index', [
            'farmers' => $farmers,
            'crops' => $crops,
            // Lets the office forecast for a barangay without picking a farmer.
            'barangays' => Farmer::verified()
                ->whereNotNull('barangay')
                ->distinct()
                ->orderBy('barangay')
                ->pluck('barangay'),
        ]);
    }

    /**
     * Yield forecast for a crop and area.
     *
     * All statistics live in ForecastService so the estimator, the predictive
     * analytics page and any future report share one implementation.
     */
    public function estimate(Request $request, ForecastService $forecast)
    {
        $validated = $request->validate([
            'crop_id' => 'required|exists:crops,id',
            'area_hectares' => 'required|numeric|min:0.01',
            'farmer_id' => 'nullable|exists:farmers,id',
            'planting_date' => 'nullable|date',
            'season' => 'nullable|in:dry,wet',
            'barangay' => 'nullable|string|max:50',
        ]);

        return response()->json($forecast->yieldForecast(
            cropId: (int) $validated['crop_id'],
            areaHa: (float) $validated['area_hectares'],
            farmerId: isset($validated['farmer_id']) ? (int) $validated['farmer_id'] : null,
            plantingDate: $validated['planting_date'] ?? null,
            season: $validated['season'] ?? null,
            barangay: $validated['barangay'] ?? null,
        ));
    }
}
