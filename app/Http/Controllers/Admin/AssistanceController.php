<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Barangay;
use App\Models\FarmParcel;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use App\Models\InventoryItem;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use RuntimeException;

class AssistanceController extends Controller
{
    /** Wrong lock passwords allowed before the user is locked out. */
    private const LOCK_ATTEMPTS = 5;

    /** How long that lockout lasts. */
    private const LOCK_DECAY_SECONDS = 900;

    public function index()
    {
        return Inertia::render('Admin/Assistance/Index', [
            // programItems is eager-loaded because the edit modal opens straight
            // from this list: without it the form would post an empty item list
            // and silently wipe the programme's entitlements.
            'programs' => FinancialAssistance::with(['assistanceType', 'barangays', 'locker:id,name', 'programItems'])
                ->withCount('distributions')
                ->withSum('distributions', 'amount_given')
                ->latest()
                ->paginate(15),
            // Drives whether the padlock is a button or just an indicator.
            'canLock' => auth()->user()?->can('lock assistance') ?? false,
            // Decides whether the confirm dialog asks for the lock password or
            // walks the user through creating one.
            'hasLockPassword' => auth()->user()?->hasLockPassword() ?? false,
            // The create/edit modal is rendered on this page, so it needs the
            // same reference data the standalone form route provides.
            'assistanceTypes' => AssistanceType::orderBy('category')->orderBy('type_name')->get(),
            // Stock the programme can draw on, for the item picker.
            'stockItems' => InventoryItem::orderBy('item_name')
                ->get(['id', 'item_name', 'unit', 'quantity', 'category']),
            'barangays' => Barangay::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** Sentinel the Assistance Type dropdown submits for "Other". */
    private const CUSTOM_TYPE = '__other__';

    /**
     * Turn an "Other" selection into a real assistance_types row, so the
     * programme still points at a proper type.
     *
     * Storing the typed name as loose text on the programme would have broken
     * every report that groups by type, and left the system unable to tell
     * whether the programme hands out goods — which is what decides if it has
     * an item list at all. Creating the row instead keeps the foreign key
     * intact and makes the new type reusable next time.
     */
    private function resolveCustomType(Request $request): void
    {
        if ($request->input('assistance_type_id') !== self::CUSTOM_TYPE) {
            return;
        }

        $data = $request->validate([
            'new_type_name'         => 'required|string|max:100',
            'new_type_distribution' => 'required|in:' . implode(',', AssistanceType::DISTRIBUTION_TYPES),
        ]);

        $name = trim($data['new_type_name']);

        // Reuse an existing type of the same name rather than accumulating
        // near-duplicates. MySQL's default collation makes this
        // case-insensitive, so "Fishery" will not sit beside "fishery".
        $type = AssistanceType::firstOrCreate(
            ['type_name' => $name],
            [
                'category'          => AssistanceType::CUSTOM_CATEGORY,
                'distribution_type' => $data['new_type_distribution'],
            ],
        );

        $request->merge(['assistance_type_id' => $type->id]);
    }

    /**
     * Keep a programme inside the barangays it was declared for.
     *
     * A farmer qualifies on either their own barangay or any barangay they hold
     * a parcel in — someone may live in one barangay and farm in another, and a
     * fertiliser programme is about the land, not the address.
     *
     * A programme with no barangays selected covers the whole municipality;
     * that is the existing convention on the form and is left alone.
     */
    private function blockIfOutsideTargetBarangays(
        FinancialAssistance $assistance,
        $farmerId,
    ): ?RedirectResponse {
        $targets = $assistance->barangays->pluck('name')
            ->filter()
            ->map(fn ($n) => mb_strtolower(trim($n)));

        if ($targets->isEmpty() || !$farmerId) {
            return null;
        }

        $farmer = Farmer::find($farmerId);

        if (!$farmer) {
            return null;   // validation reports the missing farmer
        }

        $farmerAreas = collect([$farmer->barangay])
            ->merge(FarmParcel::where('farmer_id', $farmer->id)->pluck('barangay'))
            ->filter()
            ->map(fn ($n) => mb_strtolower(trim($n)))
            ->unique();

        if ($farmerAreas->intersect($targets)->isNotEmpty()) {
            return null;
        }

        $name = trim("{$farmer->first_name} {$farmer->last_name}") ?: 'That farmer';
        $where = $farmerAreas->isEmpty()
            ? 'has no barangay recorded'
            : 'is in ' . collect([$farmer->barangay])->filter()->implode(', ');

        return back()->with('error', sprintf(
            '%s %s, but "%s" only covers %s. Add the barangay to the programme, or correct the farmer\'s record, if this is right.',
            $name,
            $where,
            $assistance->program_name,
            $assistance->barangays->pluck('name')->implode(', ')
        ));
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
            // Stock the programme can draw on, for the item picker.
            'stockItems' => InventoryItem::orderBy('item_name')
                ->get(['id', 'item_name', 'unit', 'quantity', 'category']),
            'barangays' => Barangay::where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        // Swaps an "Other" selection for a real type id before validation.
        $this->resolveCustomType($request);

        $data = $request->validate([
            'program_name'           => 'required|string|max:100',
            'assistance_type_id'     => 'required|exists:assistance_types,id',
            'description'            => 'nullable|string',
            'total_budget'           => 'required|numeric|min:0',
            'standard_cash_amount'   => 'nullable|numeric|min:0',
            'start_date'             => 'required|date',
            'end_date'               => 'required|date|after_or_equal:start_date',
            'status'                 => 'nullable|in:' . implode(',', FinancialAssistance::STATUSES),
            'barangay_ids'           => 'nullable|array',
            'barangay_ids.*'         => 'exists:barangays,id',
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

        $this->syncProgramItems($assistance, $request);

        return redirect()->route('admin.assistance.index')
            ->with('success', 'Program created successfully.');
    }

    /**
     * Replace the programme's item list with what was submitted.
     *
     * This only records the plan — how much each beneficiary is entitled to.
     * No stock moves here; that happens when a distribution is recorded.
     */
    private function syncProgramItems(FinancialAssistance $assistance, Request $request): void
    {
        if (!$request->has('items')) {
            return;
        }

        $lines = $request->validate([
            'items'                     => 'array',
            'items.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'items.*.quantity_per_farmer' => 'required|numeric|min:0.01',
            'items.*.total_quantity'    => 'nullable|numeric|min:0',
        ])['items'] ?? [];

        // Keyed by item so a duplicated row updates rather than violating the
        // unique index.
        $keep = [];

        foreach ($lines as $line) {
            $row = $assistance->programItems()->updateOrCreate(
                ['inventory_item_id' => $line['inventory_item_id']],
                [
                    'quantity_per_farmer' => $line['quantity_per_farmer'],
                    'total_quantity'      => $line['total_quantity'] ?? null,
                ],
            );
            $keep[] = $row->id;
        }

        $assistance->programItems()->whereNotIn('id', $keep)->delete();
    }

    public function show(FinancialAssistance $assistance)
    {
        $search = trim((string) request('search', ''));

        return Inertia::render('Admin/Assistance/Show', [
            'program' => $assistance->load([
                'assistanceType', 'barangays', 'locker:id,name',
                'programItems.item:id,item_name,unit,quantity,min_level',
            ]),
            'filters' => ['search' => $search],
            // What this programme hands out, with live warehouse stock beside
            // each entitlement so staff see shortfalls before they promise.
            'programItems' => $assistance->programItems->map(fn ($line) => [
                'inventory_item_id'   => $line->inventory_item_id,
                'item_name'           => $line->item?->item_name,
                'unit'                => $line->item?->unit,
                'quantity_per_farmer' => (float) $line->quantity_per_farmer,
                'total_quantity'      => $line->total_quantity === null ? null : (float) $line->total_quantity,
                'in_stock'            => (float) ($line->item?->quantity ?? 0),
                'issued'              => $line->issued(),
                'remaining_allocation' => $line->remainingAllocation(),
            ])->values(),
            // For the "add an item this programme does not normally give" case.
            'stockItems' => InventoryItem::where('quantity', '>', 0)
                ->orderBy('item_name')
                ->get(['id', 'item_name', 'unit', 'quantity']),
            'distributions' => AssistanceDistribution::with([
                    'farmer',
                    'itemIssues.item:id,item_name,unit',
                ])
                ->where('assistance_id', $assistance->id)
                ->when($search, function ($q, $s) {
                    $q->whereHas('farmer', fn ($f) => $f
                        ->where('first_name', 'like', "%{$s}%")
                        ->orWhere('last_name', 'like', "%{$s}%")
                        ->orWhere('rsbsa_no', 'like', "%{$s}%")
                    );
                })
                ->latest('distribution_date')
                ->paginate(20)
                ->withQueryString()
                ->through(fn ($d) => [
                    'id'                   => $d->id,
                    'farmer'               => $d->farmer,
                    'distribution_date'    => $d->distribution_date?->format('Y-m-d'),
                    'quantity_given'       => $d->quantity_given,
                    'amount_given'         => $d->amount_given,
                    'status'               => $d->status,
                    'notes'                => $d->notes,
                    'is_customized'        => (bool) $d->is_customized,
                    'customization_reason' => $d->customization_reason,
                    'items'                => $d->itemIssues->map(fn ($i) => [
                        'item_name'     => $i->item?->item_name,
                        'unit'          => $i->item?->unit,
                        'quantity'      => (float) $i->quantity,
                        'balance_after' => $i->balance_after === null ? null : (float) $i->balance_after,
                        // Reconstructed, since only the closing balance is stored.
                        'balance_before' => $i->balance_after === null
                            ? null
                            : (float) $i->balance_after + (float) $i->quantity,
                    ]),
                ]),
            'summary' => (function () use ($assistance) {
                $budget    = (float) $assistance->total_budget;
                $disbursed = (float) $assistance->distributions()->sum('amount_given');
                $perFarmer = (float) $assistance->standard_cash_amount;

                // Goods actually issued by this programme, item by item, with
                // what is left in the store beside it. A forfeited hand-out went
                // back on the shelf, so it is not counted as consumed.
                $goods = $assistance->itemIssues()
                    ->where('status', '!=', 'forfeited')
                    ->selectRaw('inventory_item_id, SUM(quantity) AS issued')
                    ->groupBy('inventory_item_id')
                    ->with('item:id,item_name,unit,quantity')
                    ->get()
                    ->map(fn ($row) => [
                        'item'     => $row->item?->item_name ?? 'Unknown item',
                        'unit'     => $row->item?->unit,
                        'issued'   => (float) $row->issued,
                        'in_stock' => (float) ($row->item?->quantity ?? 0),
                    ]);

                return [
                    'total'         => $assistance->distributions()->count(),
                    'claimed'       => $assistance->distributions()->where('status', 'claimed')->count(),
                    'pending'       => $assistance->distributions()->where('status', 'pending')->count(),
                    'forfeited'     => $assistance->distributions()->where('status', 'forfeited')->count(),
                    'disbursed'     => $disbursed,
                    'beneficiaries' => $assistance->distributions()->distinct('farmer_id')->count('farmer_id'),

                    'budget'         => $budget,
                    'remaining'      => round($budget - $disbursed, 2),
                    // Guarded: a programme with no budget would divide by zero.
                    'budget_used_pct' => $budget > 0 ? min(100, round($disbursed / $budget * 100, 1)) : null,

                    // How many more farmers the cash could cover at the standard
                    // rate. The honest ceiling is usually the stock, not the money.
                    'cash_covers_more' => $perFarmer > 0
                        ? max(0, (int) floor(($budget - $disbursed) / $perFarmer))
                        : null,

                    'goods' => $goods,
                ];
            })(),
        ]);
    }

    /**
     * Record a payout. For a material programme this also issues the goods,
     * which deducts them from warehouse stock.
     *
     * The payout record and every stock movement it causes are written in one
     * transaction: if any item is short, nothing is saved at all. A farmer
     * marked as served while the bags never left the store is worse than a
     * refused distribution.
     */
    public function distribute(Request $request, FinancialAssistance $assistance, InventoryService $inventory)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        // A programme that has ended, or has not started, must not hand anything
        // out. The dates are the office's own commitment about when it runs.
        $on = $request->date('distribution_date') ?? now();

        if ($assistance->start_date && $on->lt($assistance->start_date)) {
            return back()->with('error', sprintf(
                '"%s" does not start until %s. Nothing can be distributed before then.',
                $assistance->program_name,
                $assistance->start_date->format('d M Y')
            ));
        }

        if ($assistance->end_date && $on->gt($assistance->end_date)) {
            return back()->with('error', sprintf(
                '"%s" ended on %s. Extend the end date, or create a new programme, before distributing.',
                $assistance->program_name,
                $assistance->end_date->format('d M Y')
            ));
        }

        // One farmer, one hand-out per programme. A forfeited record does not
        // count — those goods went back on the shelf, so the farmer may be
        // served again.
        $already = AssistanceDistribution::where('assistance_id', $assistance->id)
            ->where('farmer_id', $request->input('farmer_id'))
            ->where('status', '!=', 'forfeited')
            ->first();

        if ($already) {
            $farmer = Farmer::find($request->input('farmer_id'));

            return back()->with('error', sprintf(
                '%s was already served by "%s" on %s. Recording it twice would double-count the budget and the stock.',
                trim(($farmer->first_name ?? '') . ' ' . ($farmer->last_name ?? '')) ?: 'That farmer',
                $assistance->program_name,
                $already->distribution_date?->format('d M Y') ?? 'an earlier date'
            ));
        }

        if ($outside = $this->blockIfOutsideTargetBarangays($assistance, $request->input('farmer_id'))) {
            return $outside;
        }

        $data = $request->validate([
            'farmer_id'         => 'required|exists:farmers,id',
            'distribution_date' => 'required|date',
            'quantity_given'    => 'nullable|numeric|min:0',
            'amount_given'      => 'nullable|numeric|min:0',
            'notes'             => 'nullable|string',
            'status'            => 'nullable|in:pending,claimed,forfeited',
            // Set when staff departed from the programme's standard package.
            'is_customized'        => 'nullable|boolean',
            'customization_reason' => 'nullable|string|max:255',
            // [{inventory_item_id, quantity}] — the goods actually handed over.
            // Defaults to the standard package; may be adjusted, and may include
            // items the programme does not normally give.
            'items'                       => 'nullable|array',
            'items.*.inventory_item_id'   => 'required|exists:inventory_items,id',
            'items.*.quantity'            => 'required|numeric|min:0',
        ]);

        $items = collect($data['items'] ?? [])
            ->filter(fn ($i) => (float) $i['quantity'] > 0)
            // Two lines for the same item would deduct twice and read as a
            // duplicate in history; fold them into one.
            ->groupBy('inventory_item_id')
            ->map(fn ($lines, $id) => [
                'inventory_item_id' => $id,
                'quantity'          => $lines->sum(fn ($l) => (float) $l['quantity']),
            ])
            ->values();

        unset($data['items']);

        $data['is_customized'] = $request->boolean('is_customized');
        // A reason only means something alongside an actual departure.
        if (!$data['is_customized']) {
            $data['customization_reason'] = null;
        }

        try {
            DB::transaction(function () use ($assistance, $data, $items, $inventory, $request) {
                /*
                 * Recorded means handed over.
                 *
                 * Staff record a distribution at the moment the farmer receives
                 * it, so "pending" described a state that never existed in
                 * practice — every hand-out sat pending forever and the Claimed
                 * figure stayed at zero. Anything genuinely not yet collected
                 * can be set back to pending on the record itself.
                 */
                $payout = AssistanceDistribution::create($data + [
                    'assistance_id' => $assistance->id,
                    'status'        => $data['status'] ?? 'claimed',
                ]);

                foreach ($items as $line) {
                    // Throws when stock is short, rolling the whole payout back.
                    $inventory->distribute(
                        InventoryItem::findOrFail($line['inventory_item_id']),
                        [
                            'farmer_id'                  => $data['farmer_id'],
                            'assistance_id'              => $assistance->id,
                            'assistance_distribution_id' => $payout->id,
                            'quantity'                   => $line['quantity'],
                            'distribution_date'          => $data['distribution_date'],
                            // Matches the payout: the goods went with the farmer.
                            'status'                     => $data['status'] ?? 'claimed',
                        ],
                        $request->user()?->id,
                    );
                }

                // The stock movements were already logged by InventoryService.
                // This records the payout itself, so the audit trail answers
                // "who served this farmer, when, and with what" in one entry
                // rather than only showing the goods leaving the store.
                AuditService::log('distribute', 'assistance_distributions', $payout->id, null, [
                    'assistance_id'  => $assistance->id,
                    'program_name'   => $assistance->program_name,
                    'farmer_id'      => $data['farmer_id'],
                    'amount_given'   => $data['amount_given'] ?? null,
                    'is_customized'  => $data['is_customized'],
                    'items'          => $items->map(fn ($i) => [
                        'inventory_item_id' => $i['inventory_item_id'],
                        'quantity'          => $i['quantity'],
                    ])->all(),
                ]);
            });
        } catch (RuntimeException $e) {
            // Insufficient stock — the message names the item and the shortfall.
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', $items->isEmpty()
            ? 'Distribution recorded successfully.'
            : "Distribution recorded and {$items->count()} item(s) deducted from stock.");
    }

    public function edit(FinancialAssistance $assistance)
    {
        return Inertia::render('Admin/Assistance/Form', [
            'program' => $assistance->load(['barangays', 'programItems']),
            'assistanceTypes' => AssistanceType::orderBy('category')->orderBy('type_name')->get(),
            // Stock the programme can draw on, for the item picker.
            'stockItems' => InventoryItem::orderBy('item_name')
                ->get(['id', 'item_name', 'unit', 'quantity', 'category']),
            'barangays' => Barangay::where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function update(Request $request, FinancialAssistance $assistance)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        $this->resolveCustomType($request);

        $data = $request->validate([
            'program_name'           => 'required|string|max:100',
            'assistance_type_id'     => 'required|exists:assistance_types,id',
            'description'            => 'nullable|string',
            'total_budget'           => 'required|numeric|min:0',
            'standard_cash_amount'   => 'nullable|numeric|min:0',
            'start_date'             => 'required|date',
            'end_date'               => 'required|date|after_or_equal:start_date',
            'status'                 => 'nullable|in:' . implode(',', FinancialAssistance::STATUSES),
            'barangay_ids'           => 'nullable|array',
            'barangay_ids.*'         => 'exists:barangays,id',
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

        $this->syncProgramItems($assistance, $request);

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
     * Lock or unlock a programme.
     *
     * Route-gated on "lock assistance" (Admin and Super Admin only), and on top
     * of that the user must re-enter their personal lock password — not their
     * login password. Being signed in is not by itself authority to freeze or
     * release a programme's figures; an unattended desk should not be enough.
     *
     * Anyone who has not set a lock password yet sets it here, on first use.
     */
    public function toggleLock(Request $request, FinancialAssistance $assistance)
    {
        $user = $request->user();

        // Throttle guessing per user, not per programme — otherwise an attacker
        // just moves to the next row.
        $throttleKey = 'lock-password:' . $user->id;

        if (RateLimiter::tooManyAttempts($throttleKey, self::LOCK_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return back()->withErrors([
                'lock_password' => 'Too many incorrect attempts. Try again in '
                    . ceil($seconds / 60) . ' minute(s).',
            ]);
        }

        if (!$user->hasLockPassword()) {
            $request->validate([
                'new_lock_password' => 'required|string|min:6|max:72|confirmed',
            ], [], ['new_lock_password' => 'lock password']);

            // Reusing the login password would defeat the whole point.
            if ($user->lockPasswordMatchesLogin($request->new_lock_password)) {
                return back()->withErrors([
                    'new_lock_password' => 'Your lock password must be different from your login password.',
                ]);
            }

            $user->setLockPassword($request->new_lock_password);
        } else {
            $request->validate(['lock_password' => 'required|string']);

            if (!$user->checkLockPassword($request->lock_password)) {
                RateLimiter::hit($throttleKey, self::LOCK_DECAY_SECONDS);

                $left = self::LOCK_ATTEMPTS - RateLimiter::attempts($throttleKey);

                return back()->withErrors([
                    'lock_password' => 'That lock password is not correct.'
                        . ($left > 0 ? " {$left} attempt(s) left." : ''),
                ]);
            }

            RateLimiter::clear($throttleKey);
        }

        $locking = !$assistance->is_locked;

        $assistance->update([
            'is_locked' => $locking,
            'locked_at' => $locking ? now() : null,
            'locked_by' => $locking ? $user->id : null,
        ]);

        return back()->with('success', $locking
            ? "\"{$assistance->program_name}\" is locked. Its details and distributions are now read-only."
            : "\"{$assistance->program_name}\" is unlocked and can be edited again.");
    }
}
