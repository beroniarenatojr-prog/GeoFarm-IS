<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NativePig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class NativePigController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'farmer_id' => 'required|exists:farmers,id',
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        NativePig::create($validated);

        return Redirect::back()->with('success', 'Native pig record added successfully.');
    }

    public function update(Request $request, NativePig $nativePig)
    {
        $validated = $request->validate([
            'male_count' => 'required|integer|min:0',
            'female_count' => 'required|integer|min:0',
        ]);

        $nativePig->update($validated);

        return Redirect::back()->with('success', 'Native pig record updated successfully.');
    }

    public function destroy(NativePig $nativePig)
    {
        $nativePig->delete();

        return Redirect::back()->with('success', 'Native pig record deleted successfully.');
    }
}
