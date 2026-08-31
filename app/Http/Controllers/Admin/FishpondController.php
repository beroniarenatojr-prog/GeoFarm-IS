<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Fishpond;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class FishpondController extends Controller
{
    /** Bangus was missing from the old rule while the column accepted it. */
    public const SPECIES = ['Tilapia', 'Hito', 'Bangus'];

    public const POND_TYPES = ['freshwater', 'brackish'];

    private function rules(bool $creating): array
    {
        return array_merge($creating ? ['farmer_id' => 'required|exists:farmers,id'] : [], [
            'species'              => 'required|in:' . implode(',', self::SPECIES),
            'pond_type'            => 'nullable|in:' . implode(',', self::POND_TYPES),
            'area_hectares'        => 'required|numeric|min:0|max:999999.99',
            'stocking_density'     => 'nullable|numeric|min:0|max:999999.99',
            'estimated_population' => 'nullable|integer|min:0|max:4294967295',
            'harvest_cycle_months' => 'nullable|integer|min:0|max:255',
            'last_harvest'         => 'nullable|date',
            // A pond is restocked on a cycle, so the next harvest is expected
            // to fall after the last one; the reverse is a typo, not a plan.
            'next_harvest'         => 'nullable|date|after_or_equal:last_harvest',
            'notes'                => 'nullable|string|max:2000',
        ]);
    }

    public function store(Request $request)
    {
        Fishpond::create($request->validate($this->rules(true)));

        return Redirect::back()->with('success', 'Fishpond added successfully.');
    }

    public function update(Request $request, Fishpond $fishpond)
    {
        $fishpond->update($request->validate($this->rules(false)));

        return Redirect::back()->with('success', 'Fishpond updated successfully.');
    }

    public function destroy(Fishpond $fishpond)
    {
        $fishpond->delete();

        return Redirect::back()->with('success', 'Fishpond deleted successfully.');
    }
}
