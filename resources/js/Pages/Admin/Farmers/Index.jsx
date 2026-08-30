import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { useState, useRef } from 'react';
import {
    Plus, Search, Upload, FileDown, Eye, Edit3, Users, X,
    ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

const PER_PAGE = [25, 50, 100];

/** Server-side sortable column header. */
function SortHeader({ column, label, sort, onSort, className = '' }) {
    const active = sort.column === column;
    const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;

    return (
        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${className}`}>
            <button
                type="button"
                onClick={() => onSort(column)}
                className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
                title={`Sort by ${label}`}
            >
                {label}
                <Icon className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-40'}`} />
            </button>
        </th>
    );
}

function YesNo({ value }) {
    return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
            value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
        }`}>
            {value ? 'YES' : 'NO'}
        </span>
    );
}

export default function FarmersIndex({ farmers, filters, barangays, sort, perPage, pendingCount }) {
    const { can } = usePermissions();
    const [search, setSearch] = useState(filters.search ?? '');
    const [barangay, setBarangay] = useState(filters.barangay ?? '');
    const fileInputRef = useRef(null);

    // Every list control goes back to the server; nothing is filtered in the
    // browser, so results always reflect the whole registry.
    const go = (params = {}) => router.get('/admin/farmers',
        { search, barangay, sort: sort.column, direction: sort.direction, per_page: perPage, ...params },
        { preserveState: true, preserveScroll: true, replace: true },
    );

    const onSort = (column) => go({
        sort: column,
        direction: sort.column === column && sort.direction === 'asc' ? 'desc' : 'asc',
        page: 1,
    });

    const clearFilters = () => {
        setSearch('');
        setBarangay('');
        router.get('/admin/farmers', {}, { preserveState: true, replace: true });
    };

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        router.post('/admin/farmers/import', formData, {
            onSuccess: () => { toast.success('Farmers imported.'); fileInputRef.current.value = ''; },
            onError: errs => { toast.error(errs.file || 'Import failed'); fileInputRef.current.value = ''; },
        });
    };

    const rows = farmers.data ?? [];
    const hasFilters = Boolean(filters.search || filters.barangay);
    const fullName = f => [f.first_name, f.middle_name, f.last_name, f.suffix].filter(Boolean).join(' ');

    return (
        <AdminLayout title="Farmer Registry">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mb-5">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && go({ page: 1 })}
                            placeholder="Search name, RSBSA number, or mobile…"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                    </div>

                    <select
                        value={barangay}
                        onChange={e => { setBarangay(e.target.value); go({ barangay: e.target.value, page: 1 }); }}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    >
                        <option value="">All barangays</option>
                        {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    <button
                        onClick={() => go({ page: 1 })}
                        className="px-6 py-2.5 bg-[#006400] text-white rounded-xl text-sm font-semibold hover:bg-[#228B22] transition-colors whitespace-nowrap"
                    >
                        Search
                    </button>

                    <div className="flex items-center gap-2 lg:ml-auto">
                        {can('export reports') && (
                            <button onClick={() => { window.location.href = '/admin/farmers/export'; }}
                                title="Export CSV" aria-label="Export CSV"
                                className="flex items-center justify-center p-2.5 bg-white border border-green-200 text-[#006400] rounded-xl hover:bg-green-50 transition-colors">
                                <FileDown className="h-5 w-5" />
                            </button>
                        )}
                        {can('create farmers') && (
                            <>
                                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleImport} className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()}
                                    title="Import CSV" aria-label="Import CSV"
                                    className="flex items-center justify-center p-2.5 bg-white border border-green-200 text-[#006400] rounded-xl hover:bg-green-50 transition-colors">
                                    <Upload className="h-5 w-5" />
                                </button>
                                <Link href="/admin/farmers/create"
                                    title="Add New Farmer" aria-label="Add New Farmer"
                                    className="flex items-center justify-center p-2.5 bg-[#006400] text-white rounded-xl hover:bg-[#228B22] transition-colors">
                                    <Plus className="h-5 w-5" />
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Result count + active filters. At 8,000 records people need to
                    know how much they are looking at. */}
                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-600">
                    <span>
                        {farmers.total > 0
                            ? <>Showing <b className="text-gray-900">{farmers.from}–{farmers.to}</b> of <b className="text-gray-900">{farmers.total.toLocaleString('en-PH')}</b> farmers</>
                            : 'No farmers match'}
                    </span>

                    {hasFilters && (
                        <button onClick={clearFilters} className="inline-flex items-center gap-1 text-[#006400] hover:underline">
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </button>
                    )}

                    <label className="ml-auto flex items-center gap-2 text-xs">
                        Rows
                        <select
                            value={perPage}
                            onChange={e => go({ per_page: e.target.value, page: 1 })}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-green-500"
                        >
                            {PER_PAGE.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="bg-white rounded-2xl border border-green-100 shadow-sm py-20 text-center">
                    <Users className="mx-auto h-12 w-12 text-green-200 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No farmers found</h3>
                    <p className="text-sm text-gray-500">
                        {hasFilters ? 'Try a different search or barangay.' : 'Add the first farmer to get started.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* ---- Desktop: table ---- */}
                    <div className="hidden lg:block bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#006400] text-white text-left">
                                    <tr>
                                        <SortHeader column="rsbsa_no" label="RSBSA No." sort={sort} onSort={onSort} />
                                        <SortHeader column="last_name" label="Name" sort={sort} onSort={onSort} />
                                        <SortHeader column="barangay" label="Barangay" sort={sort} onSort={onSort} />
                                        <SortHeader column="birthdate" label="Birthdate" sort={sort} onSort={onSort} />
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Sex</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Contact</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-center">4Ps</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-center">IP</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-center">PWD</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-green-50">
                                    {rows.map(f => (
                                        <tr key={f.id} className="hover:bg-green-50/60 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{f.rsbsa_no || '—'}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-gray-900">{f.last_name}, {f.first_name}</p>
                                                <p className="text-xs text-gray-500">{[f.middle_name, f.suffix].filter(Boolean).join(' ') || '—'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{f.barangay || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.birthdate ? formatDate(f.birthdate, 'date-only') : '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">{f.sex || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.mobile_no || '—'}</td>
                                            <td className="px-4 py-3 text-center"><YesNo value={f.is_4ps} /></td>
                                            <td className="px-4 py-3 text-center"><YesNo value={f.is_indigenous} /></td>
                                            <td className="px-4 py-3 text-center"><YesNo value={f.pwd} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {can('view farmers') && (
                                                        <Link href={`/admin/farmers/${f.id}`} title="View"
                                                            className="p-2 text-[#006400] hover:bg-green-100 rounded-lg transition-colors">
                                                            <Eye className="h-4 w-4" />
                                                        </Link>
                                                    )}
                                                    {can('edit farmers') && (
                                                        <Link href={`/admin/farmers/${f.id}/edit`} title="Edit"
                                                            className="p-2 text-[#006400] hover:bg-green-100 rounded-lg transition-colors">
                                                            <Edit3 className="h-4 w-4" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ---- Mobile / tablet: cards ---- */}
                    <div className="lg:hidden space-y-3">
                        {rows.map(f => (
                            <div key={f.id} className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{fullName(f)}</p>
                                        <p className="text-xs font-mono text-gray-500 mt-0.5">{f.rsbsa_no || 'No RSBSA number'}</p>
                                    </div>
                                    <div className="flex flex-shrink-0 gap-1">
                                        {can('view farmers') && (
                                            <Link href={`/admin/farmers/${f.id}`} aria-label="View"
                                                className="p-2 text-[#006400] bg-green-50 rounded-lg"><Eye className="h-4 w-4" /></Link>
                                        )}
                                        {can('edit farmers') && (
                                            <Link href={`/admin/farmers/${f.id}/edit`} aria-label="Edit"
                                                className="p-2 text-[#006400] bg-green-50 rounded-lg"><Edit3 className="h-4 w-4" /></Link>
                                        )}
                                    </div>
                                </div>

                                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Barangay</dt>
                                        <dd className="text-gray-800">{f.barangay || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Contact</dt>
                                        <dd className="text-gray-800">{f.mobile_no || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Birthdate</dt>
                                        <dd className="text-gray-800">{f.birthdate ? formatDate(f.birthdate, 'date-only') : '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">Sex</dt>
                                        <dd className="text-gray-800">{f.sex || '—'}</dd>
                                    </div>
                                </dl>

                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {f.is_4ps && <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-800">4Ps</span>}
                                    {f.is_indigenous && <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">IP</span>}
                                    {f.pwd && <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-lime-100 text-lime-800">PWD</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Pagination page={farmers} onGo={url => router.get(url, {}, { preserveState: true, preserveScroll: true })} />
                </>
            )}
        </AdminLayout>
    );
}

/**
 * Page numbers with ellipses. At 8,000 farmers there can be 320 pages, so
 * rendering every link (as Laravel's default does) is unusable.
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
