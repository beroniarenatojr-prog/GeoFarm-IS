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
        start_date:         toDateInput(program?.start_date),
        end_date:           toDateInput(program?.end_date),
        status:             program?.status ?? 'draft',
        barangay_ids:       program?.barangays?.map(b => b.id) ?? [],
    });
}

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

export function ProgramFormFields({ form, assistanceTypes = [], barangays = [], barangayHeight = 'max-h-32' }) {
    const { data, setData, errors } = form;

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
                </select>
            </Field>

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
