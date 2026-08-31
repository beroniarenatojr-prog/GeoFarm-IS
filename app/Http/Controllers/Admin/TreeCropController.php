<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TreeCrop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class TreeCropController extends Controller
{
    /**
     * Matches the crop_type enum on the tree_crops table.
     *
     * Coconut was missing from the old rule while the column accepted it, so
     * the single most common tree crop in Tumauini could not be recorded.
     */
    public const CROP_TYPES = ['Coconut', 'Mango', 'Banana', 'Cacao', 'Pineapple'];

    public const STATUSES = ['bearing', 'non_bearing'];

    private function rules(bool $creating): array
    {
        return array_merge($creating ? ['farmer_id' => 'required|exists:farmers,id'] : [], [
            'crop_type'     => 'required|in:' . implode(',', self::CROP_TYPES),
            'quantity'      => 'nullable|integer|min:0|max:1000000',
            'area_hectares' => 'nullable|numeric|min:0|max:999999.99',
            'age_years'     => 'nullable|integer|min:0|max:200',
            'status'        => 'nullable|in:' . implode(',', self::STATUSES),
            'parcel_id'     => 'nullable|exists:farm_parcels,id',
            'notes'         => 'nullable|string|max:2000',
        ]);
    }

    public function index(Request $request)
    {
        $farmerId = $request->get('farmer_id');
        $crops = TreeCrop::with('farmer')
            ->when($farmerId, fn($q) => $q->where('farmer_id', $farmerId))
            ->latest()
            ->paginate(20);

        return inertia('Admin/TreeCrops/Index', ['crops' => $crops]);
    }

    public function store(Request $request)
    {
        TreeCrop::create($request->validate($this->rules(true)));

        return Redirect::back()->with('success', 'Tree crop added successfully.');
    }

    public function update(Request $request, TreeCrop $treeCrop)
    {
        $treeCrop->update($request->validate($this->rules(false)));

        return Redirect::back()->with('success', 'Tree crop updated successfully.');
    }

    public function destroy(TreeCrop $treeCrop)
    {
        $treeCrop->delete();

        return Redirect::back()->with('success', 'Tree crop deleted successfully.');
    }
}
