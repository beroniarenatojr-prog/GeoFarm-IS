<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Barangay;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssistanceController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Assistance/Index', [
            'programs' => FinancialAssistance::with(['assistanceType', 'barangays', 'locker:id,name'])
                ->withCount('distributions')
                ->withSum('distributions', 'amount_given')
                ->latest()
                ->paginate(15),
            // Drives whether the padlock is a button or just an indicator.
            'canLock' => auth()->user()?->can('lock assistance') ?? false,
            // The create/edit modal is rendered on this page, so it needs the
            // same reference data the standalone form route provides.
            'assistanceTypes' => AssistanceType::orderBy('category')->orderBy('type_name')->get(),
            'barangays' => Barangay::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * A locked programme is frozen: no edits, no deletion, no new
     * distributions. Enforced here rather than only in the UI, because a
     * hidden button is not a control.
     */
    private function blockIfLocked(FinancialAssistance $assistance): ?RedirectResponse
    {
        if (!$assistance->is_locked) {
            return null;
        }

        return back()->with(
            'error',
            "\"{$assistance->program_name}\" is locked. An administrator must unlock it before it can be changed."
        );
    }

    public function create()
    {
        return Inertia::render('Admin/Assistance/Form', [
            'assistanceTypes' => AssistanceType::orderBy('category')->orderBy('type_name')->get(),
            'barangays' => Barangay::where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'program_name'        => 'required|string|max:100',
            'assistance_type_id'  => 'required|exists:assistance_types,id',
            'description'         => 'nullable|string',
            'total_budget'        => 'required|numeric|min:0',
            'start_date'          => 'required|date',
            'end_date'            => 'required|date|after_or_equal:start_date',
            'status'              => 'nullable|in:draft,active,completed,cancelled',
            'barangay_ids'        => 'nullable|array',
            'barangay_ids.*'      => 'exists:barangays,id',
        ]);

        // Separate barangay_ids from the main data
        $barangayIds = $data['barangay_ids'] ?? [];
        unset($data['barangay_ids']);

        $assistance = FinancialAssistance::create($data + [
            'created_by' => auth()->id(),
            'status' => $data['status'] ?? 'draft',
        ]);

        if (!empty($barangayIds)) {
            $assistance->barangays()->sync($barangayIds);
        }

        return redirect()->route('admin.assistance.index')
            ->with('success', 'Program created successfully.');
    }

    public function show(FinancialAssistance $assistance)
    {
        return Inertia::render('Admin/Assistance/Show', [
            'program' => $assistance->load(['assistanceType', 'barangays', 'locker:id,name']),
            'distributions' => AssistanceDistribution::with('farmer')
                ->where('assistance_id', $assistance->id)
                ->latest('distribution_date')
                ->paginate(20),
            'summary' => [
                'total'         => $assistance->distributions()->count(),
                'claimed'       => $assistance->distributions()->where('status', 'claimed')->count(),
                'pending'       => $assistance->distributions()->where('status', 'pending')->count(),
                'forfeited'     => $assistance->distributions()->where('status', 'forfeited')->count(),
                'disbursed'     => $assistance->distributions()->sum('amount_given'),
                'beneficiaries' => $assistance->distributions()->distinct('farmer_id')->count('farmer_id'),
            ],
        ]);
    }

    public function distribute(Request $request, FinancialAssistance $assistance)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        $data = $request->validate([
            'farmer_id'         => 'required|exists:farmers,id',
            'distribution_date' => 'required|date',
            'quantity_given'    => 'nullable|numeric|min:0',
            'amount_given'      => 'nullable|numeric|min:0',
            'notes'             => 'nullable|string',
            'status'            => 'nullable|in:pending,claimed,forfeited',
        ]);

        AssistanceDistribution::create($data + [
            'assistance_id' => $assistance->id,
            'status' => $data['status'] ?? 'pending',
        ]);

        return back()->with('success', 'Distribution recorded successfully.');
    }

    public function edit(FinancialAssistance $assistance)
    {
        return Inertia::render('Admin/Assistance/Form', [
            'program' => $assistance->load('barangays'),
            'assistanceTypes' => AssistanceType::orderBy('category')->orderBy('type_name')->get(),
            'barangays' => Barangay::where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function update(Request $request, FinancialAssistance $assistance)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        $data = $request->validate([
            'program_name'        => 'required|string|max:100',
            'assistance_type_id'  => 'required|exists:assistance_types,id',
            'description'         => 'nullable|string',
            'total_budget'        => 'required|numeric|min:0',
            'start_date'          => 'required|date',
            'end_date'            => 'required|date|after_or_equal:start_date',
            'status'              => 'nullable|in:' . implode(',', FinancialAssistance::STATUSES),
            'barangay_ids'        => 'nullable|array',
            'barangay_ids.*'      => 'exists:barangays,id',
        ]);

        // Separate barangay_ids from the main data
        $barangayIds = $data['barangay_ids'] ?? null;
        unset($data['barangay_ids']);

        // Update the assistance program
        $assistance->update($data);

        // Sync barangays
        if ($barangayIds !== null) {
            $assistance->barangays()->sync($barangayIds);
        }

        return redirect()->route('admin.assistance.index')
            ->with('success', 'Program updated successfully.');
    }

    public function destroy(FinancialAssistance $assistance)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        $assistance->delete();
        return redirect()->route('admin.assistance.index')->with('success', 'Program deleted.');
    }

    /** Flip a programme between active and inactive from the list. */
    public function toggleStatus(FinancialAssistance $assistance)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        if (!in_array($assistance->status, FinancialAssistance::TOGGLEABLE, true)) {
            return back()->with(
                'error',
                "\"{$assistance->program_name}\" is {$assistance->status}. Reopen it from the edit form first."
            );
        }

        $assistance->update(['status' => $next = $assistance->oppositeStatus()]);

        return back()->with(
            'success',
            "\"{$assistance->program_name}\" is now {$next}."
        );
    }

    /**
     * Lock or unlock a programme. Route-gated on "lock assistance", which only
     * Admin and Super Admin hold — Staff can see the state but not change it.
     */
    public function toggleLock(FinancialAssistance $assistance)
    {
        $locking = !$assistance->is_locked;

        $assistance->update([
            'is_locked' => $locking,
            'locked_at' => $locking ? now() : null,
            'locked_by' => $locking ? auth()->id() : null,
        ]);

        return back()->with('success', $locking
            ? "\"{$assistance->program_name}\" is locked. Its details and distributions are now read-only."
            : "\"{$assistance->program_name}\" is unlocked and can be edited again.");
    }
}
