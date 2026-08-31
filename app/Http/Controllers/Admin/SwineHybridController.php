<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\AssetRules;
use App\Http\Controllers\Controller;
use App\Models\SwineHybrid;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class SwineHybridController extends Controller
{
    use AssetRules;

    /** Matches the variety enum on the swine_hybrid table. */
    public const VARIETIES = ['White', 'Brown'];

    private function rules(bool $creating): array
    {
        return ($creating ? $this->animalRulesForCreate() : $this->animalRules()) + [
            'variety' => 'required|in:' . implode(',', self::VARIETIES),
        ];
    }

    public function store(Request $request)
    {
        SwineHybrid::create($request->validate($this->rules(true)));

        return Redirect::back()->with('success', 'Hybrid swine record added successfully.');
    }

    public function update(Request $request, SwineHybrid $swineHybrid)
    {
        $swineHybrid->update($request->validate($this->rules(false)));

        return Redirect::back()->with('success', 'Hybrid swine record updated successfully.');
    }

    public function destroy(SwineHybrid $swineHybrid)
    {
        $swineHybrid->delete();

        return Redirect::back()->with('success', 'Hybrid swine record deleted successfully.');
    }
}
