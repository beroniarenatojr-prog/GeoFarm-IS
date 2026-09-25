import { useEffect, useMemo, useRef, useState } from 'react';
import { PencilRuler, QrCode, Search, X } from 'lucide-react';

/**
 * Choose the parcel that Draw, Import and Delete will act on.
 *
 * This replaces a <select> holding every parcel in the registry. A native
 * dropdown of 76 options — soon hundreds — can only be searched by typing the
 * first characters of the option text, which here was the parcel number. So
 * finding "Rodolfo Bacud's parcel in Sta. Isabel Sur" meant scrolling a list
 * sorted by a number nobody memorises, and the hint underneath told staff to
 * use the OTHER search box, above the map, to find out which number they
 * wanted first. Two searches for one parcel.
 *
 * Typing here matches parcel number, farmer, RSBSA number, barangay and
 * commodity at once. Nothing is written by anything in this file: it reports a
 * chosen id upward and the page decides what that means.
 */
const MAX_RESULTS = 8;

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();

const fullName = (farmer) => [farmer?.first_name, farmer?.last_name]
  .filter(Boolean)
  .join(' ');

const parcelLabel = (parcel) => parcel?.parcel_number || `Parcel #${parcel?.id}`;

/** Everything about one parcel that someone might type to find it. */
const haystack = (parcel) => [
  parcelLabel(parcel),
  fullName(parcel.farmer),
  parcel.farmer?.rsbsa_no,
  parcel.barangay,
  parcel.commodity,
].map(lower);

export default function TargetParcelPicker({
  options,
  value,
  onSelect,
  onScan,
  scanBusy = false,
  canScan = true,
  query,
  onQueryChange,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const boxRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => options.find((parcel) => String(parcel.id) === String(value)) ?? null,
    [options, value],
  );

  const matches = useMemo(() => {
    const needle = lower(query);

    if (!needle) {
      /*
       * With nothing typed, the parcels that still need a boundary come
       * first. This control exists to aim the Draw button, and an undrawn
       * parcel is the only kind Draw has new work to do on — putting them at
       * the top means the common case needs no typing at all. Ties keep the
       * incoming order, which is already sorted by parcel number.
       */
      return [...options]
        .sort((a, b) => Number(Boolean(a.mapped)) - Number(Boolean(b.mapped)))
        .slice(0, MAX_RESULTS);
    }

    return options
      .filter((parcel) => haystack(parcel).some((field) => field.includes(needle)))
      .slice(0, MAX_RESULTS);
  }, [options, query]);

  const total = useMemo(() => {
    const needle = lower(query);
    if (!needle) return options.length;
    return options.filter((parcel) => haystack(parcel).some((f) => f.includes(needle))).length;
  }, [options, query]);

  // Reset the highlight whenever the result set changes, so Enter can never
  // select a row that scrolled out from under the cursor.
  useEffect(() => setActive(0), [query, open]);

  /*
   * A query set from outside opens the list.
   *
   * Scanning an ID card for a farmer who holds several parcels fills this box
   * with their name; without this the matches would be sitting behind a closed
   * panel and the scan would look like it had done nothing.
   */
  useEffect(() => {
    if (query) setOpen(true);
  }, [query]);

  /*
   * Bring the open list into view inside the scrolling panel.
   *
   * The control panel this sits in is capped to the map's height and scrolls
   * internally, and an absolutely positioned list inside a scroll container is
   * clipped by it. Without this, opening the picker near the bottom of the
   * panel would show a result list that was mostly below the panel's edge, and
   * the matches would look missing rather than merely out of sight.
   *
   * `block: 'nearest'` scrolls the least it can get away with, so a list that
   * already fits does not move the panel at all.
   */
  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, matches.length]);

  /*
   * Close when the click lands anywhere else.
   *
   * mousedown rather than click: a click that starts inside the list and ends
   * outside would otherwise close the panel before the option's own handler
   * ran, which reads as the selection being ignored.
   */
  useEffect(() => {
    if (!open) return undefined;

    const onDocument = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener('mousedown', onDocument);
    return () => document.removeEventListener('mousedown', onDocument);
  }, [open]);

  const choose = (parcel) => {
    onSelect(String(parcel.id));
    onQueryChange('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // Wraps, so holding one arrow key cannot strand the highlight at an end.
      setActive((i) => (matches.length ? (i + step + matches.length) % matches.length : 0));
      return;
    }

    if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="target-parcel-results"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => { onQueryChange(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={selected ? parcelLabel(selected) : 'Search parcel, farmer, barangay…'}
            aria-label="Search for the parcel to work on"
            className={`w-full rounded-md border py-2 pl-8 pr-8 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 ${
              selected ? 'border-emerald-500 placeholder:text-slate-800' : 'border-slate-300'
            }`}
          />

          {/* Clears the chosen parcel, not just the typed text — those are two
              different intentions and only one of them has a button. */}
          {(selected || query) && (
            <button
              type="button"
              onClick={() => {
                if (query) { onQueryChange(''); inputRef.current?.focus(); return; }
                onSelect('');
              }}
              title={query ? 'Clear the search' : 'Clear the selected parcel'}
              aria-label={query ? 'Clear the search' : 'Clear the selected parcel'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/*
            The same card staff already scan to find a farmer on the map, now
            able to aim the drawing tools as well. It sits beside the box it
            fills in, because scanning is an alternative to typing here, not a
            separate feature.
        */}
        {canScan && (
          <button
            type="button"
            onClick={onScan}
            disabled={scanBusy}
            title="Scan a farmer's ID card to pick their parcel"
            aria-label="Scan a farmer's ID card to pick their parcel"
            className="inline-flex flex-shrink-0 items-center justify-center rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <QrCode className={`h-4 w-4 ${scanBusy ? 'animate-pulse' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          id="target-parcel-results"
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">
              No parcel matches “{query}”.
            </li>
          ) : (
            matches.map((parcel, index) => {
              const isActive = index === active;
              const isChosen = String(parcel.id) === String(value);

              return (
                <li key={parcel.id} role="option" aria-selected={isChosen}>
                  <button
                    type="button"
                    onClick={() => choose(parcel)}
                    onMouseEnter={() => setActive(index)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                      isActive ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">{parcelLabel(parcel)}</span>
                        {/* Says which parcels still need tracing, so Draw is
                            aimed at one of them rather than found by trial. */}
                        {!parcel.mapped && (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1 py-px text-[10px] font-medium text-amber-800">
                            <PencilRuler className="h-2.5 w-2.5" aria-hidden="true" />
                            no boundary
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {fullName(parcel.farmer) || 'Unassigned'}
                        {parcel.barangay ? ` · ${parcel.barangay}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}

          {/* Says so when the list is a slice, rather than letting the 9th
              match look as though it does not exist. */}
          {total > matches.length && (
            <li className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
              Showing {matches.length} of {total}. Keep typing to narrow.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
