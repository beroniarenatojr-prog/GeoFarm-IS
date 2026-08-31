<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Association;
use App\Models\Crop;
use App\Models\FarmType;
use App\Models\LivestockType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * The reference lists the rest of the system chooses from.
 *
 * Every entry here is pointed at by real records, and the four tables behave
 * differently when one is removed — RESTRICT on crops and livestock types,
 * SET NULL on farm types, CASCADE on associations. Deleting was previously
 * unguarded, so the same click produced a 500, a silent wipe of a parcel's
 * farm type, or the quiet loss of a farmer's membership depending on which
 * list it was pressed in. Nothing in use can be deleted now.
 */
class LookupController extends Controller
{
    /**
     * Where each list is referenced from: [table, column, what to call it].
     */
    private const USAGE = [
        Crop::class          => ['crop_seasons', 'crop_id', 'cropping season'],
        FarmType::class      => ['farm_parcels', 'farm_type_id', 'farm parcel'],
        LivestockType::class => ['livestock', 'livestock_type_id', 'livestock record'],
        Association::class   => ['farmer_associations', 'association_id', 'farmer membership'],
    ];

    public function index()
    {
        return Inertia::render('Admin/Lookups/Index', [
            'crops'          => $this->withUsage(Crop::orderBy('crop_name')->get()),
            'farmTypes'      => $this->withUsage(FarmType::orderBy('type_name')->get()),
            'livestockTypes' => $this->withUsage(LivestockType::orderBy('type_name')->get()),
            'associations'   => $this->withUsage(Association::orderBy('association_name')->get()),
        ]);
    }

    /**
     * Stamps every row with how many records depend on it.
     *
     * Counted in one grouped query per list rather than one per row, so the
     * page does not fire a query for each crop.
     */
    private function withUsage($rows)
    {
        if ($rows->isEmpty()) {
            return $rows;
        }

        [$table, $column] = self::USAGE[get_class($rows->first())];

        $counts = DB::table($table)
            ->select($column)
            ->selectRaw('COUNT(*) as total')
            ->whereIn($column, $rows->pluck('id'))
            ->groupBy($column)
            ->pluck('total', $column);

        return $rows->map(function ($row) use ($counts) {
            $row->in_use = (int) ($counts[$row->id] ?? 0);
            return $row;
        });
    }

    /**
     * Refuses a delete that would take real records with it.
     *
     * Returns a redirect to send back, or null when the entry is safe to go.
     */
    private function blockIfInUse(Model $entry, string $name)
    {
        [$table, $column, $noun] = self::USAGE[get_class($entry)];

        $count = DB::table($table)->where($column, $entry->id)->count();

        if ($count === 0) {
            return null;
        }

        return back()->with('error', sprintf(
            '"%s" is used by %d %s%s, so it cannot be deleted. Rename it instead, or reassign those records first.',
            $name,
            $count,
            $noun,
            $count === 1 ? '' : 's',
        ));
    }

    /* ------------------------------------------------------------- crops */

    public function storeCrop(Request $request)
    {
        $request->validate([
            'crop_name' => 'required|string|max:100|unique:crops',
            'category'  => 'nullable|string|max:100',
        ]);

        Crop::create($request->only('crop_name', 'category'));

        return back()->with('success', 'Crop added.');
    }

    public function updateCrop(Request $request, Crop $crop)
    {
        $request->validate([
            'crop_name' => "required|string|max:100|unique:crops,crop_name,{$crop->id}",
            'category'  => 'nullable|string|max:100',
        ]);

        $crop->update($request->only('crop_name', 'category'));

        return back()->with('success', 'Crop updated.');
    }

    public function destroyCrop(Crop $crop)
    {
        if ($blocked = $this->blockIfInUse($crop, $crop->crop_name)) {
            return $blocked;
        }

        $crop->delete();

        return back()->with('success', 'Crop deleted.');
    }

    /* -------------------------------------------------------- farm types */

    public function storeFarmType(Request $request)
    {
        $request->validate([
            'type_name'   => 'required|string|max:100|unique:farm_types',
            'description' => 'nullable|string|max:255',
        ]);

        FarmType::create($request->only('type_name', 'description'));

        return back()->with('success', 'Farm type added.');
    }

    public function updateFarmType(Request $request, FarmType $farmType)
    {
        $request->validate([
            'type_name'   => "required|string|max:100|unique:farm_types,type_name,{$farmType->id}",
            'description' => 'nullable|string|max:255',
        ]);

        $farmType->update($request->only('type_name', 'description'));

        return back()->with('success', 'Farm type updated.');
    }

    public function destroyFarmType(FarmType $farmType)
    {
        // This one is the quiet danger: the foreign key is ON DELETE SET NULL,
        // so without this guard the parcels keep working but forget what kind
        // of farm they are, with nothing to show it happened.
        if ($blocked = $this->blockIfInUse($farmType, $farmType->type_name)) {
            return $blocked;
        }

        $farmType->delete();

        return back()->with('success', 'Farm type deleted.');
    }

    /* --------------------------------------------------- livestock types */

    public function storeLivestockType(Request $request)
    {
        $request->validate([
            'type_name' => 'required|string|max:100|unique:livestock_types',
            'category'  => 'nullable|string|max:100',
        ]);

        LivestockType::create($request->only('type_name', 'category'));

        return back()->with('success', 'Livestock type added.');
    }

    public function updateLivestockType(Request $request, LivestockType $livestockType)
    {
        // Previously unvalidated: an empty or duplicate name was accepted here
        // while the same edit was refused on crops and farm types.
        $request->validate([
            'type_name' => "required|string|max:100|unique:livestock_types,type_name,{$livestockType->id}",
            'category'  => 'nullable|string|max:100',
        ]);

        $livestockType->update($request->only('type_name', 'category'));

        return back()->with('success', 'Livestock type updated.');
    }

    public function destroyLivestockType(LivestockType $livestockType)
    {
        if ($blocked = $this->blockIfInUse($livestockType, $livestockType->type_name)) {
            return $blocked;
        }

        $livestockType->delete();

        return back()->with('success', 'Livestock type deleted.');
    }

    /* ------------------------------------------------------ associations */

    public function storeAssociation(Request $request)
    {
        $request->validate([
            'association_name' => 'required|string|max:200|unique:associations',
        ]);

        Association::create($request->only('association_name'));

        return back()->with('success', 'Association added.');
    }

    public function updateAssociation(Request $request, Association $association)
    {
        $request->validate([
            'association_name' => "required|string|max:200|unique:associations,association_name,{$association->id}",
        ]);

        $association->update($request->only('association_name'));

        return back()->with('success', 'Association updated.');
    }

    public function destroyAssociation(Association $association)
    {
        // ON DELETE CASCADE here: deleting an association would take every
        // farmer's membership of it with it, silently.
        if ($blocked = $this->blockIfInUse($association, $association->association_name)) {
            return $blocked;
        }

        $association->delete();

        return back()->with('success', 'Association deleted.');
    }
}
