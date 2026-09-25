<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FarmParcel;
use App\Services\ParcelBoundaryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class GISController extends Controller
{
    public function index()
    {
        /*
         * geojson_data is deliberately NOT selected.
         *
         * It used to be, which meant every boundary was shipped twice on each
         * map open: once in these Inertia props and again from
         * /admin/gis/parcels-geojson, which is the only one the map reads.
         * This list exists for the target-parcel selector, which needs
         * identifying text and nothing else.
         */
        $parcels = FarmParcel::with('farmer')
            ->select('id', 'parcel_number', 'farmer_id', 'barangay', 'total_area_ha', 'commodity', 'farm_type_id')
            ->get();

        return Inertia::render('Admin/GIS/MapIndex', [
            'parcels' => $parcels,
        ]);
    }

    /**
     * Everything worth knowing about one parcel, fetched when it is clicked.
     *
     * Deliberately not folded into the parcels GeoJSON: that col6ction is
     * loaded in full on every map open, and carrying each farmer's crops,
     * livestock and assistance history in it would grow the payload with the
     * registry while almost none of it is ever looked at.
     *
     * Sections come back only when they hold something. The panel renders what
     * it is given, so an empty array is simply a section that does not appear -
     * a farmer with no fishpond should not see an empty Fishpond heading.
     */
    public function show(FarmParcel $parcel)
    {
        // One query per relationship rather than one per row. Crop seasons hang
        // off the parcel; the livestock and asset records hang off the farmer.
        $parcel->load([
            'farmType',
            'seasons.crop',
            'farmer.livestock.livestockType',
            'farmer.treeCrops',
            'farmer.fishponds',
            'farmer.associations',
            'farmer.distributions.program',
            /*
             * The office's response for this farmer.
             *
             * GIS reads these relationships; it never creates them. Clicking a
             * parcel answers "what has the office done about this land", which
             * until now needed three other screens — the map could show what
             * was handed out but not what decided to hand it out.
             */
            'farmer.interventions' => fn ($query) => $query
                ->with('parcel:id,parcel_number')
                ->latest('id')
                ->limit(10),
        ]);

        $farmer = $parcel->farmer;

        return response()->json([
            'parcel' => [
                'id'            => $parcel->id,
                'parcel_number' => $parcel->parcel_number,
                'barangay'      => $parcel->barangay,
                'recorded_area' => $parcel->total_area_ha,
                'farm_type'     => $parcel->farmType?->type_name,
                'commodity'     => $parcel->commodity,
                'ownership'     => $parcel->ownership_type,
            ],

            'farmer' => $farmer ? [
                'id'       => $farmer->id,
                'name'     => $farmer->full_name,
                'sex'      => $farmer->sex,
                'contact'  => $farmer->mobile_no,
                'barangay' => $farmer->barangay,
                'rsbsa_no' => $farmer->rsbsa_no,
                // A web path, never a filesystem one: the column stores the
                // path relative to the public disk, which is served through
                // the storage symlink.
                'photo_url' => $farmer->photo_path ? '/storage/' . $farmer->photo_path : null,
            ] : null,

            'crop_seasons' => $parcel->seasons->map(fn ($season) => [
                'crop'          => $season->crop?->crop_name,
                'season'        => $season->season,
                'year'          => $season->cropping_year,
                'area_planted'  => $season->area_planted_ha,
                'yield_kg'      => $season->yield_kg,
            ])->values(),

            'livestock' => $farmer?->livestock->map(fn ($animal) => [
                'type'   => $animal->livestockType?->type_name,
                'breed'  => $animal->breed,
                'count'  => $animal->count,
            ])->values() ?? [],

            'tree_crops' => $farmer?->treeCrops->map(fn ($tree) => [
                'crop'     => $tree->crop_type,
                'quantity' => $tree->quantity,
                'area'     => $tree->area_hectares,
            ])->values() ?? [],

            'fishponds' => $farmer?->fishponds->map(fn ($pond) => [
                'species' => $pond->species,
                'area'    => $pond->area_hectares,
            ])->values() ?? [],

            'associations' => $farmer?->associations->pluck('association_name')->values() ?? [],

            /*
             * Interventions raised for this farmer, newest first.
             *
             * Farmer-level rather than parcel-only: an intervention may concern
             * one piece of land or the whole holding, and hiding the
             * farmer-level ones would make the map disagree with the farmer's
             * own profile. `parcel` says which land each concerns, or null when
             * it concerns none in particular.
             */
            'interventions' => $farmer?->interventions
                // Ones concerning the parcel just clicked first, then newest.
                // Sorted here rather than in SQL because the parcel being
                // compared against is this request's, not a column.
                ->sortByDesc(fn ($row) => [
                    (int) ((int) $row->farm_parcel_id === (int) $parcel->id),
                    $row->id,
                ])
                ->map(fn ($row) => [
                'id'       => $row->id,
                'title'    => $row->display_title,
                'source'   => $row->source,
                'type'     => $row->type_label,
                'priority' => $row->priority,
                'status'   => $row->status,
                'parcel'   => $row->parcel?->parcel_number,
                // True when this intervention concerns the parcel just clicked,
                // so the panel can put those first.
                'is_this_parcel' => (int) $row->farm_parcel_id === (int) $parcel->id,
                'target_date'  => $row->target_date?->toDateString(),
                'completed_at' => $row->completed_at?->toDateString(),
            ])->values() ?? [],

            'assistance' => $farmer?->distributions->map(fn ($given) => [
                'program'  => $given->program?->program_name,
                'status'   => $given->status,
                'quantity' => $given->quantity_given,
                'date'     => $given->distribution_date,
            ])->values() ?? [],
        ]);
    }

    /**
     * Save a boundary drawn by hand on the map.
     *
     * Goes through ParcelBoundaryService so a drawn outline lands in exactly
     * the same places an imported one does: the spatial `geom` column that is
     * the source of truth, the `geojson_data` mirror the overlay reads, the
     * recorded area, and the provenance.
     *
     * This previously wrote geojson_data alone. Once geom became the source of
     * truth that left a drawn boundary invisible to the parcel form and to
     * overlap checking — it looked as though drawing had not worked at all.
     */
    public function saveGeometry(Request $request, $id, ParcelBoundaryService $boundaries)
    {
        $request->validate([
            'geojson' => 'required|json',
        ]);

        $geometry = json_decode($request->input('geojson'), true);

        try {
            $boundaries->validateGeometry($geometry);
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $parcel = FarmParcel::findOrFail($id);

        $boundaries->store($parcel, $geometry, [
            'source' => 'drawn',
            'file'   => null,
            // A sketch must not overwrite an area that may have come off a
            // land title; the sidebar shows drawn area separately.
            'overwrite_area' => false,
        ], $request->user()?->id);

        $area = $boundaries->areaHectares($geometry);

        return back()->with('success', "Farm boundary saved — {$area} ha.");
    }

    /**
     * Every parcel in the registry, as GeoJSON.
     *
     * EVERY parcel — including the ones nobody has drawn yet. This used to end
     * in whereNotNull('geojson_data'), which meant a parcel without a boundary
     * never reached the map at all: not on it, not in the parcel list beside
     * it, not in the search, and not in the totals. Staff had no way to find
     * the records still needing a boundary from the one screen whose whole job
     * is boundaries.
     *
     * A parcel with no outline comes back as a Feature with `geometry: null`,
     * which is valid GeoJSON, and `has_boundary: false`. Only the features
     * that do carry geometry are ever handed to the map layers — see
     * sanitiseParcels on the client — so nothing is asked to draw a null. The
     * rest of the page reads the whole collection.
     *
     * No coordinates are invented for the undrawn ones. A parcel whose
     * boundary is unknown is shown as unknown.
     */
    public function getParcelsGeoJSON()
    {
        // farmType is loaded for the popup's crop line. geojson_data is kept in
        // step with the spatial geom column by ParcelBoundaryService, so an
        // imported boundary appears here without a second write path.
        /*
         * withCount rather than loading the distributions themselves: the map
         * only needs to know WHETHER a farmer has ever received assistance, and
         * eager-loading every distribution row for every mapped parcel would
         * grow this payload with the programme history for a single boolean.
         */
        $parcels = FarmParcel::with([
                'farmType',
                'farmer' => fn ($query) => $query->withCount('distributions'),
            ])
            ->get();

        $features = [];
        foreach ($parcels as $parcel) {
            /*
             * json_decode gives null for null, for '' and for malformed JSON
             * alike, and all three mean the same thing here: no usable outline.
             * Treated as "not drawn yet" rather than skipped, because a row
             * with a corrupt boundary is precisely the row somebody needs to
             * see in order to fix it.
             */
            $geometry = $parcel->geojson_data
                ? json_decode($parcel->geojson_data, true)
                : null;

            $features[] = [
                'type' => 'Feature',
                // Top-level id as well as the one in properties: this is
                // what setFeatureState addresses a feature by, and giving
                // it here is the plain GeoJSON way. The alternative,
                // promoteId on the source, lifts the property instead but
                // is one more thing that has to be right for a parcel to
                // draw at all.
                'id' => $parcel->id,
                'geometry' => $geometry,
                'properties' => [
                    'id' => $parcel->id,
                    'parcel_number' => $parcel->parcel_number ?? 'N/A',
                    // null, not 'Unknown' — the map needs to tell an
                    // unassigned parcel from one whose farmer failed to
                    // load, and only one of those is a job for staff.
                    'farmer_id'   => $parcel->farmer_id,
                    'farmer_name' => $parcel->farmer
                        ? trim($parcel->farmer->first_name . ' ' . $parcel->farmer->last_name)
                        : null,
                    'rsbsa_no'    => $parcel->farmer?->rsbsa_no,
                    'barangay' => $parcel->barangay,

                    /*
                     * Where the LAND is, which is not where the farmer lives.
                     *
                     * A Tumauini farmer may hold a parcel in Cabagan or Ilagan.
                     * These two columns are the parcel's own, already recorded
                     * and already shown on the farmer's profile; sending them
                     * here is what lets the map filter by municipality rather
                     * than assume every parcel sits in Tumauini.
                     */
                    'city_municipality' => $parcel->city_municipality,
                    'province'          => $parcel->province,

                    'area_ha' => $parcel->total_area_ha,
                    'commodity' => $parcel->commodity,
                    'farm_type' => $parcel->farmType?->type_name,
                    // Lets the popup say whether this outline was surveyed
                    // or sketched by hand — they should not read alike.
                    'boundary_source' => $parcel->boundary_source,

                    /*
                     * Whether this parcel has an outline at all.
                     *
                     * Stated as its own property rather than left for the
                     * client to infer from a null geometry: the list, the
                     * filters and the parcel card all ask the question, and
                     * none of them should have to reach into the geometry to
                     * answer it.
                     */
                    'has_boundary' => $geometry !== null,

                    /*
                     * Two thematic fields, so the map can shade parcels by
                     * risk or by whether their farmer has been helped.
                     *
                     * Both are values the office already holds; neither is
                     * derived or guessed here. risk_status is nullable and
                     * stays null when no assessment has been made — "not
                     * assessed" and "low risk" are different answers and
                     * the map must not conflate them.
                     */
                    'risk_status'    => $parcel->farmer?->risk_status,
                    'has_assistance' => (bool) ($parcel->farmer?->distributions_count ?? 0),
                ],
            ];
        }

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }

    public function deleteGeometry($id)
    {
        $parcel = FarmParcel::findOrFail($id);
        $parcel->geojson_data = null;
        $parcel->save();

        return back()->with('success', 'Farm boundary deleted successfully.');
    }
}
