import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Search, Users, Lock, AlertTriangle, Check, X, MapPin,
    ChevronLeft, ChevronRight, UserPlus, Trash2, Wallet, Filter,
} from 'lucide-react';

/** Whole pesos — this screen is for scanning, not for reconciling centavos. */
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const STATUS_TONE = {
    pending:   'bg-amber-100 text-amber-800',
    claimed:   'bg-emerald-100 text-emerald-700',
    forfeited: 'bg-gray-100 text-gray-500',
};

const STATUS_LABEL = {
    pending:   'Awaiting collection',
    claimed:   'Received',
    forfeited: 'Forfeited',
};

export default function Beneficiaries({
    program, farmers, filters = {}, barangays = [], commodities = [],
    targetBarangays = [], summary, selectAll, can = {},
}) {
    const [form, setForm] = useState({
        search:    filters.search ?? '',
        barangay:  filters.barangay ?? '',
        commodity: filters.commodity ?? '',
        assigned:  filters.assigned ?? '',
    });

    // Ids, not row objects: a selection has to survive paging, and the row
    // objects are replaced wholesale on every visit.
    const [picked, setPicked] = useState([]);
    const [amount, setAmount] = useState('');
    const [overrideBarangay, setOverrideBarangay] = useState(false);

    // router.post rather than useForm: the selection lives in `picked` and
    // drives the page's own logic, and useForm would hold a second copy of it
    // that has to be kept in step.
    const [processing, setProcessing] = useState(false);

    /*
     * A programme nobody can add to. Said once, here, so every control can ask
     * the same question instead of each re-deriving it and drifting.
     */
    const frozen = program.is_locked
        || program.status === 'completed'
        || program.status === 'cancelled'
        || !can.assign;

    const frozenReason = !can.assign
        ? 'You do not have permission to change this programme\'s beneficiaries.'
        : program.is_locked
            ? 'This programme is locked. An administrator must unlock it first.'
            : program.status === 'completed'
                ? 'This programme is completed. Reopen it to add beneficiaries.'
                : program.status === 'cancelled'
                    ? 'This programme is cancelled. Reopen it to add beneficiaries.'
                    : null;

    const rows = farmers.data ?? [];

    // Only farmers not already on the programme can be ticked.
    const selectableOnPage = rows.filter(f => !f.assigned).map(f => f.id);
    const pageAllPicked = selectableOnPage.length > 0
        && selectableOnPage.every(id => picked.includes(id));

    /*
     * How many of the chosen farmers sit outside the programme's target
     * barangays. They are offered deliberately — someone may live in one
     * barangay and farm in another — but adding them is a decision, so it is
     * named and confirmed rather than slipped through.
     */
    const outsideCount = useMemo(() => {
        // Two sources, because a selection can outrun the page: the flags on
        // the rows in view, plus the server's list for the whole filtered set
        // that "Select all" draws from.
        const flagged = new Set(selectAll?.outside ?? []);
        rows.forEach(f => f.outside_target && flagged.add(f.id));

        return picked.filter(id => flagged.has(id)).length;
    }, [picked, rows, selectAll]);

    const go = (next = {}) => {
        const query = { ...form, ...next };
        Object.keys(query).forEach(k => !query[k] && delete query[k]);

        router.get(`/admin/assistance/${program.id}/beneficiaries`, query, {
            preserveState: true,
            preserveScroll: true,
            // Deliberately NOT replace: the office uses the back button to step
            // out of a filter they mistyped.
        });
    };

    const clearFilters = () => {
        setForm({ search: '', barangay: '', commodity: '', assigned: '' });
        router.get(`/admin/assistance/${program.id}/beneficiaries`, {}, {
            preserveState: true, preserveScroll: true,
        });
    };

    const activeFilters = Object.values(form).filter(Boolean).length;

    const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    const togglePage = () => setPicked(p => pageAllPicked
        ? p.filter(id => !selectableOnPage.includes(id))
        : [...new Set([...p, ...selectableOnPage])]);

    const pickAllMatching = () => {
        setPicked(selectAll?.ids ?? []);

        if (selectAll?.truncated) {
            toast(
                `Selected the first ${selectAll.cap} of ${farmers.total.toLocaleString('en-PH')} matching farmers. `
                + 'Narrow the filter and repeat to reach the rest.',
                { icon: '⚠️', duration: 7000 },
            );
        }
    };

    const submit = (e) => {
        e.preventDefault();

        if (picked.length === 0) {
            toast.error('Tick at least one farmer first.');
            return;
        }

        if (outsideCount > 0 && !overrideBarangay) {
            toast.error(
                `${outsideCount} of the farmers you picked are outside this programme's barangays. `
                + 'Confirm that below before adding them.',
            );
            return;
        }

        router.post(
            `/admin/assistance/${program.id}/beneficiaries`,
            {
                farmer_ids: picked,
                amount: amount === '' ? null : amount,
                // The server checks this too, and refuses without it.
                allow_outside_target: overrideBarangay,
            },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                /*
                 * onSuccess fires for a refusal too — a `back()->with('error')`
                 * is still a valid Inertia response, not a validation failure.
                 * So the flash is checked before the ticks are thrown away:
                 * losing forty selections to a message saying nothing was added
                 * would mean picking them all again.
                 */
                onSuccess: (page) => {
                    if (page.props?.flash?.error) return;

                    setPicked([]);
                    setAmount('');
                    setOverrideBarangay(false);
                },
            },
        );
    };

    const remove = (farmer) => {
        if (!confirm(`Take ${farmer.name} off "${program.program_name}"?`)) return;

        router.delete(
            `/admin/assistance/${program.id}/beneficiaries/${farmer.distribution_id}`,
            { preserveScroll: true },
        );
    };

    return (
        <AdminLayout title="Manage Beneficiaries">
            <div className="mb-6">
                <Link
                    href={`/admin/assistance/${program.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#006400] mb-3"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to {program.program_name}
                </Link>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Manage Beneficiaries</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Choose which farmers <b>{program.program_name}</b> is for. They are added as
                            awaiting collection — recording what each one actually received happens on the
                            programme page.
                        </p>
                    </div>

                    {program.is_locked && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm text-amber-800">
                            <Lock className="h-4 w-4" />
                            Locked
                        </span>
                    )}
                </div>
            </div>

            {frozenReason && (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-px" />
                    <p>{frozenReason}</p>
                </div>
            )}

            {/* Assigned and received are separate figures on purpose: selecting a
                farmer is a plan, a received record is goods that left the store. */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <Stat label="On the programme" value={summary.assigned} icon={Users} tone="text-[#006400]" />
                <Stat label="Awaiting collection" value={summary.pending} tone="text-amber-600" />
                <Stat label="Received" value={summary.claimed} tone="text-emerald-600" />
                <Stat label="Forfeited" value={summary.forfeited} tone="text-gray-500" />
                <Stat
                    label="Planned allocation"
                    value={peso(summary.planned_allocation)}
                    hint={summary.total_budget === null
                        ? 'No budget set'
                        : `${peso(summary.remaining_budget)} of ${peso(summary.total_budget)} left`}
                    tone={summary.over_budget ? 'text-red-600' : 'text-gray-900'}
                    icon={Wallet}
                />
            </div>

            {summary.over_budget && (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-px" />
                    <p>
                        The allocation for the farmers on this programme is{' '}
                        <b>{peso(summary.planned_allocation)}</b>, which is more than its{' '}
                        <b>{peso(summary.total_budget)}</b> budget. Nothing has been handed out yet —
                        remove farmers, lower the per-farmer amount, or raise the budget.
                    </p>
                </div>
            )}

            {targetBarangays.length > 0 && (
                <p className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-[#006400]" />
                    <span className="font-medium">Targets:</span>
                    {targetBarangays.map(b => (
                        <span key={b} className="rounded bg-green-50 px-1.5 py-0.5 text-[#006400]">{b}</span>
                    ))}
                    <span className="text-gray-400">
                        · farmers elsewhere are still listed, and flagged
                    </span>
                </p>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <form
                    onSubmit={(e) => { e.preventDefault(); go({ page: 1 }); }}
                    className="flex flex-wrap items-end gap-3"
                >
                    <div className="flex-1 min-w-[220px]">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                value={form.search}
                                onChange={e => setForm(f => ({ ...f, search: e.target.value }))}
                                placeholder="Name or RSBSA number"
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#006400] focus:ring-1 focus:ring-[#006400]"
                            />
                        </div>
                    </div>

                    <Select
                        label="Barangay"
                        value={form.barangay}
                        onChange={v => setForm(f => ({ ...f, barangay: v }))}
                        options={barangays}
                        anyLabel="All barangays"
                    />

                    <Select
                        label="Commodity"
                        value={form.commodity}
                        onChange={v => setForm(f => ({ ...f, commodity: v }))}
                        options={commodities}
                        anyLabel="Any commodity"
                    />

                    <Select
                        label="On this programme"
                        value={form.assigned}
                        onChange={v => setForm(f => ({ ...f, assigned: v }))}
                        options={[{ value: 'no', label: 'Not yet added' }, { value: 'yes', label: 'Already added' }]}
                        anyLabel="Everyone"
                    />

                    <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#006400] text-white text-sm font-medium hover:bg-[#004d00]"
                    >
                        Apply
                    </button>

                    {activeFilters > 0 && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                        >
                            Clear
                        </button>
                    )}
                </form>
            </div>

            {/* Result count, and selecting beyond the page */}
            <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                <p className="text-gray-600">
                    {farmers.total > 0
                        ? <>Showing <b className="text-gray-900">{farmers.from}–{farmers.to}</b> of{' '}
                            <b className="text-gray-900">{farmers.total.toLocaleString('en-PH')}</b> farmers</>
                        : 'No farmers match these filters'}
                </p>

                {activeFilters > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#006400]">
                        <Filter className="h-3 w-3" />
                        {activeFilters} filter{activeFilters === 1 ? '' : 's'}
                    </span>
                )}

                {!frozen && (selectAll?.ids?.length ?? 0) > 0 && (
                    <button
                        type="button"
                        onClick={pickAllMatching}
                        className="ml-auto text-xs font-medium text-[#006400] hover:underline"
                    >
                        Select all {selectAll.ids.length.toLocaleString('en-PH')} not yet added
                        {selectAll.truncated ? ` (first ${selectAll.cap})` : ''}
                    </button>
                )}
            </div>

            {/* The list */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="w-10 px-4 py-3">
                                    {!frozen && selectableOnPage.length > 0 && (
                                        <input
                                            type="checkbox"
                                            checked={pageAllPicked}
                                            onChange={togglePage}
                                            aria-label="Select everyone on this page"
                                            className="h-4 w-4 rounded border-gray-300 text-[#006400] focus:ring-[#006400]"
                                        />
                                    )}
                                </th>
                                <th className="px-4 py-3">Farmer</th>
                                <th className="px-4 py-3">Barangay</th>
                                <th className="px-4 py-3">Land</th>
                                <th className="px-4 py-3">Commodities</th>
                                <th className="px-4 py-3">On this programme</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <Users className="mx-auto h-10 w-10 text-green-200 mb-3" />
                                        <p className="text-gray-500">
                                            {activeFilters > 0
                                                ? 'No verified farmers match these filters.'
                                                : 'There are no verified farmers in the registry yet.'}
                                        </p>
                                    </td>
                                </tr>
                            )}

                            {rows.map(f => {
                                const checked = picked.includes(f.id);

                                return (
                                    <tr
                                        key={f.id}
                                        className={checked ? 'bg-green-50/60' : 'hover:bg-gray-50'}
                                    >
                                        <td className="px-4 py-3">
                                            {!frozen && !f.assigned && (
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggle(f.id)}
                                                    aria-label={`Select ${f.name}`}
                                                    className="h-4 w-4 rounded border-gray-300 text-[#006400] focus:ring-[#006400]"
                                                />
                                            )}
                                            {f.assigned && <Check className="h-4 w-4 text-[#006400]" />}
                                        </td>

                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900">{f.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {f.rsbsa_no || 'No RSBSA number'}
                                            </p>
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className="text-gray-700">{f.barangay || '—'}</span>
                                            {f.outside_target && (
                                                <span
                                                    className="ml-1.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
                                                    title="Outside the barangays this programme targets. They can still be added."
                                                >
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Outside target
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-gray-700">
                                            {f.parcels > 0
                                                ? <>{f.parcels} parcel{f.parcels === 1 ? '' : 's'}
                                                    <span className="text-xs text-gray-500"> · {f.area_ha} ha</span></>
                                                : <span className="text-gray-400">No parcels</span>}
                                        </td>

                                        <td className="px-4 py-3">
                                            {f.commodities.length === 0
                                                ? <span className="text-gray-400">—</span>
                                                : (
                                                    <span className="flex flex-wrap gap-1">
                                                        {f.commodities.slice(0, 3).map(c => (
                                                            <span key={c} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-[#006400]">
                                                                {c}
                                                            </span>
                                                        ))}
                                                        {f.commodities.length > 3 && (
                                                            <span className="text-xs text-gray-500">
                                                                +{f.commodities.length - 3}
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                        </td>

                                        <td className="px-4 py-3">
                                            {f.status
                                                ? (
                                                    <span className="flex flex-col gap-0.5">
                                                        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[f.status]}`}>
                                                            {STATUS_LABEL[f.status] ?? f.status}
                                                        </span>
                                                        {f.amount_given > 0 && (
                                                            <span className="text-xs text-gray-500">
                                                                {peso(f.amount_given)}
                                                            </span>
                                                        )}
                                                    </span>
                                                )
                                                : <span className="text-xs text-gray-400">Not added</span>}
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                            {/* Only while still awaiting collection. Once something has
                                                been handed over the record is history, and forfeiting is
                                                how a release is undone. */}
                                            {!frozen && f.status === 'pending' && (
                                                <button
                                                    type="button"
                                                    onClick={() => remove(f)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination
                page={farmers}
                onGo={url => router.get(url, {}, { preserveState: true, preserveScroll: true })}
            />

            {/* The action bar, only once something is ticked. */}
            {picked.length > 0 && (
                <form
                    onSubmit={submit}
                    className="sticky bottom-4 mt-5 rounded-xl border border-[#006400]/30 bg-white shadow-lg p-4"
                >
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                {picked.length.toLocaleString('en-PH')} farmer{picked.length === 1 ? '' : 's'} selected
                            </p>
                            <button
                                type="button"
                                onClick={() => setPicked([])}
                                className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                            >
                                <X className="h-3 w-3" />
                                Clear selection
                            </button>
                        </div>

                        <div className="min-w-[180px]">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Amount each (optional)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder={program.standard_cash_amount
                                    ? `Programme standard: ${program.standard_cash_amount}`
                                    : 'No standard amount set'}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#006400] focus:ring-1 focus:ring-[#006400]"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#006400] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#004d00] disabled:opacity-60"
                        >
                            <UserPlus className="h-4 w-4" />
                            {processing
                                ? 'Adding…'
                                : `Add ${picked.length.toLocaleString('en-PH')} to the programme`}
                        </button>
                    </div>

                    {outsideCount > 0 && (
                        <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                            <input
                                type="checkbox"
                                checked={overrideBarangay}
                                onChange={e => setOverrideBarangay(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span>
                                <b>{outsideCount}</b> of these farmers {outsideCount === 1 ? 'is' : 'are'} outside
                                the barangays this programme targets. Add them anyway — a farmer may live in
                                one barangay and farm in another.
                            </span>
                        </label>
                    )}
                </form>
            )}
        </AdminLayout>
    );
}

function Stat({ label, value, hint, icon: Icon, tone = 'text-gray-900' }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {label}
            </div>
            <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
            {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
        </div>
    );
}

/** Options may be plain strings (barangays, commodities) or {value,label}. */
function Select({ label, value, onChange, options, anyLabel }) {
    return (
        <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-[#006400] focus:ring-1 focus:ring-[#006400]"
            >
                <option value="">{anyLabel}</option>
                {options.map(o => {
                    const val = typeof o === 'string' ? o : o.value;
                    const text = typeof o === 'string' ? o : o.label;
                    return <option key={val} value={val}>{text}</option>;
                })}
            </select>
        </div>
    );
}

/**
 * Page numbers with ellipses, matching the farmer registry. Rendering every
 * link, as Laravel's default does, is unusable at hundreds of pages.
 */
function Pagination({ page, onGo }) {
    if (!page.last_page || page.last_page <= 1) return null;

    const current = page.current_page;
    const last = page.last_page;
    const around = [current - 1, current, current + 1].filter(n => n > 1 && n < last);
    const numbers = [...new Set([1, ...around, last])].sort((a, b) => a - b);

    const link = n => page.path + '?' + new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(page.first_page_url.split('?')[1] ?? '')),
        page: n,
    }).toString();

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
            <p className="text-sm text-gray-600">Page {current} of {last.toLocaleString('en-PH')}</p>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => page.prev_page_url && onGo(page.prev_page_url)}
                    disabled={!page.prev_page_url}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-50"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {numbers.map((n, i) => (
                    <span key={n} className="flex items-center">
                        {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1.5 text-gray-400">…</span>}
                        <button
                            onClick={() => onGo(link(n))}
                            className={`min-w-[2.25rem] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                n === current
                                    ? 'bg-[#006400] text-white'
                                    : 'border border-gray-200 text-gray-700 hover:bg-green-50'
                            }`}
                        >
                            {n}
                        </button>
                    </span>
                ))}

                <button
                    onClick={() => page.next_page_url && onGo(page.next_page_url)}
                    disabled={!page.next_page_url}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-50"
                    aria-label="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
