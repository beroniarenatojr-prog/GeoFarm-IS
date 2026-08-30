import AdminLayout from '@/Layouts/AdminLayout';
import { router, Link } from '@inertiajs/react';
import { useState } from 'react';
import {
    Sprout, TreePine, Fish, Beef, Search, X, Users, Ruler, FileDown, Layers,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

const TABS = [
    { key: 'crops', label: 'Crops', icon: Sprout },
    { key: 'standing', label: 'Tree Crops & Fishponds', icon: TreePine },
    { key: 'livestock', label: 'Livestock & Poultry', icon: Beef },
];

const num = (v, dp = 0) =>
    Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp });

function Stat({ icon: Icon, value, label, tone }) {
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
                </div>
            </div>
        </div>
    );
}

function Empty({ icon: Icon, text }) {
    return (
        <div className="py-16 text-center">
            <Icon className="mx-auto mb-3 h-10 w-10 text-green-200" />
            <p className="text-sm text-gray-500">{text}</p>
        </div>
    );
}

/** Table on desktop, stacked cards below lg. */
function DataBlock({ columns, rows, renderCard, empty }) {
    if (!rows || rows.length === 0) return empty;

    return (
        <>
            <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#006400] text-white text-left">
                        <tr>
                            {columns.map(c => (
                                <th key={c.key}
                                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                        {rows.map((r, i) => (
                            <tr key={i} className="hover:bg-green-50/60 transition-colors">
                                {columns.map(c => (
                                    <td key={c.key}
                                        className={`px-4 py-3 ${c.align === 'right' ? 'text-right tabular-nums font-semibold text-[#006400]' : 'text-gray-700'}`}>
                                        {c.render(r)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="lg:hidden divide-y divide-green-50">
                {rows.map((r, i) => <div key={i} className="py-3">{renderCard(r)}</div>)}
            </div>
        </>
    );
}

export default function FarmInventoryIndex({
    farmers, farmerSearch, farmerCount, selectedFarmer, inventory, selectedFarmerId, summary,
}) {
    const { can } = usePermissions();
    const [tab, setTab] = useState('crops');
    const [picker, setPicker] = useState(false);
    const [term, setTerm] = useState(farmerSearch ?? '');

    const choose = (id) => {
        setPicker(false);
        router.get('/admin/farm-inventory', { farmer_id: id }, { preserveState: false });
    };

    const searchFarmers = (value) => {
        setTerm(value);
        router.get('/admin/farm-inventory',
            { farmer_id: selectedFarmerId, farmer_search: value },
            { preserveState: true, preserveScroll: true, replace: true, only: ['farmers', 'farmerSearch'] });
    };

    const aggregated = !selectedFarmer;
    const crops = inventory?.crops ?? [];
    const treeCrops = inventory?.tree_crops ?? [];
    const fishponds = inventory?.fishponds ?? [];
    const livestock = inventory?.livestock ?? [];

    const seasonChip = s => (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
            s === 'dry' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
        }`}>{s}</span>
    );

    return (
        <AdminLayout title="Farm Inventory">
            {/* Who we are looking at */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mb-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">Showing inventory for</p>
                        <h2 className="text-lg font-bold text-gray-900 truncate">
                            {aggregated
                                ? `All farmers — combined`
                                : `${selectedFarmer.last_name}, ${selectedFarmer.first_name}`}
                        </h2>
                        <p className="text-xs text-gray-500">
                            {aggregated
                                ? `Totals across ${num(farmerCount)} registered farmers`
                                : (selectedFarmer.rsbsa_no ? `RSBSA ${selectedFarmer.rsbsa_no}` : 'No RSBSA number')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {!aggregated && (
                            <>
                                <Link href={`/admin/farmers/${selectedFarmer.id}`}
                                    className="px-4 py-2 rounded-xl border border-green-200 text-[#006400] text-sm font-semibold hover:bg-green-50 transition-colors">
                                    View profile
                                </Link>
                                {can('export reports') && (
                                    <a href={`/admin/farm-inventory/${selectedFarmer.id}/export`}
                                        title="Export CSV" aria-label="Export CSV"
                                        className="p-2.5 rounded-xl border border-green-200 text-[#006400] hover:bg-green-50 transition-colors">
                                        <FileDown className="h-5 w-5" />
                                    </a>
                                )}
                                <button onClick={() => choose('all')}
                                    className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                                    title="Back to all farmers" aria-label="Back to all farmers">
                                    <X className="h-5 w-5" />
                                </button>
                            </>
                        )}
                        <button onClick={() => setPicker(p => !p)}
                            className="px-5 py-2.5 rounded-xl bg-[#006400] text-white text-sm font-semibold hover:bg-[#228B22] transition-colors whitespace-nowrap">
                            {aggregated ? 'Pick a farmer' : 'Change farmer'}
                        </button>
                    </div>
                </div>

                {picker && (
                    <div className="mt-4 border-t border-green-50 pt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                autoFocus
                                value={term}
                                onChange={e => searchFarmers(e.target.value)}
                                placeholder="Type a surname or RSBSA number…"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>

                        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                            <button onClick={() => choose('all')}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-green-50 transition-colors">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                                    <Users className="h-4 w-4 text-[#006400]" />
                                </span>
                                <span className="text-sm font-semibold text-gray-900">All farmers — combined</span>
                            </button>

                            {farmers.map(f => (
                                <button key={f.id} onClick={() => choose(f.id)}
                                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-green-50 transition-colors">
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-gray-900 truncate">{f.label}</span>
                                        <span className="block text-xs text-gray-500">{f.meta}</span>
                                    </span>
                                </button>
                            ))}

                            {farmers.length === 0 && (
                                <p className="px-3 py-6 text-center text-sm text-gray-500">No farmers match “{term}”.</p>
                            )}
                        </div>

                        <p className="mt-2 text-xs text-gray-400">
                            Showing up to 50 matches of {num(farmerCount)} farmers. Keep typing to narrow it down.
                        </p>
                    </div>
                )}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <Stat icon={Ruler} tone="#006400" value={num(summary?.crop_area, 2)} label="Hectares planted" />
                <Stat icon={Sprout} tone="#228B22" value={num(summary?.crop_types)} label="Crop types" />
                <Stat icon={TreePine} tone="#4CAF50" value={num(summary?.trees)} label="Trees" />
                <Stat icon={Beef} tone="#81C784" value={num(summary?.animals)} label="Animals" />
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
                <div className="flex overflow-x-auto border-b border-green-100">
                    {TABS.map(t => {
                        const active = tab === t.key;
                        const count = t.key === 'crops' ? crops.length
                            : t.key === 'standing' ? treeCrops.length + fishponds.length
                            : livestock.length;

                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                    active
                                        ? 'border-[#006400] text-[#006400] bg-green-50/60'
                                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                }`}>
                                <t.icon className="h-4 w-4" />
                                {t.label}
                                <span className={`px-1.5 py-0.5 rounded-full text-[11px] ${
                                    active ? 'bg-[#006400] text-white' : 'bg-gray-100 text-gray-500'
                                }`}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 sm:p-5">
                    {tab === 'crops' && (
                        <DataBlock
                            columns={[
                                { key: 'crop', label: 'Crop', render: r => <span className="font-medium text-gray-900">{r.crop?.crop_name ?? '—'}</span> },
                                { key: 'season', label: 'Season', render: r => seasonChip(r.season) },
                                { key: 'year', label: 'Year', render: r => r.cropping_year },
                                ...(aggregated ? [{ key: 'parcels', label: 'Parcels', render: r => r.parcel_count ?? '—' }] : []),
                                { key: 'area', label: 'Area (ha)', align: 'right', render: r => num(r.total_area, 2) },
                            ]}
                            rows={crops}
                            renderCard={r => (
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900">{r.crop?.crop_name ?? '—'}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                            {seasonChip(r.season)} {r.cropping_year}
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-lg bg-green-50 text-[#006400] font-bold text-sm tabular-nums whitespace-nowrap">
                                        {num(r.total_area, 2)} ha
                                    </span>
                                </div>
                            )}
                            empty={<Empty icon={Sprout} text="No cropping seasons recorded" />}
                        />
                    )}

                    {tab === 'standing' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-[#006400] uppercase tracking-wide mb-2">Tree Crops</h3>
                                <DataBlock
                                    columns={[
                                        { key: 'type', label: 'Crop', render: r => <span className="font-medium text-gray-900">{r.crop_type ?? '—'}</span> },
                                        ...(aggregated ? [{ key: 'farmers', label: 'Farmers', render: r => r.farmer_count ?? '—' }] : []),
                                        { key: 'qty', label: 'Trees', align: 'right', render: r => num(r.total_quantity) },
                                        { key: 'area', label: 'Area (ha)', align: 'right', render: r => num(r.total_area, 2) },
                                    ]}
                                    rows={treeCrops}
                                    renderCard={r => (
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-semibold text-gray-900 min-w-0 truncate">{r.crop_type ?? '—'}</p>
                                            <span className="text-sm tabular-nums text-[#006400] font-bold whitespace-nowrap">
                                                {num(r.total_quantity)} trees · {num(r.total_area, 2)} ha
                                            </span>
                                        </div>
                                    )}
                                    empty={<Empty icon={TreePine} text="No tree crops recorded" />}
                                />
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-[#006400] uppercase tracking-wide mb-2">Fishponds</h3>
                                <DataBlock
                                    columns={[
                                        { key: 'species', label: 'Species', render: r => <span className="font-medium text-gray-900">{r.species ?? '—'}</span> },
                                        ...(aggregated ? [{ key: 'farmers', label: 'Farmers', render: r => r.farmer_count ?? '—' }] : []),
                                        { key: 'area', label: 'Area (ha)', align: 'right', render: r => num(r.total_area, 2) },
                                    ]}
                                    rows={fishponds}
                                    renderCard={r => (
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-semibold text-gray-900 min-w-0 truncate">{r.species ?? '—'}</p>
                                            <span className="text-sm tabular-nums text-[#006400] font-bold whitespace-nowrap">
                                                {num(r.total_area, 2)} ha
                                            </span>
                                        </div>
                                    )}
                                    empty={<Empty icon={Fish} text="No fishponds recorded" />}
                                />
                            </div>
                        </div>
                    )}

                    {tab === 'livestock' && (
                        <DataBlock
                            columns={[
                                { key: 'type', label: 'Animal', render: r => <span className="font-medium text-gray-900">{r.type ?? '—'}</span> },
                                { key: 'cat', label: 'Category', render: r => (
                                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
                                        {r.category ?? '—'}
                                    </span>
                                ) },
                                ...(aggregated ? [{ key: 'farmers', label: 'Farmers', render: r => r.farmer_count ?? '—' }] : []),
                                { key: 'male', label: 'Male', align: 'right', render: r => num(r.male) },
                                { key: 'female', label: 'Female', align: 'right', render: r => num(r.female) },
                                { key: 'total', label: 'Total heads', align: 'right', render: r => num(r.total) },
                            ]}
                            rows={livestock}
                            renderCard={r => (
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{r.type ?? '—'}</p>
                                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
                                                {r.category ?? '—'}
                                            </span>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-lg bg-green-50 text-[#006400] font-bold text-sm tabular-nums whitespace-nowrap">
                                            {num(r.total)} head
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {num(r.male)} male · {num(r.female)} female
                                    </p>
                                </div>
                            )}
                            empty={<Empty icon={Beef} text="No livestock or poultry recorded" />}
                        />
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
