import { FilterX, SlidersHorizontal } from 'lucide-react';

/**
 * Farm filters.
 *
 * Every option is derived from the loaded parcels, so the lists can only ever
 * offer values that exist. Filtering is a display concern and touches nothing
 * on the server: it narrows which features are handed to the map source, and
 * no parcel record is read, written or deleted by anything in this panel.
 */
function Select({ label, value, onChange, options, placeholder, getKey, getLabel }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
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

export default function FarmFilters({ filters, options, onChange, onClear, active, resultCount }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="farm-filters-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id="farm-filters-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Farm filters
        </h3>

        {active && (
          <button
            type="button"
            onClick={onClear}
            title="Remove all filters and show every mapped parcel"
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Barangay"
          value={filters.barangay}
          onChange={set('barangay')}
          options={options.barangays}
          placeholder="All barangays"
        />
        <Select
          label="Commodity"
          value={filters.commodity}
          onChange={set('commodity')}
          options={options.commodities}
          placeholder="All commodities"
        />
        <Select
          label="Farm type"
          value={filters.farmType}
          onChange={set('farmType')}
          options={options.farmTypes}
          placeholder="All farm types"
        />
        <Select
          label="Farmer"
          value={filters.farmer}
          onChange={set('farmer')}
          options={options.farmers}
          placeholder="All farmers"
          getKey={(f) => f.id}
          getLabel={(f) => f.name}
        />
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1 block text-xs font-medium text-slate-600">Area (hectares)</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={filters.minArea}
            onChange={(event) => set('minArea')(event.target.value)}
            placeholder="Min"
            aria-label="Minimum area in hectares"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <span className="text-slate-400" aria-hidden="true">–</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={filters.maxArea}
            onChange={(event) => set('maxArea')(event.target.value)}
            placeholder="Max"
            aria-label="Maximum area in hectares"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </fieldset>

      <p
        className={`mt-3 border-t border-slate-100 pt-2 text-xs ${
          resultCount === 0 ? 'font-medium text-amber-700' : 'text-slate-500'
        }`}
        role="status"
      >
        {resultCount === 0
          ? 'No parcels match the selected filters.'
          : `${resultCount} parcel${resultCount === 1 ? '' : 's'} shown on the map.`}
      </p>
    </section>
  );
}
