import { Crosshair, ExternalLink, Phone, User, X } from 'lucide-react';
import { featureHectares } from '@/utils/gisFilters';

/**
 * Everything known about the parcel the user just clicked.
 *
 * Two sources, deliberately: the GeoJSON properties are already in the browser
 * so the card can fill in the instant a polygon is clicked, and the richer
 * detail (contact number, crop seasons, assistance) arrives from
 * /admin/gis/parcels/{id} a moment later. Nothing is invented — a field that
 * the registry does not hold is shown as "—" rather than guessed, and a
 * section with no rows is not rendered at all.
 */
function Field({ label, value, mono }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {value === null || value === undefined || value === '' ? '—' : value}
      </dd>
    </div>
  );
}

export default function SelectedParcelCard({
  properties,
  detail,
  loading,
  onZoom,
  onClear,
  canViewFarmer,
  canEditParcel,
}) {
  if (!properties) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Selected farm parcel</h3>
        <p className="mt-1 text-xs text-slate-500">
          Click a parcel on the map, or pick one from the list, to see its details here.
        </p>
      </section>
    );
  }

  const farmer = detail?.farmer;
  const seasons = detail?.crop_seasons ?? [];
  const assistance = detail?.assistance ?? [];
  const interventions = detail?.interventions ?? [];

  const boundaryLabel = properties.boundary_source === 'drawn'
    ? 'Sketched on the map'
    : properties.boundary_source
      ? `Surveyed (${properties.boundary_source})`
      : '—';

  return (
    <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="selected-parcel-heading">
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 p-3">
        <div className="min-w-0">
          <h3 id="selected-parcel-heading" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Selected farm parcel
          </h3>
          <p className="mt-0.5 flex items-center gap-2 text-base font-semibold text-slate-900">
            <span
              aria-hidden="true"
              className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-black/20"
              style={{ backgroundColor: properties.colour ?? '#94a3b8' }}
            />
            <span className="truncate">{properties.parcel_number || `Parcel #${properties.id}`}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          title="Clear selection"
          aria-label="Clear selection"
          className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-3">
        <Field label="Farmer" value={properties.farmer_name} />
        <Field label="RSBSA no." value={properties.rsbsa_no} mono />
        <Field label="Barangay" value={properties.barangay} />
        <Field label="Area (drawn)" value={`${featureHectares({ properties }).toFixed(2)} ha`} />
        <Field label="Commodity" value={properties.commodity} />
        <Field label="Farm type" value={properties.farm_type} />
        <Field label="Boundary" value={boundaryLabel} />
        <Field
          label="Risk status"
          value={properties.risk_status
            ? properties.risk_status.charAt(0).toUpperCase() + properties.risk_status.slice(1)
            : 'Not assessed'}
        />
      </dl>

      {/* Only from the detail fetch, and only when it actually returned something. */}
      {loading && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Loading farm details…
        </p>
      )}

      {!loading && farmer?.contact && (
        <p className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm text-slate-700">
          <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <a href={`tel:${farmer.contact}`} className="font-mono hover:underline">{farmer.contact}</a>
        </p>
      )}

      {!loading && seasons.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Recent cropping
          </h4>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {seasons.slice(0, 3).map((season, index) => (
              <li key={index} className="flex justify-between gap-2">
                <span className="truncate">{season.crop ?? '—'} · {season.season ?? '—'} {season.year ?? ''}</span>
                <span className="flex-shrink-0 tabular-nums text-slate-500">
                  {season.yield_kg ? `${Number(season.yield_kg).toLocaleString()} kg` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
          What the office has done about this farmer's land.

          Read only — the GIS shows these relationships, it never creates them.
          Interventions concerning the parcel just clicked come first; the rest
          are this farmer's other open work, which is context a field officer
          standing on the parcel usually wants.
      */}
      {!loading && interventions.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Interventions
          </h4>
          <ul className="mt-1 space-y-1">
            {interventions.slice(0, 4).map((row) => (
              <li key={row.id} className="text-xs">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-700">
                    {row.is_this_parcel && (
                      <span className="mr-1 text-emerald-700" title="Concerns this parcel">●</span>
                    )}
                    {row.title}
                  </span>
                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    row.status === 'completed' ? 'bg-emerald-100 text-emerald-800'
                      : row.status === 'cancelled' ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    {String(row.status ?? '').replace(/_/g, ' ')}
                  </span>
                </span>
                <span className="block text-[11px] text-slate-500">
                  {row.source === 'manual' ? 'Manual' : 'From analysis'}
                  {row.parcel ? ` · ${row.parcel}` : ' · farmer-level'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && assistance.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Assistance received
          </h4>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {assistance.slice(0, 3).map((given, index) => (
              <li key={index} className="truncate">
                {given.program ?? '—'}
                {given.date ? ` · ${given.date}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={onZoom}
          title="Zoom the map to this parcel"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          Zoom to parcel
        </button>

        {/*
            Points at the EDIT page, not /admin/parcels/{id}.

            That second URL is declared in routes/web.php as parcels.show, but
            ParcelController has no show() method and no Parcels/Show.jsx
            exists, so it returns a 500. Nothing else in the app ever linked to
            it, which is why the route had sat broken unnoticed.

            The permission matches the destination's own middleware — the edit
            route requires "edit parcels", so gating this on "view parcels"
            would hand a viewer a button that 403s.
        */}
        {canEditParcel && (
          <a
            href={`/admin/parcels/${properties.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open parcel
          </a>
        )}

        {canViewFarmer && properties.farmer_id && (
          <a
            href={`/admin/farmers/${properties.farmer_id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <User className="h-3.5 w-3.5" aria-hidden="true" />
            View farmer
          </a>
        )}
      </footer>
    </section>
  );
}
