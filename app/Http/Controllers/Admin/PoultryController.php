<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AssetRules;
use App\Http\Controllers\Controller;
use App\Models\Poultry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class PoultryController extends Controller
{
    use AssetRules;

    /** Matches the bird_type enum on the poultry table. */
    public const BIRD_TYPES = ['Chicken', 'Ducks', 'Goose', 'Turkey'];

    private function rules(bool $creating): array
    {
        return ($creating ? $this->animalRulesForCreate() : $this->animalRules()) + [
            'bird_type' => 'required|in:' . implode(',', self::BIRD_TYPES),
            'breed'     => 'nullable|string|max:40',
        ];
    }

    public function store(Request $request)
    {
        Poultry::create($request->validate($this->rules(true)));

        return Redirect::back()->with('success', 'Poultry record added successfully.');
    }

    public function update(Request $request, Poultry $poultry)
    {
        $poultry->update($request->validate($this->rules(false)));

        return Redirect::back()->with('success', 'Poultry record updated successfully.');
    }

    public function destroy(Poultry $poultry)
    {
        $poultry->delete();

        return Redirect::back()->with('success', 'Poultry record deleted successfully.');
    }
}
