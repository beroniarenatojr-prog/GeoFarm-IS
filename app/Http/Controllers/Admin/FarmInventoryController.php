<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmMachinery;
use App\Models\Fishpond;
use App\Models\LargeRuminant;
use App\Models\NativePig;
use App\Models\Poultry;
use App\Models\SmallRuminant;
use App\Models\SwineHybrid;
use App\Models\TreeCrop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FarmInventoryController extends Controller
{
    /**
     * The five RSBSA animal tables. Same shape, different discriminator
     * column — so they are read in one loop rather than five copied blocks.
     * `route` matches FarmAssetController's registry key.
     */
    private const ANIMAL_SOURCES = [
        ['model' => LargeRuminant::class, 'route' => 'large-ruminants', 'category' => 'Large Ruminant', 'field' => 'animal_type'],
        ['model' => SmallRuminant::class, 'route' => 'small-ruminants', 'category' => 'Small Ruminant', 'field' => 'animal_type'],
        ['model' => NativePig::class,     'route' => 'native-pigs',     'category' => 'Swine',          'field' => null, 'fixed' => 'Native Pig'],
        ['model' => SwineHybrid::class,   'route' => 'swine-hybrid',    'category' => 'Swine',          'field' => 'variety', 'prefix' => 'Swine Hybrid'],
        ['model' => Poultry::class,       'route' => 'poultry',         'category' => 'Poultry',        'field' => 'bird_type'],
    ];

    public function index(Request $request)
    {
        // A plain <select> of every farmer would be an 8,000-option list once
        // the registry is loaded, so the picker searches instead and only the
        // matches are sent down. The currently selected farmer is always
        // included, otherwise the picker would forget its own value.
        $search = trim((string) $request->farmer_search);

        $farmers = Farmer::query()
            ->verified()
            ->select('id', 'first_name', 'last_name', 'rsbsa_no')
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('first_name', 'like', "%$search%")
                ->orWhere('last_name', 'like', "%$search%")
                ->orWhere('rsbsa_no', 'like', "%$search%")))
            ->orderBy('last_name')
            ->limit(50)
            ->get()
            ->map(fn ($f) => [
                'id'    => $f->id,
                'label' => trim("{$f->last_name}, {$f->first_name}"),
                'meta'  => $f->rsbsa_no ? "RSBSA {$f->rsbsa_no}" : 'No RSBSA number',
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
            'farmers'          => $farmers,
            'farmerSearch'     => $search,
            'farmerCount'      => Farmer::verified()->count(),
            'selectedFarmer'   => $selectedFarmer,
            'inventory'        => $inventory,
            'selectedFarmerId' => $farmerId ?? 'all',
            // Headline totals for whatever is currently in scope.
            'summary'          => [
                'crop_area'   => round((float) collect($inventory['crops'] ?? [])->sum('total_area'), 2),
                'crop_types'  => collect($inventory['crops'] ?? [])->pluck('crop_id')->filter()->unique()->count(),
                'trees'       => (int) collect($inventory['tree_crops'] ?? [])->sum('total_quantity'),
                'pond_area'   => round((float) collect($inventory['fishponds'] ?? [])->sum('total_area'), 2),
                'animals'     => (int) collect($inventory['livestock'] ?? [])->sum('total'),
                'machinery'   => (int) collect($inventory['machinery'] ?? [])
                    ->sum(fn ($m) => (int) (is_array($m) ? 1 : ($m->total_units ?? 1))),
            ],
            // The tree-crop form can tie a stand of trees to a specific parcel.
            'parcels' => $selectedFarmer
                ? $selectedFarmer->parcels()->orderBy('parcel_number')->get(['id', 'parcel_number', 'barangay'])
                : [],
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

        // Machinery aggregated by type, with the working share called out —
        // a municipality needs to know how many of its tractors still run.
        $machinery = DB::table('farm_machinery')
            ->select('machinery_type')
            ->selectRaw('COUNT(*) as total_units')
            ->selectRaw("SUM(status = 'active') as active_units")
            ->selectRaw('COUNT(DISTINCT farmer_id) as farmer_count')
            ->groupBy('machinery_type')
            ->orderBy('machinery_type')
            ->get();

        return [
            'crops' => $crops,
            'total_crop_area' => $crops->sum('total_area'),
            'tree_crops' => $treeCrops,
            'fishponds' => $fishponds,
            'machinery' => $machinery,
            'livestock' => $livestock,
            'is_aggregated' => true,
        ];
    }

    /**
     * One farmer's assets, shaped identically to the aggregated view so the
     * page can render either without branching: every section exposes
     * total_quantity / total_area, plus the raw columns the edit forms need
     * and the `route` segment FarmAssetController is addressed by.
     */
    private function getInventory($farmerId)
    {
        $crops = CropSeason::whereHas('parcel', fn ($q) => $q->where('farmer_id', $farmerId))
            ->with('crop')
            ->select('crop_id', 'season', 'cropping_year')
            ->selectRaw('SUM(area_planted_ha) as total_area')
            ->groupBy('crop_id', 'season', 'cropping_year')
            ->orderByDesc('cropping_year')
            ->orderBy('season')
            ->get();

        $treeCrops = TreeCrop::where('farmer_id', $farmerId)
            ->orderBy('crop_type')
            ->get()
            ->map(fn ($r) => [
                'id'             => $r->id,
                'route'          => 'tree-crops',
                'crop_type'      => $r->crop_type,
                'total_quantity' => (int) $r->quantity,
                'total_area'     => (float) $r->area_hectares,
                'quantity'       => (int) $r->quantity,
                'area_hectares'  => $r->area_hectares,
                'age_years'      => $r->age_years,
                'status'         => $r->status,
                'parcel_id'      => $r->parcel_id,
                'notes'          => $r->notes,
            ]);

        $fishponds = Fishpond::where('farmer_id', $farmerId)
            ->orderBy('species')
            ->get()
            ->map(fn ($r) => [
                'id'                   => $r->id,
                'route'                => 'fishponds',
                'species'              => $r->species,
                'pond_type'            => $r->pond_type,
                'total_area'           => (float) $r->area_hectares,
                'area_hectares'        => $r->area_hectares,
                'stocking_density'     => $r->stocking_density,
                'estimated_population' => $r->estimated_population,
                'projected_population' => $r->projectedPopulation(),
                'harvest_cycle_months' => $r->harvest_cycle_months,
                'last_harvest'         => $r->last_harvest?->format('Y-m-d'),
                'next_harvest'         => $r->next_harvest?->format('Y-m-d'),
                'notes'                => $r->notes,
            ]);

        $machinery = FarmMachinery::where('farmer_id', $farmerId)
            ->orderBy('machinery_type')
            ->get()
            ->map(fn ($r) => [
                'id'               => $r->id,
                'route'            => 'machinery',
                'machinery_type'   => $r->machinery_type,
                'brand'            => $r->brand,
                'model'            => $r->model,
                'serial_number'    => $r->serial_number,
                'engine_number'    => $r->engine_number,
                'year_acquired'    => $r->year_acquired,
                'age_years'        => $r->age_years,
                'acquisition_type' => $r->acquisition_type,
                'status'           => $r->status,
                'notes'            => $r->notes,
            ]);

        // Five RSBSA animal tables, same columns, different discriminator.
        $livestock = collect(self::ANIMAL_SOURCES)->flatMap(
            fn ($src) => $src['model']::where('farmer_id', $farmerId)->get()->map(fn ($r) => [
                'id'               => $r->id,
                'route'            => $src['route'],
                'category'         => $src['category'],
                'type'             => $this->animalLabel($src, $r),
                'type_field'       => $src['field'],
                'type_value'       => $src['field'] ? $r->{$src['field']} : null,
                'male'             => (int) $r->male_count,
                'female'           => (int) $r->female_count,
                'total'            => (int) $r->total_heads,
                'male_count'       => (int) $r->male_count,
                'female_count'     => (int) $r->female_count,
                'is_large_raiser'  => (bool) $r->is_large_raiser,
                'breed'            => $src['route'] === 'poultry' ? $r->breed : null,
                'purpose'          => $r->purpose,
                'health_status'    => $r->health_status,
                'last_vaccination' => $r->last_vaccination?->format('Y-m-d'),
                'notes'            => $r->notes,
            ])
        )->values();

        return [
            'crops'           => $crops,
            'total_crop_area' => $crops->sum('total_area'),
            'tree_crops'      => $treeCrops,
            'fishponds'       => $fishponds,
            'machinery'       => $machinery,
            'livestock'       => $livestock,
        ];
    }

    /** "Swine Hybrid (White)", "Native Pig", "Cattle" … */
    private function animalLabel(array $src, $row): string
    {
        if (!$src['field']) {
            return $src['fixed'];
        }

        $value = $row->{$src['field']};

        return isset($src['prefix']) ? "{$src['prefix']} ({$value})" : (string) $value;
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
