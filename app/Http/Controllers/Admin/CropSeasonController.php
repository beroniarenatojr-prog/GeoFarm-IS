<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\SeasonalInput;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CropSeasonController extends Controller
{
    public function index(Request $request)
    {
        /*
         * The picker is Farmer -> Parcel, in that order.
         *
         * Staff know who they are encoding for; they do not know a parcel by
         * its number. The farmer travels separately so the form can group the
         * options under their name, and the label describes the land rather
         * than repeating it.
         *
         * Most parcels carry no parcel_number, which is why the barangay
         * stands in — the old label printed a bare "Parcel #" for all of them.
         */
        $parcels = FarmParcel::with('farmer')
            ->select('id', 'parcel_number', 'barangay', 'commodity', 'farmer_id')
            ->get()
            ->sortBy([
                fn ($p) => $p->farmer?->full_name ?? '',
                fn ($p) => $p->parcel_number ?? '',
            ])
            ->map(fn ($p) => [
                'id'     => $p->id,
                'farmer' => $p->farmer?->full_name ?: 'Unknown farmer',
                'label'  => collect([
                    $p->parcel_number ? "Parcel #{$p->parcel_number}" : 'No parcel no.',
                    $p->barangay,
                    $p->commodity,
                ])->filter()->implode(' · '),
            ])
            ->values();

        // Show all seasons by default with filters
        $seasons = CropSeason::with(['crop', 'parcel.farmer', 'parcel.farmType', 'inputs'])
            ->when($request->parcel_id, fn($q, $p) => $q->where('parcel_id', $p))
            ->when($request->season, fn($q, $s) => $q->where('season', $s))
            ->when($request->year,   fn($q, $y) => $q->where('cropping_year', $y))
            ->when($request->crop_id, fn($q, $c) => $q->where('crop_id', $c))
            // Barangay and commodity live on the parcel, not the season, so
            // both filter through the relationship rather than duplicating
            // those columns onto every cropping.
            ->when($request->barangay, fn ($q, $b) => $q->whereHas(
                'parcel', fn ($p) => $p->where('barangay', 'like', "%{$b}%")
            ))
            ->when($request->commodity, fn ($q, $c) => $q->whereHas(
                'parcel', fn ($p) => $p->where('commodity', 'like', "%{$c}%")
            ))
            ->when($request->search, function($q, $search) {
                $q->whereHas('parcel.farmer', function($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('rsbsa_no', 'like', "%{$search}%");
                });
            })
            // Farmer, then year, then season — the order the office reads a
            // holding's history in.
            ->orderByDesc('cropping_year')
            ->orderBy('season')
            ->paginate(20)
            ->withQueryString();

        // Totals for the summary strip. Deliberately reflect the SAME filters
        // as the table, so the headline figures always describe what is on
        // screen rather than the whole database.
        $scoped = fn () => CropSeason::query()
            ->when($request->parcel_id, fn ($q, $p) => $q->where('parcel_id', $p))
            ->when($request->season, fn ($q, $s) => $q->where('season', $s))
            ->when($request->year, fn ($q, $y) => $q->where('cropping_year', $y))
            ->when($request->crop_id, fn ($q, $c) => $q->where('crop_id', $c))
            ->when($request->barangay, fn ($q, $b) => $q->whereHas(
                'parcel', fn ($p) => $p->where('barangay', 'like', "%{$b}%")
            ))
            ->when($request->commodity, fn ($q, $c) => $q->whereHas(
                'parcel', fn ($p) => $p->where('commodity', 'like', "%{$c}%")
            ))
            ->when($request->search, fn ($q, $search) => $q->whereHas(
                'parcel.farmer',
                fn ($f) => $f->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('rsbsa_no', 'like', "%{$search}%")
            ));

        return Inertia::render('Admin/Seasonal/Index', [
            'parcels'        => $parcels,
            'seasons'        => $seasons,
            'crops'          => Crop::orderBy('crop_name')->get(['id', 'crop_name']),
            'filters'        => $request->only([
                'parcel_id', 'season', 'year', 'crop_id', 'search', 'barangay', 'commodity',
            ]),
            'barangays'      => FarmParcel::whereNotNull('barangay')->where('barangay', '!=', '')
                ->distinct()->orderBy('barangay')->pluck('barangay')->values(),
            'commodities'    => FarmParcel::whereNotNull('commodity')->where('commodity', '!=', '')
                ->distinct()->orderBy('commodity')->pluck('commodity')->values(),
            'summary'        => [
                'seasons'   => $scoped()->count(),
                'hectares'  => round((float) $scoped()->sum('area_planted_ha'), 2),
                'yield_kg'  => round((float) $scoped()->sum('yield_kg'), 2),
                'harvested' => $scoped()->whereNotNull('harvest_date')->count(),
                'cost'      => round((float) $scoped()->sum('production_cost'), 2),
                'revenue'   => round((float) $scoped()->sum('total_income'), 2),
                'net_income' => round(
                    (float) $scoped()->sum('total_income') - (float) $scoped()->sum('production_cost'),
                    2,
                ),
                // Averaged over the whole scope rather than by averaging each
                // row's own cost per kilo: a season that produced 5 t and one
                // that produced 50 kg must not count equally.
                'cost_per_kg' => $this->blendedCostPerKg($scoped()),
                'costed'    => $scoped()->whereNotNull('production_cost')->count(),
            ],
            // Cost of production by year, split wet and dry.
            'costByYear'     => $this->costByYear($scoped()),
        ]);
    }

    /**
     * Cost per kilo across a set of seasons.
     *
     * Total cost over total yield, not the mean of each row's ratio — a season
     * that produced five tonnes and one that produced fifty kilos would
     * otherwise carry equal weight and the answer would be meaningless.
     *
     * Only rows carrying BOTH a cost and a yield are counted; a costed season
     * still in the ground would otherwise inflate the price of everything
     * already harvested.
     */
    private function blendedCostPerKg($query): ?float
    {
        $row = (clone $query)
            ->whereNotNull('production_cost')
            ->where('yield_kg', '>', 0)
            ->selectRaw('SUM(production_cost) AS cost, SUM(yield_kg) AS kg')
            ->first();

        if (!$row || !$row->kg) {
            return null;
        }

        return round((float) $row->cost / (float) $row->kg, 2);
    }

    /**
     * The year's agriculture, wet against dry.
     *
     * Annual cost is wet + dry, which falls out of the grouping rather than
     * needing a rule: a parcel cropped only in the wet season contributes one
     * row and its annual cost IS that season's cost. Nothing is stored — a
     * season row already IS a year and a season, so this is a grouping rather
     * than four more columns to keep in step.
     *
     * Revenue and net income are carried alongside cost because a cost with no
     * revenue beside it cannot answer the only question the office actually
     * asks of it: did the year make money.
     */
    private function costByYear($query): array
    {
        $rows = (clone $query)
            ->selectRaw('cropping_year, season')
            ->selectRaw('SUM(production_cost) AS cost')
            ->selectRaw('SUM(total_income) AS revenue')
            ->selectRaw('SUM(yield_kg) AS kg')
            ->selectRaw('SUM(area_planted_ha) AS ha')
            ->selectRaw('COUNT(*) AS seasons')
            ->selectRaw('SUM(production_cost IS NOT NULL) AS costed')
            ->groupBy('cropping_year', 'season')
            ->orderByDesc('cropping_year')
            ->get();

        $years = [];

        foreach ($rows as $row) {
            $year = (int) $row->cropping_year;

            $years[$year] ??= [
                'year'          => $year,
                'dry'           => null,
                'wet'           => null,
                'total_cost'    => 0.0,
                'total_revenue' => 0.0,
                'total_kg'      => 0.0,
                'hectares'      => 0.0,
            ];

            $cost    = (float) $row->cost;
            $revenue = (float) $row->revenue;

            $years[$year][$row->season] = [
                'cost'        => round($cost, 2),
                'revenue'     => round($revenue, 2),
                'net_income'  => round($revenue - $cost, 2),
                'kg'          => round((float) $row->kg, 2),
                'hectares'    => round((float) $row->ha, 2),
                'seasons'     => (int) $row->seasons,
                'costed'      => (int) $row->costed,
                'cost_per_kg' => $row->kg > 0 ? round($cost / (float) $row->kg, 2) : null,
            ];

            $years[$year]['total_cost']    += $cost;
            $years[$year]['total_revenue'] += $revenue;
            $years[$year]['total_kg']      += (float) $row->kg;
            $years[$year]['hectares']      += (float) $row->ha;
        }

        // Annual net income and cost per hectare, once both seasons are in.
        foreach ($years as &$year) {
            $year['total_cost']    = round($year['total_cost'], 2);
            $year['total_revenue'] = round($year['total_revenue'], 2);
            $year['net_income']    = round($year['total_revenue'] - $year['total_cost'], 2);
            // Over the year's planted hectares, so a parcel worked twice counts
            // its area twice — that is two crops' worth of work on one holding.
            $year['cost_per_hectare'] = $year['hectares'] > 0
                ? round($year['total_cost'] / $year['hectares'], 2)
                : null;
        }

        return array_values($years);
    }

    public function store(Request $request)
    {
        $data = $request->validate(
            ['parcel_id' => 'required|exists:farm_parcels,id'] + $this->rules($request),
        );

        $season = DB::transaction(function () use ($data, $request) {
            $season = CropSeason::create($this->seasonAttributes($data));
            $this->syncInputs($season, $request->input('inputs', []));
            $this->settleTotals($season);

            return $season;
        });

        return back()->with('success', 'Season entry added.');
    }

    public function update(Request $request, CropSeason $season)
    {
        $data = $request->validate($this->rules($request, $season));

        DB::transaction(function () use ($season, $data, $request) {
            $season->update($this->seasonAttributes($data));
            $this->syncInputs($season, $request->input('inputs', []));
            $this->settleTotals($season);
        });

        return back()->with('success', 'Season entry updated.');
    }

    /**
     * Validation shared by store and update.
     *
     * The uniqueness rule is the one that matters: two rows for the same
     * parcel, year and season are not two harvests, they are one harvest
     * encoded twice — and it doubles that parcel's cost and production in
     * every report and in the risk scoring.
     */
    private function rules(Request $request, ?CropSeason $season = null): array
    {
        $parcelId = $season?->parcel_id ?? $request->input('parcel_id');

        return [
            'season'        => [
                'required', 'in:dry,wet',
                Rule::unique('crop_seasons', 'season')
                    ->where('parcel_id', $parcelId)
                    ->where('cropping_year', $request->input('cropping_year'))
                    ->ignore($season?->id),
            ],
            'cropping_year' => 'required|integer|min:2000|max:2100',
            // Required when a person is filling the form in; the rows opened
            // automatically from a cropping schedule may legitimately have no
            // crop yet, which is why the column itself is nullable.
            'crop_id'         => 'required|exists:crops,id',
            'area_planted_ha' => 'nullable|numeric|min:0',
            'planting_date'   => 'nullable|date',
            'harvest_date'    => 'nullable|date|after_or_equal:planting_date',

            'yield_kg'        => 'nullable|numeric|min:0',
            'production_unit' => 'nullable|string|max:20',
            'selling_price'   => 'nullable|numeric|min:0|max:99999999.99',
            'total_income'    => 'nullable|numeric|min:0|max:99999999.99',

            'production_cost' => 'nullable|numeric|min:0|max:99999999.99',
            'labor_cost'      => 'nullable|numeric|min:0|max:99999999.99',
            'other_cost'      => 'nullable|numeric|min:0|max:99999999.99',

            'is_organic'        => 'nullable|boolean',
            'fertilizer_type'   => 'nullable|string|max:100',
            'fertilizer_qty_kg' => 'nullable|numeric|min:0|max:99999999.99',
            'fertilizer_class'  => 'nullable|in:organic,inorganic,mixed',

            // Itemised inputs. A season may carry any number of them — two
            // fertilizers and three chemicals is ordinary.
            'inputs'            => 'nullable|array|max:50',
            'inputs.*.input_type' => ['required', Rule::in(SeasonalInput::TYPES)],
            'inputs.*.name'     => 'nullable|string|max:120',
            'inputs.*.quantity' => 'nullable|numeric|min:0|max:99999999.99',
            'inputs.*.unit'     => 'nullable|string|max:20',
            'inputs.*.cost'     => 'nullable|numeric|min:0|max:99999999.99',
            'inputs.*.notes'    => 'nullable|string|max:500',
        ];
    }

    /** The validated fields that belong on the season row itself. */
    private function seasonAttributes(array $data): array
    {
        return collect($data)->except(['inputs'])->all();
    }

    /**
     * Replace this season's input rows with what was submitted.
     *
     * Deleted and rewritten rather than diffed: the form sends the whole list,
     * a row carries no identity a user would recognise, and matching them up
     * would be more code than the rows are worth. Nothing else references
     * them, so nothing is orphaned.
     */
    private function syncInputs(CropSeason $season, array $inputs): void
    {
        $season->inputs()->delete();

        $rows = collect($inputs)
            // A blank line left behind in the form is not an input.
            ->filter(fn ($input) => filled($input['input_type'] ?? null))
            ->map(fn ($input) => [
                'input_type' => $input['input_type'],
                'name'       => $input['name'] ?? null,
                'quantity'   => $input['quantity'] ?? null,
                'unit'       => $input['unit'] ?? null,
                'cost'       => $input['cost'] ?? null,
                'notes'      => $input['notes'] ?? null,
            ]);

        if ($rows->isNotEmpty()) {
            $season->inputs()->createMany($rows->all());
        }
    }

    /**
     * Keep the season's two headline figures in step with their own parts.
     *
     * Cost: when anything has been itemised, production_cost becomes the sum
     * of the inputs plus labour and other expenses. A season costed as one
     * lump instead is left exactly as the office entered it.
     *
     * Revenue: quantity x price, when both are known and no total was typed.
     * total_income stays the stored answer either way, because the risk
     * scorer and the palugi classification read that column and a second
     * revenue figure could only disagree with it.
     */
    private function settleTotals(CropSeason $season): void
    {
        $season->refresh()->load('inputs');

        $changes = [];

        if (($fromParts = $season->costFromParts()) !== null) {
            $changes['production_cost'] = $fromParts;
        }

        if ($season->total_income === null
            && $season->yield_kg !== null
            && $season->selling_price !== null) {
            $changes['total_income'] = round(
                (float) $season->yield_kg * (float) $season->selling_price,
                2,
            );
        }

        if ($changes !== []) {
            $season->update($changes);
        }
    }

    public function destroy(CropSeason $season)
    {
        $season->delete();
        return back()->with('success', 'Season entry deleted.');
    }
}
