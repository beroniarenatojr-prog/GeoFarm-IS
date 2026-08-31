import { useForm } from '@inertiajs/react';

/**
 * The assistance programme form, shared by the full page at
 * /admin/assistance/create|edit and the modal on the index. Kept in one place
 * so the two can never drift apart.
 */

/** <input type="date"> renders blank for anything longer than YYYY-MM-DD. */
export function toDateInput(date) {
    if (!date) return '';

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
        return date.slice(0, 10);
    }

    // Carbon serialised as an object.
    if (typeof date === 'object' && date.date) {
        return date.date.slice(0, 10);
    }

    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function useProgramForm(program) {
    return useForm({
        program_name:       program?.program_name ?? '',
        assistance_type_id: program?.assistance_type_id ?? '',
        description:        program?.description ?? '',
        total_budget:       program?.total_budget ?? '',
        standard_cash_amount: program?.standard_cash_amount ?? '',
        start_date:         toDateInput(program?.start_date),
        end_date:           toDateInput(program?.end_date),
        status:             program?.status ?? 'draft',
        barangay_ids:       program?.barangays?.map(b => b.id) ?? [],
        // Only sent when the type dropdown is set to "Other".
        new_type_name:         '',
        new_type_distribution: 'material',
        // What a material programme hands out. Empty for cash-only assistance.
        items: (program?.program_items ?? []).map(i => ({
            inventory_item_id:   i.inventory_item_id,
            quantity_per_farmer: i.quantity_per_farmer ?? '',
            total_quantity:      i.total_quantity ?? '',
        })),
    });
}

/** Matches AssistanceController::CUSTOM_TYPE — the server swaps it for a real id. */
export const CUSTOM_TYPE = '__other__';

const field = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
const label = 'block text-xs font-medium text-gray-600 mb-1';
const errorText = 'text-red-500 text-xs mt-0.5';

function Field({ label: text, span, error, children }) {
    return (
        <div className={span ? 'sm:col-span-2' : undefined}>
            <label className={label}>{text}</label>
            {children}
            {error && <p className={errorText}>{error}</p>}
        </div>
    );
}

