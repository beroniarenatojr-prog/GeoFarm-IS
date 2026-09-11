import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Search, Sprout, Beef, Fish, MapPin, ChevronRight, Users, X } from 'lucide-react';

/**
 * Choose whose farm to analyse.
 *
 * This took the Crop Estimator's place in the menu. The estimator asked for a
 * crop and a hectare figure; the office arrives knowing a farmer's name and
 * wanting to know whether that farm is in trouble, so the farmer comes first
 * and everything else follows from the analysis itself.
 *
 * The same four-state colour language as the analysis page, for the same
 * reason: "not assessed" is slate and dashed, never the green of low risk. A
 * farmer nobody has visited must not look like a farmer who is fine.
 */

const RISK = {
    high:     { label: 'High risk',     chip: 'bg-red-100 text-red-800 border-red-200',       dot: 'bg-red-500' },
    moderate: { label: 'Moderate risk', chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
    low:      { label: 'Low risk',      chip: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-600' },
};

const UNASSESSED = {
    label: 'Not assessed',
    chip: 'bg-slate-100 text-slate-700 border-slate-300 border-dashed',
    dot: 'bg-slate-300',
};

export default function FarmIndex({ farmers, filters, barangays = [], upcoming }) {
    const [search, setSearch] = useState(filters.search ?? '');

    const apply = (next) => {
        router.get('/admin/analytics/farms', { ...filters, ...next }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submit = (e) => {
        e.preventDefault();
        apply({ search: search || undefined });
    };

    const clear = () => {
        setSearch('');
        router.get('/admin/analytics/farms', {}, { preserveState: true, replace: true });
    };

    const filtered = filters.search || filters.barangay;

    return (
        <AdminLayout title="Farm Analysis">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
                    <Sprout className="h-6 w-6 text-[#006400]" />
                    Farm Analysis
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Choose a farmer to see their land analysed parcel by parcel — what the records
                    show, why, and what can be done about it.
                    {upcoming?.label && <> Analyses default to the upcoming <strong>{upcoming.label}</strong>.</>}
                </p>
            </div>

            {/* ------------------------------------------------------- filters */}
            <div className="mb-5 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <form onSubmit={submit} className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or RSBSA number…"
                            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                        />
                    </form>

                    <select
                        value={filters.barangay ?? ''}
                        onChange={(e) => apply({ barangay: e.target.value || undefined })}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-transparent focus:ring-2 focus:ring-green-500 sm:min-w-56"
                    >
                        <option value="">All barangays</option>
                        {barangays.map((b) => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>

                    {filtered && (
                        <button
                            type="button"
                            onClick={clear}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white"
                        >
                            <X className="h-4 w-4" />
                            Clear
                        </button>
                    )}
                </div>

                <p className="mt-2 text-xs text-gray-500">
                    Verified farmers only — nothing on a pending registration has been checked yet.
                    Highest risk is listed first.
                </p>
            </div>

            {/* -------------------------------------------------------- results */}
            {farmers.data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
                    <Users className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-3 font-semibold text-gray-900">No farmers to show</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                        {filtered
                            ? 'No verified farmer matches these filters.'
                            : 'Once farmers are verified they appear here, ready to analyse.'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {farmers.data.map((farmer) => {
                        const tone = farmer.assessed ? (RISK[farmer.risk_level] ?? UNASSESSED) : UNASSESSED;

                        return (
                            <Link
                                key={farmer.id}
                                href={`/admin/farmers/${farmer.id}/analysis`}
                                className="group flex flex-col rounded-2xl border border-green-100 bg-white p-4 shadow-sm transition hover:border-[#006400]/30 hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-gray-900">{farmer.name}</p>
                                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                                            <MapPin className="h-3 w-3 flex-none" />
                                            {farmer.barangay || 'No barangay'}
                                            {farmer.rsbsa_no && ` • ${farmer.rsbsa_no}`}
                                        </p>
                                    </div>

                                    <span className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone.chip}`}>
                                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                                        {tone.label}
                                        {farmer.assessed && farmer.risk_score !== null && ` · ${farmer.risk_score}`}
                                    </span>
                                </div>

                                {/* What there is to analyse. Livestock and ponds
                                    are counted even though they carry no history —
                                    they are part of the farm either way. */}
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                                    <span className="inline-flex items-center gap-1">
                                        <Sprout className="h-3.5 w-3.5 text-green-700" />
                                        {farmer.crop_parcels} crop
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Beef className="h-3.5 w-3.5 text-amber-700" />
                                        {farmer.livestock_parcels} livestock
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Fish className="h-3.5 w-3.5 text-sky-700" />
                                        {farmer.fishponds} pond{farmer.fishponds === 1 ? '' : 's'}
                                    </span>
                                </div>

                                {farmer.is_stale && (
                                    <p className="mt-2 text-[11px] font-semibold text-amber-700">
                                        Assessment is over a year old
                                    </p>
                                )}

                                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#006400] group-hover:underline">
                                    Analyse farm
                                    <ChevronRight className="h-4 w-4" />
                                </span>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* ----------------------------------------------------- pagination */}
            {farmers.last_page > 1 && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                    {farmers.links.map((link, i) => (
                        <button
                            key={i}
                            type="button"
                            disabled={!link.url}
                            onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                            className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                link.active
                                    ? 'bg-[#006400] text-white'
                                    : link.url
                                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        : 'cursor-not-allowed border border-gray-200 text-gray-300'
                            }`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </div>
            )}
        </AdminLayout>
    );
}
