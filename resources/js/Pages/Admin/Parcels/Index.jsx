import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import ModalShell from '@/Components/ui/ModalShell';
import ParcelForm from './Form';
import {
    Plus, Search, MapPin, Map, Ruler, X, Edit3, Trash2,
    ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';

const PER_PAGE = [25, 50, 100];
const OWNERSHIP = ['Registered Owner', 'Lessee', 'Tenant', 'Other'];

function SortHeader({ column, label, sort, onSort, className = '' }) {
    const active = sort.column === column;
    const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;

    return (
        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${className}`}>
            <button type="button" onClick={() => onSort(column)}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
                title={`Sort by ${label}`}>
                {label}
                <Icon className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-40'}`} />
            </button>
        </th>
    );
}

const select = 'px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none';

/**
 * Add / edit a parcel without leaving the list.
 *
 * Editing fetches first: the boundary is derived from the spatial column with
 * ST_AsGeoJSON and is not part of a list row, so opening the form straight from
 * the table would show an empty map for a parcel that already has one.
 */
function ParcelModal({ editing, farmTypes, onClose }) {
    const isEdit = editing.mode === 'edit';
    const [loaded, setLoaded] = useState(isEdit ? null : { parcel: null, geojson: null });
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!isEdit) return;

        let cancelled = false;

        fetch(`/admin/parcels/${editing.id}/edit-data`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
            .then(data => { if (!cancelled) setLoaded(data); })
            .catch(() => { if (!cancelled) setFailed(true); });

        return () => { cancelled = true; };
    }, [isEdit, editing.id]);

    return (
        <ModalShell
            title={isEdit ? 'Edit farm parcel' : 'Add farm parcel'}
            size="xl"
            onClose={onClose}
            bodyClass="px-5 py-4"
        >
            {failed && (
                <p className="py-10 text-center text-sm text-red-600">
                    Could not load this parcel. Close and try again.
                </p>
            )}

            {!failed && !loaded && (
                <p className="py-10 text-center text-sm text-gray-500">Loading parcel…</p>
            )}

            {!failed && loaded && (
                <ParcelForm
                    parcel={loaded.parcel}
                    geojson={loaded.geojson}
                    farmTypes={farmTypes}
                    onClose={onClose}
                />
            )}
        </ModalShell>
    );
}