export function ProgramFormFields({
    form, assistanceTypes = [], barangays = [], stockItems = [], barangayHeight = 'max-h-32',
}) {
    const { data, setData, errors } = form;

    const isCustomType = data.assistance_type_id === CUSTOM_TYPE;
    const selectedType = assistanceTypes.find(t => String(t.id) === String(data.assistance_type_id));

    // While "Other" is selected the type does not exist yet, so what it hands
    // out comes from the select the user is filling in.
    const distribution = isCustomType
        ? data.new_type_distribution
        : selectedType?.distribution_type;

    // Always offered, whatever the type says it hands out.
    //
    // This used to appear only for "material" types, which made a MIXED
    // programme impossible to build: a cash programme could never be given its
    // first item, because the control for adding one was hidden precisely
    // while the list was empty. Cash plus a bag of fertiliser is a normal
    // package here, so the list is always available and simply left empty for
    // cash-only programmes.
    const suggestsItems = distribution === 'material';

    const setItem = (index, key, value) => setData('items',
        data.items.map((line, i) => (i === index ? { ...line, [key]: value } : line)));

    const addItem = () => setData('items', [
        ...data.items,
        { inventory_item_id: '', quantity_per_farmer: '', total_quantity: '' },
    ]);

    const removeItem = index => setData('items', data.items.filter((_, i) => i !== index));

    const stockFor = id => stockItems.find(s => String(s.id) === String(id));

    const toggleBarangay = id => setData(
        'barangay_ids',
        data.barangay_ids.includes(id)
            ? data.barangay_ids.filter(bid => bid !== id)
            : [...data.barangay_ids, id],
    );

    const allSelected = barangays.length > 0 && data.barangay_ids.length === barangays.length;

    return (
        // Two columns: the short fields pair up instead of each claiming a full
        // row, which is what made this form so tall.
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Program Name" span error={errors.program_name}>
                <input value={data.program_name} onChange={e => setData('program_name', e.target.value)}
                    className={field} required />
            </Field>

            <Field label="Assistance Type" span error={errors.assistance_type_id}>
                <select value={data.assistance_type_id} onChange={e => setData('assistance_type_id', e.target.value)}
                    className={field} required>
                    <option value="">Select type</option>
                    {assistanceTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.category} - {type.type_name}</option>
                    ))}
                    <option value={CUSTOM_TYPE}>Other — type a new one…</option>
                </select>
            </Field>

            {isCustomType && (
                <div className="sm:col-span-2 rounded-lg border border-green-200 bg-green-50/40 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#006400]">
                        New assistance type
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        <Field label="Type name" error={errors.new_type_name}>
                            <input className={field} value={data.new_type_name}
                                onChange={e => setData('new_type_name', e.target.value)}
                                placeholder="e.g. Fishery Support" required />
                        </Field>

                        <Field label="What does it hand out?" error={errors.new_type_distribution}>
                            <select className={field} value={data.new_type_distribution}
                                onChange={e => setData('new_type_distribution', e.target.value)}>
                                <option value="material">Goods from the warehouse</option>
                                <option value="financial">Cash</option>
                                <option value="training">Training</option>
                                <option value="service">A service</option>
                            </select>
                        </Field>
                    </div>

                    <p className="mt-2 text-[11px] text-gray-500">
                        This becomes a permanent type you can pick again next time.
                        Choosing “Goods from the warehouse” is what gives the program an
                        item list to deduct from stock.
                    </p>
                </div>
            )}

            <Field label="Total Budget (₱)" error={errors.total_budget}>
                <input type="number" step="0.01" value={data.total_budget}
                    onChange={e => setData('total_budget', e.target.value)} className={field} required />
            </Field>

            <Field label="Status" error={errors.status}>
                <select value={data.status} onChange={e => setData('status', e.target.value)} className={field}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive (paused)</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </Field>

            <Field label="Start Date" error={errors.start_date}>
                <input type="date" value={data.start_date}
                    onChange={e => setData('start_date', e.target.value)} className={field} required />
            </Field>

            <Field label="End Date" error={errors.end_date}>
                <input type="date" value={data.end_date}
                    onChange={e => setData('end_date', e.target.value)} className={field} required />
            </Field>

            <Field label="Description" span>
                <textarea value={data.description} onChange={e => setData('description', e.target.value)}
                    rows={2} className={`${field} resize-y`} />
            </Field>

            {/* The standard package: what every beneficiary gets unless staff
                deliberately depart from it on the day. */}
            <div className="sm:col-span-2 rounded-lg border border-green-200 bg-green-50/40 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#006400]">
                    Standard distribution package
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="Cash per farmer (₱)" error={errors.standard_cash_amount}>
                        <input type="number" step="0.01" min="0" className={field}
                            placeholder="Leave blank for goods only"
                            value={data.standard_cash_amount}
                            onChange={e => setData('standard_cash_amount', e.target.value)} />
                    </Field>
                    <div className="self-end pb-1.5 text-[11px] text-gray-500">
                        Pre-filled for every beneficiary. The Total Budget above is the
                        whole programme; this is what one farmer receives.
                    </div>
                </div>
            </div>

            <div className="sm:col-span-2">
                    <div className="mb-1 flex items-center justify-between">
                        <label className={`${label} mb-0`}>
                            Items in the package
                            <span className="ml-1.5 font-normal text-gray-400">
                                — deducted from warehouse stock as each farmer is served
                            </span>
                        </label>
                        <button type="button" onClick={addItem}
                            className="text-xs font-medium text-green-700 hover:underline">
                            + Add item
                        </button>
                    </div>

                    {data.items.length === 0 ? (
                        <p className={`rounded-lg border border-dashed px-3 py-3 text-xs ${
                            suggestsItems
                                ? 'border-amber-300 bg-amber-50 text-amber-800'
                                : 'border-gray-300 text-gray-500'
                        }`}>
                            {suggestsItems
                                ? 'This program hands out goods but has no items yet — add one so stock is deducted automatically.'
                                : 'No items. Add one to hand out goods alongside the cash, or leave empty for cash only.'}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {data.items.map((line, i) => {
                                const stock = stockFor(line.inventory_item_id);
                                const shortfall = stock && line.total_quantity !== ''
                                    && Number(line.total_quantity) > Number(stock.quantity);

                                return (
                                    <div key={i} className="rounded-lg border border-gray-200 p-2">
                                        <div className="flex flex-wrap items-end gap-2">
                                            <div className="min-w-[10rem] flex-1">
                                                <label className="mb-0.5 block text-[11px] text-gray-500">Item</label>
                                                <select className={field} value={line.inventory_item_id}
                                                    onChange={e => setItem(i, 'inventory_item_id', e.target.value)} required>
                                                    <option value="">Select an item</option>
                                                    {stockItems.map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.item_name} ({Number(s.quantity).toLocaleString()} {s.unit} in stock)
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="w-28">
                                                <label className="mb-0.5 block text-[11px] text-gray-500">Per farmer</label>
                                                <input type="number" step="0.01" min="0.01" className={field}
                                                    value={line.quantity_per_farmer}
                                                    onChange={e => setItem(i, 'quantity_per_farmer', e.target.value)} required />
                                            </div>

                                            <div className="w-28">
                                                <label className="mb-0.5 block text-[11px] text-gray-500">Total allocated</label>
                                                <input type="number" step="0.01" min="0" className={field}
                                                    placeholder="No limit"
                                                    value={line.total_quantity}
                                                    onChange={e => setItem(i, 'total_quantity', e.target.value)} />
                                            </div>

                                            <button type="button" onClick={() => removeItem(i)}
                                                className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                                                Remove
                                            </button>
                                        </div>

                                        {shortfall && (
                                            <p className="mt-1 text-[11px] text-amber-700">
                                                Allocating more than the {Number(stock.quantity).toLocaleString()} {stock.unit}{' '}
                                                currently in stock — distributions will stop once it runs out.
                                            </p>
                                        )}
                                        {errors[`items.${i}.inventory_item_id`] && (
                                            <p className={errorText}>{errors[`items.${i}.inventory_item_id`]}</p>
                                        )}
                                        {errors[`items.${i}.quantity_per_farmer`] && (
                                            <p className={errorText}>{errors[`items.${i}.quantity_per_farmer`]}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>

            <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                    <label className={`${label} mb-0`}>
                        Target Barangays
                        <span className="ml-1.5 font-normal text-gray-400">
                            {data.barangay_ids.length === 0
                                ? '— all barangays'
                                : `— ${data.barangay_ids.length} of ${barangays.length}`}
                        </span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setData('barangay_ids', allSelected ? [] : barangays.map(b => b.id))}
                        className="text-xs font-medium text-green-700 hover:underline"
                    >
                        {allSelected ? 'Clear all' : 'Select all'}
                    </button>
                </div>

                <div className={`border border-gray-300 rounded-lg p-2 overflow-y-auto overscroll-contain bg-gray-50 ${barangayHeight}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-0.5">
                        {barangays.map(barangay => (
                            <label key={barangay.id}
                                className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-1 py-0.5 hover:bg-white">
                                <input type="checkbox"
                                    checked={data.barangay_ids.includes(barangay.id)}
                                    onChange={() => toggleBarangay(barangay.id)}
                                    className="h-3.5 w-3.5 rounded text-green-700 focus:ring-green-500" />
                                <span className="truncate text-gray-700">{barangay.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {errors.barangay_ids && <p className={errorText}>{errors.barangay_ids}</p>}
            </div>
        </div>
    );
}
