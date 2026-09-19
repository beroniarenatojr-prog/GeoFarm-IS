import AdminLayout from '@/Layouts/AdminLayout';
import { Link } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CalendarDays, Landmark, MapPinned, Pencil, Sprout, User,
} from 'lucide-react';

/**
 * One parcel, read-only.
 *
 * The route behind this (parcels.show) existed in routes/web.php from the
 * start but had no controller method and no page, so /admin/parcels/{id}
 * returned a 500. Deliberately read-only: "view parcels" is a separate
 * permission from "edit parcels", and staff holding only the former are
 * entitled to look at a parcel without being sent to an editor they cannot use.
 *
 * Nothing here is computed or inferred. Every value comes from the registry,
 * and a field the office has not filled in shows as "Not recorded" rather than
 * as a guess or a blank that reads like zero.
 */
function Field({ label, value, mono }) {
  const empty = value === null || value === undefined || value === '';

  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm ${empty ? 'text-slate-400' : 'text-slate-800'} ${mono ? 'font-mono' : ''}`}>
        {empty ? 'Not recorded' : value}
      </dd>
    </div>
  );
}

function Card({ title, icon: Icon, children, aside }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const yesNo = (value) => (value ? 'Yes' : 'No');

export default function ParcelShow({ parcel, farmer, seasons, geojson }) {
  const { can } = usePermissions();

  const boundaryLabel = parcel.boundary_source === 'drawn'
    ? 'Sketched on the map'
    : parcel.boundary_source
      ? `Surveyed — ${parcel.boundary_source}`
      : null;

  return (
    <AdminLayout
      title={parcel.parcel_number || `Parcel #${parcel.id}`}
      backHref="/admin/parcels"
      backLabel="All parcels"
    >
      <div className="space-y-4">

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              Farm parcel
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {parcel.parcel_number || `Parcel #${parcel.id}`}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {[parcel.barangay, parcel.municipality, parcel.province].filter(Boolean).join(', ')
                || 'Location not recorded'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Only offered when the parcel actually has an outline to show —
                a link to the map for a parcel with no boundary lands on an
                empty view and looks like the map is broken. */}
            {parcel.has_boundary && (
              <Link
                href={`/admin/gis/map?parcel=${parcel.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <MapPinned className="h-4 w-4" aria-hidden="true" />
                View on map
              </Link>
            )}

            {can('edit parcels') && (
              <Link
                href={`/admin/parcels/${parcel.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit parcel
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Parcel details" icon={Landmark}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Recorded area" value={parcel.area_ha ? `${parcel.area_ha} ha` : null} />
              <Field label="Commodity" value={parcel.commodity} />
              <Field label="Farm type" value={parcel.farm_type} />
              <Field label="Ownership" value={parcel.ownership} />
              <Field label="Land owner" value={parcel.land_owner} />
              <Field label="Cropping schedule" value={parcel.cropping_schedule} />
              <Field label="Heads / trees" value={parcel.no_of_heads_trees} />
              <Field label="Organic" value={yesNo(parcel.is_organic)} />
              <Field label="Within ancestral domain" value={yesNo(parcel.within_ancestral)} />
              <Field label="Agrarian reform beneficiary" value={yesNo(parcel.arb)} />
              <div className="col-span-2">
                <Field label="Address" value={parcel.location} />
              </div>
            </dl>
          </Card>

          <div className="space-y-4">
            <Card title="Farmer" icon={User}>
              {farmer ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2">
                      <Field label="Name" value={farmer.name} />
                    </div>
                    <Field label="RSBSA no." value={farmer.rsbsa_no} mono />
                    <Field label="Barangay" value={farmer.barangay} />
                    <Field label="Contact" value={farmer.contact} mono />
                  </dl>

                  {can('view farmers') && (
                    <Link
                      href={`/admin/farmers/${farmer.id}`}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                      View farmer
                    </Link>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  This parcel is not assigned to a farmer.
                </p>
              )}
            </Card>

            <Card title="Boundary" icon={MapPinned}>
              {parcel.has_boundary ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Source" value={boundaryLabel} />
                  <Field
                    label="Recorded on"
                    value={parcel.boundary_imported_at
                      ? new Date(parcel.boundary_imported_at).toLocaleString(undefined, {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })
                      : null}
                  />
                </dl>
              ) : (
                <p className="text-sm text-slate-500">
                  No boundary has been mapped for this parcel yet.
                  {can('edit parcels') && ' Use Draw or Import on the GIS map to add one.'}
                </p>
              )}
            </Card>
          </div>
        </div>

        <Card
          title="Cropping history"
          icon={Sprout}
          aside={<span className="text-xs text-slate-500">{seasons.length} record{seasons.length === 1 ? '' : 's'}</span>}
        >
          {seasons.length === 0 ? (
            <p className="text-sm text-slate-500">No cropping seasons recorded for this parcel.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Crop', 'Season', 'Year', 'Area planted', 'Yield'].map((head, index) => (
                      <th
                        key={head}
                        scope="col"
                        className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                          index > 2 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {seasons.map((season, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-slate-800">{season.crop ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{season.season ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-slate-400" aria-hidden="true" />
                          {season.year ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {season.area_planted ? `${season.area_planted} ha` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {season.yield_kg ? `${Number(season.yield_kg).toLocaleString()} kg` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Present so the page is honest about what it holds; the map is the
            place to actually look at the shape. */}
        {geojson && (
          <p className="text-xs text-slate-400">
            A boundary geometry is stored for this parcel. Open it on the GIS
            map to see the outline on satellite imagery.
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
