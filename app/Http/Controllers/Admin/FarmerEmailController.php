<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\FarmerMessage;
use App\Notifications\FarmerManualEmail;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Throwable;

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

            /*
             * What has already been sent, newest first.
             *
             * Paginated rather than capped: this is correspondence, and the
             * office will want to look back further than the last screenful
             * once it has been running a while.
             */
            'messages' => FarmerMessage::with(['farmer:id,first_name,middle_name,last_name,suffix', 'sender:id,name'])
                ->latest()
                ->paginate(15)
                ->withQueryString()
                ->through(fn (FarmerMessage $message) => [
                    'id'      => $message->id,
                    'farmer'  => $message->farmer?->full_name ?? 'Deleted farmer',
                    'sent_to' => $message->sent_to,
                    'sent_by' => $message->sender?->name ?? 'Removed account',
                    'sent_at' => $message->created_at,
                    'subject' => $message->subject,
                    'preview' => $message->preview,
                    'body'    => $message->body,
                ]),
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

        /*
         * Sent inline, and this is the fix.
         *
         * FarmerManualEmail is ShouldQueue, so ->notify() wrote a row to the
         * jobs table and returned. That is only delivery if something drains
         * the queue, and nothing in this project ever did: there is no
         * queue:work in the scheduler, no console command and no cron entry in
         * the repository. Every message staff sent went into `jobs` and stayed
         * there, while this page reported "Email sent" the moment the row was
         * written — the send had not been attempted, let alone succeeded.
         *
         * notifyNow() bypasses the queue for this one notification without
         * touching the class, so nothing else that uses it changes. Staff wait
         * for the SMTP handshake, which is the right trade here: one person
         * writing one message would rather wait two seconds and be told the
         * truth than be told a comfortable lie instantly.
         */
        try {
            Notification::route('mail', $address)
                ->notifyNow(new FarmerManualEmail($farmer, $data['subject'], $data['message']));
        } catch (Throwable $e) {
            /*
             * The technical detail goes to the log, never to the screen.
             *
             * An SMTP failure message can carry the host, the account and the
             * server's own wording about authentication; staff cannot act on
             * any of it and it should not be rendered into a page. The address
             * and subject are recorded because they are what identifies the
             * attempt, and the password is never in scope here — Laravel reads
             * it from config and it appears in none of these values.
             */
            Log::error('Farmer email failed to send', [
                'farmer_id' => $farmer->id,
                'to'        => $address,
                'subject'   => $data['subject'],
                'exception' => $e::class,
                'message'   => $e->getMessage(),
                'sent_by'   => $request->user()->id,
                'at'        => now()->toDateTimeString(),
            ]);

            /*
             * Nothing is recorded below on this path. A FarmerMessage row and
             * an audit entry both assert that the office wrote to this farmer,
             * and writing them for a message that never left would put a
             * delivery in the record that did not happen.
             */
            return back()->with(
                'error',
                'The email could not be sent. The message has not been recorded — '
                . 'please try again, and tell IT if it keeps failing.'
            );
        }

        /*
         * Kept so the office can read back what it said.
         *
         * Recorded alongside the audit entry rather than instead of it: the
         * audit log answers "who wrote to whom, when" and stays free of the
         * text; this answers "what did we actually tell them", which is the
         * question staff ask when a farmer turns up quoting a message.
         *
         * The address is stored as it resolved now — a farmer's email may
         * change, and the history should say where the message went, not
         * where it would go today.
         */
        FarmerMessage::create([
            'farmer_id' => $farmer->id,
            'sent_by'   => $request->user()->id,
            'sent_to'   => $address,
            'subject'   => $data['subject'],
            'body'      => $data['message'],
        ]);

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
