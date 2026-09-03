import { useState, Fragment } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { router, useForm } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import ModalShell from '@/Components/ui/ModalShell';
import { Pencil, Trash2, Coins } from 'lucide-react';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// ── Input types for the dynamic inputs section ──────────────────────────────
const INPUT_TYPES = ['fertilizer', 'seed', 'pesticide', 'herbicide', 'other'];
const UNITS = ['kg', 'L', 'bag', 'pack', 'piece'];

/** Suggestions only — the box stays free text, since blends vary by supplier. */
const FERTILIZERS = [
    'Urea 46-0-0', 'Complete 14-14-14', 'Ammonium Sulfate 21-0-0',
    'Ammonium Phosphate 16-20-0', 'Muriate of Potash 0-0-60',
    'Vermicompost', 'Chicken manure', 'Carbonized rice hull', 'Compost',
];

const CLASS_TONE = {
    organic:   'bg-emerald-100 text-emerald-800',
    inorganic: 'bg-sky-100 text-sky-800',
    mixed:     'bg-amber-100 text-amber-800',
};

const peso = (n, dp = 2) =>
    `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

const emptyInput = () => ({ type: 'fertilizer', name: '', quantity: '', unit: 'kg', source: '' });

const emptyForm = (parcel_id = '') => ({
    parcel_id,
    season: 'wet',
    cropping_year: new Date().getFullYear(),
    crop_id: '',
    area_planted_ha: '',
    planting_date: '',
    harvest_date: '',
    yield_kg: '',
    production_cost: '',
    fertilizer_type: '',
    fertilizer_qty_kg: '',
    fertilizer_class: '',
    inputs_used: [],
});

const farmerName = (s) =>
    [s.parcel?.farmer?.first_name, s.parcel?.farmer?.last_name].filter(Boolean).join(' ') || 'Unknown farmer';

/**
 * How to name a parcel.
 *
 * Most parcels carry no parcel_number, and the page used to print a bare "#"
 * for every one of them. The barangay is what actually distinguishes them on
 * the ground, so it stands in, with the record id to tell two in the same
 * barangay apart.
 */
const parcelLabel = (parcel) => {
    if (!parcel) return 'No parcel';
    if (parcel.parcel_number) return `Parcel #${parcel.parcel_number}`;
    return parcel.barangay ? `${parcel.barangay} · no parcel no.` : `Parcel record ${parcel.id}`;
};

// ── Small reusable components ────────────────────────────────────────────────

/** Planting through harvest, and how long that took. */
function Period({ season }) {
    const { planting_date: from, harvest_date: to } = season;

    if (!from && !to) return <span className="text-gray-300">Not recorded</span>;
    if (from && !to) {
        return (
            <span>
                Planted {fmtDate(from)}
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    growing
                </span>
            </span>
        );
    }
    if (!from && to) return <span>Harvested {fmtDate(to)}</span>;

    const days = Math.round((new Date(to) - new Date(from)) / 86400000);

    return (
        <span>
            {fmtDate(from)} → {fmtDate(to)}
            {days > 0 && <span className="text-gray-400"> · {days} days</span>}
        </span>
    );
}

/**
 * Cost, with the derived price per kilo beneath it.
 *
 * When no cost has been entered this offers to add one rather than printing a
 * dash: with nothing costed yet, a column of dashes reads as though the
 * feature is broken instead of simply unfilled.
 */
function Cost({ season, onAdd, mayEdit }) {
    if (season.production_cost == null) {
        return mayEdit
            ? <button onClick={onAdd} className="text-xs font-medium text-[#006400] hover:underline">+ Add cost</button>
            : <span className="text-gray-300">—</span>;
    }

    return (
        <div>
            <p className="font-semibold text-gray-900 tabular-nums">{peso(season.production_cost, 0)}</p>
            <p className="text-xs tabular-nums text-[#006400]">
                {season.cost_per_kg != null
                    ? `${peso(season.cost_per_kg)} / kg`
                    : <span className="text-gray-400">awaiting harvest</span>}
            </p>
        </div>
    );
}

