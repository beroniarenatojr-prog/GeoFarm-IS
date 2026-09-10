<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AssistanceDistribution;
use App\Models\AuditLog;
use App\Models\ClimateRiskAssessment;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmerMessage;
use App\Models\FarmParcel;
use App\Models\Livestock;
use App\Services\ClimateRiskScorer;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

/**
 * What the office needs to know on arriving, and what it needs to act on.
 *
 * Every figure here is queried. Nothing is estimated, and nothing is a
 * placeholder — a municipal dashboard that rounds or invents is worse than one
 * that says it has no data yet.
 *
 * All of it is deferred. The shell paints immediately and each group streams in
 * on its own, so a slow aggregate never holds up the page. The grouping is by
 * panel rather than by table, so one slow panel cannot delay the others.
 */
class DashboardController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Dashboard', [
            'metrics'    => Inertia::defer(fn () => $this->headline()),
            'attention'  => Inertia::defer(fn () => $this->needsAttention()),
            'farmers'    => Inertia::defer(fn () => $this->farmerOverview()),
            'livestock'  => Inertia::defer(fn () => $this->livestockOverview()),
            'assistance' => Inertia::defer(fn () => $this->assistanceOverview()),
            'risk'       => Inertia::defer(fn () => $this->riskOverview()),
            'charts'     => Inertia::defer(fn () => $this->production()),
            'activity'   => Inertia::defer(fn () => $this->recentActivity()),
            'quickStats' => Inertia::defer(fn () => $this->quickStats()),
        ]);
    }

    /** The KPI row. */
    private function headline(): array
    {
        $parcels = FarmParcel::selectRaw('COUNT(*) AS n, COALESCE(SUM(total_area_ha), 0) AS ha')->first();

        return [
            // Verified only — a pending online registration is not a farmer yet.
            'total_farmers'        => Farmer::verified()->count(),
            'pending_verification' => Farmer::pending()->count(),

            'total_parcels'   => (int) $parcels->n,
            'hectares_mapped' => round((float) $parcels->ha, 2),

            'total_livestock' => (int) Livestock::sum('count'),
            'livestock_types' => Livestock::distinct('livestock_type_id')->count('livestock_type_id'),

            'assistance_total'  => round((float) AssistanceDistribution::sum('amount_given'), 2),
            'farmers_assisted'  => AssistanceDistribution::distinct('farmer_id')->count('farmer_id'),

            'unread_messages' => $this->messageCount(),
        ];
    }

    /**
     * The queue of things a person has to do something about.
     *
     * Only counts — the panel links to the screen that handles each one rather
     * than trying to be that screen. A zero is still returned so the page can
     * tell "nothing to do" from "not loaded yet".
     */
    private function needsAttention(): array
    {
        return [
            'pending_verification' => Farmer::pending()->count(),
            'high_risk'            => $this->riskCount(ClimateRiskScorer::LEVEL_HIGH),
            'pending_claims'       => AssistanceDistribution::where('status', 'pending')->count(),
            'seasons_uncosted'     => CropSeason::whereNotNull('harvest_date')
                ->whereNull('production_cost')->count(),
        ];
    }

    private function farmerOverview(): array
    {
        $verified = Farmer::verified();

        return [
            'total'          => (clone $verified)->count(),
            'pending'        => Farmer::pending()->count(),
            'rejected'       => Farmer::where('verification_status', Farmer::STATUS_REJECTED)->count(),
            // whereHas rather than a join: a farmer with three parcels must
            // count once, not three times.
            'with_parcels'   => (clone $verified)->whereHas('parcels')->count(),
            'with_livestock' => (clone $verified)->whereHas('livestock')->count(),
            'assisted'       => (clone $verified)->whereHas('distributions')->count(),
        ];
    }

    /**
     * Livestock by the categories the office actually uses.
     *
     * "193 heads" on its own answers nothing — the question is 193 of what.
     * Grouped on livestock_types.category, which is where those groupings
     * already live; types with no category fall under their own name rather
     * than being dropped or lumped into "Other".
     */
    private function livestockOverview(): array
    {
        $rows = Livestock::query()
            ->join('livestock_types', 'livestock.livestock_type_id', '=', 'livestock_types.id')
            ->selectRaw('COALESCE(NULLIF(livestock_types.category, ""), livestock_types.type_name) AS name')
            ->selectRaw('SUM(livestock.count) AS heads')
            ->selectRaw('COUNT(DISTINCT livestock.livestock_type_id) AS types')
            ->groupBy('name')
            ->orderByDesc('heads')
            ->get();

        return [
            'total'      => (int) $rows->sum('heads'),
            'categories' => $rows->map(fn ($r) => [
                'name'  => $r->name,
                'heads' => (int) $r->heads,
                'types' => (int) $r->types,
            ])->values(),
        ];
    }

    private function assistanceOverview(): array
    {
        return [
            'total_amount'     => round((float) AssistanceDistribution::sum('amount_given'), 2),
            'farmers_assisted' => AssistanceDistribution::distinct('farmer_id')->count('farmer_id'),
            'distributions'    => AssistanceDistribution::count(),

            'by_type' => AssistanceDistribution::query()
                ->join('financial_assistance', 'assistance_distributions.assistance_id', '=', 'financial_assistance.id')
                ->leftJoin('assistance_types', 'financial_assistance.assistance_type_id', '=', 'assistance_types.id')
                ->selectRaw('COALESCE(assistance_types.type_name, "Uncategorised") AS name')
                ->selectRaw('SUM(assistance_distributions.amount_given) AS value')
                ->selectRaw('COUNT(*) AS handouts')
                ->groupBy('name')
                ->orderByDesc('value')
                ->get(),

            'recent' => AssistanceDistribution::with(['farmer:id,first_name,middle_name,last_name,suffix', 'program:id,program_name'])
                ->latest('distribution_date')
                ->take(5)
                ->get()
                ->map(fn ($d) => [
                    'id'      => $d->id,
                    'farmer'  => $d->farmer?->full_name ?? 'Unknown farmer',
                    'program' => $d->program?->program_name ?? 'Unknown programme',
                    'amount'  => $d->amount_given,
                    'date'    => $d->distribution_date,
                    'status'  => $d->status,
                ]),
        ];
    }

    /**
     * Risk, from the assessments already recorded.
     *
     * One row per farmer — their latest assessment. Counting every assessment
     * would let a farmer who has been assessed four times outweigh three who
     * have been assessed once.
     */
    private function riskOverview(): array
    {
        return [
            'high'     => $this->riskCount(ClimateRiskScorer::LEVEL_HIGH),
            'moderate' => $this->riskCount(ClimateRiskScorer::LEVEL_MODERATE),
            'low'      => $this->riskCount(ClimateRiskScorer::LEVEL_LOW),
            'assessed' => ClimateRiskAssessment::distinct('farmer_id')->count('farmer_id'),
        ];
    }

    /** Farmers whose most recent assessment came out at this level. */
    private function riskCount(string $level): int
    {
        return ClimateRiskAssessment::query()
            ->whereIn('id', function ($q) {
                $q->selectRaw('MAX(id)')->from('climate_risk_assessments')->groupBy('farmer_id');
            })
            ->where('risk_level', $level)
            ->count();
    }

    private function production(): array
    {
        return [
            'farmers_per_month' => Farmer::verified()
                ->selectRaw("DATE_FORMAT(created_at, '%m') as month, COUNT(*) as count")
                ->whereYear('created_at', now()->year)
                ->groupBy('month')->orderBy('month')->get(),

            'crop_production' => CropSeason::selectRaw('cropping_year, SUM(yield_kg) as total_yield')
                ->groupBy('cropping_year')->orderBy('cropping_year')->get(),

            // Which crops the municipality actually grows, by weight.
            'by_crop' => CropSeason::query()
                ->join('crops', 'crop_seasons.crop_id', '=', 'crops.id')
                ->whereNotNull('crop_seasons.yield_kg')
                ->selectRaw('crops.crop_name AS name, SUM(crop_seasons.yield_kg) AS total')
                ->groupBy('crops.crop_name')
                ->orderByDesc('total')
                ->take(6)
                ->get(),

            // Real spend per programme, replacing the hard-coded pie that used
            // to sit here.
            'aid_by_program' => AssistanceDistribution::query()
                ->join('financial_assistance', 'assistance_distributions.assistance_id', '=', 'financial_assistance.id')
                ->selectRaw('financial_assistance.program_name as name, SUM(assistance_distributions.amount_given) as value')
                ->groupBy('financial_assistance.program_name')
                ->orderByDesc('value')
                ->get(),
        ];
    }

    /**
     * What has happened lately, from the audit trail.
     *
     * Read rather than written to: the log already records every create, edit
     * and hand-out, so a second activity feed would be a second version of the
     * truth. The user is eager-loaded — twelve rows would otherwise be twelve
     * extra queries.
     */
    private function recentActivity(): array
    {
        return AuditLog::with('user:id,name')
            ->latest('id')
            ->take(12)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id'     => $log->id,
                'action' => $log->action,
                'table'  => $log->table_name,
                'who'    => $log->user?->name ?? 'System',
                'when'   => $log->created_at,
                // The record's own name where the log kept one, so the feed
                // reads "Beronia, Renato" rather than "farmers #6".
                'what'   => $log->new_data['farmer_name']
                    ?? $log->new_data['program_name']
                    ?? $log->new_data['subject']
                    ?? null,
                'record' => $log->record_id,
            ])
            ->values()
            ->all();
    }

    private function quickStats(): array
    {
        return [
            'active_seasons' => CropSeason::whereNotNull('planting_date')
                ->whereNull('harvest_date')->count(),
            'pending_claims' => AssistanceDistribution::where('status', 'pending')->count(),
            'avg_yield_per_ha' => round((float) CropSeason::whereNotNull('yield_kg')
                ->where('area_planted_ha', '>', 0)
                ->selectRaw('AVG(yield_kg / area_planted_ha) as avg')
                ->value('avg'), 2),
            'hectares_mapped' => round((float) FarmParcel::sum('total_area_ha'), 2),
        ];
    }

    /**
     * Messages sent, or null where the feature has not been migrated yet.
     *
     * Guarded deliberately. The dashboard summarises the whole system, and one
     * unmigrated table should cost that panel — not the entire page. The Send
     * Email screen is not guarded the same way: there, a missing table means
     * the deploy is incomplete and hiding it would be worse.
     */
    private function messageCount(): ?int
    {
        return Schema::hasTable('farmer_messages') ? FarmerMessage::count() : null;
    }
}
