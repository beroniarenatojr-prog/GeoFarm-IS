<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Fishpond;
use App\Models\FarmMachinery;
use App\Models\LargeRuminant;
use App\Models\NativePig;
use App\Models\Poultry;
use App\Models\SmallRuminant;
use App\Models\SwineHybrid;
use App\Models\TreeCrop;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Write side of Farm Inventory — the assets a FARMER owns.
 *
 * Eight categories share one set of routes rather than eight near-identical
 * controllers. The registry below is the single source of truth for which
 * model backs a category and what may be written to it; anything not listed in
 * a category's rules cannot reach the database.
 *
 * Seasonal crops are not here: they live in crop_seasons and are edited
 * through the Seasonal Tracking module, which already handles yields and
 * input costs per season.
 */
class FarmAssetController extends Controller
{
    /** Health fields every animal category shares. */
    private const ANIMAL_RULES = [
        'male_count'       => 'required|integer|min:0|max:100000',
        'female_count'     => 'required|integer|min:0|max:100000',
        'purpose'          => 'nullable|string|max:40',
        'health_status'    => 'required|in:healthy,sick,treated,vaccinated',
        'last_vaccination' => 'nullable|date|before_or_equal:today',
        'notes'            => 'nullable|string|max:1000',
    ];

    private function registry(): array
    {
        return [
            'tree-crops' => [
                'model' => TreeCrop::class,
                'label' => 'Tree crop',
                'rules' => [
                    'crop_type'     => 'required|in:Coconut,Mango,Banana,Cacao,Pineapple',
                    'quantity'      => 'required|integer|min:0|max:1000000',
                    'area_hectares' => 'nullable|numeric|min:0|max:100000',
                    'age_years'     => 'nullable|integer|min:0|max:200',
                    'status'        => 'required|in:bearing,non_bearing',
                    'parcel_id'     => 'nullable|exists:farm_parcels,id',
                    'notes'         => 'nullable|string|max:1000',
                ],
            ],
            'large-ruminants' => [
                'model' => LargeRuminant::class,
                'label' => 'Large ruminant',
                'rules' => ['animal_type' => 'required|in:Cattle,Carabao'] + self::ANIMAL_RULES,
            ],
            'small-ruminants' => [
                'model' => SmallRuminant::class,
                'label' => 'Small ruminant',
                'rules' => ['animal_type' => 'required|in:Goat,Sheep'] + self::ANIMAL_RULES,
            ],
            'native-pigs' => [
                'model' => NativePig::class,
                'label' => 'Native pig',
                'rules' => self::ANIMAL_RULES,
            ],
            'swine-hybrid' => [
                'model' => SwineHybrid::class,
                'label' => 'Hybrid swine',
                'rules' => ['variety' => 'required|in:White,Brown'] + self::ANIMAL_RULES,
            ],
            'poultry' => [
                'model' => Poultry::class,
                'label' => 'Poultry',
                'rules' => [
                    'bird_type' => 'required|in:Chicken,Ducks,Goose,Turkey',
                    'breed'     => 'nullable|string|max:40',
                ] + self::ANIMAL_RULES,
            ],
            'fishponds' => [
                'model' => Fishpond::class,
                'label' => 'Fishpond',
                'rules' => [
                    'pond_type'            => 'required|in:freshwater,brackish',
                    'species'              => 'required|in:Tilapia,Hito,Bangus',
                    'area_hectares'        => 'required|numeric|min:0|max:100000',
                    'stocking_density'     => 'nullable|numeric|min:0|max:10000',
                    'estimated_population' => 'nullable|integer|min:0|max:100000000',
                    'harvest_cycle_months' => 'nullable|integer|min:1|max:60',
                    'last_harvest'         => 'nullable|date',
                    'next_harvest'         => 'nullable|date',
                    'notes'                => 'nullable|string|max:1000',
                ],
            ],
            'machinery' => [
                'model' => FarmMachinery::class,
                'label' => 'Machinery',
                'rules' => [
                    'machinery_type'   => 'required|string|max:60',
                    'brand'            => 'nullable|string|max:60',
                    'model'            => 'nullable|string|max:60',
                    'serial_number'    => 'nullable|string|max:60',
                    'engine_number'    => 'nullable|string|max:60',
                    'year_acquired'    => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
                    'acquisition_type' => ['required', Rule::in(FarmMachinery::ACQUISITION)],
                    'status'           => ['required', Rule::in(FarmMachinery::STATUSES)],
                    'notes'            => 'nullable|string|max:1000',
                ],
            ],
        ];
    }

    private function definition(string $category): array
    {
        return $this->registry()[$category]
            ?? abort(404, "Unknown farm asset category [$category].");
    }

    public function store(Request $request, string $category)
    {
        $def = $this->definition($category);

        $data = $request->validate(
            $def['rules'] + ['farmer_id' => 'required|exists:farmers,id']
        );

        $def['model']::create($data);

        return back()->with('success', "{$def['label']} record added.");
    }

    public function update(Request $request, string $category, int $id)
    {
        $def = $this->definition($category);

        // farmer_id is not re-validated: a record cannot be moved to a
        // different farmer by editing it. Delete and re-add instead.
        $record = $def['model']::findOrFail($id);
        $record->update($request->validate($def['rules']));

        return back()->with('success', "{$def['label']} record updated.");
    }

    public function destroy(string $category, int $id)
    {
        $def = $this->definition($category);
        $def['model']::findOrFail($id)->delete();

        return back()->with('success', "{$def['label']} record removed.");
    }
}
