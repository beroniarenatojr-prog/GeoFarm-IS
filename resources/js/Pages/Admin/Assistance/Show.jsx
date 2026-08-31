import AdminLayout from '@/Layouts/AdminLayout';
import { useForm, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lock, Unlock, Send, Wallet, Users, Package as PackageIcon } from 'lucide-react';
import ModalShell from '@/Components/ui/ModalShell';
import FarmerPicker from '@/Components/ui/FarmerPicker';
import { usePageLock } from '@/hooks/usePageLock';
import { formatDate, formatDateForInput } from '@/utils/dateFormatter';

/** Whole pesos — the overview is for scanning, not for reconciling centavos. */
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const STATUS_TONE = {
    active:    'bg-white text-[#006400]',
    inactive:  'bg-amber-100 text-amber-800',
    draft:     'bg-white/25 text-white',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-700',
};

/**
 * Where the programme sits in its own date window.
 *
 * Distributions outside that window are refused by the server, so saying so up
 * front is better than letting staff find out at the moment of hand-out.
 */
function periodNote(program) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = program.start_date ? new Date(program.start_date) : null;
    const end = program.end_date ? new Date(program.end_date) : null;
    const days = (d) => Math.round((d - today) / 86400000);

    if (start && days(start) > 0) {
        return `Starts in ${days(start)} day${days(start) === 1 ? '' : 's'}`;
    }
    if (end) {
        const left = days(end);
        if (left < 0) return `Ended ${Math.abs(left)} day${left === -1 ? '' : 's'} ago`;
        if (left === 0) return 'Last day';
        return `${left} day${left === 1 ? '' : 's'} left`;
    }
    return 'No end date';
}

