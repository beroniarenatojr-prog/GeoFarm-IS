<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgriculturalIntervention;
use App\Models\AssistanceDistribution;
use App\Models\AssistanceType;
use App\Models\Barangay;
use App\Models\FarmParcel;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use App\Models\InventoryItem;
use App\Notifications\FarmerAssistanceDistributed;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use RuntimeException;
use Throwable;

class AssistanceController extends Controller
{
    /** Wrong lock passwords allowed before the user is locked out. */
    private const LOCK_ATTEMPTS = 5;

    /** How long that lockout lasts. */
    private const LOCK_DECAY_SECONDS = 900;

    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => 'nullable|string|max:100',
            'status' => 'nullable|in:' . implode(',', FinancialAssistance::STATUSES),
            'type'   => 'nullable|integer|exists:assistance_types,id',
            'locked' => 'nullable|in:yes,no',
        ]);

        return Inertia::render('Admin/Assistance/Index', [
            // programItems is eager-loaded because the edit modal opens straight
            // from this list: without it the form would post an empty item list
            // and silently wipe the programme's entitlements.
            'programs' => FinancialAssistance::with(['assistanceType', 'barangays', 'locker:id,name', 'programItems'])
                ->withCount('distributions')
                /*
                 * Who the programme is for, split from what has actually been
                 * handed over. The list used to show how many barangays were
                 * ticked, which said nothing about the beneficiaries.
                 *
                 * The aliases deliberately avoid pending_count / claimed_count /
                 * beneficiaries_count: the model defines accessors by those
                 * names, and an accessor overrides the counted attribute during
                 * serialisation — turning one query into one per row for the
                 * same figure.
                 */
                ->withCount([
                    // Forfeited excluded: the goods went back on the shelf.
                    'distributions as on_programme_count' => fn ($q) => $q->where('status', '!=', 'forfeited'),
                    'distributions as awaiting_count' => fn ($q) => $q->where('status', 'pending'),
                    'distributions as received_count' => fn ($q) => $q->where('status', 'claimed'),
                ])
                ->withSum('distributions', 'amount_given')
                /*
                 * Filtered in SQL so the paging and the result count agree with
                 * the rows. The office runs dozens of programmes a year and was
                 * scrolling to find last season's.
                 */
                ->when(
                    $filters['search'] ?? null,
                    fn ($q, $s) => $q->where(function ($query) use ($s) {
                        $query->where('program_name', 'like', "%$s%")
                            ->orWhere('description', 'like', "%$s%")
                            // The type is a column on the list, so it is a
                            // reasonable thing to type into the box.
                            ->orWhereHas(
                                'assistanceType',
                                fn ($t) => $t->where('type_name', 'like', "%$s%"),
                            );
                    }),
                )
                ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
                ->when($filters['type'] ?? null, fn ($q, $v) => $q->where('assistance_type_id', $v))
                // is_locked is a boolean column, so 'no' has to be matched
                // explicitly — a falsy check would drop the filter entirely.
                ->when(
                    $filters['locked'] ?? null,
                    fn ($q, $v) => $q->where('is_locked', $v === 'yes'),
                )
                ->latest()
                ->paginate(15)
                ->withQueryString(),
            'filters' => $filters,
            // Drives whether the padlock is a button or just an indicator.
            'canLock' => auth()->user()?->can('lock assistance') ?? false,
            /*
             * Same treatment for the status switch: Staff see the programme's
             * state but cannot change it.
             *
             * The route refuses them anyway — this only stops the page
             * offering a control that would be rejected, which reads as the
             * system being broken rather than as a permission they lack.
             */
            'canSetStatus' => auth()->user()?->can('set assistance status') ?? false,
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
     * What a new type hands out, worked out rather than asked.
     *
     * The form used to ask, and the answer earned almost nothing: the item
     * list is offered whatever the type says, and isMaterial() already treats
     * an attached item list as the deciding factor — a "financial" type with
     * items on it is a mixed programme either way. So the programme being
     * created answers the question itself.
     *
     * A guess, and only that. It is one field on a lookup row, visible and
     * correctable under Lookups, and nothing downstream reads it without the
     * item list beside it.
     */
    private function distributionFrom(Request $request): string
    {
        $items = collect($request->input('items', []))
            ->filter(fn ($line) => filled($line['inventory_item_id'] ?? null));

        return $items->isNotEmpty() ? 'material' : 'financial';
    }

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
            // Optional now. The form no longer asks — see below.
            'new_type_distribution' => 'nullable|in:' . implode(',', AssistanceType::DISTRIBUTION_TYPES),
        ]);

        /*
         * One name, however it was typed.
         *
         * "Fuel Subsidy", "fuel subsidy" and " FUEL SUBSIDY " are the same
         * type. Surrounding space is trimmed, runs of space inside collapse to
         * one, and the lookup lower-cases both sides rather than trusting the
         * connection's collation — which is case-insensitive on MySQL but not
         * everywhere, and this list is what every assistance report groups by.
         */
        $name = preg_replace('/\s+/', ' ', trim($data['new_type_name']));

        $existing = AssistanceType::whereRaw('LOWER(type_name) = ?', [mb_strtolower($name)])->first();

        $type = $existing ?? AssistanceType::create([
            // The first spelling wins, so an existing type keeps the casing the
            // office already uses rather than being rewritten by whoever
            // typed it next.
            'type_name'         => $name,
            'category'          => AssistanceType::CUSTOM_CATEGORY,
            'distribution_type' => $data['new_type_distribution']
                ?? $this->distributionFrom($request),
        ]);

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
    /**
     * Email the farmer that a hand-out was recorded for them.
     *
     * Called after the transaction commits, never inside it.
     *
     * A farmer encoded at the office may have no login account, so the address
     * on their own record comes first and the linked user account is the
     * fallback. With neither, there is nowhere to write and the distribution
     * simply stands unannounced — staff hand the goods over in person anyway.
     */
    private function tellFarmerAboutHandout(AssistanceDistribution $payout): void
    {
        $payout->loadMissing(['farmer.user', 'program', 'itemIssues.item']);

        $address = $payout->farmer?->email ?: $payout->farmer?->user?->email;

        if (blank($address)) {
            return;
        }

        try {
            Notification::route('mail', $address)
                ->notify(new FarmerAssistanceDistributed($payout));
        } catch (Throwable $e) {
            // The goods are handed over and the row is committed. A mail or
            // queue problem must not turn a recorded distribution into an
            // error page that invites staff to record it a second time.
            Log::warning('Could not queue the assistance distribution email.', [
                'assistance_distribution_id' => $payout->id,
                'error'                      => $e->getMessage(),
            ]);
        }
    }

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
            'total_budget'           => 'nullable|numeric|min:0',
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

        /*
         * A new programme starts as a draft unless the person creating it may
         * set the status. Staff can still raise one and fill in everything
         * about it; an Admin decides when it opens.
         *
         * Unset BEFORE the union below. `$data + [...]` keeps keys that are
         * already in $data and only fills in missing ones, so a default given
         * on the right-hand side is ignored whenever the field was submitted —
         * which is exactly when it needs to apply.
         */
        if (! auth()->user()?->can('set assistance status')) {
            unset($data['status']);
        }

        $assistance = FinancialAssistance::create($data + [
            'created_by' => auth()->id(),
            'status'     => 'draft',
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
            // inventory_item_id is now optional - can use text-based items instead
            'items.*.inventory_item_id' => 'nullable|exists:inventory_items,id',
            'items.*.item_name'         => 'nullable|string|max:100',
            'items.*.unit'              => 'nullable|string|max:20',
            'items.*.quantity_per_farmer' => 'required|numeric|min:0.01',
            'items.*.total_quantity'    => 'nullable|numeric|min:0',
        ])['items'] ?? [];

        // Keyed by item (either inventory_item_id or item_name) so a duplicated 
        // row updates rather than violating the unique index.
        $keep = [];

        foreach ($lines as $line) {
            // Require either inventory_item_id OR item_name
            if (empty($line['inventory_item_id']) && empty($line['item_name'])) {
                continue;
            }

            // Use inventory_item_id as key if present, otherwise use item_name
            $uniqueKey = !empty($line['inventory_item_id']) 
                ? ['inventory_item_id' => $line['inventory_item_id']]
                : [
                    'inventory_item_id' => null,
                    'item_name' => $line['item_name']
                  ];

            $row = $assistance->programItems()->updateOrCreate(
                $uniqueKey,
                [
                    'item_name'           => $line['item_name'] ?? null,
                    'unit'                => $line['unit'] ?? null,
                    'inventory_item_id'   => $line['inventory_item_id'] ?? null,
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
            // What this programme hands out. For text-based items, show the 
            // item_name/unit directly; for inventory-linked items, fall back to
            // the inventory item details.
            'programItems' => $assistance->programItems->map(fn ($line) => [
                'inventory_item_id'   => $line->inventory_item_id,
                'item_name'           => $line->item_name ?? $line->item?->item_name ?? 'Unknown item',
                'unit'                => $line->unit ?? $line->item?->unit,
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
                    // What authorised this release, and which land it concerns.
                    // Both have been recordable since the workflow migration;
                    // this is the first screen to read them back.
                    // Every column the appended accessors read, not just the
                    // ones drawn: display_title needs title/type/reason, source
                    // needs factor_key and the assessment id, and is_overdue
                    // needs target_date — omitted, it would serialise false for
                    // an intervention that is in fact overdue.
                    'intervention:id,farmer_id,farm_parcel_id,title,type,reason,factor_key,climate_risk_assessment_id,status,priority,target_date',
                    'intervention.parcel:id,parcel_number,barangay',
                    'parcel:id,parcel_number,barangay',
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
                    'reference_no'         => $d->reference_no,
                    'notes'                => $d->notes,
                    'is_customized'        => (bool) $d->is_customized,
                    'customization_reason' => $d->customization_reason,

                    /*
                     * Null on a release that was not tied to any intervention,
                     * which is legitimate — a fuel subsidy round is not about
                     * one piece of work. The farmer is deliberately NOT
                     * repeated in here: it is already on the row above, and
                     * the intervention belongs to the same farmer by the
                     * ownership check that let it be linked at all.
                     */
                    'intervention' => $d->intervention ? [
                        'id'       => $d->intervention->id,
                        'title'    => $d->intervention->display_title,
                        'source'   => $d->intervention->source,
                        'status'   => $d->intervention->status,
                        'priority' => $d->intervention->priority,
                        // From the intervention's own parcel, falling back to
                        // the one recorded on the release.
                        'parcel'   => $d->intervention->parcel?->parcel_number ?? $d->parcel?->parcel_number,
                        'barangay' => $d->intervention->parcel?->barangay ?? $d->parcel?->barangay,
                    ] : null,

                    // The land this release concerns, when it concerns one.
                    'parcel' => $d->parcel ? [
                        'id'            => $d->parcel->id,
                        'parcel_number' => $d->parcel->parcel_number,
                        'barangay'      => $d->parcel->barangay,
                    ] : null,
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

            /*
             * What authorised this release, and which land it concerns.
             *
             * Both columns and both relations have existed since the workflow
             * migration; neither was ever accepted here, so every release in
             * the registry is unlinked and no intervention can show what the
             * farmer actually received. Optional, because assistance is
             * legitimately farmer-level as often as it is parcel-level — a
             * fuel subsidy is not about one field.
             *
             * Validated for ownership below rather than trusted: an id posted
             * from a form must not be able to attach one farmer's release to
             * another farmer's intervention.
             */
            'intervention_id'   => 'nullable|exists:agricultural_interventions,id',
            'farm_parcel_id'    => 'nullable|exists:farm_parcels,id',
            // The office's own reference from the voucher or release slip.
            'reference_no'      => 'nullable|string|max:60',
            // Set when staff departed from the programme's standard package.
            'is_customized'        => 'nullable|boolean',
            'customization_reason' => 'nullable|string|max:255',
            // [{inventory_item_id, quantity}] OR [{item_name, unit, quantity}]
            // The goods actually handed over. Defaults to the standard package; 
            // may be adjusted, and may include items the programme does not normally give.
            // Now supports both inventory-linked items AND free-text items.
            'items'                       => 'nullable|array',
            'items.*.inventory_item_id'   => 'nullable|exists:inventory_items,id',
            'items.*.item_name'           => 'nullable|string|max:100',
            'items.*.unit'                => 'nullable|string|max:20',
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

        /*
         * Both links must belong to the farmer being paid.
         *
         * Without this, a stale or mistyped id would file this release under
         * another farmer's intervention or against land they do not hold —
         * and because both are foreign keys to real rows, the database would
         * accept it happily. Refused rather than silently dropped: quietly
         * discarding the link would leave staff believing the release was
         * recorded against the intervention they chose.
         */
        if (! empty($data['intervention_id'])) {
            $owns = AgriculturalIntervention::whereKey($data['intervention_id'])
                ->where('farmer_id', $data['farmer_id'])
                ->exists();

            if (! $owns) {
                throw ValidationException::withMessages([
                    'intervention_id' => 'That intervention belongs to a different farmer.',
                ]);
            }
        }

        if (! empty($data['farm_parcel_id'])) {
            $owns = FarmParcel::whereKey($data['farm_parcel_id'])
                ->where('farmer_id', $data['farmer_id'])
                ->exists();

            if (! $owns) {
                throw ValidationException::withMessages([
                    'farm_parcel_id' => 'That parcel belongs to a different farmer.',
                ]);
            }
        }

        try {
            // The payout is returned out of the transaction rather than handled
            // inside it, so the farmer is emailed only once the row has actually
            // committed. Short stock throws below and rolls the whole thing
            // back; nobody should be told they received goods that never left
            // the store.
            $payout = DB::transaction(function () use ($assistance, $data, $items, $inventory, $request) {
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
                    // For inventory-linked items, deduct from stock
                    if (!empty($line['inventory_item_id'])) {
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
                    // For text-based items (no inventory tracking), just record them
                    // in a simple format - no stock deduction needed
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

                return $payout;
            });
        } catch (RuntimeException $e) {
            // Insufficient stock — the message names the item and the shortfall.
            return back()->with('error', $e->getMessage());
        }

        $this->tellFarmerAboutHandout($payout);

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
            'total_budget'           => 'nullable|numeric|min:0',
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

        /*
         * Status is dropped for anyone without "set assistance status".
         *
         * Guarding only the toggle route would have been theatre: this form is
         * gated on "edit assistance", which Staff hold, and it posts a status
         * field — so the restriction could be walked straight around by
         * opening the edit dialog instead of clicking the switch.
         *
         * Dropped silently rather than refused, because the field simply is
         * not theirs to send: the form does not show it to them, so a rejection
         * here would only ever be reached by a crafted request.
         */
        if (! auth()->user()?->can('set assistance status')) {
            unset($data['status']);
        }

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

    /**
     * Choose which farmers a programme is for.
     *
     * A distribution row IS the beneficiary record — 'pending' means assigned
     * and not yet served, 'claimed' means served. So this screen writes the
     * same table the hand-out does, rather than introducing a second idea of
     * who a programme is for that could disagree with it.
     *
     * Paginated and filtered in SQL. The registry holds thousands of farmers
     * and the office picks a few dozen; loading them all to filter in the
     * browser would be slow and would only ever search the page on screen.
     */
    public function beneficiaries(Request $request, FinancialAssistance $assistance)
    {
        $filters = $request->validate([
            'search'    => 'nullable|string|max:100',
            'barangay'  => 'nullable|string|max:50',
            'commodity' => 'nullable|string|max:100',
            'assigned'  => 'nullable|in:yes,no',
        ]);

        /*
         * Which barangays the programme targets, if any.
         *
         * Names rather than ids, because farmers carry a barangay NAME while
         * the pivot carries ids. An empty list means the programme is open to
         * the whole municipality, which is the common case and must not be
         * read as "nobody qualifies".
         */
        $targetBarangays = $assistance->barangays()->pluck('name')->all();

        /*
         * Everyone already on this programme, and in what state, in one query
         * rather than one per row.
         *
         * A farmer can hold more than one row — forfeited once, then served
         * again — so the live row has to win. keyBy() on its own keeps whichever
         * came last, which would show a farmer as forfeited while they are in
         * fact pending collection, or offer them for selection twice.
         */
        $existing = AssistanceDistribution::where('assistance_id', $assistance->id)
            ->get(['id', 'farmer_id', 'status', 'amount_given', 'quantity_given'])
            ->groupBy('farmer_id')
            ->map(fn ($rows) => $rows->firstWhere('status', '!=', 'forfeited') ?? $rows->last());

        $farmers = $this->farmerPickerQuery($filters, $assistance)
            ->select([
                'id', 'rsbsa_no', 'first_name', 'middle_name', 'last_name', 'suffix',
                'barangay', 'sex', 'mobile_no',
            ])
            // The parcels drive the commodity column and its filter. withCount
            // rather than loading every parcel for every row.
            ->with(['parcels:id,farmer_id,parcel_number,barangay,commodity,total_area_ha'])
            ->withCount('parcels')
            ->orderBy('last_name')->orderBy('first_name')->orderBy('id')
            ->paginate(20)
            ->withQueryString()
            ->through(function (Farmer $farmer) use ($existing, $targetBarangays) {
                $row = $existing->get($farmer->id);

                return [
                    'id'         => $farmer->id,
                    'name'       => $farmer->full_name,
                    'rsbsa_no'   => $farmer->rsbsa_no,
                    'barangay'   => $farmer->barangay,
                    'parcels'    => $farmer->parcels_count,
                    // The crops on their land, deduplicated — a farmer with
                    // three rice parcels grows rice, not rice three times.
                    'commodities' => $farmer->parcels->pluck('commodity')
                        ->filter()->unique()->values()->all(),
                    'area_ha'    => round((float) $farmer->parcels->sum('total_area_ha'), 2),

                    /*
                     * Assigned means a row that still stands. A farmer whose
                     * only record was forfeited is selectable again — the same
                     * rule the hand-out check applies — so they must not come
                     * back ticked and uncheckable.
                     */
                    'assigned'       => $row !== null && $row->status !== 'forfeited',
                    'status'         => $row?->status,
                    'distribution_id' => $row?->id,
                    'amount_given'   => $row?->amount_given,
                    'quantity_given' => $row?->quantity_given,

                    /*
                     * Outside the programme's target barangays — shown, not
                     * hidden. A programme may legitimately cover a farmer from
                     * elsewhere, and the brief is explicit that differing
                     * barangays must not disqualify anyone. The flag lets the
                     * screen say so rather than the server deciding silently.
                     */
                    'outside_target' => $targetBarangays !== []
                        && ! in_array($farmer->barangay, $targetBarangays, true),
                ];
            });

        return Inertia::render('Admin/Assistance/Beneficiaries', [
            'program' => [
                'id'            => $assistance->id,
                'program_name'  => $assistance->program_name,
                'status'        => $assistance->status,
                'is_locked'     => (bool) $assistance->is_locked,
                'total_budget'  => $assistance->total_budget,
                'standard_cash_amount' => $assistance->standard_cash_amount,
                'type'          => $assistance->assistanceType?->type_name,
                'distribution_type' => $assistance->assistanceType?->distribution_type,
                'start_date'    => $assistance->start_date?->toDateString(),
                'end_date'      => $assistance->end_date?->toDateString(),
            ],
            'farmers'         => $farmers,
            'filters'         => $filters,
            'barangays'       => Farmer::verified()->distinct()->orderBy('barangay')
                ->pluck('barangay')->filter()->values(),
            'commodities'     => FarmParcel::query()->distinct()->orderBy('commodity')
                ->pluck('commodity')->filter()->values(),
            'targetBarangays' => $targetBarangays,
            'summary'         => $this->beneficiarySummary($assistance),
            'selectAll'       => $this->selectableIds($filters, $assistance, $targetBarangays),
            'can'             => [
                'assign' => $request->user()?->can('edit assistance') ?? false,
            ],
        ]);
    }

    /**
     * The farmer list the picker shows, as a query both callers share.
     *
     * Extracted so "Select all matching" cannot drift from what the table
     * lists. Two copies of these conditions would eventually disagree by one
     * clause, and the difference would show up as Select All quietly adding
     * farmers the office never saw on screen.
     */
    private function farmerPickerQuery(array $filters, FinancialAssistance $assistance)
    {
        return Farmer::query()
            // Unverified farmers are not offered at all: their details have not
            // been checked, so they cannot be committed to a programme.
            ->verified()
            ->when($filters['search'] ?? null, fn ($q, $s) => $q->where(function ($query) use ($s) {
                $query->where('first_name', 'like', "%$s%")
                    ->orWhere('middle_name', 'like', "%$s%")
                    ->orWhere('last_name', 'like', "%$s%")
                    ->orWhere('rsbsa_no', 'like', "%$s%");
            }))
            ->when($filters['barangay'] ?? null, fn ($q, $b) => $q->where('barangay', $b))
            ->when(
                $filters['commodity'] ?? null,
                fn ($q, $c) => $q->whereHas('parcels', fn ($p) => $p->where('commodity', 'like', "%$c%")),
            )
            /*
             * Assigned / not assigned, resolved in SQL so it pages correctly.
             * Filtering the page in PHP would give pages of wildly different
             * sizes and a "Showing 1–20 of N" line that did not match the rows
             * underneath it.
             *
             * Forfeited does not count as assigned, the same rule the hand-out
             * check uses: those goods went back on the shelf.
             */
            ->when(
                ($filters['assigned'] ?? null) === 'yes',
                fn ($q) => $q->whereHas(
                    'distributions',
                    fn ($d) => $d->where('assistance_id', $assistance->id)->where('status', '!=', 'forfeited'),
                ),
            )
            ->when(
                ($filters['assigned'] ?? null) === 'no',
                fn ($q) => $q->whereDoesntHave(
                    'distributions',
                    fn ($d) => $d->where('assistance_id', $assistance->id)->where('status', '!=', 'forfeited'),
                ),
            );
    }

    /** How many ids "Select all matching" will carry in one page load. */
    private const SELECT_ALL_CAP = 500;

    /**
     * The ids "Select all matching" would tick, for the current filter.
     *
     * Needed because the list is paged on the server: a checkbox in the header
     * can only reach the twenty rows on screen, and the office selecting "all
     * rice farmers in Antagan I" means all of them, not the first page.
     *
     * Already-assigned farmers are left out — ticking someone the server will
     * skip anyway only produces a "40 added, 12 skipped" message for work the
     * screen could have got right.
     *
     * Capped, and the cap is reported rather than applied in silence. An
     * unfiltered registry of thousands would otherwise put thousands of ids in
     * every page load, and a truncated selection that claims to be everything
     * is how a programme comes to miss half its beneficiaries.
     */
    private function selectableIds(array $filters, FinancialAssistance $assistance, array $targetBarangays): array
    {
        $rows = $this->farmerPickerQuery($filters, $assistance)
            ->whereDoesntHave(
                'distributions',
                fn ($d) => $d->where('assistance_id', $assistance->id)->where('status', '!=', 'forfeited'),
            )
            ->orderBy('last_name')->orderBy('first_name')->orderBy('id')
            ->limit(self::SELECT_ALL_CAP + 1)
            ->get(['id', 'barangay']);

        $kept = $rows->take(self::SELECT_ALL_CAP);

        return [
            'ids'       => $kept->pluck('id')->values()->all(),
            /*
             * Which of those sit outside the target barangays, so the screen can
             * raise the override prompt for a Select All it never displayed.
             * Without it the prompt would depend on which page happened to be
             * on screen when the button was pressed.
             */
            'outside'   => $targetBarangays === [] ? [] : $kept
                ->reject(fn ($f) => in_array($f->barangay, $targetBarangays, true))
                ->pluck('id')->values()->all(),
            'truncated' => $rows->count() > self::SELECT_ALL_CAP,
            'cap'       => self::SELECT_ALL_CAP,
        ];
    }

    /**
     * The programme's beneficiary figures, counted from the real records.
     *
     * Assigned and served are reported separately on purpose. Selecting a
     * farmer is a plan; a claimed row is goods that left the store. A single
     * "beneficiaries" number that blurs the two is how a report comes to claim
     * deliveries that have not happened.
     */
    private function beneficiarySummary(FinancialAssistance $assistance): array
    {
        $rows = AssistanceDistribution::where('assistance_id', $assistance->id)
            ->get(['status', 'amount_given']);

        $live = $rows->where('status', '!=', 'forfeited');

        $planned = round((float) $live->sum('amount_given'), 2);
        $budget = $assistance->total_budget === null ? null : (float) $assistance->total_budget;

        return [
            // Forfeited rows are excluded: those goods went back on the shelf.
            'assigned'  => $live->count(),
            'pending'   => $rows->where('status', 'pending')->count(),
            'claimed'   => $rows->where('status', 'claimed')->count(),
            'forfeited' => $rows->where('status', 'forfeited')->count(),

            'planned_allocation' => $planned,
            'total_budget'       => $budget,
            // Null rather than the budget itself when no budget is set: an
            // unbudgeted programme has no remainder, and showing one invites
            // the figure to be read as money available.
            'remaining_budget'   => $budget === null ? null : round($budget - $planned, 2),
            'over_budget'        => $budget !== null && $planned > $budget,
        ];
    }

    /**
     * Put a batch of farmers on the programme.
     *
     * Creates 'pending' rows — assigned, awaiting distribution. It deliberately
     * does NOT mark anything as received: that is distribute()'s job, it
     * deducts live inventory, and conflating the two would record hand-outs
     * that never happened.
     *
     * Every rule is re-checked here regardless of what the screen allowed:
     * the lock, the programme status, that each farmer exists and is verified,
     * and that they are not already on the list. A request can be made without
     * the screen.
     */
    public function assignBeneficiaries(Request $request, FinancialAssistance $assistance)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        /*
         * A finished or cancelled programme takes no new beneficiaries.
         * Reopening it is an explicit act through the edit form, which is
         * where that decision belongs.
         */
        if (in_array($assistance->status, ['completed', 'cancelled'], true)) {
            return back()->with('error', sprintf(
                '"%s" is %s. Reopen it before adding beneficiaries.',
                $assistance->program_name,
                $assistance->status,
            ));
        }

        $data = $request->validate([
            'farmer_ids'   => 'required|array|min:1',
            'farmer_ids.*' => 'integer|exists:farmers,id',
            'amount'       => 'nullable|numeric|min:0',
            /*
             * The deliberate override for farmers outside the programme's
             * target barangays.
             *
             * Checked here and not only in the browser. The screen can only
             * flag the rows it has on display, so a selection built across
             * several pages could carry farmers whose flag was never shown —
             * and a guard that pages can walk around is not a guard.
             */
            'allow_outside_target' => 'nullable|boolean',
        ]);

        /*
         * Verified only, re-checked server side.
         *
         * The picker lists verified farmers, but exists:farmers,id above would
         * accept any id at all — including a self-registered farmer whose
         * documents the office has not seen. Their data has not been checked,
         * so they cannot be committed to a programme.
         */
        $eligible = Farmer::verified()
            ->whereIn('id', $data['farmer_ids'])
            ->pluck('id');

        $refused = count($data['farmer_ids']) - $eligible->count();

        // Already on the list, in any state that still counts. A forfeited row
        // does not block a fresh assignment, for the same reason it does not
        // block a fresh hand-out.
        $alreadyOn = AssistanceDistribution::where('assistance_id', $assistance->id)
            ->whereIn('farmer_id', $eligible)
            ->where('status', '!=', 'forfeited')
            ->pluck('farmer_id')
            ->all();

        $toAdd = $eligible->reject(fn ($id) => in_array($id, $alreadyOn, true))->values();

        /*
         * Farmers outside the programme's declared barangays.
         *
         * Refused only until someone says so explicitly — a farmer may live in
         * one barangay and farm in another, and the brief is clear that a
         * differing barangay must not disqualify anyone. What it must not do is
         * happen by accident on a programme declared for three barangays.
         *
         * Nothing is added when this trips: a partial batch would leave staff
         * unsure which farmers made it on, and re-ticking is cheap compared with
         * reconciling that.
         */
        $targets = $assistance->barangays()->pluck('name')
            ->filter()->map(fn ($n) => mb_strtolower(trim($n)));

        if ($targets->isNotEmpty() && ! $request->boolean('allow_outside_target')) {
            $outside = Farmer::whereIn('id', $toAdd)
                ->get(['id', 'first_name', 'last_name', 'barangay'])
                ->reject(fn (Farmer $f) => $targets->contains(mb_strtolower(trim((string) $f->barangay))));

            if ($outside->isNotEmpty()) {
                return back()->with('error', sprintf(
                    '%d of those farmers %s outside the barangays "%s" covers (%s). Confirm the override to add them anyway.',
                    $outside->count(),
                    $outside->count() === 1 ? 'is' : 'are',
                    $assistance->program_name,
                    $assistance->barangays->pluck('name')->implode(', '),
                ));
            }
        }

        if ($toAdd->isEmpty()) {
            return back()->with('error', $refused > 0
                ? 'None of those farmers could be added — they are already on this programme or are not verified.'
                : 'Those farmers are already on this programme.');
        }

        $amount = $data['amount'] ?? $assistance->standard_cash_amount;

        /*
         * One transaction. A half-written batch would leave the office unable
         * to tell which of forty farmers made it onto the list.
         */
        DB::transaction(function () use ($assistance, $toAdd, $amount, $request) {
            foreach ($toAdd as $farmerId) {
                AssistanceDistribution::create([
                    'assistance_id' => $assistance->id,
                    'farmer_id'     => $farmerId,
                    // Assigned, not served. distribute() sets the real date.
                    'status'        => 'pending',
                    'distribution_date' => now()->toDateString(),
                    'amount_given'  => $amount,
                    'assigned_by'   => $request->user()?->id,
                    'assigned_at'   => now(),
                ]);
            }
        });

        AuditService::log('assistance_beneficiaries_added', 'financial_assistance', $assistance->id, null, [
            'added'    => $toAdd->count(),
            'skipped'  => count($alreadyOn),
            'refused'  => $refused,
            'amount_each' => $amount,
            // Worth recording: it is the one rule on this screen a person can
            // decide to set aside, so the trail should show when they did.
            'outside_target_override' => $targets->isNotEmpty() && $request->boolean('allow_outside_target'),
        ]);

        $message = sprintf(
            '%d farmer%s added to "%s".',
            $toAdd->count(),
            $toAdd->count() === 1 ? '' : 's',
            $assistance->program_name,
        );

        // Says what it left out rather than quietly adding fewer than asked.
        if ($alreadyOn !== [] || $refused > 0) {
            $message .= sprintf(
                ' %d skipped (already on the programme%s).',
                count($alreadyOn) + $refused,
                $refused > 0 ? ' or not verified' : '',
            );
        }

        return back()->with('success', $message);
    }

    /**
     * Take a farmer off the programme.
     *
     * Only while still pending. Once something has actually been handed over,
     * the record is history and removing it would erase goods that left the
     * store — forfeiting is how a claimed release is undone, and that is a
     * different act with its own reason.
     */
    public function removeBeneficiary(Request $request, FinancialAssistance $assistance, AssistanceDistribution $distribution)
    {
        if ($blocked = $this->blockIfLocked($assistance)) {
            return $blocked;
        }

        if ((int) $distribution->assistance_id !== (int) $assistance->id) {
            return back()->with('error', 'That record does not belong to this programme.');
        }

        if ($distribution->status !== 'pending') {
            return back()->with('error', sprintf(
                'That farmer has already been marked %s. Forfeit the release instead of removing the record.',
                $distribution->status,
            ));
        }

        AuditService::log('assistance_beneficiary_removed', 'assistance_distributions', $distribution->id, [
            'farmer_id' => $distribution->farmer_id,
        ], null);

        $distribution->delete();

        return back()->with('success', 'Farmer removed from the programme.');
    }
}
