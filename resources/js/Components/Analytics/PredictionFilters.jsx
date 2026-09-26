import { Link } from '@inertiajs/react';
import { FilterX, SlidersHorizontal } from 'lucide-react';

/**
 * The filter bar for Predictive Analytics.
 *
 * Every control writes to the query string and reloads the page through
 * Inertia, which is what makes a filtered view bookmarkable, shareable and
 * survivable across a refresh. No client-side filter state is kept, so there
 * is nothing that can disagree with what the server actually counted.
 *
 * Filters apply on change rather than behind an Apply button. With four
 * dropdowns over deferred props, an Apply button mostly adds a click before
 * the thing people already expect to happen.
 */
function Select({ label, value, onChange, options, placeholder, getKey, getLabel }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
            <select
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            >
                <option value="">{placeholder}</option>
                {options.map((option) => {
                    const key = getKey ? getKey(option) : option;
                    return (
                        <option key={key} value={key}>
                            {getLabel ? getLabel(option) : option}
                        </option>
                    );
                })}
            </select>
        </label>
    );
}

const SEASON_LABELS = { wet: 'Wet season', dry: 'Dry season' };

export default function PredictionFilters({ filters, options, barangays, onChange, active }) {
    const set = (key) => (value) => onChange({ ...filters, [key]: value || null });

    return (
        <section
            className="mb-5 rounded-2xl border border-gray-200 bg-white p-4"
            aria-labelledby="prediction-filters-heading"
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2
                    id="prediction-filters-heading"
                    className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                >
                    <SlidersHorizontal className="h-4 w-4 text-green-700" aria-hidden="true" />
                    Filters
                </h2>

                {active && (
                    <Link
                        href="/admin/analytics/predictive"
                        preserveScroll
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                        Reset filters
                    </Link>
                )}
            </div>

            {/* Stacks on a phone, two across on a tablet, five on a desktop. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Select
                    label="Barangay"
                    value={filters.barangay}
                    onChange={set('barangay')}
                    options={barangays ?? []}
                    placeholder="All barangays"
                />
                <Select
                    label="Season"
                    value={filters.season}
                    onChange={set('season')}
                    options={options?.seasons ?? []}
                    placeholder="All seasons"
                    getLabel={(s) => SEASON_LABELS[s] ?? s}
                />
                <Select
                    label="Crop"
                    value={filters.crop_id ?? ''}
                    onChange={set('crop_id')}
                    options={options?.crops ?? []}
                    placeholder="All crops"
                    getKey={(c) => c.id}
                    getLabel={(c) => c.name}
                />
                <Select
                    label="Prediction status"
                    value={filters.status}
                    onChange={set('status')}
                    options={options?.statuses ?? []}
                    placeholder="All statuses"
                    getKey={(s) => s.id}
                    getLabel={(s) => s.name}
                />

                {/*
                    Year is intentionally absent as a filter.

                    The forecast is for the NEXT cropping — there is only one of
                    them — so a year dropdown would either do nothing or quietly
                    change what is being predicted. The yearly chart below shows
                    every recorded year instead, which is the question a year
                    selector was really being asked to answer.
                */}
                <div className="hidden xl:block" aria-hidden="true" />
            </div>
        </section>
    );
}
