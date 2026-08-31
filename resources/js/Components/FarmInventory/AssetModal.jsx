import { useForm } from '@inertiajs/react';
import { useId } from 'react';
import toast from 'react-hot-toast';
import ModalShell from '@/Components/ui/ModalShell';
import { ASSET_FORMS, optionPair } from './assetSchema';

const input = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

/**
 * One modal for all eight asset categories, driven by assetSchema.
 *
 * Writing eight of these by hand would guarantee they drift from the
 * controller's validation rules; here the field list and the rules are checked
 * against each other in one place.
 */
export default function AssetModal({ category, record, farmerId, parcels = [], onClose }) {
    const schema = ASSET_FORMS[category];
    const isEdit = !!record;

    // Seed from the record, falling back to the declared default. Nulls become
    // '' so React keeps the inputs controlled.
    const form = useForm(
        Object.fromEntries(
            Object.entries(schema.defaults).map(([k, fallback]) => [
                k, record?.[k] ?? fallback ?? '',
            ]),
        ),
    );

    const submit = e => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: onClose,
            onError: errs => toast.error(Object.values(errs)[0] ?? 'Could not save this record.'),
        };

        isEdit
            ? form.put(`/admin/farm-assets/${category}/${record.id}`, options)
            : form.transform(d => ({ ...d, farmer_id: farmerId }))
                  .post(`/admin/farm-assets/${category}`, options);
    };

    return (
        <ModalShell
            title={`${isEdit ? 'Edit' : 'Add'} ${schema.title.toLowerCase()}`}
            size="lg"
            onClose={onClose}
            as="form"
            onSubmit={submit}
            bodyClass="px-5 py-4"
            footer={
                <>
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={form.processing}
                        className="px-5 py-2 bg-[#006400] text-white rounded-lg text-sm font-semibold hover:bg-[#228B22] disabled:opacity-50">
                        {form.processing ? 'Saving…' : isEdit ? 'Save changes' : 'Add record'}
                    </button>
                </>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {schema.fields.map(f => (
                    <FieldRow key={f.name} field={f} form={form} parcels={parcels} />
                ))}
            </div>
        </ModalShell>
    );
}

function FieldRow({ field: f, form, parcels }) {
    const listId = useId();
    const { data, setData, errors } = form;
    const value = data[f.name] ?? '';
    const set = v => setData(f.name, v);

    let control;

    if (f.type === 'select') {
        control = (
            <select className={input} value={value} onChange={e => set(e.target.value)} required={f.required}>
                {!f.required && <option value="">—</option>}
                {f.options.map(o => {
                    const [val, text] = optionPair(o);
                    return <option key={val} value={val}>{text}</option>;
                })}
            </select>
        );
    } else if (f.type === 'parcel') {
        control = (
            <select className={input} value={value} onChange={e => set(e.target.value)}>
                <option value="">Not tied to a parcel</option>
                {parcels.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.parcel_number || `Parcel #${p.id}`}{p.barangay ? ` · ${p.barangay}` : ''}
                    </option>
                ))}
            </select>
        );
    } else if (f.type === 'datalist') {
        // Free text with suggestions: the office records brands and purposes we
        // cannot enumerate in advance.
        control = (
            <>
                <input className={input} list={listId} value={value}
                    onChange={e => set(e.target.value)} required={f.required} />
                <datalist id={listId}>
                    {f.options.map(o => <option key={o} value={o} />)}
                </datalist>
            </>
        );
    } else if (f.type === 'textarea') {
        control = (
            <textarea rows={2} className={`${input} resize-y`} value={value}
                onChange={e => set(e.target.value)} />
        );
    } else {
        control = (
            <input type={f.type} className={input} value={value}
                onChange={e => set(e.target.value)}
                required={f.required} min={f.min} max={f.max} step={f.step} />
        );
    }

    return (
        <div className={f.span ? 'sm:col-span-2' : undefined}>
            <label className={labelCls}>
                {f.label}{f.required && <span className="text-red-500"> *</span>}
            </label>
            {control}
            {f.hint && !errors[f.name] && <p className="mt-0.5 text-[11px] text-gray-400">{f.hint}</p>}
            {errors[f.name] && <p className="mt-0.5 text-xs text-red-600">{errors[f.name]}</p>}
        </div>
    );
}
