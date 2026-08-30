import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    Package, AlertTriangle, XCircle, Wallet, CalendarClock, Send,
    Plus, Search, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import ModalShell from '@/Components/ui/ModalShell';
import { formatDate } from '@/utils/dateFormatter';

const PER_PAGE = [25, 50, 100];

const peso = n => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const num = (n, dp = 2) =>
    Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const STATUS = {
    available:    { label: 'Available',    cls: 'bg-green-100 text-green-800 border-green-200' },
    low_stock:    { label: 'Low stock',    cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    out_of_stock: { label: 'Out of stock', cls: 'bg-red-100 text-red-800 border-red-200' },
};

function Stat({ icon: Icon, value, label, tone, hint }) {
    return (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
                <span className="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: tone }}>
                    <Icon className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
                </div>
            </div>
        </div>
    );
}

function SortHeader({ column, label, sort, onSort, className = '' }) {
    const active = sort.column === column;
    const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
    return (
        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${className}`}>
            <button type="button" onClick={() => onSort(column)}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors">
                {label}<Icon className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-40'}`} />
            </button>
        </th>
    );
}

export default function InventoryIndex({ items, filters, sort, perPage, categories, units, summary, alerts }) {
    const { can } = usePermissions();
    const [search, setSearch] = useState(filters.search ?? '');
    const [adding, setAdding] = useState(false);

    const go = (params = {}) => router.get('/admin/inventory',
        {
            search, category: filters.category ?? '', status: filters.status ?? '',
            expiring: filters.expiring ?? '', sort: sort.column, direction: sort.direction,
            per_page: perPage, ...params,
        },
        { preserveState: true, preserveScroll: true, replace: true });

    const onSort = c => go({
        sort: c,
        direction: sort.column === c && sort.direction === 'asc' ? 'desc' : 'asc',
        page: 1,
    });

    const activeFilters = ['search', 'category', 'status', 'expiring'].filter(k => filters[k]).length;
    const rows = items.data ?? [];

    return (
        <AdminLayout title="Inventory">
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                <Stat icon={Package} tone="#006400" value={summary ? summary.total_items : '—'} label="Items" />
                <Stat icon={AlertTriangle} tone="#D97706" value={summary ? summary.low_stock : '—'} label="Low stock" />
                <Stat icon={XCircle} tone="#DC2626" value={summary ? summary.out_of_stock : '—'} label="Out of stock" />
                <Stat icon={Wallet} tone="#228B22" value={summary ? peso(summary.total_value) : '—'} label="Stock value"
                    hint={summary?.unvalued ? `${summary.unvalued} item(s) have no unit cost` : undefined} />
                <Stat icon={Send} tone="#4CAF50" value={summary ? summary.issued_30d : '—'} label="Issued (30 days)" />
            </div>

            {/* What needs action */}
            {alerts && alerts.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm mb-5 overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-100">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <h2 className="text-sm font-bold text-amber-900">Needs restocking</h2>
                        <span className="ml-auto text-xs text-amber-700">{alerts.length} item(s)</span>
                    </div>
                    <div className="divide-y divide-amber-50">
                        {alerts.map(a => {
                            const out = Number(a.quantity) <= 0;
                            return (
                                <Link key={a.id} href={`/admin/inventory/${a.id}`}
                                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-amber-50/50 transition-colors">
                                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${out ? 'bg-red-500' : 'bg-amber-500'}`} />
                                    <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{a.item_name}</span>
                                    <span className="text-sm tabular-nums text-gray-700 whitespace-nowrap">
                                        {num(a.quantity)} {a.unit}
                                    </span>
                                    <span className="hidden sm:inline text-xs text-gray-400 whitespace-nowrap">
                                        min {num(a.min_level)}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mb-5">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && go({ page: 1 })}
                            placeholder="Search item, supplier, or funding source…"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <select className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-green-500"
                        value={filters.category ?? ''} onChange={e => go({ category: e.target.value, page: 1 })}>
                        <option value="">All categories</option>
                        {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-green-500"
                        value={filters.status ?? ''} onChange={e => go({ status: e.target.value, page: 1 })}>
                        <option value="">Any status</option>
                        <option value="available">Available</option>
                        <option value="low_stock">Low stock</option>
                        <option value="out_of_stock">Out of stock</option>
                    </select>
                    <button onClick={() => go({ page: 1 })}
                        className="px-6 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] transition-colors whitespace-nowrap">
                        Search
                    </button>
                    {can('create supplies') && (
                        <button onClick={() => setAdding(true)}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] transition-colors whitespace-nowrap">
                            <Plus className="h-4 w-4" /> Add item
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-600">
                    <span>
                        {items.total > 0
                            ? <>Showing <b className="text-gray-900">{items.from}–{items.to}</b> of <b className="text-gray-900">{items.total}</b></>
                            : 'No items match'}
                    </span>
                    {activeFilters > 0 && (
                        <button onClick={() => { setSearch(''); router.get('/admin/inventory'); }}
                            className="inline-flex items-center gap-1 text-[#006400] hover:underline">
                            <X className="h-3.5 w-3.5" /> Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
                        </button>
                    )}
                    <label className="ml-auto flex items-center gap-2 text-xs">
                        Rows
                        <select value={perPage} onChange={e => go({ per_page: e.target.value, page: 1 })}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-green-500">
                            {PER_PAGE.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="bg-white rounded-2xl border border-green-100 shadow-sm py-20 text-center">
                    <Package className="mx-auto h-12 w-12 text-green-200 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Nothing in stock yet</h3>
                    <p className="text-sm text-gray-500">
                        {activeFilters > 0 ? 'Try clearing some filters.' : 'Add seeds, fertilizer or equipment to start tracking.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="hidden lg:block bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#006400] text-white text-left">
                                    <tr>
                                        <SortHeader column="item_name" label="Item" sort={sort} onSort={onSort} />
                                        <SortHeader column="category" label="Category" sort={sort} onSort={onSort} />
                                        <SortHeader column="quantity" label="In stock" sort={sort} onSort={onSort} className="text-right" />
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right">Min</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Supplier</th>
                                        <SortHeader column="expiry_date" label="Expiry" sort={sort} onSort={onSort} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-green-50">
                                    {rows.map(i => (
                                        <tr key={i.id} onClick={() => router.visit(`/admin/inventory/${i.id}`)}
                                            className="hover:bg-green-50/60 transition-colors cursor-pointer">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-gray-900">{i.item_name}</p>
                                                {i.source && <p className="text-xs text-gray-500">from {i.source}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">{i.category_label}</td>
                                            <td className="px-4 py-3 text-right font-bold text-[#006400] tabular-nums whitespace-nowrap">
                                                {num(i.quantity)} <span className="text-xs font-normal text-gray-500">{i.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{num(i.min_level)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS[i.status].cls}`}>
                                                    {STATUS[i.status].label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{i.supplier || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(i.expiry_date, 'date-only')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:hidden space-y-3">
                        {rows.map(i => (
                            <Link key={i.id} href={`/admin/inventory/${i.id}`}
                                className="block bg-white rounded-2xl border border-green-100 shadow-sm p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{i.item_name}</p>
                                        <p className="text-xs text-gray-500">{i.category_label}</p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-lg bg-green-50 text-[#006400] font-bold text-sm tabular-nums whitespace-nowrap">
                                        {num(i.quantity)} {i.unit}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS[i.status].cls}`}>
                                        {STATUS[i.status].label}
                                    </span>
                                    <span className="text-xs text-gray-500">min {num(i.min_level)} {i.unit}</span>
                                </div>
                            </Link>
                        ))}
                    </div>

                    <Pagination page={items} onGo={url => router.get(url, {}, { preserveState: true, preserveScroll: true })} />
                </>
            )}

            {adding && <AddItemModal categories={categories} units={units} onClose={() => setAdding(false)} />}
        </AdminLayout>
    );
}

function AddItemModal({ categories, units, onClose }) {
    const form = useForm({
        item_name: '', category: 'seed', unit: 'bags', quantity: '', min_level: '',
        supplier: '', source: '', unit_cost: '', funding_source: '', expiry_date: '', description: '',
    });

    const submit = e => {
        e.preventDefault();
        form.post('/admin/inventory', {
            onSuccess: () => { toast.success('Item added.'); onClose(); },
            onError: errs => toast.error(Object.values(errs)[0] || 'Could not add this item.'),
        });
    };

    const field = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500';
    const label = 'block text-xs font-medium text-gray-600 mb-1';

    return (
        <ModalShell
            title="Add inventory item"
            size="lg"
            onClose={onClose}
            as="form"
            onSubmit={submit}
            bodyClass="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
            footer={
                <>
                    <button type="button" onClick={onClose}
                        className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={form.processing}
                        className="px-6 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] disabled:opacity-50">
                        {form.processing ? 'Saving…' : 'Add item'}
                    </button>
                </>
            }
        >
            <div className="sm:col-span-2">
                <label className={label}>Item name *</label>
                <input className={field} value={form.data.item_name}
                    onChange={e => form.setData('item_name', e.target.value)} placeholder="e.g. Urea Fertilizer" />
                {form.errors.item_name && <p className="text-xs text-red-600 mt-1">{form.errors.item_name}</p>}
            </div>

            <div>
                <label className={label}>Category *</label>
                <select className={field} value={form.data.category} onChange={e => form.setData('category', e.target.value)}>
                    {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>
            <div>
                <label className={label}>Unit *</label>
                <select className={field} value={form.data.unit} onChange={e => form.setData('unit', e.target.value)}>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
            </div>

            <div>
                <label className={label}>Opening stock</label>
                <input type="number" step="0.01" min="0" className={field} value={form.data.quantity}
                    onChange={e => form.setData('quantity', e.target.value)} />
                <p className="text-[11px] text-gray-400 mt-1">Recorded as an “Opening stock” entry.</p>
            </div>
            <div>
                <label className={label}>Alert below</label>
                <input type="number" step="0.01" min="0" className={field} value={form.data.min_level}
                    onChange={e => form.setData('min_level', e.target.value)} />
                <p className="text-[11px] text-gray-400 mt-1">Flags the item as low stock.</p>
            </div>

            <div>
                <label className={label}>Supplier</label>
                <input className={field} value={form.data.supplier} onChange={e => form.setData('supplier', e.target.value)} />
            </div>
            <div>
                <label className={label}>Source</label>
                <input className={field} value={form.data.source}
                    onChange={e => form.setData('source', e.target.value)} placeholder="DA, LGU, Donation…" />
            </div>

            <div>
                <label className={label}>Unit cost (₱)</label>
                <input type="number" step="0.01" min="0" className={field} value={form.data.unit_cost}
                    onChange={e => form.setData('unit_cost', e.target.value)} />
            </div>
            <div>
                <label className={label}>Funding source</label>
                <input className={field} value={form.data.funding_source}
                    onChange={e => form.setData('funding_source', e.target.value)} />
            </div>

            <div>
                <label className={label}>Expiry date</label>
                <input type="date" className={field} value={form.data.expiry_date}
                    onChange={e => form.setData('expiry_date', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
                <label className={label}>Notes</label>
                <textarea rows={2} className={field} value={form.data.description}
                    onChange={e => form.setData('description', e.target.value)} />
            </div>
        </ModalShell>
    );
}

function Pagination({ page, onGo }) {
    if (!page.last_page || page.last_page <= 1) return null;
    const current = page.current_page, last = page.last_page;
    const around = [current - 1, current, current + 1].filter(n => n > 1 && n < last);
    const numbers = [...new Set([1, ...around, last])].sort((a, b) => a - b);
    const link = n => page.path + '?' + new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(page.first_page_url.split('?')[1] ?? '')), page: n,
    }).toString();

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
            <p className="text-sm text-gray-600">Page {current} of {last}</p>
            <div className="flex items-center gap-1">
                <button onClick={() => page.prev_page_url && onGo(page.prev_page_url)} disabled={!page.prev_page_url}
                    aria-label="Previous page"
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-green-50">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                {numbers.map((n, i) => (
                    <span key={n} className="flex items-center">
                        {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1.5 text-gray-400">…</span>}
                        <button onClick={() => onGo(link(n))}
                            className={`min-w-[2.25rem] px-3 py-2 rounded-lg text-sm font-medium ${
                                n === current ? 'bg-[#006400] text-white' : 'border border-gray-200 text-gray-700 hover:bg-green-50'
                            }`}>{n}</button>
                    </span>
                ))}
                <button onClick={() => page.next_page_url && onGo(page.next_page_url)} disabled={!page.next_page_url}
                    aria-label="Next page"
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-green-50">
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
