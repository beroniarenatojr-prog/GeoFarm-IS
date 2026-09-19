<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgriculturalIntervention;
use App\Models\FarmParcel;
use App\Models\Farmer;
use App\Models\Recommendation;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The office's work queue.
 *
 * The analysis suggests; this is where a person decides. Nothing in this
 * controller is reached by the risk engine — every row exists because a staff
 * member opened it, and every closed row exists because a staff member wrote
 * down what they actually did.
 *
 * The one invariant it enforces above all others: an intervention cannot reach
 * "completed" without action_taken. A recommendation is not evidence that
 * anything happened, and a queue that let itself be ticked off without a
 * record of the work would report visits nobody made.
 */
class InterventionController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'status'   => ['nullable', Rule::in(array_merge(AgriculturalIntervention::STATUSES, ['open', 'all']))],
            'priority' => ['nullable', Rule::in(AgriculturalIntervention::PRIORITIES)],
            'assignee' => 'nullable|integer|exists:users,id',
        ]);

        $status = $filters['status'] ?? 'open';

        $interventions = AgriculturalIntervention::query()
            ->with([
                'farmer:id,first_name,middle_name,last_name,suffix,barangay',
                'parcel:id,parcel_number,commodity,total_area_ha',
                'assignee:id,name',
                'completer:id,name',
            ])
            // Counted in SQL rather than loaded: the list shows how many
            // releases an intervention carries, not what they were.
            ->withCount('assistanceRecords')
            // Default to the open queue: the page exists to show outstanding
            // work, and closed records would quickly bury it.
            ->when($status === 'open', fn ($q) => $q->open())
            ->when(! in_array($status, ['open', 'all'], true), fn ($q) => $q->where('status', $status))
            ->when($filters['priority'] ?? null, fn ($q, $p) => $q->where('priority', $p))
            ->when($filters['assignee'] ?? null, fn ($q, $id) => $q->where('assigned_to', $id))
            ->inWorkOrder()
            ->paginate(15)
            ->withQueryString()
            ->through(fn (AgriculturalIntervention $row) => [
                'id'          => $row->id,
                'farmer_id'   => $row->farmer_id,
                'farmer'      => $row->farmer?->full_name ?? 'Unknown farmer',
                'barangay'    => $row->farmer?->barangay,
                'parcel'      => $row->parcel?->parcel_number ? "Parcel #{$row->parcel->parcel_number}" : null,
                'commodity'   => $row->parcel?->commodity,
                'area_ha'     => $row->parcel?->total_area_ha ? (float) $row->parcel->total_area_ha : null,
                'type'        => $row->type,
                'type_label'  => $row->type_label,
                // Derived on the model from the foreign keys, so the badge can
                // never disagree with where the record actually came from.
                'source'        => $row->source,
                'display_title' => $row->display_title,
                // One intervention may carry several releases; the list says
                // how many without loading any of them.
                'assistance_count' => $row->assistance_records_count ?? 0,
                'priority'    => $row->priority,
                'reason'      => $row->reason,
                'status'      => $row->status,
                'assigned_to' => $row->assigned_to,
                'assignee'    => $row->assignee?->name,
                'target_date' => $row->target_date?->toDateString(),
                'is_overdue'  => $row->is_overdue,
                'notes'       => $row->notes,
                // Shown apart from the reason on purpose: one is why it was
                // suggested, the other is what somebody did.
                'action_taken'    => $row->action_taken,
                'completed_at'    => $row->completed_at?->toDateString(),
                'completed_by'    => $row->completer?->name,
                'follow_up_date'  => $row->follow_up_date?->toDateString(),
                'follow_up_notes' => $row->follow_up_notes,
            ]);

        return Inertia::render('Admin/Interventions/Index', [
            'interventions' => $interventions,
            'filters'       => ['status' => $status, 'priority' => $filters['priority'] ?? null, 'assignee' => $filters['assignee'] ?? null],
            'statuses'      => AgriculturalIntervention::STATUSES,
            'types'         => config('climate_risk.intervention_types'),
            'staff'         => User::permission('view predictive')
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
            'counts'        => $this->counts(),
        ]);
    }

    /**
     * Open an intervention from a suggested factor.
     *
     * The type, reason and priority are read from config against the factor
     * key rather than accepted from the browser: they are the office's own
     * stated plan for that condition, and letting a form supply them would
     * make the queue's reasons unverifiable.
     */
    public function store(Request $request)
    {
        /*
         * Two entry paths, one table.
         *
         * From the analysis: a factor_key is required and must be one the
         * office has configured, and the type, reason and priority are read
         * from that config rather than from the browser. That is what makes
         * the queue's reasons verifiable, and it is unchanged.
         *
         * Manual: a staff member already knows what is needed and there is no
         * analysis behind it, so they name it and say why themselves. It gets
         * no factor_key and no assessment, which is exactly what the `source`
         * accessor reads to tell the two apart.
         *
         * The manual path is an ADDITIONAL door, not a way around the first
         * one: nothing here lets a caller supply their own reason for a
         * factor-driven intervention.
         */
        $isManual = $request->input('source') === AgriculturalIntervention::SOURCE_MANUAL;

        $data = $request->validate([
            'farmer_id'  => 'required|exists:farmers,id',
            'factor_key' => [
                Rule::requiredIf(! $isManual),
                'nullable', 'string',
                Rule::in(array_keys(config('climate_risk.interventions'))),
            ],
            'farm_parcel_id' => 'nullable|exists:farm_parcels,id',
            'climate_risk_assessment_id' => 'nullable|exists:climate_risk_assessments,id',
            'target_date' => 'nullable|date',
            'notes'       => 'nullable|string|max:2000',

            // Manual only. Required there because an intervention nobody can
            // name is one nobody can act on.
            'title'  => [Rule::requiredIf($isManual), 'nullable', 'string', 'max:150'],
            'reason' => [Rule::requiredIf($isManual), 'nullable', 'string', 'max:255'],
            'type'   => [
                Rule::requiredIf($isManual), 'nullable', 'string',
                Rule::in(array_keys(config('climate_risk.intervention_types'))),
            ],
        ], [
            'factor_key.in' => 'The office has no configured intervention for that risk factor.',
            'title.required' => 'Give the intervention a name so staff can find it later.',
            'reason.required' => 'Record why this intervention is being opened.',
            'type.required' => 'Choose what kind of action this is.',
        ]);

        // A parcel belongs to one farmer. Without this, a mistyped id would
        // attach one farmer's visit to another's land.
        if (! empty($data['farm_parcel_id'])) {
            $belongs = FarmParcel::where('id', $data['farm_parcel_id'])
                ->where('farmer_id', $data['farmer_id'])
                ->exists();

            if (! $belongs) {
                throw ValidationException::withMessages([
                    'farm_parcel_id' => 'That parcel does not belong to this farmer.',
                ]);
            }
        }

        $priority = $request->input('priority');
        $priority = in_array($priority, AgriculturalIntervention::PRIORITIES, true) ? $priority : 'medium';

        if ($isManual) {
            // Named and justified by the person raising it. No factor_key and
            // no assessment: there was no analysis, and pretending otherwise
            // would make a manual decision look like an evidenced one.
            $attributes = [
                'factor_key' => null,
                'climate_risk_assessment_id' => null,
                'title'      => $data['title'],
                'type'       => $data['type'],
                'reason'     => $data['reason'],
            ];
        } else {
            $plan = config("climate_risk.interventions.{$data['factor_key']}");

            $attributes = [
                'factor_key' => $data['factor_key'],
                'climate_risk_assessment_id' => $data['climate_risk_assessment_id'] ?? null,
                'title'      => null,
                'type'       => $plan['type'],
                // Frozen. The office revises this wording, and a reason that
                // reworded itself later would misreport a visit already made.
                'reason'     => $plan['reason'],
            ];
        }

        $intervention = AgriculturalIntervention::create(array_merge($attributes, [
            'farmer_id'      => $data['farmer_id'],
            'farm_parcel_id' => $data['farm_parcel_id'] ?? null,
            'priority'       => $priority,
            'status'         => AgriculturalIntervention::STATUS_PENDING,
            'target_date'    => $data['target_date']
                ?? now()->addDays((int) config("climate_risk.intervention_target_days.{$priority}", 21)),
            'notes'          => $data['notes'] ?? null,
            'created_by'     => $request->user()->id,
        ]));

        AuditService::log('create', 'agricultural_interventions', $intervention->id, null, [
            'farmer_id'  => $intervention->farmer_id,
            'factor_key' => $intervention->factor_key,
            'type'       => $intervention->type,
            'source'     => $intervention->source,
        ]);

        /*
         * Mark the advice that prompted this as dealt with.
         *
         * recommendations.intervention_id and Recommendation::STATUS_CONVERTED
         * have existed since the workflow migration but nothing ever wrote
         * them, so the same advice stayed outstanding after somebody acted on
         * it and two staff reading one analysis could raise the same visit
         * twice.
         *
         * Matched narrowly — same farmer, same factor, same assessment, still
         * outstanding, not already linked — because a loose match would attach
         * a visit to the wrong piece of advice. Oldest first, and only one. If
         * nothing matches, nothing happens: the intervention stands on its own
         * and this is not allowed to fail the request that created it.
         */
        if (! $isManual && $intervention->climate_risk_assessment_id) {
            Recommendation::where('farmer_id', $intervention->farmer_id)
                ->where('factor_key', $intervention->factor_key)
                ->where('climate_risk_assessment_id', $intervention->climate_risk_assessment_id)
                ->whereNull('intervention_id')
                ->outstanding()
                ->oldest('id')
                ->first()
                ?->forceFill([
                    'intervention_id' => $intervention->id,
                    'status'          => Recommendation::STATUS_CONVERTED,
                    'reviewed_by'     => $request->user()->id,
                    'reviewed_at'     => now(),
                ])->save();
        }

        return back()->with('success', $isManual
            ? 'Manual intervention opened. It is now on the office queue.'
            : 'Intervention opened. It is now on the office queue.');
    }

    /** Assign it, move it along, or close it with what was actually done. */
    public function update(Request $request, AgriculturalIntervention $intervention)
    {
        $data = $request->validate([
            'status'      => ['required', Rule::in(AgriculturalIntervention::STATUSES)],
            'assigned_to' => 'nullable|integer|exists:users,id',
            'target_date' => 'nullable|date',
            'notes'       => 'nullable|string|max:2000',
            'priority'    => ['nullable', Rule::in(AgriculturalIntervention::PRIORITIES)],

            /*
             * The invariant.
             *
             * Completing requires a record of the work. Without this a visit
             * could be ticked off because the system once recommended it,
             * which is exactly the claim this module exists to prevent.
             */
            'action_taken' => [
                Rule::requiredIf(fn () => $request->input('status') === AgriculturalIntervention::STATUS_COMPLETED),
                'nullable', 'string', 'max:5000',
            ],

            'follow_up_date'  => 'nullable|date',
            'follow_up_notes' => 'nullable|string|max:2000',
        ], [
            'action_taken.required' => 'Record what was actually done before marking this completed.',
        ]);

        $before = $intervention->only(['status', 'assigned_to', 'action_taken']);
        $completing = $data['status'] === AgriculturalIntervention::STATUS_COMPLETED;

        $intervention->update([
            'status'      => $data['status'],
            'assigned_to' => $data['assigned_to'] ?? $intervention->assigned_to,
            'target_date' => $data['target_date'] ?? $intervention->target_date,
            'notes'       => $data['notes'] ?? $intervention->notes,
            'priority'    => $data['priority'] ?? $intervention->priority,

            // Only ever written when a person closes the record, and only the
            // text they typed. Never derived from the recommendation.
            'action_taken' => $completing ? $data['action_taken'] : $intervention->action_taken,
            'completed_at' => $completing ? ($intervention->completed_at ?? now()) : null,
            'completed_by' => $completing ? ($intervention->completed_by ?? $request->user()->id) : null,

            'follow_up_date'  => $data['follow_up_date'] ?? $intervention->follow_up_date,
            'follow_up_notes' => $data['follow_up_notes'] ?? $intervention->follow_up_notes,
        ]);

        AuditService::log('update', 'agricultural_interventions', $intervention->id, $before, [
            'status'       => $intervention->status,
            'assigned_to'  => $intervention->assigned_to,
            'action_taken' => $intervention->action_taken,
        ]);

        return back()->with('success', $completing
            ? 'Intervention completed and the action recorded.'
            : 'Intervention updated.');
    }

    /**
     * One intervention, with everything hanging off it.
     *
     * The whole chain in one place — the analysis that prompted it, the farm
     * it concerns, what has been done, and what the farmer actually received —
     * because that is the question staff ask and it currently takes three
     * screens to answer.
     *
     * Everything here is read through existing relationships. No figure is
     * recomputed and no field is duplicated: the barangay, commodity and area
     * come off the parcel, and the farmer's name off the farmer.
     */
    public function show(AgriculturalIntervention $intervention)
    {
        $intervention->load([
            'farmer:id,first_name,middle_name,last_name,suffix,barangay,rsbsa_no,mobile_no',
            'parcel:id,parcel_number,barangay,commodity,total_area_ha,farm_type_id',
            'parcel.farmType:id,type_name',
            'assessment',
            'recommendation',
            'assignee:id,name',
            'completer:id,name',
            'creator:id,name',
            'actions.performer:id,name',
            'assistanceRecords.program:id,program_name,assistance_type_id',
            'assistanceRecords.program.assistanceType:id,type_name,distribution_type',
        ]);

        return Inertia::render('Admin/Interventions/Show', [
            'intervention' => [
                'id'            => $intervention->id,
                'title'         => $intervention->title,
                'display_title' => $intervention->display_title,
                'source'        => $intervention->source,
                'type'          => $intervention->type,
                'type_label'    => $intervention->type_label,
                'priority'      => $intervention->priority,
                'status'        => $intervention->status,
                'reason'        => $intervention->reason,
                'notes'         => $intervention->notes,
                'action_taken'  => $intervention->action_taken,
                'target_date'   => $intervention->target_date?->toDateString(),
                'completed_at'  => $intervention->completed_at?->toDateString(),
                'follow_up_date'  => $intervention->follow_up_date?->toDateString(),
                'follow_up_notes' => $intervention->follow_up_notes,
                'is_overdue'    => $intervention->is_overdue,
                'assignee'      => $intervention->assignee?->name,
                'assigned_to'   => $intervention->assigned_to,
                'completed_by'  => $intervention->completer?->name,
                'created_by'    => $intervention->creator?->name,
                'created_at'    => $intervention->created_at?->toDateString(),
            ],

            'farmer' => $intervention->farmer ? [
                'id'       => $intervention->farmer->id,
                'name'     => $intervention->farmer->full_name,
                'rsbsa_no' => $intervention->farmer->rsbsa_no,
                'barangay' => $intervention->farmer->barangay,
                'contact'  => $intervention->farmer->mobile_no,
            ] : null,

            // Parcel-level when the action concerns one piece of land, null
            // when it is farmer-level. Both are legitimate; nothing forces a
            // parcel onto an intervention that does not need one.
            'parcel' => $intervention->parcel ? [
                'id'            => $intervention->parcel->id,
                'parcel_number' => $intervention->parcel->parcel_number,
                'barangay'      => $intervention->parcel->barangay,
                'commodity'     => $intervention->parcel->commodity,
                'area_ha'       => $intervention->parcel->total_area_ha,
                'farm_type'     => $intervention->parcel->farmType?->type_name,
            ] : null,

            // Only present on the analysis-driven path. The page says so
            // plainly rather than leaving an empty section that reads like
            // missing data.
            'analysis' => $intervention->assessment ? [
                'id'         => $intervention->assessment->id,
                'factor_key' => $intervention->factor_key,
                'assessed_on' => $intervention->assessment->created_at?->toDateString(),
                'risk_level' => $intervention->assessment->risk_level ?? null,
            ] : null,

            'recommendation' => $intervention->recommendation ? [
                'title'    => $intervention->recommendation->title,
                'reason'   => $intervention->recommendation->reason,
                'priority' => $intervention->recommendation->priority,
                'status'   => $intervention->recommendation->status,
            ] : null,

            'actions' => $intervention->actions
                ->sortByDesc('action_date')
                ->map(fn ($action) => [
                    'id'          => $action->id,
                    'action_date' => $action->action_date?->toDateString(),
                    'action'      => $action->action,
                    'result'      => $action->result,
                    'farmer_response'    => $action->farmer_response,
                    'resources_provided' => $action->resources_provided,
                    'next_action' => $action->next_action,
                    'performed_by' => $action->performer?->name,
                ])->values(),

            'assistance' => $intervention->assistanceRecords
                ->sortByDesc('distribution_date')
                ->map(fn ($given) => [
                    'id'       => $given->id,
                    'program'  => $given->program?->program_name,
                    'type'     => $given->program?->assistanceType?->type_name,
                    'quantity' => $given->quantity_given,
                    'amount'   => $given->amount_given,
                    'status'   => $given->status,
                    'reference_no' => $given->reference_no,
                    'date'     => $given->distribution_date?->toDateString(),
                    'notes'    => $given->notes,
                ])->values(),
        ]);
    }

    /**
     * One farmer's interventions, for the release form's picker.
     *
     * Scoped by the relation itself, so the list can only ever contain that
     * farmer's work. This is what keeps the wrong choice off the screen; it is
     * NOT the check — AssistanceController re-verifies ownership on the way in
     * and refuses a mismatch, because a list is only a convenience and an id
     * can be posted without it.
     *
     * Cancelled ones are left out: linking a release to work the office called
     * off is a mistake in every case anyone could describe. Completed ones
     * stay, because assistance is often recorded after the visit that
     * authorised it, and the status travels with each row so staff can see
     * what they are attaching to.
     */
    public function optionsForFarmer(Farmer $farmer)
    {
        return response()->json(
            $farmer->interventions()
                ->with('parcel:id,parcel_number,barangay')
                ->where('status', '!=', AgriculturalIntervention::STATUS_CANCELLED)
                ->get()
                // Open work first — that is what a release is usually against —
                // then newest. Sorted here because "open" is a set of statuses
                // rather than a column to order by.
                ->sortByDesc(fn (AgriculturalIntervention $row) => [(int) $row->is_open, $row->id])
                ->map(fn (AgriculturalIntervention $row) => [
                    'id'       => $row->id,
                    'title'    => $row->display_title,
                    'source'   => $row->source,
                    'status'   => $row->status,
                    'priority' => $row->priority,
                    'is_open'  => $row->is_open,
                    // Null when the intervention is farmer-level rather than
                    // about one piece of land. Both are legitimate.
                    'parcel_id'     => $row->farm_parcel_id,
                    'parcel_number' => $row->parcel?->parcel_number,
                    'barangay'      => $row->parcel?->barangay,
                ])
                ->values()
        );
    }

    /** Counts for the strip across the top of the queue. */
    private function counts(): array
    {
        $by = AgriculturalIntervention::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'pending'     => (int) ($by[AgriculturalIntervention::STATUS_PENDING] ?? 0),
            'assigned'    => (int) ($by[AgriculturalIntervention::STATUS_ASSIGNED] ?? 0),
            'in_progress' => (int) ($by[AgriculturalIntervention::STATUS_IN_PROGRESS] ?? 0),
            'completed'   => (int) ($by[AgriculturalIntervention::STATUS_COMPLETED] ?? 0),
            'cancelled'   => (int) ($by[AgriculturalIntervention::STATUS_CANCELLED] ?? 0),
            'overdue'     => AgriculturalIntervention::open()
                ->whereNotNull('target_date')
                ->whereDate('target_date', '<', now())
                ->count(),
        ];
    }
}
