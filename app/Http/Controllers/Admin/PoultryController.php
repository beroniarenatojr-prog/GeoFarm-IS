<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Poultry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class PoultryController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'farmer_id' => 'required|exists:farmers,id',
            'bird_type' => 'required|in:Chicken,Ducks,Goose,Turkey',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        Poultry::create($validated);

        return Redirect::back()->with('success', 'Poultry record added successfully.');
    }

    public function update(Request $request, Poultry $poultry)
    {
        $validated = $request->validate([
            'bird_type' => 'required|in:Chicken,Ducks,Goose,Turkey',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        $poultry->update($validated);

        return Redirect::back()->with('success', 'Poultry record updated successfully.');
    }

    public function destroy(Poultry $poultry)
    {
        $poultry->delete();

        return Redirect::back()->with('success', 'Poultry record deleted successfully.');
    }
}
