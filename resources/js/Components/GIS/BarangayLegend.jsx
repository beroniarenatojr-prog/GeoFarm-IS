import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

/**
 * Which colour is which barangay.
 *
 * The swatches are read back from each feature's own `colour` property — the
 * value the map paints from — rather than recomputed from the palette, so the
 * legend cannot drift out of step with what is actually drawn. That also means
 * a barangay keeps its colour when a filter is applied: filtering changes
 * which rows are listed, never which colour a barangay has.
 *
 * Collapsible and searchable because Tumauini has 46 barangays, and a 46-row
 * block permanently open under the map is a wall, not a key.
 */
export default function BarangayLegend({ entries, activeBarangay, onPick, totalCount }) {
  const [open, setOpen] = useState(true);
  const [needle, setNeedle] = useState('');

  const term = needle.trim().toLowerCase();
  const shown = term
    ? entries.filter((entry) => entry.label.toLowerCase().includes(term))
    : entries;

  return (
    <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="barangay-legend-heading">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <h3 id="barangay-legend-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {open
            ? <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
            : <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />}
          Barangay
          <span className="font-normal text-slate-500">(same colour = same barangay)</span>
        </h3>
        <span className="flex-shrink-0 text-xs text-slate-500">
          {entries.length} shown{typeof totalCount === 'number' && totalCount !== entries.length ? ` of ${totalCount}` : ''}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3">
          {entries.length > 8 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={needle}
                onChange={(event) => setNeedle(event.target.value)}
                placeholder="Find a barangay…"
                aria-label="Filter the barangay legend"
                className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          )}

          {shown.length === 0 ? (
            <p className="py-2 text-xs text-slate-500">No barangay matches “{needle}”.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((entry) => {
                const isActive = activeBarangay === entry.name && entry.name !== '';
                return (
                  <li key={entry.label}>
                    <button
                      type="button"
                      // Clicking a barangay filters the map to it; clicking the
                      // active one clears that filter again.
                      onClick={() => onPick(isActive ? '' : entry.name)}
                      disabled={entry.name === ''}
                      title={entry.name === ''
                        ? `${entry.count} parcel(s) with no barangay recorded`
                        : `Show only ${entry.label} (${entry.count} parcel${entry.count === 1 ? '' : 's'})`}
                      className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm ${
                        isActive ? 'bg-emerald-50 font-medium text-emerald-900' : 'text-slate-700'
                      } ${entry.name === '' ? 'cursor-default opacity-70' : 'hover:bg-slate-50'}`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-black/20"
                        style={{ backgroundColor: entry.colour }}
                      />
                      <span className="min-w-0 truncate">{entry.label}</span>
                      <span className="ml-auto flex-shrink-0 text-xs tabular-nums text-slate-400">
                        {entry.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
