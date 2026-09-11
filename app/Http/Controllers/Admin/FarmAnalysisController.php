<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgriculturalIntervention;
use App\Models\Barangay;
use App\Models\Farmer;
use App\Models\FarmerMessage;
use App\Models\FinancialAssistance;
use App\Models\LivestockType;
use App\Notifications\FarmRiskAlert;
use App\Services\AuditService;
use App\Services\ClimateRecommendationEngine;
use App\Services\InterventionSuggester;
use App\Services\ParcelRiskAnalyser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

/**
 * One farmer's farm, analysed parcel by parcel.
 *
 * The municipality-wide page answers "who needs attention"; this answers "what
 * is happening on this farm, on what evidence, and what should be done about
 * it". Everything shown is computed by ParcelRiskAnalyser from records that
 * already exist — this controller decides what reaches the screen and nothing
 * about the analysis itself.
 *
 * Not cached. The whole point is that it is read while advising a specific
 * farmer, often just after their assessment was submitted, and a ten-minute
 * cache would show the adviser the answer from before the conversation.
 */
class FarmAnalysisController extends Controller
{
    /**
     * Choose whose farm to analyse.
     *
     * This is where the Crop Estimator used to sit in the menu. The estimator
     * asked for a crop and a hectare figure and answered how much it might
     * yield; the office arrives knowing a farmer's name and wanting to know
     * whether that farm is in trouble, which is the question this answers.
     *
     * Verified farmers only. Nothing on a pending registration has been
     * checked, and analysing it would dress unverified data up as a finding.
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'search'   => 'nullable|string|max:100',
            'barangay' => 'nullable|string|max:50',
        ]);

        $search = $filters['search'] ?? null;
        $barangay = $filters['barangay'] ?? null;

        /*
         * The counts come from withCount, not from loading the rows: a page of
         * farmers each dragging in their parcels and ponds is the classic N+1,
         * and the list only needs the numbers.
         *
         * latestRiskAssessment is eager-loaded rather than queried per row for
         * the same reason.
         */
        $farmers = Farmer::verified()
            // Columns qualified by hand. latestOfMany joins the assessments
            // table to two derived copies of itself, so a bare "farmer_id" in
            // the select list is ambiguous and MySQL refuses the query.
            ->with(['latestRiskAssessment' => fn ($q) => $q->select(
                'climate_risk_assessments.id',
                'climate_risk_assessments.farmer_id',
                'climate_risk_assessments.risk_level',
                'climate_risk_assessments.risk_score',
                'climate_risk_assessments.assessed_at',
            )])
            ->withCount([
                'parcels as crop_parcels' => fn ($q) => $q->whereNotIn(
                    DB::raw('LOWER(TRIM(COALESCE(commodity, "")))'),
                    $this->livestockNames(),
                ),
                'parcels as livestock_parcels' => fn ($q) => $q->whereIn(
                    DB::raw('LOWER(TRIM(COALESCE(commodity, "")))'),
                    $this->livestockNames(),
                ),
                'fishponds as fishponds',
            ])
            ->when($search, fn ($q) => $q->where(fn ($w) => $w
                ->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('rsbsa_no', 'like', "%{$search}%")))
            ->when($barangay, fn ($q) => $q->where('barangay', $barangay))
            // Highest risk first, then the unassessed, then the rest. The point
            // of the page is to reach the farms that need attention soonest.
            ->orderByRaw("FIELD((select risk_level from climate_risk_assessments where farmer_id = farmers.id order by assessed_at desc limit 1), 'high', 'moderate', 'low')")
            ->orderBy('last_name')
            ->paginate(12)
            ->withQueryString()
            ->through(fn (Farmer $farmer) => [
                'id'                => $farmer->id,
                'name'              => $farmer->full_name,
                'barangay'          => $farmer->barangay,
                'rsbsa_no'          => $farmer->rsbsa_no,
                'crop_parcels'      => $farmer->crop_parcels,
                'livestock_parcels' => $farmer->livestock_parcels,
                'fishponds'         => $farmer->fishponds,
                // Null level and assessed:false are two different facts and the
                // page needs both — "not assessed" must never render as green.
                'assessed'          => $farmer->latestRiskAssessment !== null,
                'risk_level'        => $farmer->latestRiskAssessment?->risk_level,
                'risk_score'        => $farmer->latestRiskAssessment?->risk_score,
                'assessed_at'       => $farmer->latestRiskAssessment?->assessed_at,
                'is_stale'          => $farmer->latestRiskAssessment?->is_stale ?? false,
            ]);