function Fertilizer({ season, compact = false }) {
    if (!season.fertilizer_type && !season.fertilizer_class) {
        return compact ? null : <span className="text-gray-300">—</span>;
    }

    const chip = season.fertilizer_class && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${CLASS_TONE[season.fertilizer_class]}`}>
            {season.fertilizer_class}
        </span>
    );

    if (compact) {
        return (
            <span className="flex items-center gap-1.5">
                {season.fertilizer_type || 'Fertilizer'}
                {season.fertilizer_qty_kg != null && <span>· {Number(season.fertilizer_qty_kg).toLocaleString('en-PH')} kg</span>}
                {chip}
            </span>
        );
    }

    return (
        <div className="min-w-0">
            <p className="truncate text-gray-700">{season.fertilizer_type || '—'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                {season.fertilizer_qty_kg != null && <span>{Number(season.fertilizer_qty_kg).toLocaleString('en-PH')} kg</span>}
                {chip}
            </p>
        </div>
    );
}

function Badge({ value }) {
    const cls = value === 'dry'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-green-100 text-green-700';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>{value}</span>;
}

function Modal({ title, onClose, children }) {
    return (
        <ModalShell title={title} onClose={onClose} size="lg" tone="plain" bodyClass="px-6 py-4">
            {children}
        </ModalShell>
    );
}

// ── Season Form (add / edit) ─────────────────────────────────────────────────
function SeasonForm({ data, setData, errors, crops, onSubmit, onClose }) {
    function addInput() {
        setData('inputs_used', [...(data.inputs_used ?? []), emptyInput()]);
    }

    function removeInput(i) {
        setData('inputs_used', data.inputs_used.filter((_, idx) => idx !== i));
    }

    function updateInput(i, field, value) {
        const updated = data.inputs_used.map((item, idx) =>
            idx === i ? { ...item, [field]: value } : item
        );
        setData('inputs_used', updated);
    }

    const field = 'px-3 py-2 border rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500';
    const label = 'block text-xs font-medium text-gray-600 mb-1';
    const err   = 'text-red-500 text-xs mt-1';

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={label}>Season</label>
                    <select className={field} value={data.season} onChange={e => setData('season', e.target.value)}>
                        <option value="wet">Wet</option>
                        <option value="dry">Dry</option>
                    </select>
                    {errors.season && <p className={err}>{errors.season}</p>}
                </div>
                <div>
                    <label className={label}>Year</label>
                    <input type="number" className={field} value={data.cropping_year}
                        onChange={e => setData('cropping_year', e.target.value)} min="2000" max="2100" />
                    {errors.cropping_year && <p className={err}>{errors.cropping_year}</p>}
                </div>
            </div>

            <div>
                <label className={label}>Crop</label>
                <select className={field} value={data.crop_id} onChange={e => setData('crop_id', e.target.value)}>
                    <option value="">— Select crop —</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.crop_name}</option>)}
                </select>
                {errors.crop_id && <p className={err}>{errors.crop_id}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className={label}>Area Planted (ha)</label>
                    <input type="number" step="0.01" className={field} value={data.area_planted_ha}
                        onChange={e => setData('area_planted_ha', e.target.value)} />
                </div>
                <div>
                    <label className={label}>Planting Date</label>
                    <input type="date" className={field} value={data.planting_date}
                        onChange={e => setData('planting_date', e.target.value)} />
                    {errors.planting_date && <p className={err}>{errors.planting_date}</p>}
                </div>
                <div>
                    <label className={label}>Harvest Date</label>
                    <input type="date" className={field} value={data.harvest_date}
                        onChange={e => setData('harvest_date', e.target.value)} />
                    {errors.harvest_date && <p className={err}>{errors.harvest_date}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={label}>Yield (kg)</label>
                    <input type="number" step="0.01" min="0" className={field} value={data.yield_kg}
                        onChange={e => setData('yield_kg', e.target.value)} />
                </div>
                <div>
                    <label className={label}>Cost of production (₱)</label>
                    <input type="number" step="0.01" min="0" className={field} value={data.production_cost}
                        onChange={e => setData('production_cost', e.target.value)}
                        placeholder="Seed, fertilizer, labour, fuel" />
                    {errors.production_cost && <p className={err}>{errors.production_cost}</p>}
                    {/* Shown as it is typed so a slip of a zero is obvious
                        before saving, rather than a month later in a report. */}
                    {data.production_cost > 0 && data.yield_kg > 0 && (
                        <p className="mt-1 text-[11px] text-[#006400] font-medium">
                            ₱{(data.production_cost / data.yield_kg).toFixed(2)} per kilo
                        </p>
                    )}
                </div>
            </div>

            {/* Fertilizer — its own block, because the office reports on
                organic versus inorganic use separately from cost. */}
            <div className="rounded-lg border border-gray-200 p-3">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fertilizer</span>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                        <label className={label}>Type</label>
                        <input className={field} value={data.fertilizer_type} list="fertilizer-types"
                            onChange={e => setData('fertilizer_type', e.target.value)}
                            placeholder="e.g. Urea 46-0-0" />
                        <datalist id="fertilizer-types">
                            {FERTILIZERS.map(f => <option key={f} value={f} />)}
                        </datalist>
                        {errors.fertilizer_type && <p className={err}>{errors.fertilizer_type}</p>}
                    </div>
                    <div>
                        <label className={label}>Amount (kg)</label>
                        <input type="number" step="0.01" min="0" className={field} value={data.fertilizer_qty_kg}
                            onChange={e => setData('fertilizer_qty_kg', e.target.value)} />
                        {errors.fertilizer_qty_kg && <p className={err}>{errors.fertilizer_qty_kg}</p>}
                    </div>
                </div>
                <div className="mt-3">
                    <label className={label}>Organic or inorganic</label>
                    <div className="flex flex-wrap gap-2">
                        {[['', 'Not recorded'], ['organic', 'Organic'], ['inorganic', 'Inorganic'], ['mixed', 'Both']]
                            .map(([value, text]) => (
                                <button key={value || 'none'} type="button"
                                    onClick={() => setData('fertilizer_class', value)}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        (data.fertilizer_class ?? '') === value
                                            ? 'border-[#006400] bg-[#006400] text-white'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}>
                                    {text}
                                </button>
                            ))}
                    </div>
                    {errors.fertilizer_class && <p className={err}>{errors.fertilizer_class}</p>}
                </div>
            </div>

            {/* Dynamic inputs section */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Inputs Used</span>
                    <button type="button" onClick={addInput}
                        className="text-xs text-green-700 hover:text-green-900 font-medium">+ Add Input</button>
                </div>
                {(data.inputs_used ?? []).length === 0 && (
                    <p className="text-xs text-gray-400 italic">No inputs added yet.</p>
                )}
                <div className="space-y-2">
                    {(data.inputs_used ?? []).map((inp, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded-lg">
                            <select className={`${field} col-span-2`} value={inp.type}
                                onChange={e => updateInput(i, 'type', e.target.value)}>
                                {INPUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input placeholder="Name / variety" className={`${field} col-span-3`} value={inp.name}
                                onChange={e => updateInput(i, 'name', e.target.value)} />
                            <input type="number" placeholder="Qty" className={`${field} col-span-2`} value={inp.quantity}
                                onChange={e => updateInput(i, 'quantity', e.target.value)} />
                            <select className={`${field} col-span-1`} value={inp.unit}
                                onChange={e => updateInput(i, 'unit', e.target.value)}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <input placeholder="Source" className={`${field} col-span-3`} value={inp.source}
                                onChange={e => updateInput(i, 'source', e.target.value)} />
                            <button type="button" onClick={() => removeInput(i)}
                                className="col-span-1 text-red-400 hover:text-red-600 text-lg leading-none text-center">&times;</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit"
                    className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800">Save</button>
            </div>
        </form>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SeasonalIndex({ parcels, seasons, crops, filters, summary, costByYear = [] }) {
    const { can } = usePermissions();
    const [showAdd, setShowAdd]   = useState(false);
    const [editing, setEditing]   = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [yearInput, setYearInput] = useState(filters.year ?? '');
    const [searchInput, setSearchInput] = useState(filters.search ?? '');

    // Filters
    function applyFilter(key, value) {
        router.get('/admin/seasonal', { ...filters, [key]: value || undefined }, { preserveState: true });
    }

    // Debounced year filter
    function handleYearChange(value) {
        setYearInput(value);
        if (window.yearFilterTimeout) clearTimeout(window.yearFilterTimeout);
        window.yearFilterTimeout = setTimeout(() => {
            applyFilter('year', value);
        }, 500);
    }

    // Debounced search filter
    function handleSearchChange(value) {
        setSearchInput(value);
        if (window.searchFilterTimeout) clearTimeout(window.searchFilterTimeout);
        window.searchFilterTimeout = setTimeout(() => {
            applyFilter('search', value);
        }, 500);
    }

    function clearFilters() {
        setYearInput('');
        setSearchInput('');
        router.get('/admin/seasonal', {}, { preserveState: true });
    }

    const hasActiveFilters = filters.parcel_id || filters.season || filters.year || filters.crop_id || filters.search;

    // Add form
    const addForm = useForm(emptyForm(''));

    function submitAdd(e) {
        e.preventDefault();
        if (!addForm.data.parcel_id) {
            alert('Please select a parcel');
            return;
        }
        addForm.post('/admin/seasonal', {
            onSuccess: () => { setShowAdd(false); addForm.reset(); },
        });
    }

    // Edit form
    const editForm = useForm({});

const toDateInput = (d) => d ? d.toString().slice(0, 10) : '';

    function openEdit(season) {
        editForm.setData({
            season:          season.season,
            cropping_year:   season.cropping_year,
            crop_id:         season.crop_id,
            area_planted_ha: season.area_planted_ha ?? '',
            planting_date:   toDateInput(season.planting_date),
            harvest_date:    toDateInput(season.harvest_date),
            yield_kg:        season.yield_kg ?? '',
            inputs_used:     season.inputs_used ?? [],
        });
        setEditing(season);
    }

    function submitEdit(e) {
        e.preventDefault();
        editForm.put(`/admin/seasonal/${editing.id}`, {
            onSuccess: () => setEditing(null),
        });
    }

    // Delete
    function confirmDelete() {
        router.delete(`/admin/seasonal/${deleting.id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setDeleting(null);
            },
            onError: (errors) => {
                console.error('Delete failed:', errors);
                alert('Failed to delete season entry');
            }
        });
    }

    return (
        <AdminLayout title="Seasonal Tracking">
            {/* Totals for the current filter, so the headline always describes
                what is actually listed below. */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
                {/* Production — what was planted and what came off it. */}
                <div className="xl:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Cropping seasons', value: (summary?.seasons ?? 0).toLocaleString('en-PH'), tone: '#006400' },
                        { label: 'Hectares planted', value: (summary?.hectares ?? 0).toLocaleString('en-PH'), tone: '#228B22' },
                        { label: 'Total yield (kg)', value: (summary?.yield_kg ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 }), tone: '#4CAF50' },
                        { label: 'Harvested', value: `${summary?.harvested ?? 0} of ${summary?.seasons ?? 0}`, tone: '#81C784' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
                            <div className="h-1 w-10 rounded-full mb-3" style={{ backgroundColor: s.tone }} />
                            <p className="text-2xl font-bold text-gray-900 leading-tight">{s.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Cost gets its own panel rather than two more identical tiles.
                    With nothing costed yet, "₱0" and "—" beside real production
                    figures read as broken rather than simply unfilled — so the
                    panel says which it is. */}
                <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1B5E20]">
                            <Coins className="h-4 w-4 text-white" />
                        </span>
                        <h2 className="text-xs font-bold uppercase tracking-wide text-[#006400]">Cost of production</h2>
                    </div>

                    {summary?.costed > 0 ? (
                        <>
                            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 leading-tight">{peso(summary.cost, 0)}</p>
                                    <p className="text-xs text-gray-500">Total recorded</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-[#006400] leading-tight">
                                        {summary.cost_per_kg != null ? peso(summary.cost_per_kg) : '—'}
                                    </p>
                                    <p className="text-xs text-gray-500">Average per kilo</p>
                                </div>
                            </div>
                            <p className="mt-auto pt-3 text-[11px] text-gray-400">
                                From {summary.costed} of {summary.seasons} seasons.
                                {summary.costed < summary.seasons && ' The rest have no cost recorded yet.'}
                            </p>
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col justify-center">
                            <p className="text-sm font-medium text-gray-600">Not recorded yet</p>
                            <p className="mt-1 text-xs text-gray-400">
                                Add a cost to any season and this fills in — with cost per kilo
                                worked out from its yield, and a wet-versus-dry breakdown by year.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Cost of production per year, wet against dry. Grouped from the
                season rows themselves, so it always agrees with the table. */}
            {costByYear?.length > 0 && (
                <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden mb-6">
                    <div className="border-b border-green-100 bg-green-50/40 px-4 sm:px-5 py-3">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-[#006400]">
                            Cost of production by year
                        </h2>
                        <p className="text-[11px] text-gray-500">Wet and dry season, for the current filter</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-4 py-2.5 font-semibold">Year</th>
                                    <th className="px-4 py-2.5 font-semibold text-right">Dry — cost</th>
                                    <th className="px-4 py-2.5 font-semibold text-right">Dry — ₱/kg</th>
                                    <th className="px-4 py-2.5 font-semibold text-right">Wet — cost</th>
                                    <th className="px-4 py-2.5 font-semibold text-right">Wet — ₱/kg</th>
                                    <th className="px-4 py-2.5 font-semibold text-right">Year total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-green-50">
                                {costByYear.map(y => (
                                    <tr key={y.year} className="hover:bg-green-50/40">
                                        <td className="px-4 py-2.5 font-semibold text-gray-900">{y.year}</td>
                                        {['dry', 'wet'].map(part => (
                                            <Fragment key={part}>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                                                    {y[part] ? peso(y[part].cost, 0) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">
                                                    {y[part]?.cost_per_kg != null
                                                        ? <span className="font-semibold text-[#006400]">{peso(y[part].cost_per_kg)}</span>
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                            </Fragment>
                                        ))}
                                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-900">
                                            {peso(y.total_cost, 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Filter bar and Add button */}
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[250px]">
                        <input
                            type="text"
                            placeholder="Search farmer name or RSBSA..."
                            value={searchInput}
                            onChange={e => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Parcel filter */}
                    <select
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={filters.parcel_id ?? ''}
                        onChange={e => applyFilter('parcel_id', e.target.value)}
                    >
                        <option value="">All Parcels</option>
                        {parcels.map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                    </select>

                    {/* Season filter */}
                    <select
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={filters.season ?? ''}
                        onChange={e => applyFilter('season', e.target.value)}
                    >
                        <option value="">All Seasons</option>
                        <option value="wet">Wet</option>
                        <option value="dry">Dry</option>
                    </select>

                    {/* Year filter */}
                    <input
                        type="number" placeholder="Year" min="2000" max="2100"
                        className="border rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={yearInput}
                        onChange={e => handleYearChange(e.target.value)}
                    />

                    {/* Crop filter */}
                    <select
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={filters.crop_id ?? ''}
                        onChange={e => applyFilter('crop_id', e.target.value)}
                    >
                        <option value="">All Crops</option>
                        {crops.map(c => <option key={c.id} value={c.id}>{c.crop_name}</option>)}
                    </select>

                    {hasActiveFilters && (
                        <button onClick={clearFilters}
                            className="text-xs text-red-500 hover:text-red-700 underline">
                            Clear filters
                        </button>
                    )}

                    {can('create seasonal') && (
                        <button onClick={() => { addForm.setData(emptyForm('')); setShowAdd(true); }}
                            className="ml-auto bg-[#006400] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#228B22] shadow-sm transition-colors whitespace-nowrap">
                            + Add Season
                        </button>
                    )}
                </div>

                <p className="text-xs text-gray-500">
                    Showing {seasons.data?.length ?? 0} of {seasons.total ?? 0} season(s)
                </p>
            </div>

            {/* Seasons */}
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
                {seasons.data?.length === 0 ? (
                    <div className="py-20 text-center">
                        <p className="text-sm font-medium text-gray-600">
                            {hasActiveFilters ? 'No seasons match those filters' : 'No cropping seasons recorded yet'}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                            {hasActiveFilters
                                ? 'Widen the year or clear the filters to see everything.'
                                : 'Add the first one to start tracking yields and costs.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Thirteen separate columns did not fit any screen, so
                            related facts now share a cell: who and where, what
                            and when, how much came off, what it cost. */}
                        <div className="hidden xl:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Farmer &amp; parcel</th>
                                        <th className="px-4 py-3 font-semibold">Crop &amp; season</th>
                                        <th className="px-4 py-3 font-semibold">Growing period</th>
                                        <th className="px-4 py-3 font-semibold text-right">Area</th>
                                        <th className="px-4 py-3 font-semibold text-right">Yield</th>
                                        <th className="px-4 py-3 font-semibold text-right">Cost</th>
                                        <th className="px-4 py-3 font-semibold">Fertilizer</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-green-50">
                                    {seasons.data.map(s => (
                                        <tr key={s.id} className="hover:bg-green-50/60 transition-colors align-top">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900">{farmerName(s)}</p>
                                                <p className="text-xs text-gray-400">{parcelLabel(s.parcel)}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900">{s.crop?.crop_name ?? '—'}</p>
                                                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Badge value={s.season} /> {s.cropping_year}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600">
                                                <Period season={s} />
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                                                {s.area_planted_ha != null
                                                    ? <>{Number(s.area_planted_ha).toFixed(2)}<span className="text-gray-400"> ha</span></>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                                                {s.yield_kg != null
                                                    ? <>{Number(s.yield_kg).toLocaleString('en-PH', { maximumFractionDigits: 0 })}<span className="text-gray-400"> kg</span></>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Cost season={s} onAdd={() => openEdit(s)} mayEdit={can('edit seasonal')} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <Fertilizer season={s} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {can('edit seasonal') && (
                                                        <button onClick={() => openEdit(s)} title="Edit"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                    {can('delete seasonal') && (
                                                        <button onClick={() => setDeleting(s)} title="Delete"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Below xl the same rows as cards — a 13-column table
                            was unusable on the laptops the office actually uses. */}
                        <ul className="xl:hidden divide-y divide-green-50">
                            {seasons.data.map(s => (
                                <li key={s.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">
                                                {s.crop?.crop_name ?? 'Unrecorded crop'}
                                            </p>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                                                <Badge value={s.season} /> {s.cropping_year}
                                                <span className="text-gray-300">·</span>
                                                {farmerName(s)}
                                            </p>
                                            <p className="text-xs text-gray-400">{parcelLabel(s.parcel)}</p>
                                        </div>
                                        <div className="flex flex-shrink-0 items-center gap-1.5">
                                            {can('edit seasonal') && (
                                                <button onClick={() => openEdit(s)} title="Edit"
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {can('delete seasonal') && (
                                                <button onClick={() => setDeleting(s)} title="Delete"
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide text-gray-400">Area</dt>
                                            <dd className="font-semibold text-gray-800 tabular-nums">
                                                {s.area_planted_ha != null ? `${Number(s.area_planted_ha).toFixed(2)} ha` : '—'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide text-gray-400">Yield</dt>
                                            <dd className="font-semibold text-gray-800 tabular-nums">
                                                {s.yield_kg != null
                                                    ? `${Number(s.yield_kg).toLocaleString('en-PH', { maximumFractionDigits: 0 })} kg`
                                                    : '—'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide text-gray-400">Cost</dt>
                                            <dd className="font-semibold text-gray-800 tabular-nums">
                                                {s.production_cost != null ? peso(s.production_cost, 0) : '—'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide text-gray-400">Per kilo</dt>
                                            <dd className="font-semibold text-[#006400] tabular-nums">
                                                {s.cost_per_kg != null ? peso(s.cost_per_kg) : '—'}
                                            </dd>
                                        </div>
                                    </dl>

                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                        <Period season={s} />
                                        <Fertilizer season={s} compact />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {/* Pagination */}
                {seasons.last_page > 1 && (
                    <div className="px-4 py-3 border-t flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            Page {seasons.current_page} of {seasons.last_page}
                        </p>
                        <div className="flex gap-2">
                            {seasons.links.map((link, i) => (
                                <button
                                    key={i}
                                    onClick={() => link.url && router.get(link.url)}
                                    disabled={!link.url}
                                    className={`px-3 py-1 text-xs rounded ${
                                        link.active 
                                            ? 'bg-[#006400] text-white' 
                                            : link.url 
                                                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                                                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAdd && (
                <Modal title="Add Season Entry" onClose={() => setShowAdd(false)}>
                    <SeasonForm
                        data={addForm.data}
                        setData={addForm.setData}
                        errors={addForm.errors}
                        crops={crops}
                        onSubmit={submitAdd}
                        onClose={() => setShowAdd(false)}
                    />
                </Modal>
            )}

            {/* Edit Modal */}
            {editing && (
                <Modal title="Edit Season Entry" onClose={() => setEditing(null)}>
                    <SeasonForm
                        data={editForm.data}
                        setData={editForm.setData}
                        errors={editForm.errors}
                        crops={crops}
                        onSubmit={submitEdit}
                        onClose={() => setEditing(null)}
                    />
                </Modal>
            )}

            {/* Delete Confirm Modal */}
            {deleting && (
                <Modal title="Confirm Delete" onClose={() => setDeleting(null)}>
                    <p className="text-sm text-gray-700 mb-6">
                        Delete the <strong>{deleting.season}</strong> {deleting.cropping_year} season entry? This cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setDeleting(null)}
                            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                        <button onClick={confirmDelete}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                    </div>
                </Modal>
            )}
        </AdminLayout>
    );
}
