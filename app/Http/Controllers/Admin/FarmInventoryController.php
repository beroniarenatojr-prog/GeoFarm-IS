<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\CropSeason;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FarmInventoryController extends Controller
{
    public function index(Request $request)
    {
        $farmers = Farmer::select('id', 'first_name', 'last_name', 'rsbsa_no')
            ->orderBy('last_name')
            ->get()
            ->map(fn($f) => [
                'id' => $f->id,
                'label' => "{$f->first_name} {$f->last_name} ({$f->rsbsa_no})"
            ]);

        $inventory = null;
        $selectedFarmer = null;
        $farmerId = $request->farmer_id;

        if ($farmerId && $farmerId !== 'all') {
            $selectedFarmer = Farmer::findOrFail($farmerId);
            $inventory = $this->getInventory($farmerId);
        } else {
            // Show all farmers inventory (aggregated)
            $inventory = $this->getAllFarmersInventory();
        }

        return Inertia::render('Admin/FarmInventory/Index', [
            'farmers' => $farmers,
            'selectedFarmer' => $selectedFarmer,
            'inventory' => $inventory,
            'selectedFarmerId' => $farmerId ?? 'all',
        ]);
    }

    private function getAllFarmersInventory()
    {
        // Crops (aggregated by crop, season, year across all farmers)
        $crops = CropSeason::with('crop')
            ->select('crop_id', 'season', 'cropping_year')
            ->selectRaw('SUM(area_planted_ha) as total_area')
            ->selectRaw('COUNT(DISTINCT parcel_id) as parcel_count')
            ->groupBy('crop_id', 'season', 'cropping_year')
            ->orderByDesc('cropping_year')
            ->orderBy('season')
            ->get();

        // Tree crops aggregated
        $treeCrops = DB::table('tree_crops')
            ->select('crop_type')
            ->selectRaw('SUM(quantity) as total_quantity')
            ->selectRaw('SUM(area_hectares) as total_area')
            ->selectRaw('COUNT(*) as farmer_count')
            ->groupBy('crop_type')
            ->get();

        // Fishponds aggregated
        $fishponds = DB::table('fishponds')
            ->select('species')
            ->selectRaw('SUM(area_hectares) as total_area')
            ->selectRaw('COUNT(*) as farmer_count')
            ->groupBy('species')
            ->get();

        // Livestock aggregated by type
        $livestock = collect();

        // Large ruminants
        $largeRuminants = DB::table('large_ruminants')
            ->select('animal_type')
            ->selectRaw('SUM(male_count) as total_male')
            ->selectRaw('SUM(female_count) as total_female')
            ->selectRaw('SUM(total_heads) as total_heads')
            ->selectRaw('COUNT(*) as farmer_count')
            ->groupBy('animal_type')
            ->get()
            ->map(fn($r) => (object)[
                'type' => $r->animal_type,
                'category' => 'Large Ruminant',
                'male' => $r->total_male,
                'female' => $r->total_female,
                'total' => $r->total_heads,
                'farmer_count' => $r->farmer_count,
            ]);

        // Small ruminants
        $smallRuminants = DB::table('small_ruminants')
            ->select('animal_type')
            ->selectRaw('SUM(male_count) as total_male')
            ->selectRaw('SUM(female_count) as total_female')
            ->selectRaw('SUM(total_heads) as total_heads')
            ->selectRaw('COUNT(*) as farmer_count')
            ->groupBy('animal_type')
            ->get()
            ->map(fn($r) => (object)[
                'type' => $r->animal_type,
                'category' => 'Small Ruminant',
                'male' => $r->total_male,
                'female' => $r->total_female,
                'total' => $r->total_heads,
                'farmer_count' => $r->farmer_count,
            ]);

        // Native pigs
        $nativePigs = DB::table('native_pigs')
            ->selectRaw('SUM(male_count) as total_male')
            ->selectRaw('SUM(female_count) as total_female')
            ->selectRaw('SUM(total_heads) as total_heads')
            ->selectRaw('COUNT(*) as farmer_count')
            ->first();
        
        if ($nativePigs && $nativePigs->total_heads > 0) {
            $livestock->push((object)[
                'type' => 'Native Pig',
                'category' => 'Swine',
                'male' => $nativePigs->total_male,
                'female' => $nativePigs->total_female,
                'total' => $nativePigs->total_heads,
                'farmer_count' => $nativePigs->farmer_count,
            ]);
        }

        // Swine hybrids
        $swineHybrids = DB::table('swine_hybrid')
            ->select('variety')
            ->selectRaw('SUM(male_count) as total_male')
            ->selectRaw('SUM(female_count) as total_female')
            ->selectRaw('SUM(total_heads) as total_heads')
            ->selectRaw('COUNT(*) as farmer_count')
            ->groupBy('variety')
            ->get()
            ->map(fn($r) => (object)[
                'type' => "Swine Hybrid ({$r->variety})",
                'category' => 'Swine',
                'male' => $r->total_male,
                'female' => $r->total_female,
                'total' => $r->total_heads,
                'farmer_count' => $r->farmer_count,
            ]);

        // Poultry
        $poultry = DB::table('poultry')
            ->select('bird_type')
            ->selectRaw('SUM(male_count) as total_male')
            ->selectRaw('SUM(female_count) as total_female')
            ->selectRaw('SUM(total_heads) as total_heads')
            ->selectRaw('COUNT(*) as farmer_count')
            ->groupBy('bird_type')
            ->get()
            ->map(fn($r) => (object)[
                'type' => $r->bird_type,
                'category' => 'Poultry',
                'male' => $r->total_male,
                'female' => $r->total_female,
                'total' => $r->total_heads,
                'farmer_count' => $r->farmer_count,
            ]);

        $livestock = $livestock
            ->merge($largeRuminants)
            ->merge($smallRuminants)
            ->merge($swineHybrids)
            ->merge($poultry);

        return [
            'crops' => $crops,
            'total_crop_area' => $crops->sum('total_area'),
            'tree_crops' => $treeCrops,
            'fishponds' => $fishponds,
            'livestock' => $livestock,
            'is_aggregated' => true,
        ];
    }

    private function getInventory($farmerId)
    {
        // Crops (aggregated by crop, season, year)
        $crops = CropSeason::whereHas('parcel', fn($q) => $q->where('farmer_id', $farmerId))
            ->with('crop')
            ->select('crop_id', 'season', 'cropping_year')
            ->selectRaw('SUM(area_planted_ha) as total_area')
            ->groupBy('crop_id', 'season', 'cropping_year')
            ->orderByDesc('cropping_year')
            ->orderBy('season')
            ->get();

        // Tree crops
        $treeCrops = DB::table('tree_crops')
            ->where('farmer_id', $farmerId)
            ->get();

        // Fishponds
        $fishponds = DB::table('fishponds')
            ->where('farmer_id', $farmerId)
            ->get();

        // Large ruminants
        $largeRuminants = DB::table('large_ruminants')
            ->where('farmer_id', $farmerId)
            ->get()
            ->map(fn($r) => (object)[
                'id' => $r->id,
                'type' => $r->animal_type,
                'category' => 'Large Ruminant',
                'male' => $r->male_count,
                'female' => $r->female_count,
                'total' => $r->total_heads,
                'is_large_raiser' => $r->is_large_raiser,
                'table' => 'large_ruminants'
            ]);

        // Small ruminants
        $smallRuminants = DB::table('small_ruminants')
            ->where('farmer_id', $farmerId)
            ->get()
            ->map(fn($r) => (object)[
                'id' => $r->id,
                'type' => $r->animal_type,
                'category' => 'Small Ruminant',
                'male' => $r->male_count,
                'female' => $r->female_count,
                'total' => $r->total_heads,
                'is_large_raiser' => false,
                'table' => 'small_ruminants'
            ]);

        // Native pigs
        $nativePigs = DB::table('native_pigs')
            ->where('farmer_id', $farmerId)
            ->get()
            ->map(fn($r) => (object)[
                'id' => $r->id,
                'type' => 'Native Pig',
                'category' => 'Swine',
                'male' => $r->male_count,
                'female' => $r->female_count,
                'total' => $r->total_heads,
                'is_large_raiser' => false,
                'table' => 'native_pigs'
            ]);

        // Swine hybrids
        $swineHybrids = DB::table('swine_hybrid')
            ->where('farmer_id', $farmerId)
            ->get()
            ->map(fn($r) => (object)[
                'id' => $r->id,
                'type' => "Swine Hybrid ({$r->variety})",
                'category' => 'Swine',
                'male' => $r->male_count,
                'female' => $r->female_count,
                'total' => $r->total_heads,
                'is_large_raiser' => false,
                'table' => 'swine_hybrid'
            ]);

        // Poultry
        $poultry = DB::table('poultry')
            ->where('farmer_id', $farmerId)
            ->get()
            ->map(fn($r) => (object)[
                'id' => $r->id,
                'type' => $r->bird_type,
                'category' => 'Poultry',
                'male' => $r->male_count,
                'female' => $r->female_count,
                'total' => $r->total_heads,
                'is_large_raiser' => false,
                'table' => 'poultry'
            ]);

        // Merge all livestock
        $livestock = collect()
            ->merge($largeRuminants)
            ->merge($smallRuminants)
            ->merge($nativePigs)
            ->merge($swineHybrids)
            ->merge($poultry);

        return [
            'crops' => $crops,
            'total_crop_area' => $crops->sum('total_area'),
            'tree_crops' => $treeCrops,
            'fishponds' => $fishponds,
            'livestock' => $livestock,
        ];
    }

    public function export($farmerId)
    {
        $farmer = Farmer::findOrFail($farmerId);
        $inventory = $this->getInventory($farmerId);
        
        // Simple CSV export for now
        $filename = "farmer-{$farmerId}-inventory-" . date('Y-m-d') . ".csv";
        
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];
        
        $callback = function() use ($farmer, $inventory) {
            $file = fopen('php://output', 'w');
            
            // Farmer info
            fputcsv($file, ['FARMER INVENTORY REPORT']);
            fputcsv($file, ['Name', "{$farmer->first_name} {$farmer->last_name}"]);
            fputcsv($file, ['RSBSA', $farmer->rsbsa_no]);
            fputcsv($file, []);
            
            // Crops
            fputcsv($file, ['CROPS']);
            fputcsv($file, ['Crop', 'Season', 'Year', 'Area (ha)']);
            foreach ($inventory['crops'] as $crop) {
                fputcsv($file, [
                    $crop->crop->crop_name ?? '',
                    $crop->season,
                    $crop->cropping_year,
                    $crop->total_area
                ]);
            }
            fputcsv($file, ['Total Area', '', '', $inventory['total_crop_area']]);
            fputcsv($file, []);
            
            // Livestock
            fputcsv($file, ['LIVESTOCK & POULTRY']);
            fputcsv($file, ['Type', 'Category', 'Male', 'Female', 'Total']);
            foreach ($inventory['livestock'] as $animal) {
                fputcsv($file, [
                    $animal->type,
                    $animal->category,
                    $animal->male,
                    $animal->female,
                    $animal->total
                ]);
            }
            
            fclose($file);
        };
        
        return response()->stream($callback, 200, $headers);
    }
}
