import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    Package, Plus, Minus, Send, Trash2, X, Search, CalendarClock,
    ArrowUpRight, ArrowDownRight, Users, Wallet, Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/Components/ui/Card';
import ModalShell from '@/Components/ui/ModalShell';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

const peso = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n, dp = 2) =>
    Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const STATUS = {
    available:    { label: 'Available',    cls: 'bg-green-100 text-green-800 border-green-200' },
    low_stock:    { label: 'Low stock',    cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    out_of_stock: { label: 'Out of stock', cls: 'bg-red-100 text-red-800 border-red-200' },
};

const DIST_STATUS = {
    pending:   'bg-amber-100 text-amber-800',
    claimed:   'bg-green-100 text-green-800',
    forfeited: 'bg-gray-100 text-gray-600',
};

const field = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500';
const label = 'block text-xs font-medium text-gray-600 mb-1';

export default function InventoryShow({ item, issued, recipients, programs }) {
    const { can } = usePermissions();
    const [panel, setPanel] = useState(null);   // 'adjust' | 'issue'

    const expired = item.expiry_date && new Date(item.expiry_date) < new Date();
    const status = STATUS[item.status];

    const remove = () => {
        if (!confirm(`Delete ${item.item_name}? This cannot be undone.`)) return;
        router.delete(`/admin/inventory/${item.id}`, {
            onSuccess: () => toast.success('Item deleted.'),
            onError: () => toast.error('Could not delete this item.'),
        });
    };

    return (
        <AdminLayout title={item.item_name}>
            {/* Header */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mb-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <span className="hidden sm:flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#006400]">
                        <Package className="h-7 w-7 text-white" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-bold text-gray-900">{item.item_name}</h1>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${status.cls}`}>
                                {status.label}
                            </span>
                            {expired && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                                    Expired
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {item.category_label}
                            {item.supplier && <> · {item.supplier}</>}
                            {item.source && <> · from {item.source}</>}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {can('edit supplies') && (
                            <button onClick={() => setPanel('adjust')}
                                className="px-4 py-2.5 rounded-xl border border-green-200 text-[#006400] text-sm font-semibold hover:bg-green-50">
                                Adjust stock
                            </button>
                        )}
                        {can('distribute supplies') && (
                            <button onClick={() => setPanel('issue')}
                                disabled={Number(item.quantity) <= 0}
                                title={Number(item.quantity) <= 0 ? 'Nothing in stock to issue' : undefined}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006400] text-white text-sm font-semibold hover:bg-[#228B22] disabled:opacity-40 disabled:cursor-not-allowed">
                                <Send className="h-4 w-4" /> Issue to farmer
                            </button>
                        )}
                        {can('delete supplies') && (
                            <button onClick={remove} title="Delete item"
                                className="p-2.5 rounded-xl text-red-600 hover:bg-red-50">
                                <Trash2 className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stock figures */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <Figure label="In stock" value={`${num(item.quantity)} ${item.unit}`} tone="#006400" icon={Package} />
                <Figure label="Issued to date" value={`${num(issued)} ${item.unit}`} tone="#228B22" icon={Truck} />
                <Figure label="Farmers reached" value={recipients} tone="#4CAF50" icon={Users} />
                <Figure label="Stock value" tone="#81C784" icon={Wallet}
                    value={item.unit_cost ? peso(item.total_value) : 'No unit cost'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Card title="Details">
                    <dl className="space-y-3 text-sm">
                        <Row label="Alert below" value={`${num(item.min_level)} ${item.unit}`} />
                        <Row label="Unit cost" value={item.unit_cost ? peso(item.unit_cost) : '—'} />
                        <Row label="Funding source" value={item.funding_source} />
                        <Row label="Expiry" value={item.expiry_date ? formatDate(item.expiry_date, 'date-only') : '—'} />
                        <Row label="Added by" value={item.creator?.name} />
                        <Row label="Added on" value={item.created_at ? formatDate(item.created_at, 'date-only') : '—'} />
                    </dl>
                    {item.description && (
                        <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">{item.description}</p>
                    )}
                </Card>

                <div className="lg:col-span-2 space-y-5">
                    <Card title="Issued to farmers">
                        {item.distributions?.length ? (
                            <div className="divide-y divide-green-50 -my-2">
                                {item.distributions.map(d => (
                                    <div key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                                        <div className="min-w-0 flex-1">
                                            <Link href={`/admin/farmers/${d.farmer?.id}`}
                                                className="font-semibold text-gray-900 hover:text-[#006400] truncate block">
                                                {d.farmer ? `${d.farmer.last_name}, ${d.farmer.first_name}` : 'Unknown farmer'}
                                            </Link>
                                            <p className="text-xs text-gray-500">
                                                {formatDate(d.distribution_date, 'date-only')}
                                                {d.program && <> · {d.program.program_name}</>}
                                                {d.issuer && <> · by {d.issuer.name}</>}
                                            </p>
                                        </div>
                                        <span className="font-bold text-[#006400] tabular-nums whitespace-nowrap">
                                            {num(d.quantity)} {item.unit}
                                        </span>
                                        {can('distribute supplies') ? (
                                            <select
                                                value={d.status}
                                                onChange={e => router.put(`/admin/inventory-distributions/${d.id}`,
                                                    { status: e.target.value },
                                                    {
                                                        preserveScroll: true,
                                                        onSuccess: () => toast.success('Updated.'),
                                                        onError: errs => toast.error(Object.values(errs)[0] || 'Could not update.'),
                                                    })}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border-0 outline-none cursor-pointer ${DIST_STATUS[d.status]}`}
                                            >
                                                <option value="pending">pending</option>
                                                <option value="claimed">claimed</option>
                                                <option value="forfeited">forfeited</option>
                                            </select>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${DIST_STATUS[d.status]}`}>
                                                {d.status}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <Empty icon={Send} text="Not issued to anyone yet" />
                        )}
                    </Card>

                    <Card title="Stock history">
                        {item.adjustments?.length ? (
                            <div className="divide-y divide-green-50 -my-2">
                                {item.adjustments.map(a => {
                                    const up = a.adjustment_type === 'add' || a.adjustment_type === 'return';
                                    return (
                                        <div key={a.id} className="flex items-center gap-3 py-3">
                                            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                                                up ? 'bg-green-100' : 'bg-amber-100'
                                            }`}>
                                                {up
                                                    ? <ArrowUpRight className="h-4 w-4 text-green-700" />
                                                    : <ArrowDownRight className="h-4 w-4 text-amber-700" />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900">
                                                    {a.reason || (up ? 'Stock added' : 'Stock reduced')}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDate(a.adjusted_on, 'date-only')}
                                                    {a.performer && <> · {a.performer.name}</>}
                                                </p>
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <p className={`text-sm font-bold tabular-nums ${up ? 'text-green-700' : 'text-amber-700'}`}>
                                                    {up ? '+' : '−'}{num(a.quantity)}
                                                </p>
                                                <p className="text-[11px] text-gray-400 tabular-nums">
                                                    balance {num(a.balance_after)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Empty icon={CalendarClock} text="No stock movements recorded" />
                        )}
                    </Card>
                </div>
            </div>

            {panel === 'adjust' && <AdjustPanel item={item} onClose={() => setPanel(null)} />}
            {panel === 'issue' && <IssuePanel item={item} programs={programs} onClose={() => setPanel(null)} />}
        </AdminLayout>
    );
}

function Figure({ icon: Icon, label, value, tone }) {
    return (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
                <span className="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: tone }}>
                    <Icon className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-medium text-gray-900 text-right">{value || '—'}</dd>
        </div>
    );
}

function Empty({ icon: Icon, text }) {
    return (
        <div className="py-12 text-center">
            <Icon className="mx-auto mb-3 h-9 w-9 text-green-200" />
            <p className="text-sm text-gray-500">{text}</p>
        </div>
    );
}

function Sheet({ title, onClose, children }) {
    // bodyClass is cleared because each panel brings its own padded <form>.
    return (
        <ModalShell title={title} onClose={onClose} size="md" bodyClass="">
            {children}
        </ModalShell>
    );
}

function AdjustPanel({ item, onClose }) {
    const form = useForm({
        adjustment_type: 'add', quantity: '', reason: '', notes: '',
        adjusted_on: new Date().toISOString().slice(0, 10),
    });

    const up = form.data.adjustment_type === 'add' || form.data.adjustment_type === 'return';
    const projected = up
        ? Number(item.quantity) + Number(form.data.quantity || 0)
        : Number(item.quantity) - Number(form.data.quantity || 0);

    const submit = e => {
        e.preventDefault();
        form.post(`/admin/inventory/${item.id}/adjust`, {
            preserveScroll: true,
            onSuccess: () => { toast.success('Stock updated.'); onClose(); },
            onError: errs => toast.error(Object.values(errs)[0] || 'Could not adjust stock.'),
        });
    };

    return (
        <Sheet title="Adjust stock" onClose={onClose}>
            <form onSubmit={submit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { k: 'add', l: 'Add stock', i: Plus },
                        { k: 'reduce', l: 'Reduce stock', i: Minus },
                        { k: 'return', l: 'Returned', i: ArrowUpRight },
                        { k: 'transfer', l: 'Transferred out', i: ArrowDownRight },
                    ].map(o => (
                        <button key={o.k} type="button" onClick={() => form.setData('adjustment_type', o.k)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                                form.data.adjustment_type === o.k
                                    ? 'border-[#006400] bg-green-50 text-[#006400]'
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}>
                            <o.i className="h-4 w-4" /> {o.l}
                        </button>
                    ))}
                </div>

                <div>
                    <label className={label}>Quantity ({item.unit}) *</label>
                    <input type="number" step="0.01" min="0.01" className={field} value={form.data.quantity}
                        onChange={e => form.setData('quantity', e.target.value)} autoFocus />
                    {form.errors.quantity && <p className="text-xs text-red-600 mt-1">{form.errors.quantity}</p>}
                    {form.data.quantity && (
                        <p className={`text-xs mt-1 ${projected < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {num(item.quantity)} → <b>{num(projected)}</b> {item.unit}
                            {projected < 0 && ' — more than you have in stock'}
                        </p>
                    )}
                </div>

                <div>
                    <label className={label}>Reason</label>
                    <input className={field} list="reasons" value={form.data.reason}
                        onChange={e => form.setData('reason', e.target.value)} placeholder="e.g. New delivery" />
                    <datalist id="reasons">
                        {['New delivery', 'Donation received', 'Damaged', 'Expired', 'Lost', 'Correction',
                            'Unused by farmer', 'Transferred to storage'].map(r => <option key={r} value={r} />)}
                    </datalist>
                </div>

                <div>
                    <label className={label}>Date</label>
                    <input type="date" className={field} value={form.data.adjusted_on}
                        onChange={e => form.setData('adjusted_on', e.target.value)} />
                </div>

                <div>
                    <label className={label}>Notes</label>
                    <textarea rows={2} className={field} value={form.data.notes}
                        onChange={e => form.setData('notes', e.target.value)} />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose}
                        className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={form.processing || projected < 0}
                        className="px-6 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] disabled:opacity-50">
                        {form.processing ? 'Saving…' : 'Record'}
                    </button>
                </div>
            </form>
        </Sheet>
    );
}

function IssuePanel({ item, programs, onClose }) {
    const form = useForm({
        farmer_id: '', assistance_id: '', quantity: '',
        distribution_date: new Date().toISOString().slice(0, 10), status: 'pending', notes: '',
    });

    const [term, setTerm] = useState('');
    const [matches, setMatches] = useState([]);
    const [chosen, setChosen] = useState(null);

    // The registry is far too large for a dropdown, so the farmer is searched.
    useEffect(() => {
        if (term.trim().length < 2) { setMatches([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/admin/inventory/farmer-options?q=${encodeURIComponent(term)}`, {
                    headers: { Accept: 'application/json' }, credentials: 'same-origin',
                });
                if (res.ok) setMatches(await res.json());
            } catch { /* leave the previous matches in place */ }
        }, 250);
        return () => clearTimeout(t);
    }, [term]);

    const remaining = Number(item.quantity) - Number(form.data.quantity || 0);

    const submit = e => {
        e.preventDefault();
        form.post(`/admin/inventory/${item.id}/distribute`, {
            preserveScroll: true,
            onSuccess: () => { toast.success('Issued to farmer.'); onClose(); },
            onError: errs => toast.error(Object.values(errs)[0] || 'Could not issue this item.'),
        });
    };

    return (
        <Sheet title={`Issue ${item.item_name}`} onClose={onClose}>
            <form onSubmit={submit} className="p-6 space-y-4">
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm">
                    <span className="text-gray-600">Available: </span>
                    <b className="text-[#006400] tabular-nums">{num(item.quantity)} {item.unit}</b>
                </div>

                <div>
                    <label className={label}>Farmer *</label>
                    {chosen ? (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-green-200 bg-green-50">
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-gray-900 truncate">{chosen.label}</span>
                                <span className="block text-xs text-gray-500">{chosen.meta}</span>
                            </span>
                            <button type="button"
                                onClick={() => { setChosen(null); form.setData('farmer_id', ''); setTerm(''); }}
                                className="p-1 text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input className={`${field} pl-10`} value={term} onChange={e => setTerm(e.target.value)}
                                    placeholder="Search surname or RSBSA number…" />
                            </div>
                            {matches.length > 0 && (
                                <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                                    {matches.map(m => (
                                        <button key={m.id} type="button"
                                            onClick={() => { setChosen(m); form.setData('farmer_id', m.id); }}
                                            className="w-full px-3 py-2 text-left hover:bg-green-50">
                                            <span className="block text-sm font-medium text-gray-900">{m.label}</span>
                                            <span className="block text-xs text-gray-500">{m.meta}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {form.errors.farmer_id && <p className="text-xs text-red-600 mt-1">{form.errors.farmer_id}</p>}
                </div>

                <div>
                    <label className={label}>Quantity ({item.unit}) *</label>
                    <input type="number" step="0.01" min="0.01" max={item.quantity} className={field}
                        value={form.data.quantity} onChange={e => form.setData('quantity', e.target.value)} />
                    {form.errors.quantity && <p className="text-xs text-red-600 mt-1">{form.errors.quantity}</p>}
                    {form.data.quantity && (
                        <p className={`text-xs mt-1 ${remaining < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {remaining < 0
                                ? `Only ${num(item.quantity)} ${item.unit} in stock`
                                : <>Leaves <b>{num(remaining)} {item.unit}</b> in stock</>}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={label}>Programme</label>
                        <select className={field} value={form.data.assistance_id}
                            onChange={e => form.setData('assistance_id', e.target.value)}>
                            <option value="">None</option>
                            {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={label}>Date</label>
                        <input type="date" className={field} value={form.data.distribution_date}
                            onChange={e => form.setData('distribution_date', e.target.value)} />
                    </div>
                </div>

                <div>
                    <label className={label}>Status</label>
                    <select className={field} value={form.data.status} onChange={e => form.setData('status', e.target.value)}>
                        <option value="pending">Pending — not yet collected</option>
                        <option value="claimed">Claimed — handed over</option>
                    </select>
                </div>

                <div>
                    <label className={label}>Notes</label>
                    <textarea rows={2} className={field} value={form.data.notes}
                        onChange={e => form.setData('notes', e.target.value)} />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose}
                        className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={form.processing || !form.data.farmer_id || remaining < 0}
                        className="px-6 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] disabled:opacity-50">
                        {form.processing ? 'Issuing…' : 'Issue to farmer'}
                    </button>
                </div>
            </form>
        </Sheet>
    );
}
