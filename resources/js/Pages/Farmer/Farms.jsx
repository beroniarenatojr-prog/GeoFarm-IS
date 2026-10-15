import { useState } from 'react';
import FarmerLayout from '@/Layouts/FarmerLayout';
import MapViewer from '@/Components/ui/MapViewer';
import { TUMAUINI_CENTER } from '@/config/tumauiniMap';
import { Map as MapIcon, Ruler, Sprout, Leaf, Info, ChevronDown } from 'lucide-react';

const area = (ha) => `${Number(ha || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
})} ha`;

/**
 * My Farms — the parcels this farmer holds.
 *
 * Read-only throughout. Boundaries are surveyed by the Agriculture Office, and
 * a farmer who could redraw their own area is the reason the register would
 * stop being worth anything. The screen says where to go instead.
 */
export default function Farms({ farmer, parcels = [], summary, parcelGeoJson }) {
    const [expanded, setExpanded] = useState(null);

    const unmapped = summary.count - summary.mapped;

    return (
        <FarmerLayout title="My Farms" subtitle={farmer.barangay ? `${farmer.barangay}, Tumauini` : 'Tumauini'}>
            {/* ------------------------------------------------ summary --- */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <Tile icon={MapIcon} label="Parcels" value={summary.count} />
                <Tile icon={Ruler} label="Total area" value={area(summary.total_area)} />
                <Tile icon={Sprout} label="Commodities" value={summary.commodities.length} />
            </div>

            {parcels.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    {/* ------------------------------------------- map --- */}
                    {summary.mapped > 0 ? (
                        <section className="mb-4" aria-label="Map of your parcels">
                            <MapViewer
                                geojson={parcelGeoJson}
                                center={TUMAUINI_CENTER}
                                height="320px"
                                /*
                                 * The one screen where locating yourself is
                                 * genuinely useful — standing in a field,
                                 * working out which parcel you are on. Nothing
                                 * is requested until the control is pressed.
                                 */
                                showLocation
                            />

                            {unmapped > 0 && (
                                <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                                    <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    {/* Said plainly, because otherwise the map
                                        silently shows fewer parcels than the
                                        list and looks broken. */}
                                    {unmapped} of your {summary.count} parcels {unmapped === 1 ? 'has' : 'have'} no
                                    surveyed boundary yet, so {unmapped === 1 ? 'it is' : 'they are'} listed below
                                    but not drawn on the map.
                                </p>
                            )}
                        </section>
                    ) : (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="font-medium">No boundaries surveyed yet</p>
                            <p className="mt-1 text-xs leading-relaxed">
                                Your parcels are registered, but the Agriculture Office has not mapped
                                their outlines. Everything below is on file — only the map is waiting.
                            </p>
                        </div>
                    )}

                    {/* ---------------------------------------- parcels --- */}
                    <h2 className="mb-2 text-sm font-semibold text-gray-900">
                        Registered parcels
                    </h2>

                    <ul className="space-y-2">
                        {parcels.map((parcel) => {
                            const open = expanded === parcel.id;

                            return (
                                <li key={parcel.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(open ? null : parcel.id)}
                                        aria-expanded={open}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#006400]"
                                    >
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-sm font-bold text-[#006400]">
                                            {parcel.parcel_number || '?'}
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-gray-900">
                                                {parcel.commodity || parcel.farm_type || 'Parcel'}
                                            </span>
                                            <span className="block truncate text-xs text-gray-500">
                                                {parcel.barangay || 'Barangay not recorded'} · {area(parcel.area_ha)}
                                            </span>
                                        </span>

                                        {!parcel.is_mapped && (
                                            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                                                Not mapped
                                            </span>
                                        )}

                                        <ChevronDown
                                            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                                            aria-hidden="true"
                                        />
                                    </button>

                                    {open && (
                                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 text-xs">
                                            <Detail term="Area" value={area(parcel.area_ha)} />
                                            <Detail term="Barangay" value={parcel.barangay} />
                                            <Detail term="Commodity" value={parcel.commodity} />
                                            <Detail term="Farm type" value={parcel.farm_type} />
                                            <Detail term="Ownership" value={parcel.ownership} />
                                            <Detail
                                                term="Heads / trees"
                                                value={parcel.heads_trees ? String(parcel.heads_trees) : null}
                                            />
                                            {parcel.location && (
                                                <div className="col-span-2">
                                                    <dt className="font-medium text-gray-500">Location</dt>
                                                    <dd className="mt-0.5 text-gray-900">{parcel.location}</dd>
                                                </div>
                                            )}
                                            {parcel.is_organic && (
                                                <div className="col-span-2">
                                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                                                        <Leaf className="h-3 w-3" aria-hidden="true" />
                                                        Organic
                                                    </span>
                                                </div>
                                            )}
                                        </dl>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    <p className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600">
                        These records are kept by the Municipal Agriculture Office. If something
                        here is wrong, visit the office to have it corrected — it cannot be
                        changed from this app.
                    </p>
                </>
            )}
        </FarmerLayout>
    );
}

function Tile({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
            <Icon className="h-4 w-4 text-[#006400]" aria-hidden="true" />
            <p className="mt-1.5 text-base font-bold leading-tight text-gray-900">{value}</p>
            <p className="text-[11px] text-gray-500">{label}</p>
        </div>
    );
}

/** Renders nothing at all for a blank field, rather than an empty row. */
function Detail({ term, value }) {
    if (!value) return null;

    return (
        <div>
            <dt className="font-medium text-gray-500">{term}</dt>
            <dd className="mt-0.5 text-gray-900">{value}</dd>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
            <MapIcon className="mx-auto h-10 w-10 text-green-200" aria-hidden="true" />
            <p className="mt-3 font-semibold text-gray-900">No parcels registered yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                Once the Agriculture Office records your land, it will appear here with its
                area, commodity and boundary.
            </p>
        </div>
    );
}
