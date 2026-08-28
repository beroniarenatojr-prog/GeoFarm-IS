<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Staff-side review of farmers who registered themselves online.
 *
 * The farmer brings their documents to the Agriculture Office; staff compares
 * them against the online submission and either approves the record (which
 * activates the farmer's login) or rejects it with a reason.
 */
class FarmerVerificationController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->input('status', Farmer::STATUS_PENDING);

        $submissions = Farmer::query()
            ->with('parcels')
            ->whereIn('verification_status', [Farmer::STATUS_PENDING, Farmer::STATUS_REJECTED])
            ->when($status, fn ($q, $s) => $q->where('verification_status', $s))
            ->when($request->search, fn ($q, $s) => $q->where(function ($query) use ($s) {
                $query->where('first_name', 'like', "%$s%")
                    ->orWhere('last_name', 'like', "%$s%")
                    ->orWhere('reference_code', 'like', "%$s%");
            }))
            ->orderByDesc('submitted_online_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Farmers/Verification', [
            'submissions' => $submissions,
            'filters'     => $request->only(['search', 'status']),
            'counts'      => [
                'pending'  => Farmer::pending()->count(),
                'rejected' => Farmer::where('verification_status', Farmer::STATUS_REJECTED)->count(),
            ],
        ]);
    }

    public function approve(Request $request, Farmer $farmer)
    {
        if (!$farmer->isPending()) {
            return back()->with('error', 'Only pending submissions can be approved.');
        }

        $old = $farmer->toArray();

        DB::transaction(function () use ($farmer, $request) {
            $farmer->update([
                'verification_status' => Farmer::STATUS_VERIFIED,
                'verified_at'         => now(),
                'verified_by'         => $request->user()->id,
                'rejection_reason'    => null,
            ]);

            // Approval is what grants the farmer access to their dashboard.
            $farmer->user?->update(['is_active' => true]);
        });

        AuditService::log('approve', 'farmers', $farmer->id, $old, $farmer->fresh()->toArray());

        return back()->with('success', "{$farmer->full_name} verified. Their account is now active.");
    }

    public function reject(Request $request, Farmer $farmer)
    {
        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:500',
        ]);

        if (!$farmer->isPending()) {
            return back()->with('error', 'Only pending submissions can be rejected.');
        }

        $old = $farmer->toArray();

        DB::transaction(function () use ($farmer, $validated, $request) {
            $farmer->update([
                'verification_status' => Farmer::STATUS_REJECTED,
                'rejection_reason'    => $validated['rejection_reason'],
                'verified_at'         => now(),
                'verified_by'         => $request->user()->id,
            ]);

            // Keep the account locked out.
            $farmer->user?->update(['is_active' => false]);
        });

        AuditService::log('reject', 'farmers', $farmer->id, $old, $farmer->fresh()->toArray());

        return back()->with('success', "Submission for {$farmer->full_name} was rejected.");
    }
}
