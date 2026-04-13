import { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { router, useForm } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// ── Input types for the dynamic inputs section ──────────────────────────────
const INPUT_TYPES = ['fertilizer', 'seed', 'pesticide', 'herbicide', 'other'];
const UNITS = ['kg', 'L', 'bag', 'pack', 'piece'];

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
    inputs_used: [],
});

// ── Small reusable components ────────────────────────────────────────────────
function Badge({ value }) {
    const cls = value === 'dry'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-blue-100 text-blue-700';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>{value}</span>;
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="font-semibold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                </div>
                <div className="px-6 py-4">{children}</div>
            </div>
        </div>
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

            <div>
                <label className={label}>Yield (kg)</label>
                <input type="number" step="0.01" className={field} value={data.yield_kg}
                    onChange={e => setData('yield_kg', e.target.value)} />
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
export default function SeasonalIndex({ parcels, seasons, crops, filters }) {
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
            {/* Filter bar and Add button */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
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
                            className="ml-auto bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800 whitespace-nowrap">
                            + Add Season
                        </button>
                    )}
                </div>

                <p className="text-xs text-gray-500">
                    Showing {seasons.data?.length ?? 0} of {seasons.total ?? 0} season(s)
                </p>
            </div>

            {/* Seasons table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Farmer</th>
                            <th className="px-4 py-3">Parcel</th>
                            <th className="px-4 py-3">Season</th>
                            <th className="px-4 py-3">Year</th>
                            <th className="px-4 py-3">Crop</th>
                            <th className="px-4 py-3">Area (ha)</th>
                            <th className="px-4 py-3">Planting</th>
                            <th className="px-4 py-3">Harvest</th>
                            <th className="px-4 py-3">Yield (kg)</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {seasons.data?.length === 0 && (
                            <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                                {hasActiveFilters ? 'No seasons found matching your filters.' : 'No seasonal entries yet.'}
                            </td></tr>
                        )}
                        {seasons.data?.map(s => (
                            <tr key={s.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3">{s.parcel?.farmer?.first_name} {s.parcel?.farmer?.last_name}</td>
                                <td className="px-4 py-3">#{s.parcel?.parcel_number}</td>
                                <td className="px-4 py-3"><Badge value={s.season} /></td>
                                <td className="px-4 py-3">{s.cropping_year}</td>
                                <td className="px-4 py-3">{s.crop?.crop_name ?? '—'}</td>
                                <td className="px-4 py-3">{s.area_planted_ha ?? '—'}</td>
                                <td className="px-4 py-3">{fmtDate(s.planting_date)}</td>
                                <td className="px-4 py-3">{fmtDate(s.harvest_date)}</td>
                                <td className="px-4 py-3">{s.yield_kg ?? '—'}</td>
                                <td className="px-4 py-3 flex gap-2">
                                    {can('edit seasonal') && (
                                        <button onClick={() => openEdit(s)}
                                            className="text-green-600 hover:underline text-xs">Edit</button>
                                    )}
                                    {can('delete seasonal') && (
                                        <button onClick={() => setDeleting(s)}
                                            className="text-red-500 hover:underline text-xs">Delete</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

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
                                            ? 'bg-green-700 text-white' 
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
