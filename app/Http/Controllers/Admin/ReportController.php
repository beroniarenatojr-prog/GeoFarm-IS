<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AssistanceDistribution;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\Livestock;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Reports/Index');
    }

    public function farmerDemographics(Request $request)
    {
        $data = Farmer::query()
            ->when($request->barangay, fn($q, $v) => $q->where('barangay', $v))
            ->selectRaw('barangay, sex, COUNT(*) as count')
            ->groupBy('barangay', 'sex')
            ->get();

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('reports.farmer-demographics', compact('data'));
            return $pdf->download('farmer-demographics.pdf');
        }

        return response()->json($data);
    }

    public function cropProduction(Request $request)
    {
        $data = CropSeason::with('crop')
            ->when($request->season, fn($q, $v) => $q->where('season', $v))
            ->when($request->year, fn($q, $v) => $q->where('cropping_year', $v))
            ->selectRaw('crop_id, season, cropping_year, SUM(area_planted_ha) as total_area, SUM(yield_kg) as total_yield')
            ->groupBy('crop_id', 'season', 'cropping_year')
            ->get();

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('reports.crop-production', compact('data'));
            return $pdf->download('crop-production.pdf');
        }

        return response()->json($data);
    }

    public function livestockInventory(Request $request)
    {
        $data = Livestock::with('livestockType')
            ->selectRaw('livestock_type_id, SUM(count) as total')
            ->groupBy('livestock_type_id')
            ->get();

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('reports.livestock', compact('data'));
            return $pdf->download('livestock-inventory.pdf');
        }

        return response()->json($data);
    }

    public function assistanceSummary(Request $request)
    {
        $data = AssistanceDistribution::with(['farmer', 'assistance'])
            ->when($request->date_from, fn($q, $v) => $q->whereDate('distribution_date', '>=', $v))
            ->when($request->date_to, fn($q, $v) => $q->whereDate('distribution_date', '<=', $v))
            ->get();

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('reports.assistance', compact('data'));
            return $pdf->download('assistance-summary.pdf');
        }

        return response()->json($data);
    }

    public function agriculturalAssets(Request $request)
    {
        $data = [
            'tree_crops' => \DB::table('tree_crops')
                ->join('farmers', 'tree_crops.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'tree_crops.crop_type', 
                    \DB::raw('SUM(tree_crops.quantity) as total_trees'),
                    \DB::raw('SUM(tree_crops.area_hectares) as total_area'))
                ->groupBy('farmers.barangay', 'tree_crops.crop_type')
                ->get(),

            'fishponds' => \DB::table('fishponds')
                ->join('farmers', 'fishponds.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'fishponds.species',
                    \DB::raw('SUM(fishponds.area_hectares) as total_area'))
                ->groupBy('farmers.barangay', 'fishponds.species')
                ->get(),

            'large_ruminants' => \DB::table('large_ruminants')
                ->join('farmers', 'large_ruminants.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'large_ruminants.animal_type',
                    \DB::raw('SUM(large_ruminants.male_count) as total_male'),
                    \DB::raw('SUM(large_ruminants.female_count) as total_female'),
                    \DB::raw('SUM(large_ruminants.male_count + large_ruminants.female_count) as total_heads'),
                    \DB::raw('COUNT(CASE WHEN large_ruminants.is_large_raiser = 1 THEN 1 END) as large_raisers'))
                ->groupBy('farmers.barangay', 'large_ruminants.animal_type')
                ->get(),

            'small_ruminants' => \DB::table('small_ruminants')
                ->join('farmers', 'small_ruminants.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'small_ruminants.animal_type',
                    \DB::raw('SUM(small_ruminants.male_count) as total_male'),
                    \DB::raw('SUM(small_ruminants.female_count) as total_female'),
                    \DB::raw('SUM(small_ruminants.male_count + small_ruminants.female_count) as total_heads'),
                    \DB::raw('COUNT(CASE WHEN small_ruminants.is_large_raiser = 1 THEN 1 END) as large_raisers'))
                ->groupBy('farmers.barangay', 'small_ruminants.animal_type')
                ->get(),

            'swine' => \DB::table('native_pigs')
                ->join('farmers', 'native_pigs.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay',
                    \DB::raw('"Native" as type'),
                    \DB::raw('SUM(native_pigs.male_count) as total_male'),
                    \DB::raw('SUM(native_pigs.female_count) as total_female'),
                    \DB::raw('SUM(native_pigs.male_count + native_pigs.female_count) as total_heads'))
                ->groupBy('farmers.barangay')
                ->union(
                    \DB::table('swine_hybrid')
                        ->join('farmers', 'swine_hybrid.farmer_id', '=', 'farmers.id')
                        ->select('farmers.barangay',
                            \DB::raw('CONCAT("Hybrid-", swine_hybrid.variety) as type'),
                            \DB::raw('SUM(swine_hybrid.male_count) as total_male'),
                            \DB::raw('SUM(swine_hybrid.female_count) as total_female'),
                            \DB::raw('SUM(swine_hybrid.male_count + swine_hybrid.female_count) as total_heads'))
                        ->groupBy('farmers.barangay', 'swine_hybrid.variety')
                )
                ->get(),

            'poultry' => \DB::table('poultry')
                ->join('farmers', 'poultry.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'poultry.bird_type',
                    \DB::raw('SUM(poultry.male_count) as total_male'),
                    \DB::raw('SUM(poultry.female_count) as total_female'),
                    \DB::raw('SUM(poultry.male_count + poultry.female_count) as total_heads'))
                ->groupBy('farmers.barangay', 'poultry.bird_type')
                ->get(),
        ];

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('reports.agricultural-assets', compact('data'));
            return $pdf->download('agricultural-assets.pdf');
        }

        return response()->json($data);
    }
}
