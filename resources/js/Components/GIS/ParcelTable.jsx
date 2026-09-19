import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { featureHectares } from '@/utils/gisFilters';

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
          Visible farm parcels
        </h3>
        <span className="text-xs text-slate-500">
          {features.length} parcel{features.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-slate-500">Loading farm parcels…</p>
      ) : features.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No parcels match the selected filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50">
                <tr>{COLUMNS.map(header)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((feature) => {
                  const p = feature.properties ?? {};
                  const isSelected = String(p.id) === String(selectedId);

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
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/20"
                            style={{ backgroundColor: p.colour ?? '#94a3b8' }}
                          />
                          <span className="font-medium text-slate-800">
                            {p.parcel_number || `#${p.id}`}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{p.farmer_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{p.barangay || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{p.commodity || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
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