export default function ParcelsIndex({ parcels, filters, barangays, farmTypes, sort, perPage, summary }) {
    const { can } = usePermissions();
    const [search, setSearch] = useState(filters.search ?? '');

    // { mode: 'new' } or { mode: 'edit', id } — null when the modal is closed.
    const [editing, setEditing] = useState(null);

    const go = (params = {}) => router.get('/admin/parcels',
        {
            search, barangay: filters.barangay ?? '', farm_type_id: filters.farm_type_id ?? '',
            ownership: filters.ownership ?? '', mapped: filters.mapped ?? '',
            sort: sort.column, direction: sort.direction, per_page: perPage, ...params,
        },
        { preserveState: true, preserveScroll: true, replace: true },
    );

    const onSort = (column) => go({
        sort: column,
        direction: sort.column === column && sort.direction === 'asc' ? 'desc' : 'asc',
        page: 1,
    });

    const activeFilters = ['search', 'barangay', 'farm_type_id', 'ownership', 'mapped']
        .filter(k => filters[k]).length;

    const clearFilters = () => {
        setSearch('');
        router.get('/admin/parcels', {}, { preserveState: true, replace: true });
    };

    const destroy = (parcel) => {
        if (!confirm(`Delete parcel ${parcel.parcel_number || '(no number)'}? This cannot be undone.`)) return;
        router.delete(`/admin/parcels/${parcel.id}`, {
            preserveScroll: true,
            onSuccess: () => toast.success('Parcel deleted.'),
            onError: () => toast.error('Could not delete this parcel.'),
        });
    };

    const rows = parcels.data ?? [];
    const owner = f => f ? [f.last_name, f.first_name].filter(Boolean).join(', ') : '—';

    return (
        <AdminLayout title="Farm Parcel Management">
            {/* Totals for the current filter */}
            <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                    { label: 'Parcels', value: (summary?.parcels ?? 0).toLocaleString('en-PH'), icon: MapPin, tone: '#006400' },
                    { label: 'Hectares', value: (summary?.hectares ?? 0).toLocaleString('en-PH'), icon: Ruler, tone: '#228B22' },
                    { label: 'With a map drawn', value: `${summary?.mapped ?? 0} of ${summary?.parcels ?? 0}`, icon: Map, tone: '#4CAF50' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
                        <div className="flex items-center gap-3">
                            <span className="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                                style={{ backgroundColor: s.tone }}>
                                <s.icon className="h-5 w-5 text-white" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{s.value}</p>
                                <p className="text-xs text-gray-500">{s.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mb-5">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && go({ page: 1 })}
                            placeholder="Search parcel no., farmer, RSBSA, or commodity…"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <button onClick={() => go({ page: 1 })}
                        className="px-6 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] transition-colors whitespace-nowrap">
                        Search
                    </button>
                    {can('create parcels') && (
                        <button type="button" onClick={() => setEditing({ mode: 'new' })}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] transition-colors whitespace-nowrap">
                            <Plus className="h-4 w-4" /> Add Parcel
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                    <select className={select} value={filters.barangay ?? ''}
                        onChange={e => go({ barangay: e.target.value, page: 1 })}>
                        <option value="">All barangays</option>
                        {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    <select className={select} value={filters.farm_type_id ?? ''}
                        onChange={e => go({ farm_type_id: e.target.value, page: 1 })}>
                        <option value="">All farm types</option>
                        {farmTypes.map(t => <option key={t.id} value={t.id}>{t.type_name}</option>)}
                    </select>

                    <select className={select} value={filters.ownership ?? ''}
                        onChange={e => go({ ownership: e.target.value, page: 1 })}>
                        <option value="">Any ownership</option>
                        {OWNERSHIP.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>

                    <select className={select} value={filters.mapped ?? ''}
                        onChange={e => go({ mapped: e.target.value, page: 1 })}>
                        <option value="">Mapped or not</option>
                        <option value="yes">Has a map drawn</option>
                        <option value="no">Not yet mapped</option>
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-600">
                    <span>
                        {parcels.total > 0
                            ? <>Showing <b className="text-gray-900">{parcels.from}–{parcels.to}</b> of <b className="text-gray-900">{parcels.total.toLocaleString('en-PH')}</b></>
                            : 'No parcels match'}
                    </span>
                    {activeFilters > 0 && (
                        <button onClick={clearFilters} className="inline-flex items-center gap-1 text-[#006400] hover:underline">
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
                    <MapPin className="mx-auto h-12 w-12 text-green-200 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No parcels found</h3>
                    <p className="text-sm text-gray-500">
                        {activeFilters > 0 ? 'Try clearing some filters.' : 'Add the first farm parcel to get started.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop */}
                    <div className="hidden lg:block bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#006400] text-white text-left">
                                    <tr>
                                        <SortHeader column="parcel_number" label="Parcel #" sort={sort} onSort={onSort} />
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Farmer</th>
                                        <SortHeader column="barangay" label="Barangay" sort={sort} onSort={onSort} />
                                        <SortHeader column="total_area_ha" label="Area (ha)" sort={sort} onSort={onSort} className="text-right" />
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Commodity</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Ownership</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-center">Map</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-green-50">
                                    {rows.map(p => (
                                        <tr key={p.id} className="hover:bg-green-50/60 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.parcel_number || '—'}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-gray-900">{owner(p.farmer)}</p>
                                                {p.farmer?.rsbsa_no && <p className="text-xs font-mono text-gray-500">{p.farmer.rsbsa_no}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">{p.barangay || '—'}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-[#006400] tabular-nums">
                                                {p.total_area_ha != null ? Number(p.total_area_ha).toFixed(2) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                {p.commodity || <span className="text-gray-400">—</span>}
                                                {p.no_of_heads_trees > 0 && (
                                                    <span className="ml-1 text-xs text-gray-500">({p.no_of_heads_trees})</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">{p.farm_type?.type_name || '—'}</td>
                                            <td className="px-4 py-3 text-gray-700">{p.ownership_type || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                    p.geojson_data ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {p.geojson_data ? 'Mapped' : 'None'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Offered only when there is a boundary to look at: a map link
                                                        that opens on empty ground is worse than no link. */}
                                                    {p.geojson_data && can('view maps') && (
                                                        <a href={`/admin/gis/map?parcel=${p.id}`} title="View on map"
                                                            className="p-2 text-[#006400] hover:bg-green-100 rounded-lg transition-colors">
                                                            <Map className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                    {can('edit parcels') && (
                                                        <button type="button" onClick={() => setEditing({ mode: 'edit', id: p.id })} title="Edit"
                                                            className="p-2 text-[#006400] hover:bg-green-100 rounded-lg transition-colors">
                                                            <Edit3 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {can('delete parcels') && (
                                                        <button onClick={() => destroy(p)} title="Delete"
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile / tablet */}
                    <div className="lg:hidden space-y-3">
                        {rows.map(p => (
                            <div key={p.id} className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{owner(p.farmer)}</p>
                                        <p className="text-xs font-mono text-gray-500 mt-0.5">
                                            Parcel {p.parcel_number || '—'}
                                        </p>
                                    </div>
                                    <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-green-50 text-[#006400] font-bold text-sm tabular-nums">
                                        {p.total_area_ha != null ? `${Number(p.total_area_ha).toFixed(2)} ha` : '—'}
                                    </span>
                                </div>

                                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Barangay</dt>
                                        <dd className="text-gray-800">{p.barangay || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Type</dt>
                                        <dd className="text-gray-800">{p.farm_type?.type_name || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Commodity</dt>
                                        <dd className="text-gray-800">
                                            {p.commodity || '—'}
                                            {p.no_of_heads_trees > 0 && (
                                                <span className="ml-1 text-xs text-gray-500">({p.no_of_heads_trees})</span>
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Ownership</dt>
                                        <dd className="text-gray-800">{p.ownership_type || '—'}</dd>
                                    </div>
                                </dl>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-green-50">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                        p.geojson_data ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {p.geojson_data ? 'Mapped' : 'Not yet mapped'}
                                    </span>
                                    <div className="flex gap-1">
                                        {p.geojson_data && can('view maps') && (
                                            <a href={`/admin/gis/map?parcel=${p.id}`} aria-label="View on map"
                                                className="p-2 text-[#006400] bg-green-50 rounded-lg"><Map className="h-4 w-4" /></a>
                                        )}
                                        {can('edit parcels') && (
                                            <button type="button" onClick={() => setEditing({ mode: 'edit', id: p.id })} aria-label="Edit"
                                                className="p-2 text-[#006400] bg-green-50 rounded-lg"><Edit3 className="h-4 w-4" /></button>
                                        )}
                                        {can('delete parcels') && (
                                            <button onClick={() => destroy(p)} aria-label="Delete"
                                                className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Pagination page={parcels} onGo={url => router.get(url, {}, { preserveState: true, preserveScroll: true })} />
                </>
            )}

            {editing && (
                <ParcelModal
                    key={editing.mode === 'edit' ? editing.id : 'new'}
                    editing={editing}
                    farmTypes={farmTypes}
                    onClose={() => setEditing(null)}
                />
            )}
        </AdminLayout>
    );
}

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
                <button onClick={() => page.prev_page_url && onGo(page.prev_page_url)} disabled={!page.prev_page_url}
                    aria-label="Previous page"
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-50">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                {numbers.map((n, i) => (
                    <span key={n} className="flex items-center">
                        {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1.5 text-gray-400">…</span>}
                        <button onClick={() => onGo(link(n))}
                            className={`min-w-[2.25rem] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                n === current ? 'bg-[#006400] text-white' : 'border border-gray-200 text-gray-700 hover:bg-green-50'
                            }`}>
                            {n}
                        </button>
                    </span>
                ))}
                <button onClick={() => page.next_page_url && onGo(page.next_page_url)} disabled={!page.next_page_url}
                    aria-label="Next page"
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-50">
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
