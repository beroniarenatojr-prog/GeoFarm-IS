<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AssetRules;
use App\Http\Controllers\Controller;
use App\Models\LargeRuminant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class LargeRuminantController extends Controller
{
    use AssetRules;

    /** Matches the animal_type enum on the large_ruminants table. */
    public const ANIMAL_TYPES = ['Cattle', 'Carabao'];

    private function rules(bool $creating): array
    {
        return ($creating ? $this->animalRulesForCreate() : $this->animalRules()) + [
            'animal_type' => 'required|in:' . implode(',', self::ANIMAL_TYPES),
        ];
    }

    public function store(Request $request)
    {
        LargeRuminant::create($request->validate($this->rules(true)));

        return Redirect::back()->with('success', 'Large ruminant added successfully.');
    }

    public function update(Request $request, LargeRuminant $largeRuminant)
    {
        $largeRuminant->update($request->validate($this->rules(false)));

        return Redirect::back()->with('success', 'Large ruminant updated successfully.');
    }

    public function destroy(LargeRuminant $largeRuminant)
    {
        $largeRuminant->delete();

        return Redirect::back()->with('success', 'Large ruminant deleted successfully.');
    }
}
