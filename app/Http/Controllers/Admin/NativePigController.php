<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AssetRules;
use App\Http\Controllers\Controller;
use App\Models\NativePig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

/** Native pigs have no breed or variety column — the table is heads only. */
class NativePigController extends Controller
{
    use AssetRules;

    public function store(Request $request)
    {
        NativePig::create($request->validate($this->animalRulesForCreate()));

        return Redirect::back()->with('success', 'Native pig record added successfully.');
    }

    public function update(Request $request, NativePig $nativePig)
    {
        $nativePig->update($request->validate($this->animalRules()));

        return Redirect::back()->with('success', 'Native pig record updated successfully.');
    }

    public function destroy(NativePig $nativePig)
    {
        $nativePig->delete();

        return Redirect::back()->with('success', 'Native pig record deleted successfully.');
    }
}
