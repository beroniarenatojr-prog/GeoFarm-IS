import AdminLayout from '@/Layouts/AdminLayout';
import { Link } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Activity, ClipboardList, Gift, MapPinned, Sparkles, User, Wrench,
} from 'lucide-react';

/**
 * One intervention, end to end.
 *
 * The chain in a single view: what the analysis found, what the office decided
 * to do, what was actually done, and what the farmer received. Those four live
 * in four tables and until now took four screens to read together.
 *
 * Nothing here is recomputed. The farmer's name comes off the farmer, the
 * barangay, commodity and area off the parcel, and the assistance off the
 * releases — no value is duplicated into the intervention itself.
 */

/** Status colours, matching the queue so the two pages agree. */
const STATUS_STYLES = {
  pending:     'bg-amber-100 text-amber-800 ring-amber-200',
  assigned:    'bg-sky-100 text-sky-800 ring-sky-200',
  in_progress: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  completed:   'bg-emerald-100 text-emerald-800 ring-emerald-200',
  cancelled:   'bg-slate-100 text-slate-600 ring-slate-200',
};

const PRIORITY_STYLES = {
  high:   'bg-rose-100 text-rose-800 ring-rose-200',
  medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  low:    'bg-slate-100 text-slate-700 ring-slate-200',
};

/*
 * "Claimed" is what the database stores and "Released" is what the office
 * says. Relabelled here only — the stored value is untouched, because
 * rewriting an enum across live distribution records to change a word would
 * risk real disbursement history.
 */
const ASSISTANCE_STATUS = {
  pending:   { label: 'Pending',   style: 'bg-amber-100 text-amber-800' },
  claimed:   { label: 'Released',  style: 'bg-emerald-100 text-emerald-800' },
  forfeited: { label: 'Forfeited', style: 'bg-slate-100 text-slate-600' },
};

const titleCase = (value) => String(value ?? '')
  .replace(/_/g, ' ')
  .replace(/^\w/, (c) => c.toUpperCase());

