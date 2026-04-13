<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Association;
use App\Models\Crop;
use App\Models\FarmType;
use App\Models\LivestockType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LookupController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Lookups/Index', [
            'farmTypes'      => FarmType::all(),
            'crops'          => Crop::all(),
            'livestockTypes' => LivestockType::all(),
            'associations'   => Association::all(),
        ]);
    }

    // Generic store/update/delete for each lookup type
    public function storeCrop(Request $request)
    {
        $request->validate(['crop_name' => 'required|unique:crops', 'category' => 'nullable|string']);
        Crop::create($request->only('crop_name', 'category'));
        return back()->with('success', 'Crop added.');
    }

    public function updateCrop(Request $request, Crop $crop)
    {
        $request->validate(['crop_name' => "required|unique:crops,crop_name,{$crop->id}", 'category' => 'nullable|string']);
        $crop->update($request->only('crop_name', 'category'));
        return back()->with('success', 'Crop updated.');
    }

    public function destroyCrop(Crop $crop)
    {
        $crop->delete();
        return back()->with('success', 'Crop deleted.');
    }

    public function storeFarmType(Request $request)
    {
        $request->validate(['type_name' => 'required|unique:farm_types', 'description' => 'nullable|string']);
        FarmType::create($request->only('type_name', 'description'));
        return back()->with('success', 'Farm type added.');
    }

    public function updateFarmType(Request $request, FarmType $farmType)
    {
        $request->validate(['type_name' => "required|unique:farm_types,type_name,{$farmType->id}"]);
        $farmType->update($request->only('type_name', 'description'));
        return back()->with('success', 'Farm type updated.');
    }

    public function destroyFarmType(FarmType $farmType)
    {
        $farmType->delete();
        return back()->with('success', 'Farm type deleted.');
    }

    public function storeLivestockType(Request $request)
    {
        $request->validate(['type_name' => 'required|unique:livestock_types', 'category' => 'nullable|string']);
        LivestockType::create($request->only('type_name', 'category'));
        return back()->with('success', 'Livestock type added.');
    }

    public function updateLivestockType(Request $request, LivestockType $livestockType)
    {
        $livestockType->update($request->only('type_name', 'category'));
        return back()->with('success', 'Livestock type updated.');
    }

    public function destroyLivestockType(LivestockType $livestockType)
    {
        $livestockType->delete();
        return back()->with('success', 'Livestock type deleted.');
    }

    public function storeAssociation(Request $request)
    {
        $request->validate(['association_name' => 'required|unique:associations']);
        Association::create($request->only('association_name'));
        return back()->with('success', 'Association added.');
    }

    public function updateAssociation(Request $request, Association $association)
    {
        $association->update($request->only('association_name'));
        return back()->with('success', 'Association updated.');
    }

    public function destroyAssociation(Association $association)
    {
        $association->delete();
        return back()->with('success', 'Association deleted.');
    }
}
