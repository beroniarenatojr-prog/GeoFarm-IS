import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { featureHectares } from '@/utils/gisFilters';

/**
 * One search box across everything already loaded.
 *
 * It searches the GeoJSON collection the map is already holding rather than
 * asking the server, so there is no second source of truth to drift and no
 * request per keystroke. The input is uncontrolled-feeling but debounced by
 * the parent; what happens here is only the dropdown.
 *
 * Keyboard: ArrowUp/ArrowDown move, Enter picks, Escape closes. The list is
 * capped because a dropdown longer than the map is not a dropdown.
 */
const MAX_RESULTS = 8;

export default function GisSearch({ value, onChange, results, onPick, loading }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const listId = useId();

  const shown = results.slice(0, MAX_RESULTS);

  // Close when the click lands anywhere else.
  useEffect(() => {
    const away = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  // A new search is a new list; keeping the old highlight would let Enter pick
  // something the user can no longer see.
  useEffect(() => { setActive(0); }, [value]);

  const pick = (feature) => {
    if (!feature) return;
    onPick(feature);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (!open || shown.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + shown.length) % shown.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search farmers, parcels, RSBSA numbers and barangays
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={value}
          onChange={(event) => { onChange(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search farmer, parcel, RSBSA, barangay…"
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            title="Clear search"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && value.trim() !== '' && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-slate-500">Loading farm parcels…</li>
          )}

          {!loading && shown.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              No parcels match “{value}”.
            </li>
          )}

          {shown.map((feature, index) => {
            const p = feature.properties ?? {};
            return (
              <li key={p.id ?? index} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(feature)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                    index === active ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/20"
                    style={{ backgroundColor: p.colour ?? '#94a3b8' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">
                      {p.farmer_name || 'Unassigned parcel'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {p.parcel_number || `Parcel #${p.id}`}
                      {p.barangay ? ` · ${p.barangay}` : ''}
                      {p.commodity ? ` · ${p.commodity}` : ''}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-slate-500">
                    {featureHectares(feature).toFixed(2)} ha
                  </span>
                </button>
              </li>
            );
          })}

          {results.length > MAX_RESULTS && (
            <li className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
              {results.length - MAX_RESULTS} more match — keep typing to narrow it down.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
