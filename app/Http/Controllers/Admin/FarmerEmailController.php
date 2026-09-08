<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Notifications\FarmerManualEmail;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
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
                    'email'    => $farmer->contact_email,
                    'rsbsa_no' => $farmer->rsbsa_no,
                    'barangay' => $farmer->barangay,
                ])
                ->values(),
        ]);
    }

    /**
     * Send one message to one farmer.
     *
     * The farmer arrives through route model binding, so the URL names who is
     * being written to and the request body carries only what staff typed.
     */
    public function send(Request $request, Farmer $farmer)
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:200'],
            'message' => ['required', 'string', 'max:10000'],
        ]);

        /*
         * The recipient comes from here and nowhere else.
         *
         * Note what is NOT read: $request->input('email'), 'to' or 'recipient'.
         * Accepting an address from the form would turn an authenticated staff
         * page into an open relay for the office's mail account. Nothing in the
         * validated set above can influence where this goes.
         */
        $address = $farmer->loadMissing('user:id,email')->contact_email;

        if (blank($address)) {
            return back()->with('error', 'This farmer does not have a valid email address.');
        }

        // Queued, not sent inline: FarmerManualEmail is ShouldQueue, so this
        // writes a row to the jobs table and returns. The worker cron delivers
        // it, which keeps a slow SMTP handshake out of the staff request.
        Notification::route('mail', $address)
            ->notify(new FarmerManualEmail($farmer, $data['subject'], $data['message']));

        AuditService::log('email', 'farmers', $farmer->id, null, [
            'farmer_name' => $farmer->full_name,
            'to'          => $address,
            'subject'     => $data['subject'],
            // The body is deliberately not logged. It is free text that may
            // carry personal detail, and the audit trail only needs to answer
            // who wrote to whom, when, and about what. AuditService::log()
            // supplies the staff user id and the timestamp itself.
        ]);

        return back()->with('success', 'Email sent to ' . $farmer->full_name . '.');
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
}
