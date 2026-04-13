<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LargeRuminant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class LargeRuminantController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'farmer_id' => 'required|exists:farmers,id',
            'animal_type' => 'required|in:Cattle,Carabao',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        LargeRuminant::create($validated);

        return Redirect::back()->with('success', 'Large ruminant added successfully.');
    }

    public function update(Request $request, LargeRuminant $largeRuminant)
    {
        $validated = $request->validate([
            'animal_type' => 'required|in:Cattle,Carabao',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        $largeRuminant->update($validated);

        return Redirect::back()->with('success', 'Large ruminant updated successfully.');
    }

    public function destroy(LargeRuminant $largeRuminant)
    {
        $largeRuminant->delete();

        return Redirect::back()->with('success', 'Large ruminant deleted successfully.');
    }
}
