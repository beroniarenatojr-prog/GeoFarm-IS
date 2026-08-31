<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AssetRules;
use App\Http\Controllers\Controller;
use App\Models\SmallRuminant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class SmallRuminantController extends Controller
{
    use AssetRules;

    /** Matches the animal_type enum on the small_ruminants table. */
    public const ANIMAL_TYPES = ['Goat', 'Sheep'];

    private function rules(bool $creating): array
    {
        return ($creating ? $this->animalRulesForCreate() : $this->animalRules()) + [
            'animal_type' => 'required|in:' . implode(',', self::ANIMAL_TYPES),
        ];
    }

    public function store(Request $request)
    {
        SmallRuminant::create($request->validate($this->rules(true)));

        return Redirect::back()->with('success', 'Small ruminant added successfully.');
    }

    public function update(Request $request, SmallRuminant $smallRuminant)
    {
        $smallRuminant->update($request->validate($this->rules(false)));

        return Redirect::back()->with('success', 'Small ruminant updated successfully.');
    }

    public function destroy(SmallRuminant $smallRuminant)
    {
        $smallRuminant->delete();

        return Redirect::back()->with('success', 'Small ruminant deleted successfully.');
    }
}
