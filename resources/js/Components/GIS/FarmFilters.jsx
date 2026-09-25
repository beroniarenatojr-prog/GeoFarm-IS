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

export default function FarmFilters({
  filters, options, onChange, onClear, active, resultCount, unmappedCount = 0, mappedCount = resultCount,
}) {
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

      {/*
          Container query, not a viewport one.

          This panel is 360 px wide beside the map on a large screen and full
          width when it stacks below the map on a small one — so the viewport
          being wide is exactly when this box is narrowest. `sm:grid-cols-2`
          would put two dropdowns in 165 px each on a desktop and one per row
          on a phone, which is backwards. @md keys off the panel's own width,
          so four selects go side by side only when there is room for them.
      */}
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        <Select
          label="Barangay"
          value={filters.barangay}
          onChange={set('barangay')}
          options={options.barangays}
          placeholder="All barangays"
        />
        {/*
            Offered only when the records actually span more than one
            municipality. For an office whose every parcel sits in Tumauini
            this is a dropdown with one choice, which is just clutter — and the
            moment a parcel in Cabagan is recorded it appears on its own.
        */}
        {options.municipalities.length > 1 && (
          <Select
            label="Municipality"
            value={filters.municipality}
            onChange={set('municipality')}
            options={options.municipalities}
            placeholder="All municipalities"
          />
        )}
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
        {/*
            The office's own worklist.

            "Needs a boundary" is the reason this filter exists: it turns the
            map into a list of the parcels still to be traced, which is the
            question staff actually bring to this screen. It is offered only
            when there is at least one of each, so it can never produce an
            empty map on its own.
        */}
        {unmappedCount > 0 && (
          <Select
            label="Boundary"
            value={filters.boundary}
            onChange={set('boundary')}
            options={[
              { id: 'mapped', name: 'Drawn on the map' },
              { id: 'unmapped', name: `Needs a boundary (${unmappedCount})` },
            ]}
            placeholder="Drawn and undrawn"
            getKey={(o) => o.id}
            getLabel={(o) => o.name}
          />
        )}
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

      {/*
          Says both numbers when they differ.

          This used to read "N parcels shown on the map", which stopped being
          true the moment undrawn parcels joined the list: a filter matching 12
          parcels of which 3 have no boundary puts 9 on the map, and one number
          cannot honestly stand for both.
      */}
      <p
        className={`mt-3 border-t border-slate-100 pt-2 text-xs ${
          resultCount === 0 ? 'font-medium text-amber-700' : 'text-slate-500'
        }`}
        role="status"
      >
        {resultCount === 0
          ? 'No parcels match the selected filters.'
          : `${resultCount} parcel${resultCount === 1 ? '' : 's'} match${resultCount === 1 ? 'es' : ''}`
            + (mappedCount === resultCount
              ? ', all drawn on the map.'
              : `, ${mappedCount} drawn on the map.`)}
      </p>
    </section>
  );
}
