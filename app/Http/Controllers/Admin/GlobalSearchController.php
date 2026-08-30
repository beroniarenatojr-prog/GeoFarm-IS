<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\FarmParcel;
use Illuminate\Http\Request;

/**
 * Header search. Lets staff jump straight to a farmer or parcel from any page
 * instead of navigating to the registry first and searching there.
 *
 * Results are capped hard: this runs on every keystroke against a registry
 * sized for 8,000+ farmers, so it must stay cheap.
 */
class GlobalSearchController extends Controller
{
    private const LIMIT = 6;

    public function __invoke(Request $request)
    {
        $term = trim((string) $request->query('q', ''));

        // Two characters is the floor; one letter would match most of the registry.
        if (mb_strlen($term) < 2) {
            return response()->json(['farmers' => [], 'parcels' => [], 'term' => $term]);
        }

        $like = '%' . $term . '%';

        $farmers = $request->user()->can('view farmers')
            ? Farmer::query()
                ->verified()
                ->select(['id', 'first_name', 'middle_name', 'last_name', 'suffix', 'rsbsa_no', 'barangay', 'mobile_no'])
                ->where(fn ($q) => $q
                    ->where('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('middle_name', 'like', $like)
                    ->orWhere('rsbsa_no', 'like', $like)
                    ->orWhere('mobile_no', 'like', $like))
                ->orderBy('last_name')
                ->limit(self::LIMIT)
                ->get()
                ->map(fn (Farmer $f) => [
                    'id'       => $f->id,
                    'title'    => $f->full_name,
                    'subtitle' => collect([$f->rsbsa_no ? "RSBSA {$f->rsbsa_no}" : null, $f->barangay])
                        ->filter()->implode(' · '),
                    'url'      => "/admin/farmers/{$f->id}",
                ])
            : collect();

        $parcels = $request->user()->can('view parcels')
            ? FarmParcel::query()
                ->select(['id', 'parcel_number', 'barangay', 'total_area_ha', 'farmer_id'])
                ->with('farmer:id,first_name,last_name')
                ->where(fn ($q) => $q
                    ->where('parcel_number', 'like', $like)
                    ->orWhere('barangay', 'like', $like)
                    ->orWhere('commodity', 'like', $like)
                    ->orWhereHas('farmer', fn ($f) => $f
                        ->where('first_name', 'like', $like)
                        ->orWhere('last_name', 'like', $like)))
                ->orderBy('parcel_number')
                ->limit(self::LIMIT)
                ->get()
                ->map(fn (FarmParcel $p) => [
                    'id'       => $p->id,
                    'title'    => 'Parcel ' . ($p->parcel_number ?: '(no number)'),
                    'subtitle' => collect([
                        $p->farmer?->last_name ? "{$p->farmer->last_name}, {$p->farmer->first_name}" : null,
                        $p->barangay,
                        $p->total_area_ha ? number_format((float) $p->total_area_ha, 2) . ' ha' : null,
                    ])->filter()->implode(' · '),
                    'url'      => "/admin/parcels/{$p->id}/edit",
                ])
            : collect();

        return response()->json([
            'term'    => $term,
            'farmers' => $farmers->values(),
            'parcels' => $parcels->values(),
        ]);
    }
}
