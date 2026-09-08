<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Notifications\FarmerManualEmail;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Staff writing to one farmer directly.
 *
 * Everything else the system sends is triggered by an event. This is the case
 * that has no event behind it: a schedule moved, a document is missing, a
 * farmer needs telling something the forms do not cover.
 *
 * The one rule the whole feature turns on is that the browser never supplies
 * the recipient. Staff choose a farmer; the address is read from that farmer's
 * record here on the server. An address posted in the request is ignored, so
 * the form cannot be used to send mail from the office's account to anyone the
 * office does not already hold a record for.
 */
class FarmerEmailController extends Controller
{
    /** Farmers listed at once before staff are expected to search. */
    private const LIST_LIMIT = 200;

    public function create(Request $request)
    {
        $search = trim((string) $request->input('search', ''));

        return Inertia::render('Admin/Farmers/SendEmail', [
            'filters' => ['search' => $search],
            'farmers' => $this->reachable()
                ->when($search, fn (Builder $q, string $s) => $q->where(fn (Builder $w) => $w
                    ->where('first_name', 'like', "%{$s}%")
                    ->orWhere('last_name', 'like', "%{$s}%")
                    ->orWhere('rsbsa_no', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")))
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->limit(self::LIST_LIMIT)
                ->get()
                ->map(fn (Farmer $farmer) => [
                    'id'       => $farmer->id,
                    'name'     => $farmer->full_name,
                    'email'    => $this->addressFor($farmer),
                    'rsbsa_no' => $farmer->rsbsa_no,
                    'barangay' => $farmer->barangay,
                ])
                ->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'farmer_id' => ['required', 'integer', 'exists:farmers,id'],
            'subject'   => ['required', 'string', 'max:150'],
            'message'   => ['required', 'string', 'max:5000'],
        ]);

        /*
         * The recipient comes from here and nowhere else.
         *
         * Note what is NOT read: $request->input('email'). Accepting an address
         * from the form would turn an authenticated staff page into an open
         * relay for the office's mail account.
         */
        $farmer  = Farmer::with('user:id,email')->findOrFail($data['farmer_id']);
        $address = $this->addressFor($farmer);

        if (blank($address)) {
            // Reported against the farmer field, because the farmer is what
            // has to change - the message itself is fine.
            throw ValidationException::withMessages([
                'farmer_id' => 'This farmer has no email address on record, so there is nowhere to send the message.',
            ]);
        }

        Notification::route('mail', $address)
            ->notify(new FarmerManualEmail($farmer, $data['subject'], $data['message']));

        AuditService::log('email', 'farmers', $farmer->id, null, [
            'to'      => $address,
            'subject' => $data['subject'],
            // The body is deliberately not logged. It is free text that may
            // carry personal detail, and the audit trail only needs to answer
            // who wrote to whom, when, and about what.
        ]);

        return redirect()
            ->route('admin.farmer-email.create')
            ->with('success', 'Email sent to ' . $farmer->full_name . '.');
    }

    /**
     * Farmers there is somewhere to write to.
     *
     * One without an address cannot be offered in the picker: choosing them
     * could only ever fail, and an empty option reads as a system fault rather
     * than as missing data on the record.
     */
    private function reachable(): Builder
    {
        return Farmer::query()
            ->with('user:id,email')
            ->where(fn (Builder $q) => $q
                ->where(fn (Builder $own) => $own->whereNotNull('email')->where('email', '!=', ''))
                ->orWhereHas('user', fn (Builder $account) => $account
                    ->whereNotNull('email')->where('email', '!=', '')));
    }

    /**
     * The farmer's own address first, their login account second.
     *
     * Staff encode farmers at the office who never registered online and so
     * have no user account; farmers who registered themselves may carry the
     * address only on the account. Both cases have to work.
     */
    private function addressFor(Farmer $farmer): ?string
    {
        return $farmer->email ?: $farmer->user?->email;
    }
}
