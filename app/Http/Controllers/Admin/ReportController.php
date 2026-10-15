<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AssistanceDistribution;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use App\Models\Livestock;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Reports/Index');
    }

    /**
     * Return a report in the shape that was asked for.
     *
     * One place, for one reason: the preview and the PDF must be the same
     * document. The point of previewing a report is to see what you are about
     * to hand to the DA, and a preview built from a second rendering path would
     * eventually drift from the file — showing a column the PDF omits, or the
     * other way round, which is worse than having no preview at all.
     *
     *   format=pdf   the file, as a download
     *   format=html  the same Blade view, rendered for the preview iframe
     *   otherwise    the raw figures as JSON
     *
     * The report templates are complete HTML documents with their own
     * print-oriented CSS, which is why the preview is framed rather than
     * injected into the page: their `table`/`th`/`td` rules would otherwise
     * restyle the whole dashboard.
     */
    private function respond(Request $request, string $view, $data, string $filename, array $with = [])
    {
        // $with carries whatever else a template needs beside its rows — a
        // programme header, a summary line. It is merged in one place so the
        // preview and the PDF cannot be given different context.
        $viewData = $with + ['data' => $data];

        if ($request->format === 'pdf') {
            return Pdf::loadView($view, $viewData)->download("$filename.pdf");
        }

        if ($request->format === 'html') {
            return response()->view($view, $viewData);
        }

        return response()->json($data);
    }

    public function farmerDemographics(Request $request)
    {
        // Reports go to the DA, so they must count verified farmers only.
        $data = Farmer::query()
            ->verified()
            ->when($request->barangay, fn($q, $v) => $q->where('barangay', $v))
            ->selectRaw('barangay, sex, COUNT(*) as count')
            ->groupBy('barangay', 'sex')
            ->get();

        return $this->respond($request, 'reports.farmer-demographics', $data, 'farmer-demographics');
    }

    public function cropProduction(Request $request)
    {
        $data = CropSeason::with('crop')
            ->when($request->season, fn($q, $v) => $q->where('season', $v))
            ->when($request->year, fn($q, $v) => $q->where('cropping_year', $v))
            ->selectRaw('crop_id, season, cropping_year, SUM(area_planted_ha) as total_area, SUM(yield_kg) as total_yield')
            ->groupBy('crop_id', 'season', 'cropping_year')
            ->get();

        return $this->respond($request, 'reports.crop-production', $data, 'crop-production');
    }

    public function livestockInventory(Request $request)
    {
        $data = Livestock::with('livestockType')
            ->selectRaw('livestock_type_id, SUM(count) as total')
            ->groupBy('livestock_type_id')
            ->get();

        return $this->respond($request, 'reports.livestock', $data, 'livestock-inventory');
    }

    public function assistanceSummary(Request $request)
    {
        $data = AssistanceDistribution::with([
                // farmer carries the barangay column the report prints; parcel
                // is its fallback, and itemIssues the "item given" column.
                // Eager loaded because the report walks every row — without
                // this it is three queries per distribution.
                'farmer:id,first_name,last_name,barangay',
                'program:id,program_name',
                'parcel:id,barangay',
                'itemIssues.item:id,item_name,unit',
            ])
            ->when($request->date_from, fn($q, $v) => $q->whereDate('distribution_date', '>=', $v))
            ->when($request->date_to, fn($q, $v) => $q->whereDate('distribution_date', '<=', $v))
            ->get();

        return $this->respond($request, 'reports.assistance', $data, 'assistance-summary');
    }

    /**
     * One programme's distribution report.
     *
     * Reached from the Actions menu on the programme list, previewed in a modal
     * before anyone downloads it. Rows are flattened here rather than in the
     * template so the figures are worked out once, in PHP, where the fallbacks
     * — a farmer's barangay versus the parcel's, cash versus goods — can be
     * stated plainly instead of being buried in Blade.
     */
    public function assistanceProgram(Request $request, FinancialAssistance $assistance)
    {
        $distributions = AssistanceDistribution::with([
                'farmer:id,first_name,middle_name,last_name,suffix,rsbsa_no,barangay',
                'parcel:id,barangay',
                'itemIssues.item:id,item_name,unit',
            ])
            ->where('assistance_id', $assistance->id)
            ->orderBy('distribution_date')
            ->get();

        $data = $distributions->map(fn (AssistanceDistribution $d) => [
            'farmer'   => $d->farmer?->full_name ?: 'Farmer no longer on file',
            'rsbsa_no' => $d->farmer?->rsbsa_no,
            // Where the farmer is. A release recorded against a parcel in
            // another barangay falls back to that, since it is the better
            // answer than nothing.
            'barangay' => $d->farmer?->barangay ?: $d->parcel?->barangay,
            'date'     => $d->distribution_date?->format('M d, Y'),
            /*
             * Null, not zero, for a goods-only hand-out. Printing 0.00 would
             * say the farmer was paid nothing when in fact they were not paid
             * at all — and a column of zeroes totals to the same thing either
             * way, which is how a goods programme comes to look unfunded.
             */
            'amount'   => $d->amount_given === null ? null : (float) $d->amount_given,
            'items'    => $d->itemIssues->map(function ($issue) {
                // Trailing zeros trimmed: "2 sacks", not "2.00 sacks".
                $quantity = rtrim(rtrim(number_format((float) $issue->quantity, 2), '0'), '.');

                return trim("{$quantity} {$issue->item?->unit} {$issue->item?->item_name}");
            })->filter()->values()->all(),
            'status'       => $d->status,
            'status_label' => match ($d->status) {
                'claimed'   => 'Received',
                'pending'   => 'Awaiting collection',
                'forfeited' => 'Forfeited',
                default     => ucfirst((string) $d->status),
            },
        ]);

        // Forfeited rows are excluded from every figure below for the reason the
        // rest of this module excludes them: the goods went back on the shelf.
        $live = $distributions->where('status', '!=', 'forfeited');

        $summary = [
            'beneficiaries' => $live->count(),
            'received'      => $distributions->where('status', 'claimed')->count(),
            'awaiting'      => $distributions->where('status', 'pending')->count(),
            'forfeited'     => $distributions->where('status', 'forfeited')->count(),
            // What has actually been handed over, not what was allocated.
            'cash_total'    => round(
                (float) $distributions->where('status', 'claimed')->sum('amount_given'),
                2,
            ),
        ];

        $assistance->loadMissing('assistanceType:id,type_name');

        $slug = Str::slug($assistance->program_name) ?: "programme-{$assistance->id}";

        return $this->respond(
            $request,
            'reports.assistance-program',
            $data,
            "{$slug}-distributions",
            ['program' => $assistance, 'summary' => $summary],
        );
    }

    public function agriculturalAssets(Request $request)
    {
        $data = [
            'tree_crops' => \DB::table('tree_crops')
                ->join('farmers', 'tree_crops.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'tree_crops.crop_type', 
                    \DB::raw('SUM(tree_crops.quantity) as total_trees'),
                    \DB::raw('SUM(tree_crops.area_hectares) as total_area'))
                ->groupBy('farmers.barangay', 'tree_crops.crop_type')
                ->get(),

            'fishponds' => \DB::table('fishponds')
                ->join('farmers', 'fishponds.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'fishponds.species',
                    \DB::raw('SUM(fishponds.area_hectares) as total_area'))
                ->groupBy('farmers.barangay', 'fishponds.species')
                ->get(),

            'large_ruminants' => \DB::table('large_ruminants')
                ->join('farmers', 'large_ruminants.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'large_ruminants.animal_type',
                    \DB::raw('SUM(large_ruminants.male_count) as total_male'),
                    \DB::raw('SUM(large_ruminants.female_count) as total_female'),
                    \DB::raw('SUM(large_ruminants.male_count + large_ruminants.female_count) as total_heads'),
                    \DB::raw('COUNT(CASE WHEN large_ruminants.is_large_raiser = 1 THEN 1 END) as large_raisers'))
                ->groupBy('farmers.barangay', 'large_ruminants.animal_type')
                ->get(),

            'small_ruminants' => \DB::table('small_ruminants')
                ->join('farmers', 'small_ruminants.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'small_ruminants.animal_type',
                    \DB::raw('SUM(small_ruminants.male_count) as total_male'),
                    \DB::raw('SUM(small_ruminants.female_count) as total_female'),
                    \DB::raw('SUM(small_ruminants.male_count + small_ruminants.female_count) as total_heads'),
                    \DB::raw('COUNT(CASE WHEN small_ruminants.is_large_raiser = 1 THEN 1 END) as large_raisers'))
                ->groupBy('farmers.barangay', 'small_ruminants.animal_type')
                ->get(),

            'swine' => \DB::table('native_pigs')
                ->join('farmers', 'native_pigs.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay',
                    \DB::raw('"Native" as type'),
                    \DB::raw('SUM(native_pigs.male_count) as total_male'),
                    \DB::raw('SUM(native_pigs.female_count) as total_female'),
                    \DB::raw('SUM(native_pigs.male_count + native_pigs.female_count) as total_heads'))
                ->groupBy('farmers.barangay')
                ->union(
                    \DB::table('swine_hybrid')
                        ->join('farmers', 'swine_hybrid.farmer_id', '=', 'farmers.id')
                        ->select('farmers.barangay',
                            \DB::raw('CONCAT("Hybrid-", swine_hybrid.variety) as type'),
                            \DB::raw('SUM(swine_hybrid.male_count) as total_male'),
                            \DB::raw('SUM(swine_hybrid.female_count) as total_female'),
                            \DB::raw('SUM(swine_hybrid.male_count + swine_hybrid.female_count) as total_heads'))
                        ->groupBy('farmers.barangay', 'swine_hybrid.variety')
                )
                ->get(),

            'poultry' => \DB::table('poultry')
                ->join('farmers', 'poultry.farmer_id', '=', 'farmers.id')
                ->select('farmers.barangay', 'poultry.bird_type',
                    \DB::raw('SUM(poultry.male_count) as total_male'),
                    \DB::raw('SUM(poultry.female_count) as total_female'),
                    \DB::raw('SUM(poultry.male_count + poultry.female_count) as total_heads'))
                ->groupBy('farmers.barangay', 'poultry.bird_type')
                ->get(),
        ];

        return $this->respond($request, 'reports.agricultural-assets', $data, 'agricultural-assets');
    }
}
