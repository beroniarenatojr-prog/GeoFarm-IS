<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Notifications\FarmerVerificationDecided;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
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

        /*
         * Every decision, not only the ones still outstanding.
         *
         * Approved farmers used to be excluded outright, so the moment a
         * submission was cleared it vanished from the only screen that ever
         * showed it — leaving no way to answer "who approved this, and when"
         * without going to the audit log. The queue still opens on Pending;
         * the other two are history.
         */
        $submissions = Farmer::query()
            ->with(['parcels', 'verifier:id,name'])
            // Only accounts that actually went through this workflow. A farmer
            // encoded at the counter was never submitted online and would read
            // as an approval nobody made.
            ->whereNotNull('submitted_online_at')
            ->when($status, fn ($q, $s) => $q->where('verification_status', $s))
            ->when($request->search, fn ($q, $s) => $q->where(function ($query) use ($s) {
                $query->where('first_name', 'like', "%$s%")
                    ->orWhere('last_name', 'like', "%$s%")
                    ->orWhere('reference_code', 'like', "%$s%");
            }))
            // Approved and rejected read newest-decision-first; pending has no
            // decision yet, so it falls back to when it arrived.
            ->orderByDesc($status === Farmer::STATUS_VERIFIED ? 'verified_at' : 'submitted_online_at')
            ->paginate(20)
            ->withQueryString();

        $submitted = fn () => Farmer::whereNotNull('submitted_online_at');

        return Inertia::render('Admin/Farmers/Verification', [
            'submissions' => $submissions,
            'filters'     => $request->only(['search', 'status']),
            'counts'      => [
                'pending'  => $submitted()->where('verification_status', Farmer::STATUS_PENDING)->count(),
                'approved' => $submitted()->where('verification_status', Farmer::STATUS_VERIFIED)->count(),
                'rejected' => $submitted()->where('verification_status', Farmer::STATUS_REJECTED)->count(),
            ],
        ]);
    }

    /**
     * Same queue as index(), but as JSON for the header notification modal so
     * staff can review submissions without leaving the page they are on.
     */
    public function queue(Request $request)
    {
        $validated = $request->validate([
            'status' => 'nullable|in:pending,rejected',
            'search' => 'nullable|string|max:100',
        ]);

        $status = $validated['status'] ?? Farmer::STATUS_PENDING;
        $search = $validated['search'] ?? null;

        $submissions = Farmer::query()
            ->withCount('parcels')
            ->where('verification_status', $status)
            ->when($search, fn ($q, $s) => $q->where(function ($query) use ($s) {
                $query->where('first_name', 'like', "%$s%")
                    ->orWhere('last_name', 'like', "%$s%")
                    ->orWhere('reference_code', 'like', "%$s%");
            }))
            ->orderByDesc('submitted_online_at')
            ->limit(50)
            ->get()
            ->map(fn (Farmer $f) => [
                'id'                  => $f->id,
                'name'                => $f->full_name,
                'reference_code'      => $f->reference_code,
                'verification_status' => $f->verification_status,
                'birthdate'           => $f->birthdate?->toDateString(),
                'barangay'            => $f->barangay,
                'livelihood_type'     => $f->livelihood_type,
                'parcels_count'       => $f->parcels_count,
                'mobile_no'           => $f->mobile_no,
                'email'               => $f->email,
                'valid_id_type'       => $f->valid_id_type,
                'id_number'           => $f->id_number,
                'submitted_at'        => $f->submitted_online_at?->toIso8601String(),
                'rejection_reason'    => $f->rejection_reason,
            ]);

        return response()->json([
            'submissions' => $submissions,
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

        $this->tellFarmer($farmer->fresh(), approved: true);

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

        $this->tellFarmer($farmer->fresh(), approved: false);

        AuditService::log('reject', 'farmers', $farmer->id, $old, $farmer->fresh()->toArray());

        return back()->with('success', "Submission for {$farmer->full_name} was rejected.");
    }

    /**
     * Email the farmer the decision.
     *
     * Routed on demand rather than notified through a model, because a farmer
     * encoded at the office has no login account to notify - and the address
     * on the farmer record is the one they gave, whether or not it became a
     * login.
     *
     * Called after the transaction commits so an email cannot describe a
     * decision that was rolled back, and re-approving is impossible anyway:
     * both actions return early unless the submission is still pending.
     */
    private function tellFarmer(Farmer $farmer, bool $approved): void
    {
        $address = $farmer->email ?: $farmer->user?->email;

        if (blank($address)) {
            return;
        }

        Notification::route('mail', $address)
            ->notify(new FarmerVerificationDecided($farmer, $approved));
    }
}
