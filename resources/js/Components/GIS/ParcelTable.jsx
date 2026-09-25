import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { featureHectares, hasBoundary } from '@/utils/gisFilters';

/**
 * The parcels currently on the map, as a list.
 *
 * Paged rather than virtualised: the registry holds tens of mapped parcels
 * today, and a page size keeps the DOM small without pulling in a windowing
 * library for a problem that does not exist yet. If this ever grows into the
 * thousands, swap the slice below for a virtualiser — the sorting and paging
 * boundaries are already in the right place for that.
 *
 * Clicking a row only moves the map and the selection. It never writes.
 */
const PAGE_SIZE = 10;

const COLUMNS = [
  { key: 'parcel', label: 'Parcel', sortable: true },
  { key: 'farmer', label: 'Farmer', sortable: true },
  { key: 'barangay', label: 'Barangay', sortable: true },
  /*
   * Where the LAND is. Only rendered when the records actually span more than
   * one municipality — see `showMunicipality` below — because a column reading
   * "Tumauini" seventy-five times is width spent on nothing.
   */
  { key: 'municipality', label: 'Municipality', sortable: true, optional: true },
  { key: 'commodity', label: 'Commodity', sortable: true },
  { key: 'area', label: 'Area', sortable: true, numeric: true },
];

export default function ParcelTable({ features, sort, onSort, onPick, selectedId, loading }) {
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(features.length / PAGE_SIZE));
  // Clamp rather than store: a filter that shrinks the list must not strand
  // the view on a page that no longer exists.
  const current = Math.min(page, pages - 1);
  const rows = features.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  /*
   * Show the municipality column only when the parcels span more than one.
   *
   * Counted over the whole list rather than the current page, so the table
   * does not gain and lose a column as you page through it.
   */
  const showMunicipality = new Set(
    features
      .map((feature) => String(feature.properties?.city_municipality ?? '').trim())
      .filter(Boolean),
  ).size > 1;

  const columns = COLUMNS.filter((column) => !column.optional || showMunicipality);

  /** How many of the listed parcels are actually drawn. */
  const drawn = features.reduce((total, feature) => total + (hasBoundary(feature) ? 1 : 0), 0);

  const header = (column) => {
    const isSorted = sort.key === column.key;
    return (
      <th
        key={column.key}
        scope="col"
        className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
          column.numeric ? 'text-right' : ''
        }`}
        aria-sort={isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => onSort(column.key)}
          title={`Sort by ${column.label.toLowerCase()}`}
          className={`inline-flex items-center gap-1 hover:text-slate-800 ${column.numeric ? 'flex-row-reverse' : ''}`}
        >
          {column.label}
          {isSorted && (sort.dir === 'asc'
            ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
            : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
        </button>
      </th>
    );
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="parcel-table-heading">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-3">
        <h3 id="parcel-table-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Table2 className="h-4 w-4" aria-hidden="true" />
          {/* Was "Visible farm parcels", which is no longer what this is: the
              list now includes parcels that have no boundary and so are not
              visible on the map at all. */}
          Farm parcels
        </h3>
        <span className="text-xs text-slate-500">
          {features.length} parcel{features.length === 1 ? '' : 's'}
          {drawn !== features.length && ` · ${features.length - drawn} undrawn`}
        </span>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-slate-500">Loading farm parcels…</p>
      ) : features.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No parcels match the selected filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${showMunicipality ? "min-w-[660px]" : "min-w-[560px]"}`}>
              <thead className="bg-slate-50">
                <tr>{columns.map(header)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((feature) => {
                  const p = feature.properties ?? {};
                  const isSelected = String(p.id) === String(selectedId);
                  const drawnHere = hasBoundary(feature);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onPick(feature)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onPick(feature);
                        }
                      }}
                      aria-selected={isSelected}
                      className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-600 ${
                        isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          {/* A hollow ring for an undrawn parcel: it has no
                              colour on the map because it is not on the map,
                              and a filled swatch would imply it is. */}
                          <span
                            aria-hidden="true"
                            className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                              drawnHere
                                ? 'ring-1 ring-black/20'
                                : 'border border-dashed border-slate-400'
                            }`}
                            style={drawnHere ? { backgroundColor: p.colour ?? '#94a3b8' } : undefined}
                          />
                          <span className="font-medium text-slate-800">
                            {p.parcel_number || `#${p.id}`}
                          </span>
                          {!drawnHere && (
                            <span
                              className="rounded border border-amber-300 bg-amber-50 px-1 py-px text-[10px] font-medium text-amber-800"
                              title="This parcel is on record but has no boundary drawn yet"
                            >
                              no boundary
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{p.farmer_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{p.barangay || '—'}</td>
                      {showMunicipality && (
                        <td className="px-3 py-2 text-slate-700">{p.city_municipality || '—'}</td>
                      )}
                      <td className="px-3 py-2 text-slate-700">{p.commodity || '—'}</td>
                      {/*
                          An undrawn parcel's area is the office's recorded
                          figure, not a measurement, so it is shown in italics
                          with the difference spelled out on hover. Presenting
                          it identically to a measured one is exactly the kind
                          of quiet conflation this table should not do.
                      */}
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          drawnHere ? 'text-slate-700' : 'italic text-slate-500'
                        }`}
                        title={drawnHere
                          ? 'Measured from the drawn boundary'
                          : 'Recorded area — no boundary has been drawn to measure'}
                      >
                        {featureHectares(feature).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, current - 1))}
                disabled={current === 0}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </button>
              <span className="text-xs tabular-nums text-slate-500">
                {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, features.length)} of {features.length}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(pages - 1, current + 1))}
                disabled={current >= pages - 1}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
