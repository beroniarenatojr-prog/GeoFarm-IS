import { useEffect, useState } from 'react';
import { ClipboardList, MapPin } from 'lucide-react';

/**
 * Which intervention authorised this release.
 *
 * Optional by design. Assistance is legitimately farmer-level as often as it
 * is tied to a piece of work — a fuel subsidy round is not about one visit —
 * and the column has always been nullable, so "not linked" stays a valid and
 * unremarkable answer rather than something the form nags about.
 *
 * The list is scoped to the chosen farmer by the endpoint, which reads it off
 * the relation. That keeps a wrong choice off the screen; it is not the check.
 * AssistanceController re-verifies ownership on submit and refuses an
 * intervention belonging to someone else, because an id can be posted without
 * ever touching this component.
 *
 * Nothing about the farmer, parcel or barangay is duplicated here — each is
 * read from the intervention that owns it and shown for confirmation only.
 */
const STATUS_STYLES = {
  pending:     'bg-amber-100 text-amber-800',
  assigned:    'bg-sky-100 text-sky-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed:   'bg-emerald-100 text-emerald-800',
};

const titleCase = (value) => String(value ?? '')
  .replace(/_/g, ' ')
  .replace(/^\w/, (c) => c.toUpperCase());

export default function InterventionPicker({
  farmerId,
  parcelId,
  value,
  onChange,
  error,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Clearing the farmer clears the link: an intervention belongs to the
    // farmer it was raised for, so it cannot survive a change of beneficiary.
    if (!farmerId) {
      setOptions([]);
      setFailed(false);
      if (value) onChange('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetch(`/admin/farmers/${farmerId}/intervention-options`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setOptions(list);

        // A selection that is not this farmer's must not survive. The server
        // would refuse it anyway; dropping it here means staff find out now
        // rather than at submit.
        if (value && !list.some((row) => String(row.id) === String(value))) {
          onChange('');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // `value` and `onChange` are deliberately not dependencies: re-running this
    // on every selection would refetch the list each time one was picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerId]);

  /*
   * Interventions about the chosen parcel first.
   *
   * When staff have named a parcel, the work concerning that land is almost
   * always what they are recording against. Farmer-level interventions stay in
   * the list underneath rather than being filtered out — a fuel subsidy is
   * farmer-level and would otherwise vanish the moment a parcel was picked.
   */
  const ordered = parcelId
    ? [...options].sort((a, b) => {
      const aMatch = String(a.parcel_id ?? '') === String(parcelId) ? 1 : 0;
      const bMatch = String(b.parcel_id ?? '') === String(parcelId) ? 1 : 0;
      return bMatch - aMatch;
    })
    : options;

  const selected = options.find((row) => String(row.id) === String(value));

  return (
    <div>
      <label htmlFor="intervention-picker" className="mb-1.5 block text-sm font-semibold text-gray-700">
        Intervention <span className="font-normal text-gray-500">(optional)</span>
      </label>

      <select
        id="intervention-picker"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={!farmerId || loading}
        className={`w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
      >
        <option value="">
          {!farmerId ? 'Select a farmer first'
            : loading ? 'Loading interventions…'
              : failed ? 'Could not load interventions'
                : options.length === 0 ? 'This farmer has no interventions on record'
                  : 'Not linked to an intervention'}
        </option>

        {ordered.map((row) => (
          <option key={row.id} value={row.id}>
            {row.title}
            {row.parcel_number ? ` — ${row.parcel_number}` : ' — farmer-level'}
            {` — ${titleCase(row.status)}`}
            {String(row.parcel_id ?? '') === String(parcelId ?? '') && parcelId ? '  ★ this parcel' : ''}
          </option>
        ))}
      </select>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {failed && (
        <p className="mt-1 text-xs text-amber-700">
          The intervention list could not be loaded. The release can still be
          recorded without one.
        </p>
      )}

      {!error && !failed && farmerId && !loading && options.length === 0 && (
        <p className="mt-1 text-xs text-gray-500">
          Nothing to link to yet. Releases do not need an intervention.
        </p>
      )}

      {/*
          Confirmation of what is about to be linked. Every value here is read
          off the intervention itself — none of it is stored again on the
          release, which carries only the foreign key.
      */}
      {selected && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-emerald-900">
            <ClipboardList className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            <span className="min-w-0 truncate">{selected.title}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-emerald-800">
            <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_STYLES[selected.status] ?? 'bg-slate-100 text-slate-700'}`}>
              {titleCase(selected.status)}
            </span>
            <span>{selected.source === 'manual' ? 'Manual' : 'From farm analysis'}</span>
            {selected.parcel_number ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {selected.parcel_number}
                {selected.barangay ? `, ${selected.barangay}` : ''}
              </span>
            ) : (
              <span>Farmer-level — no particular parcel</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