export default function AssistanceShow({
    program, distributions, summary, programItems = [], stockItems = [], filters = {},
}) {
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [recording, setRecording] = useState(false);

    // Staff switch this on for the length of a hand-out session. Keyed to the
    // programme so locking one does not lock the others.
    const pageLock = usePageLock(`assistance:${program.id}`, {
        onBlocked: () => toast('This page is locked. Unlock it before leaving.', {
            icon: '🔒',
            id: 'page-lock',   // one message however many times they click
        }),
    });

    const applySearch = (e) => {
        e.preventDefault();
        router.get(`/admin/assistance/${program.id}`, { search: searchTerm }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // The standard package: what every beneficiary gets. Staff confirm it as-is
    // unless they tick Customize, which is the exception rather than the norm.
    const standardItems = () => programItems.map(i => ({
        inventory_item_id: i.inventory_item_id,
        quantity: i.quantity_per_farmer,
    }));

    const { data, setData, post, processing, reset, errors } = useForm({
        // quantity_given and notes were dropped from this form: the items list
        // below records what was actually handed over, and a free-text note
        // duplicated the customisation reason. The columns still exist, so
        // older records keep their values.
        farmer_id: '',
        // Today by default — a hand-out is recorded as it happens, and staff
        // serving a queue should not retype the date for every farmer. It stays
        // editable for anything recorded after the fact.
        //
        // Built from local date parts rather than toISOString(), which returns
        // the UTC day: at 12:30am in Manila that would stamp yesterday.
        distribution_date: formatDateForInput(new Date()),
        amount_given: program.standard_cash_amount ?? '',
        is_customized: false,
        customization_reason: '',
        items: standardItems(),
    });

    const setItemQty = (id, value) => setData('items',
        data.items.map(l => (l.inventory_item_id === id ? { ...l, quantity: value } : l)));

    const qtyFor = id => data.items.find(l => l.inventory_item_id === id)?.quantity ?? '';

    // Items on this hand-out that are not part of the standard package.
    const extraLines = data.items.filter(
        l => !programItems.some(p => String(p.inventory_item_id) === String(l.inventory_item_id)));

    const addExtraItem = () => setData('items',
        [...data.items, { inventory_item_id: '', quantity: '' }]);

    const removeLine = index => setData('items', data.items.filter((_, i) => i !== index));

    const toggleCustomize = on => {
        // Turning it off restores the package exactly, so a half-finished
        // adjustment cannot leak into a hand-out recorded as standard.
        setData(prev => ({
            ...prev,
            is_customized: on,
            items: on ? prev.items : standardItems(),
            customization_reason: on ? prev.customization_reason : '',
            amount_given: on ? prev.amount_given : (program.standard_cash_amount ?? ''),
        }));
    };

    const stockFor = id => stockItems.find(s => String(s.id) === String(id));

    // Flash messages are announced globally from app.jsx — success and failure,
    // on every page — so this page no longer handles them itself.

    const submit = e => {
        e.preventDefault();
        post(`/admin/assistance/${program.id}/distribute`, {
            preserveScroll: true,
            onSuccess: (page) => {
                // A refusal — short stock, or a locked program — comes back as
                // a redirect carrying flash.error, which Inertia still treats
                // as a successful visit. Without this check the form would be
                // cleared and the user told it worked. The message itself is
                // announced globally in app.jsx.
                if (page.props.flash?.error) return;

                reset();
                setRecording(false);
            },
            // Validation failures (422) carry no flash, so they are reported here.
            onError: () => toast.error('Please check the form and try again.'),
        });
    };

    // Filter distributions based on search term — now server-side
    const filteredDistributions = distributions.data;

    // Context-aware labels based on distribution type
    const distributionType = program.assistance_type?.distribution_type || 'financial';
    const labels = {
        financial: { 
            record: 'Record Distribution', 
            amount: 'Amount (₱)', 
            quantity: 'Quantity',
            action: 'Distribution'
        },
        material: { 
            record: 'Record Distribution', 
            amount: 'Value (₱)', 
            quantity: 'Quantity',
            action: 'Distribution'
        },
        training: { 
            record: 'Record Participant', 
            amount: 'Allowance (₱)', 
            quantity: 'Days Attended',
            action: 'Participation'
        },
        service: { 
            record: 'Record Service', 
            amount: 'Premium/Value (₱)', 
            quantity: 'Coverage',
            action: 'Service'
        }
    };
    const label = labels[distributionType];

    return (
        <AdminLayout
            title={program.program_name}
            backHref="/admin/assistance"
            backLabel="Back to Financial Assistance"
            backLocked={pageLock.locked}
        >
            {/* ---------------------------------------- programme header */}
            <div className="rounded-xl shadow-sm mb-6 overflow-hidden">
                {/* The identity strip: what this programme is, and whether it is
                    running. Everything here answers "can I hand out today?" */}
                <div className="bg-gradient-to-r from-[#004d00] via-[#006400] to-[#228B22] px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                            {program.assistance_type?.type_name || 'Untyped'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_TONE[program.status] ?? STATUS_TONE.draft}`}>
                            {program.status}
                        </span>
                        {program.is_locked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                <Lock className="h-3 w-3" /> Locked
                            </span>
                        )}
                        <span className="ml-auto text-xs font-medium text-white/80">
                            {periodNote(program)}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white p-5">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Runs</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                            {formatDate(program.start_date, 'date-only')} – {formatDate(program.end_date, 'date-only')}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                            Total budget {peso(program.total_budget)}
                        </p>
                    </div>

                    {/* What one farmer receives — previously only visible inside
                        the distribution modal, which is too late to check. */}
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Each farmer gets</p>
                        {program.standard_cash_amount || programItems.length ? (
                            <ul className="mt-1 space-y-0.5 text-sm text-gray-900">
                                {program.standard_cash_amount > 0 && (
                                    <li className="font-semibold">{peso(program.standard_cash_amount)} cash</li>
                                )}
                                {programItems.map(i => (
                                    <li key={i.inventory_item_id}>
                                        {i.quantity_per_farmer} {i.unit} {i.item_name}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-1 text-sm text-amber-700">
                                No package set — add one in Edit.
                            </p>
                        )}
                    </div>

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Covers {program.barangays?.length ? `${program.barangays.length} barangay${program.barangays.length > 1 ? 's' : ''}` : 'everywhere'}
                        </p>
                        {program.barangays?.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {program.barangays.map(b => (
                                    <span key={b.id} className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-800">
                                        {b.name}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-1 text-sm text-gray-700">
                                Every barangay in Tumauini.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ------------------------------------------------- overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

                {/* Money: what was committed, what has gone out, what is left. */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Wallet className="h-4 w-4 text-[#006400]" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Budget</h3>
                    </div>

                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                        {peso(summary.remaining ?? 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                        left of {peso(summary.budget ?? 0)}
                    </p>

                    {summary.budget_used_pct !== null && summary.budget_used_pct !== undefined && (
                        <>
                            <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full bg-[#006400]"
                                    style={{ width: `${Math.max(summary.budget_used_pct, 0.5)}%` }} />
                            </div>
                            <p className="mt-1.5 text-xs text-gray-500">
                                {peso(summary.disbursed ?? 0)} disbursed · {summary.budget_used_pct}% used
                            </p>
                        </>
                    )}

                    {summary.cash_covers_more != null && (
                        <p className="mt-2 text-xs text-gray-500">
                            Covers about <b className="text-gray-700">{summary.cash_covers_more.toLocaleString()}</b> more
                            farmers at {peso(program.standard_cash_amount ?? 0)} each.
                        </p>
                    )}
                </div>

                {/* Who has been served. */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-[#006400]" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Beneficiaries</h3>
                    </div>

                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.beneficiaries ?? 0}</p>
                    <p className="text-xs text-gray-500">farmers served</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                            {summary.claimed ?? 0} claimed
                        </span>
                        {summary.pending > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                {summary.pending} pending
                            </span>
                        )}
                        {summary.forfeited > 0 && (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                {summary.forfeited} forfeited
                            </span>
                        )}
                    </div>
                </div>

                {/* Goods this programme has taken out of the store. */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <PackageIcon className="h-4 w-4 text-[#006400]" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Items given out</h3>
                    </div>

                    {summary.goods?.length ? (
                        <ul className="space-y-2">
                            {summary.goods.map(g => (
                                <li key={g.item}>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="text-sm text-gray-800 truncate">{g.item}</span>
                                        <span className="text-sm font-bold tabular-nums text-[#006400] whitespace-nowrap">
                                            {Number(g.issued).toLocaleString()} {g.unit}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                        {Number(g.in_stock).toLocaleString()} {g.unit} still in the store
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <>
                            <p className="text-2xl font-bold text-gray-300 tabular-nums">—</p>
                            <p className="text-xs text-gray-500">
                                {programItems.length
                                    ? 'Nothing issued yet.'
                                    : 'Cash only — no items in this program’s package.'}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Add distribution — hidden entirely while the program is locked,
                so nobody fills in a form the server will refuse. */}
            {program.is_locked ? (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                        <p className="text-sm font-semibold text-amber-900">This program is locked</p>
                        <p className="mt-0.5 text-sm text-amber-800">
                            Its details and distributions are read-only
                            {program.locker?.name ? ` — locked by ${program.locker.name}` : ''}
                            {program.locked_at ? ` on ${formatDate(program.locked_at, 'date-only')}` : ''}.
                            An administrator must unlock it before anything can be recorded.
                        </p>
                    </div>
                </div>
            ) : (
            <>
            {/* Says plainly why the menus have stopped responding, and carries
                its own way out so staff are never stuck hunting for one. */}
            {pageLock.locked && (
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span className="min-w-0">
                        <strong className="font-semibold">This page is locked.</strong>{' '}
                        The back arrow and the side menu are blocked so you keep your
                        place while serving the queue.
                    </span>
                    <button type="button" onClick={pageLock.unlock}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                        <Unlock className="h-3.5 w-3.5" /> Unlock
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-5 mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-gray-700">{label.record}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {programItems.length > 0 || program.standard_cash_amount
                            ? 'Serves one farmer the standard package. Stock is deducted as you confirm.'
                            : 'Record what this program gave a farmer.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={pageLock.toggle} aria-pressed={pageLock.locked}
                        title={pageLock.locked
                            ? 'Release the page so you can use the menus again'
                            : 'Stay on this page — blocks the back arrow and the side menu'}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                            pageLock.locked
                                ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200'
                                : 'border-gray-300 bg-white text-gray-600 hover:border-[#006400] hover:text-[#006400]'
                        }`}>
                        {pageLock.locked
                            ? <><Lock className="h-4 w-4" /> Locked</>
                            : <><Unlock className="h-4 w-4" /> Lock page</>}
                    </button>
                    <button type="button" onClick={() => setRecording(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#006400] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#228B22]">
                        <Send className="h-4 w-4" /> {label.record}
                    </button>
                </div>
            </div>
            </>
            )}

            {/* The form itself, as a modal — the same shape as Inventory's
                "Issue to farmer", so one hand-out looks the same wherever it is
                started from. */}
            {recording && !program.is_locked && (
            <ModalShell
                title={`${label.record} — ${program.program_name}`}
                size="lg"
                onClose={() => setRecording(false)}
                as="form"
                onSubmit={submit}
                bodyClass="px-5 py-4"
                footer={
                    <>
                        <button type="button" onClick={() => setRecording(false)}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                            Cancel
                        </button>
                        <button type="submit" disabled={processing}
                            className="px-5 py-2 bg-[#006400] text-white rounded-lg text-sm font-semibold hover:bg-[#228B22] disabled:opacity-50">
                            {processing ? 'Recording…' : 'Confirm distribution'}
                        </button>
                    </>
                }
            >
                {Object.keys(errors).length > 0 && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800 mb-1">Please fix the following:</p>
                        <ul className="text-sm text-red-600 list-disc list-inside">
                            {Object.entries(errors).map(([key, message]) => (
                                <li key={key}>{message}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FarmerPicker
                        label={null}
                        value={data.farmer_id}
                        onChange={id => setData('farmer_id', id)}
                        error={errors.farmer_id}
                    />
                    <div>
                        <input type="date" value={data.distribution_date}
                            onChange={e => setData('distribution_date', e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-green-500 outline-none ${errors.distribution_date ? 'border-red-500' : ''}`}
                            required />
                        {errors.distribution_date && <p className="text-xs text-red-500 mt-1">{errors.distribution_date}</p>}
                    </div>
                    <div>
                        <input placeholder={label.amount} type="number" value={data.amount_given}
                            onChange={e => setData('amount_given', e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-green-500 outline-none ${errors.amount_given ? 'border-red-500' : ''}`} />
                        {errors.amount_given && <p className="text-xs text-red-500 mt-1">{errors.amount_given}</p>}
                    </div>

                    {(programItems.length > 0 || program.standard_cash_amount) && (
                        <div className="sm:col-span-3 space-y-3">
                            {/* Read-only unless customised: the common case is
                                confirming the package, not editing it. */}
                            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#006400]">
                                    Standard package
                                </p>

                                {program.standard_cash_amount != null && program.standard_cash_amount !== '' && (
                                    <p className="mb-2 text-sm text-gray-800">
                                        Cash:{' '}
                                        <span className="font-semibold">
                                            ₱{Number(program.standard_cash_amount).toLocaleString()}
                                        </span>
                                    </p>
                                )}

                                <div className="space-y-1">
                                    {programItems.map(i => {
                                        const given = Number(qtyFor(i.inventory_item_id) || 0);
                                        const short = given > i.in_stock;
                                        const changed = data.is_customized && given !== Number(i.quantity_per_farmer);

                                        return (
                                            <div key={i.inventory_item_id} className="flex flex-wrap items-center gap-2 text-sm">
                                                <span className="min-w-[9rem] flex-1 font-medium text-gray-800">
                                                    {i.item_name}
                                                </span>

                                                {data.is_customized ? (
                                                    <input
                                                        type="number" step="0.01" min="0"
                                                        value={qtyFor(i.inventory_item_id)}
                                                        onChange={e => setItemQty(i.inventory_item_id, e.target.value)}
                                                        className={`w-24 rounded-lg border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-green-500 ${
                                                            short ? 'border-red-400' : 'border-gray-300'
                                                        }`}
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-gray-900">
                                                        {i.quantity_per_farmer} {i.unit}
                                                    </span>
                                                )}

                                                {changed && (
                                                    <span className="text-[11px] text-amber-700">
                                                        instead of {i.quantity_per_farmer}
                                                    </span>
                                                )}

                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                    short ? 'bg-red-100 text-red-700'
                                                          : i.in_stock <= 0 ? 'bg-gray-200 text-gray-600'
                                                          : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {short
                                                        ? `only ${i.in_stock} ${i.unit} left`
                                                        : `stock ${i.in_stock} ${i.unit}`}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <p className="mt-2 text-[11px] text-gray-500">
                                    Confirming deducts these from warehouse stock. If any item is short,
                                    nothing is saved — the whole distribution is refused.
                                </p>
                            </div>

                            {/* Customisation is opt-in, and recorded as such. */}
                            <div className="rounded-lg border border-gray-200 p-3">
                                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={data.is_customized}
                                        onChange={e => toggleCustomize(e.target.checked)}
                                        className="h-4 w-4 rounded text-green-700 focus:ring-green-500"
                                    />
                                    Adjust this package for this farmer
                                    <span className="font-normal text-gray-400">(exception)</span>
                                </label>

                                {data.is_customized && (
                                    <div className="mt-3 space-y-2">
                                        {extraLines.length > 0 && (
                                            <div className="space-y-2">
                                                {data.items.map((line, index) => {
                                                    const isExtra = !programItems.some(
                                                        p => String(p.inventory_item_id) === String(line.inventory_item_id));
                                                    if (!isExtra) return null;
                                                    const stock = stockFor(line.inventory_item_id);

                                                    return (
                                                        <div key={index} className="flex flex-wrap items-center gap-2">
                                                            <select
                                                                value={line.inventory_item_id}
                                                                onChange={e => setData('items', data.items.map((l, i) =>
                                                                    i === index ? { ...l, inventory_item_id: e.target.value } : l))}
                                                                className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-green-500"
                                                            >
                                                                <option value="">Select an item</option>
                                                                {stockItems.map(s => (
                                                                    <option key={s.id} value={s.id}>
                                                                        {s.item_name} ({Number(s.quantity).toLocaleString()} {s.unit})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <input
                                                                type="number" step="0.01" min="0"
                                                                value={line.quantity}
                                                                onChange={e => setData('items', data.items.map((l, i) =>
                                                                    i === index ? { ...l, quantity: e.target.value } : l))}
                                                                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-green-500"
                                                            />
                                                            <span className="text-[11px] text-gray-500">{stock?.unit}</span>
                                                            <button type="button" onClick={() => removeLine(index)}
                                                                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                                                                Remove
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <button type="button" onClick={addExtraItem}
                                            className="text-xs font-medium text-green-700 hover:underline">
                                            + Add an item not in the package
                                        </button>

                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                                Reason for the adjustment
                                            </label>
                                            <input
                                                value={data.customization_reason}
                                                onChange={e => setData('customization_reason', e.target.value)}
                                                placeholder="e.g. Farmer already had extra fertilizer"
                                                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 ${
                                                    errors.customization_reason ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                            />
                                            {errors.customization_reason && (
                                                <p className="mt-1 text-xs text-red-500">{errors.customization_reason}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </ModalShell>
            )}

            {/* Distributions table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Search filter */}
                <div className="p-4 border-b bg-gray-50">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by farmer name or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-96 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                        />
                        <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    {searchTerm && (
                        <p className="text-xs text-gray-500 mt-2">
                            Found {filteredDistributions.length} result(s)
                        </p>
                    )}
                </div>
                
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Farmer</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Items given</th>
                            <th className="px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDistributions.length > 0 ? (
                            filteredDistributions.map(d => (
                                <tr key={d.id} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1.5">
                                            {d.farmer?.first_name} {d.farmer?.last_name}
                                            {d.is_customized && (
                                                <span
                                                    title={d.customization_reason || 'Adjusted for this farmer'}
                                                    className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                                    adjusted
                                                </span>
                                            )}
                                        </span>
                                        {d.is_customized && d.customization_reason && (
                                            <span className="mt-0.5 block text-[11px] text-gray-500">
                                                {d.customization_reason}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{formatDate(d.distribution_date, 'date-only')}</td>
                                    <td className="px-4 py-3">₱{Number(d.amount_given ?? 0).toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        {d.items?.length ? (
                                            <div className="space-y-0.5">
                                                {d.items.map((it, k) => (
                                                    <div key={k} className="whitespace-nowrap text-xs">
                                                        <span className="font-medium text-gray-800">
                                                            {it.quantity} {it.unit} {it.item_name}
                                                        </span>
                                                        {it.balance_after !== null && (
                                                            <span className="ml-1.5 text-gray-400">
                                                                stock {it.balance_before} → {it.balance_after}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full
                                            ${d.status === 'claimed' ? 'bg-green-100 text-green-700' :
                                              d.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-red-100 text-red-600'}`}>
                                            {d.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                    {searchTerm ? 'No farmers found matching your search.' : 'No distributions recorded yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
