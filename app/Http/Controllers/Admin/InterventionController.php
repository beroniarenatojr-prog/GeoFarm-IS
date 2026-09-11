<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgriculturalIntervention;
use App\Models\FarmParcel;
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
        $data = $request->validate([
            'farmer_id'  => 'required|exists:farmers,id',
            'factor_key' => ['required', 'string', Rule::in(array_keys(config('climate_risk.interventions')))],
            'farm_parcel_id' => 'nullable|exists:farm_parcels,id',
            'climate_risk_assessment_id' => 'nullable|exists:climate_risk_assessments,id',
            'target_date' => 'nullable|date',
            'notes'       => 'nullable|string|max:2000',
        ], [
            'factor_key.in' => 'The office has no configured intervention for that risk factor.',
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

        $plan = config("climate_risk.interventions.{$data['factor_key']}");
        $priority = $request->input('priority');
        $priority = in_array($priority, AgriculturalIntervention::PRIORITIES, true) ? $priority : 'medium';

        $intervention = AgriculturalIntervention::create([
            'farmer_id'      => $data['farmer_id'],
            'farm_parcel_id' => $data['farm_parcel_id'] ?? null,
            'climate_risk_assessment_id' => $data['climate_risk_assessment_id'] ?? null,
            'factor_key'     => $data['factor_key'],
            'type'           => $plan['type'],
            'priority'       => $priority,
            // Frozen. The office revises this wording, and a reason that
            // reworded itself later would misreport a visit already made.
            'reason'         => $plan['reason'],
            'status'         => AgriculturalIntervention::STATUS_PENDING,
            'target_date'    => $data['target_date']
                ?? now()->addDays((int) config("climate_risk.intervention_target_days.{$priority}", 21)),
            'notes'          => $data['notes'] ?? null,
            'created_by'     => $request->user()->id,
        ]);

        AuditService::log('create', 'agricultural_interventions', $intervention->id, null, [
            'farmer_id'  => $intervention->farmer_id,
            'factor_key' => $intervention->factor_key,
            'type'       => $intervention->type,
        ]);

        return back()->with('success', 'Intervention opened. It is now on the office queue.');
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
