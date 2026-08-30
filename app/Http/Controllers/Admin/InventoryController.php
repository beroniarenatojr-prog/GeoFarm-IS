<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use App\Models\InventoryAdjustment;
use App\Models\InventoryDistribution;
use App\Models\InventoryItem;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use RuntimeException;

/**
 * Supply inventory held by the Agriculture Office.
 *
 * Stock is only ever moved through InventoryService, never by assigning to
 * `quantity` here, so the running balance always has a ledger row behind it.
 */
class InventoryController extends Controller
{
    public function __construct(private InventoryService $inventory)
    {
    }

    public function index(Request $request)
    {
        $sortable = ['item_name', 'category', 'quantity', 'expiry_date', 'created_at'];
        $sort = in_array($request->sort, $sortable, true) ? $request->sort : 'item_name';
        $direction = $request->direction === 'desc' ? 'desc' : 'asc';
        $perPage = in_array((int) $request->per_page, [25, 50, 100], true) ? (int) $request->per_page : 25;

        $filtered = fn () => InventoryItem::query()
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('item_name', 'like', "%$s%")
                ->orWhere('supplier', 'like', "%$s%")
                ->orWhere('funding_source', 'like', "%$s%")))
            ->when($request->category, fn ($q, $c) => $q->where('category', $c))
            ->when($request->status === 'out_of_stock', fn ($q) => $q->outOfStock())
            ->when($request->status === 'low_stock', fn ($q) => $q->lowStock())
            ->when($request->status === 'available',
                fn ($q) => $q->whereColumn('quantity', '>', 'min_level')->where('quantity', '>', 0))
            ->when($request->expiring, fn ($q) => $q
                ->whereNotNull('expiry_date')
                ->whereDate('expiry_date', '<=', now()->addDays(InventoryItem::EXPIRY_WARNING_DAYS)));

        $items = $filtered()->orderBy($sort, $direction)->orderBy('id')
            ->paginate($perPage)->withQueryString();

        return Inertia::render('Admin/Inventory/Index', [
            'items'      => $items,
            'filters'    => $request->only(['search', 'category', 'status', 'expiring', 'sort', 'direction', 'per_page']),
            'sort'       => ['column' => $sort, 'direction' => $direction],
            'perPage'    => $perPage,
            'categories' => InventoryItem::CATEGORIES,
            'units'      => InventoryItem::UNITS,

            'summary' => Inertia::defer(fn () => [
                'total_items'  => InventoryItem::count(),
                'low_stock'    => InventoryItem::lowStock()->count(),
                'out_of_stock' => InventoryItem::outOfStock()->count(),
                // Only items with a unit cost can be valued; the rest are
                // excluded rather than counted as zero.
                'total_value'  => round((float) InventoryItem::whereNotNull('unit_cost')
                    ->selectRaw('SUM(quantity * unit_cost) as v')->value('v'), 2),
                'unvalued'     => InventoryItem::whereNull('unit_cost')->count(),
                'expiring'     => InventoryItem::whereNotNull('expiry_date')
                    ->whereDate('expiry_date', '<=', now()->addDays(InventoryItem::EXPIRY_WARNING_DAYS))
                    ->whereDate('expiry_date', '>=', now())->count(),
                'issued_30d'   => InventoryDistribution::where('distribution_date', '>=', now()->subDays(30))->count(),
            ]),

            // The alert panel lists what needs action first.
            'alerts' => Inertia::defer(fn () => InventoryItem::query()
                ->where(fn ($q) => $q->whereColumn('quantity', '<=', 'min_level'))
                ->orderBy('quantity')
                ->limit(8)
                ->get(['id', 'item_name', 'unit', 'quantity', 'min_level', 'category'])),
        ]);
    }

    public function show(InventoryItem $inventory)
    {
        $inventory->load([
            'creator:id,name',
            'adjustments' => fn ($q) => $q->with('performer:id,name')->latest('adjusted_on')->latest('id')->limit(50),
            'distributions' => fn ($q) => $q->with([
                'farmer:id,first_name,middle_name,last_name,suffix,rsbsa_no,barangay',
                'program:id,program_name',
                'issuer:id,name',
            ])->latest('distribution_date')->latest('id')->limit(50),
        ]);

        return Inertia::render('Admin/Inventory/Show', [
            'item'       => $inventory,
            'issued'     => round((float) $inventory->distributions()->sum('quantity'), 2),
            'recipients' => $inventory->distributions()->distinct('farmer_id')->count('farmer_id'),
            'categories' => InventoryItem::CATEGORIES,
            'units'      => InventoryItem::UNITS,
            'programs'   => FinancialAssistance::orderBy('program_name')->get(['id', 'program_name']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        // Opening stock is entered on the form but recorded as an adjustment,
        // so even the first quantity has a ledger entry behind it.
        $opening = round((float) ($data['quantity'] ?? 0), 2);
        $data['quantity'] = 0;
        $data['created_by'] = $request->user()->id;

        $item = InventoryItem::create($data);

        if ($opening > 0) {
            $this->inventory->adjust($item, [
                'adjustment_type' => 'add',
                'quantity'        => $opening,
                'reason'          => 'Opening stock',
                'adjusted_on'     => now()->toDateString(),
            ], $request->user()->id);
        }

        AuditService::log('create', 'inventory_items', $item->id, null, $item->toArray());

        return redirect()->route('admin.inventory.show', $item)
            ->with('success', "{$item->item_name} added to inventory.");
    }

    public function update(Request $request, InventoryItem $inventory)
    {
        $data = $this->validated($request, $inventory->id);

        // Quantity is not editable here: it moves only through adjustments and
        // distributions, otherwise the ledger and the balance drift apart.
        unset($data['quantity']);

        $before = $inventory->toArray();
        $inventory->update($data);

        AuditService::log('update', 'inventory_items', $inventory->id, $before, $inventory->fresh()->toArray());

        return back()->with('success', 'Item updated.');
    }

    public function destroy(InventoryItem $inventory)
    {
        // Deleting would cascade the distribution history away with it, and
        // that history is the record of what farmers received.
        if ($inventory->distributions()->exists()) {
            return back()->with('error',
                'This item has been distributed to farmers, so it cannot be deleted. Set its stock to zero instead.');
        }

        $before = $inventory->toArray();
        $inventory->delete();

        AuditService::log('delete', 'inventory_items', $before['id'], $before, null);

        return redirect()->route('admin.inventory.index')->with('success', 'Item deleted.');
    }

    public function adjust(Request $request, InventoryItem $inventory)
    {
        $data = $request->validate([
            'adjustment_type' => ['required', Rule::in(array_keys(InventoryAdjustment::TYPES))],
            'quantity'        => 'required|numeric|min:0.01',
            'reason'          => 'nullable|string|max:255',
            'notes'           => 'nullable|string|max:1000',
            'adjusted_on'     => 'nullable|date|before_or_equal:today',
        ]);

        try {
            $this->inventory->adjust($inventory, $data, $request->user()->id);
        } catch (RuntimeException $e) {
            return back()->withErrors(['quantity' => $e->getMessage()]);
        }

        return back()->with('success', 'Stock updated.');
    }

    public function distribute(Request $request, InventoryItem $inventory)
    {
        $data = $request->validate([
            'farmer_id'         => 'required|exists:farmers,id',
            'assistance_id'     => 'nullable|exists:financial_assistance,id',
            'quantity'          => 'required|numeric|min:0.01',
            'distribution_date' => 'nullable|date|before_or_equal:today',
            'status'            => ['nullable', Rule::in(['pending', 'claimed', 'forfeited'])],
            'notes'             => 'nullable|string|max:1000',
        ]);

        try {
            $this->inventory->distribute($inventory, $data, $request->user()->id);
        } catch (RuntimeException $e) {
            return back()->withErrors(['quantity' => $e->getMessage()]);
        }

        return back()->with('success', 'Issued to farmer.');
    }

    public function updateDistribution(Request $request, InventoryDistribution $distribution)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'claimed', 'forfeited'])],
        ]);

        try {
            $this->inventory->updateDistributionStatus($distribution, $data['status'], $request->user()->id);
        } catch (RuntimeException $e) {
            return back()->withErrors(['status' => $e->getMessage()]);
        }

        return back()->with('success', 'Distribution updated.');
    }

    /** Farmer lookup for the issue form — never the whole registry. */
    public function farmerOptions(Request $request)
    {
        $term = trim((string) $request->query('q', ''));

        if (mb_strlen($term) < 2) {
            return response()->json([]);
        }

        return response()->json(
            Farmer::verified()
                ->where(fn ($q) => $q
                    ->where('first_name', 'like', "%$term%")
                    ->orWhere('last_name', 'like', "%$term%")
                    ->orWhere('rsbsa_no', 'like', "%$term%"))
                ->orderBy('last_name')
                ->limit(10)
                ->get(['id', 'first_name', 'last_name', 'rsbsa_no', 'barangay'])
                ->map(fn ($f) => [
                    'id'    => $f->id,
                    'label' => trim("{$f->last_name}, {$f->first_name}"),
                    'meta'  => collect([$f->rsbsa_no ? "RSBSA {$f->rsbsa_no}" : null, $f->barangay])
                        ->filter()->implode(' · '),
                ])
        );
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'item_name'      => ['required', 'string', 'max:255',
                Rule::unique('inventory_items', 'item_name')->ignore($ignoreId)],
            'category'       => ['required', Rule::in(array_keys(InventoryItem::CATEGORIES))],
            'unit'           => ['required', 'string', 'max:20'],
            'quantity'       => 'nullable|numeric|min:0',
            'min_level'      => 'nullable|numeric|min:0',
            'supplier'       => 'nullable|string|max:255',
            'source'         => 'nullable|string|max:100',
            'unit_cost'      => 'nullable|numeric|min:0',
            'funding_source' => 'nullable|string|max:255',
            'expiry_date'    => 'nullable|date',
            'description'    => 'nullable|string|max:2000',
        ]);
    }
}
