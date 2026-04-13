<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Barangay;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AssistanceController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Assistance/Index', [
            'programs' => FinancialAssistance::with(['assistanceType', 'barangays'])
                ->withCount('distributions')
                ->withSum('distributions', 'amount_given')
                ->latest()
                ->paginate(15),
        ]);
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
            'program' => $assistance->load(['assistanceType', 'barangays']),
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
        $assistance->delete();
        return redirect()->route('admin.assistance.index')->with('success', 'Program deleted.');
    }
}
