import AdminLayout from '@/Layouts/AdminLayout';
import { router, Link } from '@inertiajs/react';
import { useState } from 'react';
import {
    Sprout, TreePine, Fish, Beef, Search, X, Users, Ruler, FileDown, Layers,
    Tractor, Plus, Pencil, Trash2, Printer,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';
import AssetModal from '@/Components/FarmInventory/AssetModal';

const TABS = [
    { key: 'crops', label: 'Crops', icon: Sprout },
    { key: 'standing', label: 'Tree Crops & Fishponds', icon: TreePine },
    { key: 'livestock', label: 'Livestock & Poultry', icon: Beef },
    { key: 'machinery', label: 'Machinery', icon: Tractor },
];

const HEALTH_TONE = {
    healthy: 'bg-green-100 text-green-800',
    vaccinated: 'bg-blue-100 text-blue-800',
    treated: 'bg-amber-100 text-amber-800',
    sick: 'bg-red-100 text-red-800',
};

const MACHINE_TONE = {
    active: 'bg-green-100 text-green-800',
    for_repair: 'bg-amber-100 text-amber-800',
    decommissioned: 'bg-gray-200 text-gray-600',
};

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

/** Row-level edit/delete, shown only when a single farmer is in scope. */
function RowActions({ onEdit, onDelete }) {
    return (
        <div className="flex items-center justify-end gap-1.5">
            <button type="button" onClick={onEdit} title="Edit"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onDelete} title="Remove"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

function AddButton({ label, onClick }) {
    return (
        <button type="button" onClick={onClick}
            className="inline-flex items-center gap-1 rounded-lg bg-[#006400] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#228B22]">
            <Plus className="h-3.5 w-3.5" /> {label}
        </button>
    );
}

function SectionHead({ title, action }) {
    return (
        <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#006400]">{title}</h3>
            {action}
        </div>
    );
}

/**
 * One asset category, as its own card.
 *
 * These used to be tabs. Staff answering "what does this farmer have?" had to
 * click through four of them and hold the answer in their head, so every
 * category is now on the page at once and the question is answered by
 * scrolling.
 */
function Panel({ icon: Icon, title, count, action, children }) {
    return (
        <section className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b border-green-100 bg-green-50/40 px-4 sm:px-5 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#006400]">
                    <Icon className="h-4 w-4 text-white" />
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#006400]">{title}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500 border border-green-100">
                    {count}
                </span>
                {action && <div className="ml-auto flex flex-wrap items-center gap-2">{action}</div>}
            </header>
            <div className="p-4 sm:p-5">{children}</div>
        </section>
    );
}

/**
 * Deleting an asset is irreversible and there is no audit trail behind these
 * tables, so the record is spelled out before it goes rather than hidden
 * behind a browser confirm() that says only "Are you sure?".
 */
function DeleteDialog({ target, onCancel, onConfirm, busy }) {
    return (
        <ModalShell title="Delete this record?" size="sm" onClose={onCancel}
            footer={
                <>
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} disabled={busy}
                        className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                        {busy ? 'Deleting…' : 'Delete'}
                    </button>
                </>
            }
        >
            <div className="px-5 py-4">
                <p className="text-sm text-gray-600">
                    This will remove the following {target.what} from the farmer&rsquo;s record.
                </p>
                <dl className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                    {target.details.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 py-0.5">
                            <dt className="text-gray-500">{k}</dt>
                            <dd className="font-semibold text-gray-900 text-right">{v}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-3 text-xs font-semibold text-red-600">This action cannot be undone.</p>
            </div>
        </ModalShell>
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
    parcels = [], cropOptions = [],
}) {
    const { can } = usePermissions();
    const [picker, setPicker] = useState(false);
    const [term, setTerm] = useState(farmerSearch ?? '');
    // { category, record } — record is null when adding.
    const [asset, setAsset] = useState(null);
    // { category, id, what, details } while a delete is awaiting confirmation.
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

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
    const machinery = inventory?.machinery ?? [];

    // Records belong to one farmer, so editing only makes sense once a farmer
    // is chosen — the combined view has nothing individual to change.
    const editable = !aggregated && can('edit inventory');
    const addable = !aggregated && can('create inventory');

    // Cropping seasons belong to the Seasonal Tracking module and are governed
    // by its own permissions, not the inventory ones.
    const cropsEditable = !aggregated && can('edit seasonal');
    const cropsAddable = !aggregated && can('create seasonal') && parcels.length > 0;

    /** Crops carry their own actions column because of that permission split. */
    const cropActionsCol = cropsEditable ? [{
        key: 'actions', label: '', align: 'right',
        render: r => (
            <RowActions
                onEdit={() => setAsset({ category: 'crops', record: r })}
                onDelete={() => setPendingDelete({
                    category: 'crops', id: r.id, what: 'cropping season',
                    details: [
                        ['Crop', r.crop_name ?? '—'],
                        ['Season', `${r.season ?? ''} ${r.cropping_year ?? ''}`.trim()],
                        ['Parcel', r.parcel_number ? `#${r.parcel_number}` : '—'],
                        ['Area', `${num(r.total_area, 2)} ha`],
                    ],
                })}
            />
        ),
    }] : [];

    const confirmDelete = () => {
        const { category, id } = pendingDelete;
        setDeleting(true);
        // Cropping seasons are owned by Seasonal Tracking, so they are removed
        // through its route rather than the shared farm-assets one.
        const url = category === 'crops'
            ? `/admin/seasonal/${id}`
            : `/admin/farm-assets/${category}/${id}`;

        router.delete(url, {
            preserveScroll: true,
            onFinish: () => { setDeleting(false); setPendingDelete(null); },
        });
    };

    /**
     * Trailing actions column, present only when a farmer is in scope — the
     * combined view has nothing individual to change.
     */
    const actionsCol = (fallbackCategory, what, describe) => (editable ? [{
        key: 'actions', label: '', align: 'right',
        render: r => (
            <RowActions
                onEdit={() => setAsset({ category: r.route ?? fallbackCategory, record: r })}
                onDelete={() => setPendingDelete({
                    category: r.route ?? fallbackCategory,
                    id: r.id,
                    what,
                    details: describe(r),
                })}
            />
        ),
    }] : []);

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
                                {/* Every category on one sheet, unlike the tabbed
                                    screen — opened in its own tab so the record
                                    stays put behind it. */}
                                <a href={`/admin/farm-inventory/${selectedFarmer.id}/print`}
                                    target="_blank" rel="noopener"
                                    title="Print asset record" aria-label="Print asset record"
                                    className="p-2.5 rounded-xl border border-green-200 text-[#006400] hover:bg-green-50 transition-colors">
                                    <Printer className="h-5 w-5" />
                                </a>
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
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-5">
                <Stat icon={Ruler} tone="#006400" value={num(summary?.crop_area, 2)} label="Hectares planted" />
                <Stat icon={Sprout} tone="#228B22" value={num(summary?.crop_types)} label="Crop types" />
                <Stat icon={TreePine} tone="#4CAF50" value={num(summary?.trees)} label="Trees" />
                <Stat icon={Beef} tone="#81C784" value={num(summary?.animals)} label="Animals" />
                <Stat icon={Fish} tone="#2E7D32" value={num(summary?.pond_area, 2)} label="Pond hectares" />
                {/* Already counted server-side but never shown until now. */}
                <Stat icon={Tractor} tone="#1B5E20" value={num(summary?.machinery)} label="Machinery" />
            </div>

            {/* Every category on the page at once, in the order the office
                thinks about them: what is planted, what is standing, what is
                alive, what is in the water, what is in the shed. */}
            <div className="space-y-5">
                <Panel icon={Sprout} title="Crops" count={crops.length}
                    action={cropsAddable && <AddButton label="Add crop"
                        onClick={() => setAsset({ category: 'crops', record: null })} />}>
                    {!aggregated && !cropsAddable && can('create seasonal') && parcels.length === 0 && (
                        <p className="mb-3 text-xs text-amber-700">
                            This farmer has no parcels yet. A cropping season is planted on a
                            parcel, so one must be recorded first in{' '}
                            <Link href="/admin/parcels" className="font-semibold underline">Farm Parcels</Link>.
                        </p>
                    )}
                    {!aggregated && (
                        <p className="mb-3 text-xs text-gray-500">
                            Yields and input costs for a season are also editable in{' '}
                            <Link href="/admin/seasonal" className="font-semibold text-[#006400] hover:underline">
                                Seasonal Tracking
                            </Link>.
                        </p>
                    )}
                    <DataBlock
                        columns={[
                            { key: 'crop', label: 'Crop', render: r => <span className="font-medium text-gray-900">{r.crop_name ?? '—'}</span> },
                            { key: 'season', label: 'Season', render: r => seasonChip(r.season) },
                            { key: 'year', label: 'Year', render: r => r.cropping_year },
                            aggregated
                                ? { key: 'parcels', label: 'Parcels', render: r => r.parcel_count ?? '—' }
                                : { key: 'parcel', label: 'Parcel', render: r => r.parcel_number ? `#${r.parcel_number}` : '—' },
                            { key: 'area', label: 'Area (ha)', align: 'right', render: r => num(r.total_area, 2) },
                            { key: 'yield', label: 'Yield (kg)', align: 'right',
                              render: r => (r.yield_kg === null || r.yield_kg === undefined || r.yield_kg === '')
                                  ? <span className="text-gray-400 font-normal">Not harvested</span>
                                  : num(r.yield_kg) },
                            ...cropActionsCol,
                        ]}
                        rows={crops}
                        renderCard={r => (
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900">{r.crop_name ?? '—'}</p>
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                        {seasonChip(r.season)} {r.cropping_year}
                                        {r.parcel_number && <span>· #{r.parcel_number}</span>}
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg bg-green-50 text-[#006400] font-bold text-sm tabular-nums whitespace-nowrap">
                                    {num(r.total_area, 2)} ha
                                </span>
                            </div>
                        )}
                        empty={<Empty icon={Sprout} text="No cropping seasons recorded" />}
                    />
                </Panel>

                <Panel icon={TreePine} title="Tree Crops" count={treeCrops.length}
                    action={addable && <AddButton label="Add tree crop"
                        onClick={() => setAsset({ category: 'tree-crops', record: null })} />}>
                                <DataBlock
                                    columns={[
                                        { key: 'type', label: 'Crop', render: r => <span className="font-medium text-gray-900">{r.crop_type ?? '—'}</span> },
                                        ...(aggregated ? [{ key: 'farmers', label: 'Farmers', render: r => r.farmer_count ?? '—' }] : [
                                            { key: 'status', label: 'Status', render: r => (
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                    r.status === 'bearing' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                                }`}>{r.status === 'bearing' ? 'Bearing' : 'Non-bearing'}</span>
                                            ) },
                                            // Planted year, worked back from the age the
                                            // table actually stores.
                                            { key: 'planted', label: 'Planted', render: r => r.age_years
                                                ? new Date().getFullYear() - Number(r.age_years) : '—' },
                                        ]),
                                        { key: 'qty', label: 'Trees', align: 'right', render: r => num(r.total_quantity) },
                                        { key: 'area', label: 'Area (ha)', align: 'right', render: r => num(r.total_area, 2) },
                                        ...actionsCol('tree-crops', 'tree crop record', r => [
                                            ['Crop', r.crop_type],
                                            ['Trees', num(r.total_quantity)],
                                            ['Area', `${num(r.total_area, 2)} ha`],
                                        ]),
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
                                <SectionHead
                                    title="Fishponds"
                                    action={addable && <AddButton label="Add fishpond"
                                        onClick={() => setAsset({ category: 'fishponds', record: null })} />}
                                />
                                <DataBlock
                                    columns={[
                                        { key: 'species', label: 'Species', render: r => <span className="font-medium text-gray-900">{r.species ?? '—'}</span> },
                                        ...(aggregated ? [{ key: 'farmers', label: 'Farmers', render: r => r.farmer_count ?? '—' }] : [
                                            { key: 'pond', label: 'Type', render: r => <span className="capitalize text-gray-600">{r.pond_type ?? '—'}</span> },
                                        ]),
                                        { key: 'area', label: 'Area (ha)', align: 'right', render: r => num(r.total_area, 2) },
                                        ...(aggregated ? [] : [
                                            { key: 'pop', label: 'Est. stock', align: 'right',
                                              render: r => r.projected_population ? num(r.projected_population) : '—' },
                                            { key: 'next', label: 'Next harvest',
                                              render: r => r.next_harvest ? formatDate(r.next_harvest, 'date-only') : '—' },
                                        ]),
                                        ...actionsCol('fishponds', 'fishpond record'),
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
                        <>
                            {addable && (
                                // Five separate RSBSA tables sit behind this tab, so
                                // the user chooses which one they are adding to.
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500">Add:</span>
                                    {[
                                        ['large-ruminants', 'Cattle / Carabao'],
                                        ['small-ruminants', 'Goat / Sheep'],
                                        ['native-pigs', 'Native pigs'],
                                        ['swine-hybrid', 'Hybrid swine'],
                                        ['poultry', 'Poultry'],
                                    ].map(([cat, label]) => (
                                        <AddButton key={cat} label={label}
                                            onClick={() => setAsset({ category: cat, record: null })} />
                                    ))}
                                </div>
                            )}
                            <DataBlock
                                columns={[
                                    { key: 'type', label: 'Animal', render: r => <span className="font-medium text-gray-900">{r.type ?? '—'}</span> },
                                    { key: 'cat', label: 'Category', render: r => (
                                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
                                            {r.category ?? '—'}
                                        </span>
                                    ) },
                                    ...(aggregated ? [{ key: 'farmers', label: 'Farmers', render: r => r.farmer_count ?? '—' }] : [
                                        { key: 'health', label: 'Health', render: r => (
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                                                HEALTH_TONE[r.health_status] ?? 'bg-gray-100 text-gray-600'
                                            }`}>{r.health_status ?? '—'}</span>
                                        ) },
                                        { key: 'vacc', label: 'Last vaccinated',
                                          render: r => r.last_vaccination ? formatDate(r.last_vaccination, 'date-only') : '—' },
                                    ]),
                                    { key: 'male', label: 'Male', align: 'right', render: r => num(r.male) },
                                    { key: 'female', label: 'Female', align: 'right', render: r => num(r.female) },
                                    { key: 'total', label: 'Total heads', align: 'right', render: r => num(r.total) },
                                    ...actionsCol('livestock', 'animal record'),
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
                        </>
                    )}

                    {tab === 'machinery' && (
                        <>
                            {addable && (
                                <div className="mb-3 flex justify-end">
                                    <AddButton label="Add machinery"
                                        onClick={() => setAsset({ category: 'machinery', record: null })} />
                                </div>
                            )}
                            <DataBlock
                                columns={aggregated ? [
                                    { key: 'type', label: 'Machinery', render: r => <span className="font-medium text-gray-900">{r.machinery_type}</span> },
                                    { key: 'farmers', label: 'Farmers', render: r => num(r.farmer_count) },
                                    { key: 'active', label: 'Working', align: 'right', render: r => num(r.active_units) },
                                    { key: 'total', label: 'Units', align: 'right', render: r => num(r.total_units) },
                                ] : [
                                    { key: 'type', label: 'Machinery', render: r => (
                                        <div>
                                            <span className="font-medium text-gray-900">{r.machinery_type}</span>
                                            {(r.brand || r.model) && (
                                                <span className="block text-xs text-gray-500">
                                                    {[r.brand, r.model].filter(Boolean).join(' ')}
                                                </span>
                                            )}
                                        </div>
                                    ) },
                                    { key: 'serial', label: 'Serial no.', render: r => (
                                        <span className="font-mono text-xs text-gray-600">{r.serial_number || '—'}</span>
                                    ) },
                                    { key: 'acq', label: 'Acquired', render: r => (
                                        <span className="capitalize">
                                            {r.year_acquired ? `${r.year_acquired} · ` : ''}{r.acquisition_type}
                                        </span>
                                    ) },
                                    { key: 'status', label: 'Status', render: r => (
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                                            MACHINE_TONE[r.status] ?? 'bg-gray-100 text-gray-600'
                                        }`}>{(r.status ?? '').replace('_', ' ')}</span>
                                    ) },
                                    ...actionsCol('machinery', 'machinery record'),
                                ]}
                                rows={machinery}
                                renderCard={r => (
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{r.machinery_type}</p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {aggregated
                                                    ? `${num(r.farmer_count)} farmers`
                                                    : ([r.brand, r.model].filter(Boolean).join(' ') || '—')}
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold tabular-nums text-[#006400] whitespace-nowrap capitalize">
                                            {aggregated
                                                ? `${num(r.active_units)}/${num(r.total_units)} working`
                                                : (r.status ?? '').replace('_', ' ')}
                                        </span>
                                    </div>
                                )}
                                empty={<Empty icon={Tractor} text="No farm machinery recorded" />}
                            />
                        </>
                    )}
                </div>
            </div>

            {asset && (
                <AssetModal
                    key={`${asset.category}-${asset.record?.id ?? 'new'}`}
                    category={asset.category}
                    record={asset.record}
                    farmerId={selectedFarmer?.id}
                    parcels={parcels}
                    onClose={() => setAsset(null)}
                />
            )}
        </AdminLayout>
    );
}
