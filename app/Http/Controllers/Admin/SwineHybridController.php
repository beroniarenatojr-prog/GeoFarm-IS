<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SwineHybrid;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class SwineHybridController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'farmer_id' => 'required|exists:farmers,id',
            'variety' => 'required|in:White,Brown',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        SwineHybrid::create($validated);

        return Redirect::back()->with('success', 'Swine hybrid record added successfully.');
    }

    public function update(Request $request, SwineHybrid $swineHybrid)
    {
        $validated = $request->validate([
            'variety' => 'required|in:White,Brown',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        $swineHybrid->update($validated);

        return Redirect::back()->with('success', 'Swine hybrid record updated successfully.');
    }

    public function destroy(SwineHybrid $swineHybrid)
    {
        $swineHybrid->delete();

        return Redirect::back()->with('success', 'Swine hybrid record deleted successfully.');
    }
}
