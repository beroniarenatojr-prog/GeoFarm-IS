import AdminLayout from '@/Layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
    Plus, Search, Pencil, Trash2, Check, X, Lock, Sprout, Tractor, Beef, Users, Library,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
const inputBad = 'w-full border border-red-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none';

/**
 * One reference list.
 *
 * Entries can now be renamed — the update routes existed all along but the
 * page offered no way to reach them, so a typo meant deleting and re-adding.
 * Deleting is offered only where nothing depends on the entry; the server
 * refuses the rest regardless, and says why.
 */
function LookupCard({
    title, icon: Icon, blurb, items, nameKey, nameLabel,
    extraKey, extraLabel, route,
}) {
    const { can } = usePermissions();
    const mayManage = can('manage lookups');

    const [term, setTerm] = useState('');
    const [editing, setEditing] = useState(null);   // id being renamed
    const [adding, setAdding] = useState(false);

    const blank = extraKey ? { [nameKey]: '', [extraKey]: '' } : { [nameKey]: '' };
    const add = useForm(blank);
    const edit = useForm(blank);

    const shown = items.filter(i => {
        const hay = `${i[nameKey] ?? ''} ${extraKey ? i[extraKey] ?? '' : ''}`.toLowerCase();
        return hay.includes(term.trim().toLowerCase());
    });

    const submitAdd = (e) => {
        e.preventDefault();
        add.post(route, {
            preserveScroll: true,
            onSuccess: () => { add.reset(); setAdding(false); },
            onError: errs => toast.error(Object.values(errs)[0] ?? 'Could not add this entry.'),
        });
    };

    const startEdit = (item) => {
        setEditing(item.id);
        edit.clearErrors();
        edit.setData(extraKey
            ? { [nameKey]: item[nameKey] ?? '', [extraKey]: item[extraKey] ?? '' }
            : { [nameKey]: item[nameKey] ?? '' });
    };

    const submitEdit = (e, id) => {
        e.preventDefault();
        edit.put(`${route}/${id}`, {
            preserveScroll: true,
            onSuccess: () => setEditing(null),
            onError: errs => toast.error(Object.values(errs)[0] ?? 'Could not save this change.'),
        });
    };

    const remove = (item) => {
        if (!confirm(`Delete "${item[nameKey]}" from ${title}? This cannot be undone.`)) return;
        router.delete(`${route}/${item.id}`, { preserveScroll: true });
    };

    return (
        <section className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden flex flex-col">
            <header className="border-b border-green-100 bg-green-50/40 px-4 sm:px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#006400]">
                        <Icon className="h-4 w-4 text-white" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-[#006400]">{title}</h2>
                        <p className="text-[11px] text-gray-500">{blurb}</p>
                    </div>
                    <span className="ml-auto rounded-full border border-green-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                        {items.length}
                    </span>
                    {mayManage && !adding && (
                        <button type="button" onClick={() => { setAdding(true); add.clearErrors(); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#006400] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#228B22]">
                            <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                    )}
                </div>
            </header>

            <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
                {mayManage && adding && (
                    <form onSubmit={submitAdd} className="rounded-xl border border-green-200 bg-green-50/40 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input autoFocus placeholder={nameLabel}
                                className={add.errors[nameKey] ? inputBad : input}
                                value={add.data[nameKey]}
                                onChange={e => { add.setData(nameKey, e.target.value); add.clearErrors(nameKey); }} />
                            {extraKey && (
                                <input placeholder={extraLabel}
                                    className={add.errors[extraKey] ? inputBad : input}
                                    value={add.data[extraKey]}
                                    onChange={e => { add.setData(extraKey, e.target.value); add.clearErrors(extraKey); }} />
                            )}
                        </div>
                        {(add.errors[nameKey] || (extraKey && add.errors[extraKey])) && (
                            <p className="mt-1.5 text-xs text-red-600">
                                {add.errors[nameKey] || add.errors[extraKey]}
                            </p>
                        )}
                        <div className="mt-2 flex gap-2">
                            <button type="submit" disabled={add.processing}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#006400] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#228B22] disabled:opacity-50">
                                <Check className="h-3.5 w-3.5" /> {add.processing ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={() => { setAdding(false); add.reset(); add.clearErrors(); }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                                <X className="h-3.5 w-3.5" /> Cancel
                            </button>
                        </div>
                    </form>
                )}

                {/* Worth having once a list passes a screenful — crops already do. */}
                {items.length > 6 && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input value={term} onChange={e => setTerm(e.target.value)}
                            placeholder={`Search ${title.toLowerCase()}…`}
                            className={`${input} pl-9`} />
                    </div>
                )}

                <ul className="divide-y divide-green-50">
                    {shown.map(item => {
                        const locked = item.in_use > 0;

                        if (editing === item.id) {
                            return (
                                <li key={item.id} className="py-2">
                                    <form onSubmit={e => submitEdit(e, item.id)}>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <input autoFocus className={edit.errors[nameKey] ? inputBad : input}
                                                value={edit.data[nameKey]}
                                                onChange={e => { edit.setData(nameKey, e.target.value); edit.clearErrors(nameKey); }} />
                                            {extraKey && (
                                                <input placeholder={extraLabel}
                                                    className={edit.errors[extraKey] ? inputBad : input}
                                                    value={edit.data[extraKey]}
                                                    onChange={e => { edit.setData(extraKey, e.target.value); edit.clearErrors(extraKey); }} />
                                            )}
                                        </div>
                                        {(edit.errors[nameKey] || (extraKey && edit.errors[extraKey])) && (
                                            <p className="mt-1.5 text-xs text-red-600">
                                                {edit.errors[nameKey] || edit.errors[extraKey]}
                                            </p>
                                        )}
                                        <div className="mt-2 flex gap-2">
                                            <button type="submit" disabled={edit.processing}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#006400] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#228B22] disabled:opacity-50">
                                                <Check className="h-3.5 w-3.5" /> {edit.processing ? 'Saving…' : 'Save'}
                                            </button>
                                            <button type="button" onClick={() => { setEditing(null); edit.clearErrors(); }}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                                                <X className="h-3.5 w-3.5" /> Cancel
                                            </button>
                                        </div>
                                    </form>
                                </li>
                            );
                        }

                        return (
                            <li key={item.id} className="group flex items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 truncate">{item[nameKey]}</p>
                                    {extraKey && (
                                        <p className="text-xs text-gray-400 truncate">{item[extraKey] || '—'}</p>
                                    )}
                                </div>

                                {/* Says plainly why an entry cannot be removed, instead
                                    of letting the click fail at the database. */}
                                {locked && (
                                    <span title={`Used by ${item.in_use} record${item.in_use === 1 ? '' : 's'}`}
                                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">
                                        <Lock className="h-3 w-3" /> {item.in_use} in use
                                    </span>
                                )}

                                {mayManage && (
                                    <div className="flex flex-shrink-0 items-center gap-1">
                                        <button type="button" onClick={() => startEdit(item)} title="Rename"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        {locked ? (
                                            <span aria-disabled="true"
                                                title="In use by existing records — rename it instead"
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-300 cursor-not-allowed">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </span>
                                        ) : (
                                            <button type="button" onClick={() => remove(item)} title="Delete"
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}

                    {shown.length === 0 && (
                        <li className="py-10 text-center text-xs text-gray-400">
                            {items.length === 0
                                ? 'Nothing in this list yet.'
                                : `Nothing matches “${term}”.`}
                        </li>
                    )}
                </ul>
            </div>
        </section>
    );
}

export default function LookupsIndex({ farmTypes, crops, livestockTypes, associations }) {
    return (
        <AdminLayout title="Lookup Table Management">
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#006400]">
                    <Library className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-gray-900">The lists the rest of the system chooses from</h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                        These options appear in farmer, parcel and livestock forms. An entry already
                        used by existing records can be renamed but not deleted — removing it would
                        change or erase those records.
                    </p>
                </div>
            </div>

            {/* One column on a phone: two fixed columns made every field a sliver. */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                <LookupCard
                    title="Crops" icon={Sprout}
                    blurb="Chosen when recording a cropping season"
                    items={crops} nameKey="crop_name" nameLabel="Crop name"
                    extraKey="category" extraLabel="Category (e.g. Cereal)"
                    route="/admin/lookups/crops" />

                <LookupCard
                    title="Farm Types" icon={Tractor}
                    blurb="Chosen when recording a farm parcel"
                    items={farmTypes} nameKey="type_name" nameLabel="Type name"
                    extraKey="description" extraLabel="Description"
                    route="/admin/lookups/farm-types" />

                <LookupCard
                    title="Livestock Types" icon={Beef}
                    blurb="Chosen when recording livestock"
                    items={livestockTypes} nameKey="type_name" nameLabel="Type name"
                    extraKey="category" extraLabel="Category (e.g. Poultry)"
                    route="/admin/lookups/livestock-types" />

                <LookupCard
                    title="Associations" icon={Users}
                    blurb="Farmer organisations a member can belong to"
                    items={associations} nameKey="association_name" nameLabel="Association name"
                    extraKey={null} extraLabel={null}
                    route="/admin/lookups/associations" />
            </div>
        </AdminLayout>
    );
}