function Pill({ children, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

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

function Section({ title, icon: Icon, children, aside }) {
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

export default function InterventionShow({
  intervention, farmer, parcel, analysis, recommendation, actions, assistance,
}) {
  const { can } = usePermissions();
  const fromAnalysis = intervention.source === 'analysis';

  return (
    <AdminLayout
      title={intervention.display_title}
      backHref="/admin/interventions"
      backLabel="Intervention queue"
    >
      <div className="space-y-4">

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill className={fromAnalysis
                ? 'bg-violet-100 text-violet-800 ring-violet-200'
                : 'bg-slate-100 text-slate-700 ring-slate-200'}
              >
                {fromAnalysis ? 'From farm analysis' : 'Manual intervention'}
              </Pill>
              <Pill className={STATUS_STYLES[intervention.status] ?? STATUS_STYLES.pending}>
                {titleCase(intervention.status)}
              </Pill>
              <Pill className={PRIORITY_STYLES[intervention.priority] ?? PRIORITY_STYLES.medium}>
                {titleCase(intervention.priority)} priority
              </Pill>
              {intervention.is_overdue && (
                <Pill className="bg-rose-100 text-rose-800 ring-rose-200">Overdue</Pill>
              )}
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {intervention.display_title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {intervention.type_label}
              {intervention.created_at ? ` · opened ${intervention.created_at}` : ''}
              {intervention.created_by ? ` by ${intervention.created_by}` : ''}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Intervention" icon={ClipboardList}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Type" value={intervention.type_label} />
              <Field label="Status" value={titleCase(intervention.status)} />
              <Field label="Priority" value={titleCase(intervention.priority)} />
              <Field label="Responsible staff" value={intervention.assignee} />
              <Field label="Target date" value={intervention.target_date} />
              <Field label="Completed on" value={intervention.completed_at} />
              <div className="col-span-2">
                <Field label="Reason" value={intervention.reason} />
              </div>
            </dl>
          </Section>

          <Section title="Farm & beneficiary" icon={User}>
            {farmer ? (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-2">
                    <Field label="Farmer" value={farmer.name} />
                  </div>
                  <Field label="RSBSA no." value={farmer.rsbsa_no} mono />
                  <Field label="Contact" value={farmer.contact} mono />
                  {/* Derived from the parcel where there is one, and from the
                      farmer otherwise. Never typed twice. */}
                  <Field label="Barangay" value={parcel?.barangay || farmer.barangay} />
                  <Field label="Parcel" value={parcel?.parcel_number} />
                  <Field label="Commodity" value={parcel?.commodity} />
                  <Field label="Area" value={parcel?.area_ha ? `${parcel.area_ha} ha` : null} />
                </dl>

                {!parcel && (
                  <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                    Farmer-level intervention — it does not concern one particular parcel.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {can('view farmers') && (
                    <Link
                      href={`/admin/farmers/${farmer.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                      View farmer
                    </Link>
                  )}
                  {parcel && can('view maps') && (
                    <Link
                      href={`/admin/gis/map?parcel=${parcel.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
                      View on map
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No farmer is attached to this intervention.</p>
            )}
          </Section>
        </div>

        <Section title="Farm analysis" icon={Sparkles}>
          {fromAnalysis && (analysis || recommendation) ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Finding" value={recommendation?.title} />
              <Field label="Risk level" value={titleCase(analysis?.risk_level)} />
              <div className="col-span-2">
                <Field label="Need / recommendation" value={recommendation?.reason || intervention.reason} />
              </div>
              <Field label="Risk factor" value={titleCase(analysis?.factor_key)} />
              <Field label="Assessed on" value={analysis?.assessed_on} />
            </dl>
          ) : (
            /* Stated plainly. An empty section here would read as missing
               data rather than as a deliberate entry path. */
            <p className="text-sm text-slate-500">
              {fromAnalysis
                ? 'This intervention came from the farm analysis, but the assessment behind it is no longer on record.'
                : 'Manual intervention — no farm analysis linked.'}
            </p>
          )}
        </Section>

        <Section
          title="Action"
          icon={Wrench}
          aside={<span className="text-xs text-slate-500">{actions.length} logged</span>}
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Planned action / notes" value={intervention.notes} />
            <Field label="Actual action taken" value={intervention.action_taken} />
            <Field label="Follow-up date" value={intervention.follow_up_date} />
            <Field label="Follow-up notes" value={intervention.follow_up_notes} />
          </dl>

          {actions.length > 0 && (
            <ul className="mt-4 space-y-3 border-t border-slate-100 pt-3">
              {actions.map((action) => (
                <li key={action.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{action.action_date}</span>
                    <span className="text-xs text-slate-500">{action.performed_by || 'Staff not recorded'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{action.action}</p>
                  {action.result && <p className="mt-1 text-xs text-slate-600"><strong>Result:</strong> {action.result}</p>}
                  {action.farmer_response && <p className="mt-0.5 text-xs text-slate-600"><strong>Farmer response:</strong> {action.farmer_response}</p>}
                  {action.resources_provided && <p className="mt-0.5 text-xs text-slate-600"><strong>Resources:</strong> {action.resources_provided}</p>}
                  {action.next_action && <p className="mt-0.5 text-xs text-slate-600"><strong>Next:</strong> {action.next_action}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Assistance"
          icon={Gift}
          aside={
            <span className="text-xs text-slate-500">
              {assistance.length} record{assistance.length === 1 ? '' : 's'}
            </span>
          }
        >
          {assistance.length === 0 ? (
            <div className="text-sm text-slate-500">
              <p>No assistance has been recorded against this intervention yet.</p>
              {can('edit assistance') && (
                <Link
                  href="/admin/assistance"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                  Record a release
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Programme', 'Type', 'Quantity', 'Amount', 'Reference', 'Date', 'Status'].map((head, i) => (
                      <th
                        key={head}
                        scope="col"
                        className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                          i === 2 || i === 3 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assistance.map((given) => {
                    const status = ASSISTANCE_STATUS[given.status]
                      ?? { label: titleCase(given.status), style: 'bg-slate-100 text-slate-600' };

                    return (
                      <tr key={given.id}>
                        <td className="px-3 py-2 text-slate-800">{given.program ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{given.type ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {given.quantity ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {given.amount ? `₱${Number(given.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{given.reference_no ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{given.date ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.style}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          Intervention status is the office&rsquo;s action. Assistance status is the
          benefit itself — an intervention can still be in progress while one of
          its releases has already gone out.
        </p>
      </div>
    </AdminLayout>
  );
}
