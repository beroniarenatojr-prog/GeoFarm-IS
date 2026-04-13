<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TreeCrop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class TreeCropController extends Controller
{
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
        $validated = $request->validate([
            'farmer_id' => 'required|exists:farmers,id',
            'crop_type' => 'required|in:Mango,Banana,Cacao,Pineapple',
            'quantity' => 'nullable|integer|min:0',
            'area_hectares' => 'nullable|numeric|min:0',
        ]);

        TreeCrop::create($validated);

        return Redirect::back()->with('success', 'Tree crop added successfully.');
    }

    public function update(Request $request, TreeCrop $treeCrop)
    {
        $validated = $request->validate([
            'crop_type' => 'required|in:Mango,Banana,Cacao,Pineapple',
            'quantity' => 'nullable|integer|min:0',
            'area_hectares' => 'nullable|numeric|min:0',
        ]);

        $treeCrop->update($validated);

        return Redirect::back()->with('success', 'Tree crop updated successfully.');
    }

    public function destroy(TreeCrop $treeCrop)
    {
        $treeCrop->delete();

        return Redirect::back()->with('success', 'Tree crop deleted successfully.');
    }
}
