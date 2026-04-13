<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Fishpond;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class FishpondController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'farmer_id' => 'required|exists:farmers,id',
            'species' => 'required|in:Tilapia,Hito',
            'area_hectares' => 'required|numeric|min:0',
        ]);

        Fishpond::create($validated);

        return Redirect::back()->with('success', 'Fishpond added successfully.');
    }

    public function update(Request $request, Fishpond $fishpond)
    {
        $validated = $request->validate([
            'species' => 'required|in:Tilapia,Hito',
            'area_hectares' => 'required|numeric|min:0',
        ]);

        $fishpond->update($validated);

        return Redirect::back()->with('success', 'Fishpond updated successfully.');
    }

    public function destroy(Fishpond $fishpond)
    {
        $fishpond->delete();

        return Redirect::back()->with('success', 'Fishpond deleted successfully.');
    }
}
