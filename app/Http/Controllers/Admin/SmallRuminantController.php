<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SmallRuminant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class SmallRuminantController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'farmer_id' => 'required|exists:farmers,id',
            'animal_type' => 'required|in:Goat,Sheep',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        SmallRuminant::create($validated);

        return Redirect::back()->with('success', 'Small ruminant added successfully.');
    }

    public function update(Request $request, SmallRuminant $smallRuminant)
    {
        $validated = $request->validate([
            'animal_type' => 'required|in:Goat,Sheep',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        $smallRuminant->update($validated);

        return Redirect::back()->with('success', 'Small ruminant updated successfully.');
    }

    public function destroy(SmallRuminant $smallRuminant)
    {
        $smallRuminant->delete();

        return Redirect::back()->with('success', 'Small ruminant deleted successfully.');
    }
}
