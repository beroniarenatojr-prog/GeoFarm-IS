import { useForm } from '@inertiajs/react';
import SuggestSelect from '@/Components/ui/SuggestSelect';
import MultiSuggestSelect from '@/Components/ui/MultiSuggestSelect';

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
        // No field asks for this any more, but it is still carried so editing
        // an older programme sends its budget back unchanged rather than
        // quietly dropping a figure the office recorded.
        standard_cash_amount: program?.standard_cash_amount ?? '',
        start_date:         toDateInput(program?.start_date),
        end_date:           toDateInput(program?.end_date),
        status:             program?.status ?? 'draft',
        barangay_ids:       program?.barangays?.map(b => b.id) ?? [],
        // Only sent when a type is being added. What it hands out is settled
        // server-side from the item list rather than asked for.
        new_type_name:         '',
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
    form, assistanceTypes = [], barangays = [], stockItems = [],
}) {
    const { data, setData, errors } = form;

    const isCustomType = data.assistance_type_id === CUSTOM_TYPE;
    const selectedType = assistanceTypes.find(t => String(t.id) === String(data.assistance_type_id));

    // A type still being added has no distribution yet — the server works it
    // out from the item list on save — so there is nothing to read here.
    const distribution = isCustomType ? null : selectedType?.distribution_type;

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

    /*
     * The types to offer, plus the one being added.
     *
     * A pending new type has no id yet — it is created server-side on save —
     * so it rides along under the CUSTOM_TYPE sentinel. Without it the box
     * would go blank the moment "Add new type: …" was chosen.
     */
    const typeOptions = [
        ...assistanceTypes.map(type => ({
            id:    type.id,
            label: type.type_name,
            meta:  type.category,
        })),
        ...(isCustomType && data.new_type_name
            ? [{ id: CUSTOM_TYPE, label: data.new_type_name, meta: 'New type' }]
            : []),
    ];

    const barangayOptions = barangays.map(b => ({ id: b.id, label: b.name }));

    /*
     * Warehouse stock for the item type-ahead.
     *
     * What is on hand rides along as the note under each suggestion, so the
     * figure is visible while choosing rather than only after — the old
     * dropdown put it in the option text, and it should not be lost.
     */
    const itemOptions = stockItems.map(s => ({
        id:    s.id,
        label: s.item_name,
        meta:  `${Number(s.quantity).toLocaleString()} ${s.unit ?? ''} in stock`.trim(),
    }));

    return (
        // Two columns: the short fields pair up instead of each claiming a full
        // row, which is what made this form so tall.
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {/* Half-width each: two short fields side by side rather than two
                full rows, which is most of what made this form need scrolling. */}
            <Field label="Program Name" error={errors.program_name}>
                <input value={data.program_name} onChange={e => setData('program_name', e.target.value)}
                    className={field} required />
            </Field>

            <Field label="Assistance Type" error={errors.assistance_type_id}>
                {/* Typing filters the list; typing something that is not on it
                    offers to add it. The pending new type is carried as an
                    option of its own so the box keeps showing what was typed
                    rather than falling back to blank. */}
                <SuggestSelect
                    value={data.assistance_type_id}
                    onChange={id => setData('assistance_type_id', id)}
                    options={typeOptions}
                    onCreate={name => setData(d => ({
                        ...d,
                        assistance_type_id: CUSTOM_TYPE,
                        new_type_name: name,
                    }))}
                    createLabel={name => `Add new type: ${name}`}
                    placeholder="Search or add…"
                    className={field}
                />
            </Field>

            {/* A new type asks nothing further.

                It used to also ask what the type hands out, but that answer
                changed almost nothing: the item list below is offered whatever
                the type says, and isMaterial() already treats an attached item
                list as the deciding factor. The server settles it from the
                items instead, and it stays correctable under Lookups. */}
            {isCustomType && errors.new_type_name && (
                <p className={`sm:col-span-2 ${errorText}`}>{errors.new_type_name}</p>
            )}

            {/* The two dates pair with each other, not with Status. Removing
                Total Budget left End Date stranded alone on its own row; this
                puts a whole row back. */}
            <Field label="Start Date" error={errors.start_date}>
                <input type="date" value={data.start_date}
                    onChange={e => setData('start_date', e.target.value)} className={field} required />
            </Field>

            <Field label="End Date" error={errors.end_date}>
                <input type="date" value={data.end_date}
                    onChange={e => setData('end_date', e.target.value)} className={field} required />
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
                    {/* No longer contrasts this with a Total Budget field —
                        that field is gone, and the sentence was left pointing
                        at something the form no longer shows. */}
                    <div className="self-end pb-1.5 text-[11px] text-gray-500">
                        What one farmer receives, pre-filled on every distribution.
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
                                                {/* Typed, not scrolled. A warehouse list runs to
                                                    hundreds of lines, and staff know "urea", not
                                                    where it falls alphabetically. The stock figure
                                                    stays on each row, since choosing something the
                                                    store barely has is the mistake worth catching
                                                    at this point rather than on hand-out day. */}
                                                <SuggestSelect
                                                    value={line.inventory_item_id}
                                                    onChange={id => setItem(i, 'inventory_item_id', id)}
                                                    options={itemOptions}
                                                    placeholder="Type an item name…"
                                                    className={field}
                                                    emptyHint="No stock items are on file yet. Add them under Farm Assets first."
                                                />
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
                            {data.barangay_ids.length === 0 ? '— all barangays' : ''}
                        </span>
                    </label>
                </div>

                {/* Typing beats hunting through 46 checkboxes. What is chosen
                    stays visible as chips, since a filtered list would hide
                    the very rows already ticked. */}
                <MultiSuggestSelect
                    value={data.barangay_ids}
                    onChange={ids => setData('barangay_ids', ids)}
                    options={barangayOptions}
                    allLabel="Select all barangays"
                    placeholder="Type a barangay name…"
                    className={field}
                    emptyHint="No active barangays are on file."
                />

                {errors.barangay_ids && <p className={errorText}>{errors.barangay_ids}</p>}
            </div>
        </div>
    );
}
