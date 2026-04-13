<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CropEstimatorController extends Controller
{
    public function index()
    {
        $farmers = Farmer::select('id', DB::raw("CONCAT(first_name, ' ', last_name, ' (', COALESCE(rsbsa_no, id), ')') as name"))
            ->orderBy('first_name')
            ->get();

        $crops = Crop::select('id', 'crop_name', 'seeding_rate_kg_per_ha', 'fertilizer_bags_per_ha')
            ->orderBy('crop_name')
            ->get();

        return Inertia::render('Admin/CropEstimator/Index', [
            'farmers' => $farmers,
            'crops' => $crops,
        ]);
    }

    public function estimate(Request $request)
    {
        $request->validate([
            'crop_id' => 'required|exists:crops,id',
            'area_hectares' => 'required|numeric|min:0.01',
            'farmer_id' => 'nullable|exists:farmers,id',
        ]);

        $crop = Crop::findOrFail($request->crop_id);
        
        // Get historical data for this crop
        $query = CropSeason::where('crop_id', $request->crop_id)
            ->whereNotNull('yield_kg')
            ->whereNotNull('area_planted_ha')
            ->where('area_planted_ha', '>', 0);

        // If farmer specified, prioritize their data but also include general data
        if ($request->farmer_id) {
            $farmerData = (clone $query)
                ->whereHas('parcel', function($q) use ($request) {
                    $q->where('farmer_id', $request->farmer_id);
                })
                ->get();
            
            // If farmer has enough data, use it; otherwise use general data
            if ($farmerData->count() >= 3) {
                $historicalData = $farmerData;
            } else {
                $historicalData = $query->get();
            }
        } else {
            $historicalData = $query->get();
        }

        // Calculate yield per hectare for each record
        $yieldsPerHa = $historicalData->map(function($season) {
            return $season->yield_kg / $season->area_planted_ha;
        });

        // Calculate average yield per hectare
        $avgYieldPerHa = $yieldsPerHa->avg() ?: 0;

        // Calculate estimated total yield
        $estimatedTotalYield = $avgYieldPerHa * $request->area_hectares;

        // Calculate input requirements
        $recommendedSeeds = ($crop->seeding_rate_kg_per_ha ?? 0) * $request->area_hectares;
        $recommendedFertilizer = ($crop->fertilizer_bags_per_ha ?? 0) * $request->area_hectares;

        // Get seasonal breakdown
        $seasonalData = CropSeason::select(
                'season',
                'cropping_year',
                DB::raw('AVG(yield_kg / area_planted_ha) as avg_yield')
            )
            ->where('crop_id', $request->crop_id)
            ->whereNotNull('yield_kg')
            ->whereNotNull('area_planted_ha')
            ->where('area_planted_ha', '>', 0)
            ->groupBy('season', 'cropping_year')
            ->orderBy('cropping_year', 'desc')
            ->orderBy('season')
            ->limit(10)
            ->get();

        return response()->json([
            'avg_yield_per_ha' => round($avgYieldPerHa, 2),
            'estimated_total_yield_kg' => round($estimatedTotalYield, 2),
            'recommended_seeds_kg' => round($recommendedSeeds, 2),
            'recommended_fertilizer_bags' => round($recommendedFertilizer, 2),
            'data_points' => $historicalData->count(),
            'seasonal_data' => $seasonalData,
            'crop_name' => $crop->crop_name,
            'area_hectares' => $request->area_hectares,
        ]);
    }
}