        return Inertia::render('Admin/Analytics/FarmIndex', [
            'farmers'   => $farmers,
            'filters'   => ['search' => $search, 'barangay' => $barangay],
            'barangays' => Barangay::where('is_active', true)->orderBy('name')->pluck('name'),
            'upcoming'  => app(ParcelRiskAnalyser::class)->upcomingPeriod(),
        ]);
    }

    /**
     * Commodity names that mean livestock, lower-cased for comparison.
     *
     * Read from the livestock_types table rather than hard-coded, so the split
     * between a crop parcel and a livestock one follows the same lookup
     * CommodityCatalogue uses everywhere else.
     */
    private function livestockNames(): array
    {
        return LivestockType::query()
            ->pluck('type_name')
            ->map(fn ($name) => mb_strtolower(trim($name)))
            ->all() ?: [''];
    }

    public function show(
        Request $request,
        Farmer $farmer,
        ParcelRiskAnalyser $analyser,
        ClimateRecommendationEngine $recommendations,
        InterventionSuggester $suggester,
    ) {
        /*
         * The season comes from the calendar, not from the query string, unless
         * a valid one is named. Anything else falls back rather than throwing:
         * a mistyped URL should show this season's analysis, not an error page.
         */
        $requested = $request->validate([
            'season' => 'nullable|in:wet,dry',
            'year'   => 'nullable|integer|min:2000|max:2100',
        ]);

        $analysis = $analyser->forFarmer(
            $farmer,
            $requested['season'] ?? null,
            isset($requested['year']) ? (int) $requested['year'] : null,
        );

        $all = $analysis['recommendations'];

        return Inertia::render('Admin/Analytics/FarmAnalysis', [
            'analysis' => $analysis,

            // Split here rather than in the page, so "the top three" means the
            // same thing wherever it is shown and the office can change it in
            // config without touching a component.
            'topActions' => $recommendations->topOf($all),
            'allActions' => $all,

            'periods' => $this->selectablePeriods($analyser),

            /*
             * What the office might do, as distinct from what the farmer is
             * advised to do. Suggestions only — nothing is written until a
             * staff member opens one, so the queue always reflects decisions
             * people made rather than work the system assigned itself.
             */
            'suggestedInterventions' => $suggester->for($analysis['why']),

            // Already-open work for this farmer, so the same visit is not
            // opened twice by two people reading the same analysis.
            'openInterventions' => AgriculturalIntervention::where('farmer_id', $farmer->id)
                ->open()
                ->inWorkOrder()
                ->get()
                ->map(fn (AgriculturalIntervention $row) => [
                    'id'          => $row->id,
                    'factor_key'  => $row->factor_key,
                    'type_label'  => $row->type_label,
                    'status'      => $row->status,
                    'priority'    => $row->priority,
                    'target_date' => $row->target_date?->toDateString(),
                    'assignee'    => $row->assignee?->name,
                ]),

            // What the office could actually offer. Only programmes that exist
            // — nothing is proposed that staff cannot then go and find.
            'assistance' => $this->availableAssistance(),

            'canRecordAssistance' => $request->user()?->can('create assistance') ?? false,
        ]);
    }

    /**
     * Email this farmer what the analysis found.
     *
     * Composed here from the analysis rather than typed by staff, so the email
     * cannot say something the screen does not. Two refusals guard it:
     *
     *  - nothing is sent when no factor was raised, because there would be no
     *    risk to alert anyone about;
     *  - nothing is sent without an address on the farmer's own record, which
     *    is the same rule the manual email follows and what stops this being a
     *    way to send mail from the office account to an arbitrary recipient.
     */
    public function alert(
        Request $request,
        Farmer $farmer,
        ParcelRiskAnalyser $analyser,
        ClimateRecommendationEngine $recommendations,
    ) {
        $analysis = $analyser->forFarmer($farmer);
        $factors = $analysis['why'];

        if ($factors === []) {
            return back()->withErrors([
                'alert' => 'No risk factor was raised for this farm, so there is nothing to alert the farmer about.',
            ]);
        }

        $to = $farmer->contact_email;

        if (! $to) {
            return back()->withErrors([
                'alert' => 'This farmer has no email address on record.',
            ]);
        }

        $top = $recommendations->topOf($recommendations->for($factors));

        $notification = new FarmRiskAlert(
            farmer: $farmer,
            level: (string) ($analysis['overall']['level'] ?? 'low'),
            period: $analysis['period']['label'],
            parcel: $analysis['affected']
                ? trim(($analysis['affected']['label'] ?? '') . ' — ' . ($analysis['affected']['commodity'] ?? ''), ' —')
                : null,
            // The heaviest factor's own wording, not a paraphrase of several.
            concern: collect($factors)->sortByDesc('weight')->first()['label'],
            actions: array_column($top, 'text'),
        );

        Notification::route('mail', $to)->notify($notification);

        // Logged beside the manual emails, so the office's correspondence with
        // a farmer reads as one history rather than two.
        FarmerMessage::create([
            'farmer_id' => $farmer->id,
            'sent_by'   => $request->user()->id,
            'sent_to'   => $to,
            'subject'   => 'Farm risk alert — ' . $analysis['period']['label'],
            'body'      => collect($top)->pluck('text')->prepend(
                'Main concern: ' . collect($factors)->sortByDesc('weight')->first()['label']
            )->implode("\n\n"),
        ]);

        AuditService::log('create', 'farm_risk_alert', $farmer->id, null, [
            'level'  => $analysis['overall']['level'],
            'period' => $analysis['period']['label'],
            'sent_to' => $to,
        ]);

        return back()->with('success', 'Risk alert sent to the farmer.');
    }

    /**
     * The upcoming season plus the two around it.
     *
     * Enough to look back at what was predicted last time without turning the
     * page into a date picker.
     */
    private function selectablePeriods(ParcelRiskAnalyser $analyser): array
    {
        $upcoming = $analyser->upcomingPeriod();
        $year = $upcoming['year'];

        $periods = [
            ['season' => 'wet', 'year' => $year],
            ['season' => 'dry', 'year' => $year],
            ['season' => 'wet', 'year' => $year - 1],
            ['season' => 'dry', 'year' => $year - 1],
        ];

        return collect($periods)
            ->map(fn (array $p) => $p + [
                'label' => ($p['season'] === 'wet' ? 'Wet Season ' : 'Dry Season ') . $p['year'],
                'is_upcoming' => $p['season'] === $upcoming['season'] && $p['year'] === $upcoming['year'],
            ])
            ->values()
            ->all();
    }

    /**
     * Assistance programmes the office actually holds.
     *
     * Guarded on the table, because financial_assistance has drifted between
     * the repository and the server before; a missing column here would take
     * down the whole analysis over a sidebar panel.
     */
    private function availableAssistance(): array
    {
        if (! Schema::hasTable('financial_assistance')) {
            return [];
        }

        try {
            return FinancialAssistance::query()
                ->latest('id')
                ->limit(5)
                ->get()
                ->map(fn (FinancialAssistance $a) => [
                    'id'   => $a->id,
                    'name' => $a->program_name ?? $a->assistance_type ?? 'Assistance programme',
                ])
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }
}
