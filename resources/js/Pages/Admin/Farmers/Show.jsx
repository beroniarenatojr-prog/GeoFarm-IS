import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
// Map is aliased: imported under its own name it shadows the global Map for
// this whole module, so any `new Map()` added here later would build a lucide
// icon and throw "is not a constructor" — which blanked the farmer edit page
// once already this week.
import { User, MapPin, Phone, Mail, Calendar, Map as MapIcon, Users, Award, Download, TreePine, Fish, Beef, Egg, Printer, Sprout, IdCard, Pencil, Trash2, ShieldAlert, CloudRain, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '@/Components/ui/DataTable';
import Tabs from '@/Components/ui/Tabs';
import MapViewer from '@/Components/ui/MapViewer';
import Badge from '@/Components/ui/Badge';
import Modal from '@/Components/ui/Modal';
import ModalShell from '@/Components/ui/ModalShell';
import Card from '@/Components/ui/Card';
import Skeleton from '@/Components/ui/Skeleton';
import TreeCropForm from '@/Components/AgriAssets/TreeCropForm';
import FishpondForm from '@/Components/AgriAssets/FishpondForm';
import LivestockForm from '@/Components/AgriAssets/LivestockForm';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

/* ------------------------------------------------- profile display helpers */

const yesNo = (value) => (value === null || value === undefined ? null : value ? 'Yes' : 'No');

/** Joins the parts that are actually filled in, or null when none are. */
const joined = (parts, separator = ', ') => {
  const filled = parts.filter(Boolean);
  return filled.length ? filled.join(separator) : null;
};

function Section({ icon: Icon, title, children }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h4 className="font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <Icon className="h-5 w-5 text-green-600" />
        {title}
      </h4>
      <dl className="space-y-2.5">{children}</dl>
    </div>
  );
}

/** A single label/value pair. Blank values still render, so staff can see at a
 *  glance which parts of the RSBSA record are still missing. */
function Field({ label, value }) {
  const empty = value === null || value === undefined || value === '';

  return (
    <div className="grid grid-cols-5 gap-3 text-sm">
      <dt className="col-span-2 text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`col-span-3 ${empty ? 'text-gray-400 italic' : 'font-medium text-gray-900 dark:text-gray-100'}`}>
        {empty ? 'Not provided' : value}
      </dd>
    </div>
  );
}

/* ------------------------------------------- climate & financial risk panel */

const RISK_TONE = {
  low:      'bg-green-100 text-green-800',
  moderate: 'bg-amber-100 text-amber-800',
  high:     'bg-red-100 text-red-700',
};

/**
 * Turns an instrument key back into words.
 *
 * The questionnaire stores keys — flood_frequency: "very_frequently" — because
 * the label is display text that gets reworded (it was translated into Tagalog
 * only this week) while the key is what the score was computed from. Reading
 * one back means undoing that here rather than storing prose in the column.
 */
const readable = (key) =>
  typeof key !== 'string' || key === ''
    ? null
    : key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const readableList = (keys) =>
  Array.isArray(keys) && keys.length ? keys.map(readable).join(', ') : null;

const onDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

/** Null rather than ₱0, so Field renders "Not provided" for an unanswered amount. */
const peso = (value) =>
  value === null || value === undefined || value === ''
    ? null
    : `₱${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/**
 * What the farmer answered, for the person advising them.
 *
 * Read-only on purpose. The questionnaire is the farmer's own account of their
 * season, and staff editing those answers would quietly turn a survey response
 * into an office opinion while leaving the risk score attached to it.
 */
function RiskAssessmentTab({ latest, history = [] }) {
  if (!latest) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-3 font-medium text-gray-700">No risk assessment yet</p>
        <p className="mt-1 text-sm text-gray-500">
          This farmer has not completed the climate and financial risk questionnaire.
          They can fill it in from their own portal, or ask them at the counter.
        </p>
      </div>
    );
  }

  const previous = history.filter((row) => row.id !== latest.id);

  return (
    <div className="space-y-5">
      {/* Headline: the level, the score, and how old the answer is */}
      <div className="rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide ${RISK_TONE[latest.risk_level] ?? 'bg-gray-100 text-gray-700'}`}>
            {readable(latest.risk_level) ?? 'Not scored'} risk
          </span>
          {/* A score, never a probability — nothing has been fitted against
              outcomes, so a percentage would claim a precision the rules
              do not have. Same wording the farmer sees on the portal. */}
          <span className="text-sm text-gray-500">
            Risk score {latest.risk_score ?? '—'} of 100
          </span>
          {latest.is_stale && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Over a year old
            </span>
          )}
          <span className="text-sm text-gray-500">Assessed {onDate(latest.assessed_at) ?? 'date not recorded'}</span>
        </div>

        {latest.risk_factors?.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Main risk factors</p>
            <ul className="mt-1.5 space-y-1">
              {latest.risk_factors.map((factor, i) => (
                <li key={factor.key ?? i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
                  {factor.label ?? readable(factor.key)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {latest.recommendations?.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recommended actions</p>
            <ul className="mt-1.5 space-y-2">
              {latest.recommendations.map((item, i) => (
                <li key={item.key ?? i} className="flex items-start gap-2 text-sm leading-relaxed text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[#006400]" />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* The answers behind the score */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section icon={CloudRain} title="Climate and weather">
          <Field label="Events experienced" value={readableList(latest.climate_events)} />
          <Field label="Flooding" value={readable(latest.flood_frequency)} />
          <Field label="Drought" value={readable(latest.drought_frequency)} />
          <Field label="Extreme heat" value={readable(latest.heat_frequency)} />
          <Field label="Storms / strong winds" value={readable(latest.storm_frequency)} />
        </Section>

        <Section icon={TrendingDown} title="Effect on production">
          <Field label="Worst effect" value={readable(latest.worst_effect)} />
          <Field label="Losses experienced" value={readableList(latest.loss_types)} />
          <Field label="Financial loss" value={readable(latest.had_financial_loss)} />
          <Field label="Estimated loss" value={peso(latest.estimated_loss_amount)} />
          <Field label="Costs increased" value={readable(latest.had_cost_increase)} />
          <Field label="Estimated extra cost" value={peso(latest.estimated_extra_cost)} />
          <Field label="Against last season" value={readable(latest.season_comparison)} />
        </Section>

        <Section icon={Sprout} title="Adaptation">
          <Field label="Practices used" value={readableList(latest.adaptation_practices)} />
          <Field label="How effective" value={readable(latest.adaptation_effectiveness)} />
          <Field label="Main barrier" value={readable(latest.adaptation_barrier)} />
        </Section>

        <Section icon={Award} title="Assistance and expectation">
          <Field label="Received assistance" value={readable(latest.received_assistance)} />
          <Field label="Type received" value={readableList(latest.assistance_types)} />
          <Field label="How helpful" value={readable(latest.assistance_helpfulness)} />
          <Field label="Farmer expects loss" value={readable(latest.perceived_risk)} />
          <Field label="Factors they expect" value={readableList(latest.anticipated_factors)} />
        </Section>
      </div>

      {previous.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-5">
          <h4 className="mb-3 font-semibold text-gray-900">Previous assessments</h4>
          {/* Kept rather than overwritten, so a farmer moving from high to
              moderate is visible instead of silently replaced. */}
          <ul className="space-y-2">
            {previous.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${RISK_TONE[row.risk_level] ?? 'bg-gray-100 text-gray-700'}`}>
                  {readable(row.risk_level) ?? 'Not scored'}
                </span>
                <span className="text-gray-500">Score {row.risk_score ?? '—'}</span>
                <span className="text-gray-500">{onDate(row.assessed_at) ?? 'date not recorded'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400">
        A preliminary rule-based assessment from the farmer&rsquo;s recorded data and their own
        questionnaire answers — not a statistical prediction. The suggested actions are general
        guidance, not a technical prescription.
      </p>
    </div>
  );
}

function DocumentPreview({ label, path }) {
  if (!path) {
    return (
      <div>
        <p className="text-sm text-gray-500 mb-2">{label}</p>
        <div className="h-32 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs text-gray-400 italic">
          Not uploaded
        </div>
      </div>
    );
  }

  const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(path);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      <a
        href={`/storage/${path}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-32 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:ring-2 hover:ring-green-500 transition"
        title={`Open ${label.toLowerCase()} in a new tab`}
      >
        {isImage ? (
          <img src={`/storage/${path}`} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800 text-gray-500">
            <Download className="h-6 w-6" />
            <span className="text-xs font-medium">Open file</span>
          </div>
        )}
      </a>
    </div>
  );
}

export default function FarmerShow({ farmer }) {
  const { can } = usePermissions();

  const sumHeads = (rows) => (rows || []).reduce((total, row) => total + Number(row.total_heads || 0), 0);

  // Head counts live across the legacy livestock table and the RSBSA asset
  // tables, so both have to be added up for the total to be honest.
  const summary = {
    parcels: farmer.parcels?.length || 0,
    hectares: (farmer.parcels || []).reduce((total, p) => total + Number(p.total_area_ha || 0), 0),
    animalHeads:
      (farmer.livestock || []).reduce((total, l) => total + Number(l.count || 0), 0)
      + sumHeads(farmer.large_ruminants)
      + sumHeads(farmer.small_ruminants)
      + sumHeads(farmer.native_pigs)
      + sumHeads(farmer.swine_hybrid)
      + sumHeads(farmer.poultry),
    treeCrops: farmer.tree_crops?.length || 0,
    fishponds: farmer.fishponds?.length || 0,
    assistance: farmer.distributions?.length || 0,
    seasons: farmer.crop_seasons?.length || 0,
  };

  // Planted area is reported for the latest cropping year only. Summing every
  // season on record adds the same land back once per season and once per
  // year, which produces a "hectares" figure larger than the farm itself.
  const latestYear = (farmer.crop_seasons || [])
    .reduce((max, s) => Math.max(max, Number(s.cropping_year) || 0), 0);
  const plantedLatest = (farmer.crop_seasons || [])
    .filter(s => Number(s.cropping_year) === latestYear)
    .reduce((total, s) => total + Number(s.area_planted_ha || 0), 0);

  const hasProvincialAddress = [
    farmer.provincial_house_lot,
    farmer.provincial_street_sitio,
    farmer.provincial_barangay,
    farmer.provincial_city_municipality,
    farmer.provincial_province,
    farmer.provincial_region,
  ].some(Boolean);
  const [loading, setLoading] = useState(false);
  const [assetModal, setAssetModal] = useState({ open: false, type: null, record: null });
  const [emailOpen, setEmailOpen] = useState(false);

  /* The manual message to this farmer. Note what the form does NOT hold: a
     recipient. The address is displayed from the record and resolved again on
     the server, so nothing here can redirect where the mail goes. */
  const emailForm = useForm({ subject: '', message: '' });

  const sendEmail = (e) => {
    e.preventDefault();

    emailForm.post(`/admin/farmers/${farmer.id}/send-email`, {
      preserveScroll: true,
      onSuccess: () => {
        // Only cleared on success — a rejected message keeps what was typed.
        emailForm.reset();
        setEmailOpen(false);
      },
    });
  };

  const parcelsData = (farmer.parcels || []).map(p => ({
    id: p.id,
    parcel_number: p.parcel_number || '—',
    barangay: p.barangay,
    area: `${p.total_area_ha} ha`,
    // What is actually grown or raised on the parcel, with the head/tree count
    // beside it when one was recorded — the RSBSA form asks for the pair.
    commodity: p.commodity
      ? p.commodity + (p.no_of_heads_trees ? ` (${p.no_of_heads_trees})` : '')
      : '—',
    type: p.farm_type?.type_name || '—',
    ownership: p.ownership_type || '—',
  }));

  // Cropping seasons reach the farmer through their parcels, so a farmer with
  // fifty seasons recorded used to show nothing here at all.
  const cropsData = (farmer.crop_seasons || []).map(s => ({
    id: s.id,
    crop: s.crop?.crop_name || '—',
    season: s.season ? s.season[0].toUpperCase() + s.season.slice(1) : '—',
    year: s.cropping_year ?? '—',
    parcel: s.parcel?.parcel_number ? `#${s.parcel.parcel_number}` : '—',
    area: s.area_planted_ha != null ? `${Number(s.area_planted_ha).toFixed(2)} ha` : '—',
    yield: s.yield_kg != null
      ? `${Number(s.yield_kg).toLocaleString('en-PH', { maximumFractionDigits: 0 })} kg`
      : 'Not harvested',
  }));

  const livestockData = (farmer.livestock || []).map(l => ({
    id: l.id,
    type: l.livestock_type?.type_name || '—',
    breed: l.breed || '—',
    count: l.count,
    purpose: l.purpose || '—',
    health: l.health_status || 'Good',
  }));

  const parcelsColumns = [
    { header: 'Parcel #', accessorKey: 'parcel_number' },
    { header: 'Barangay', accessorKey: 'barangay' },
    { header: 'Area', accessorKey: 'area' },
    // Shown exactly as stored. The values are inconsistently cased ("Corn"
    // beside "corn"); tidying that belongs in the data, not behind a CSS class
    // that hides it from whoever has to clean it up.
    { header: 'Commodity', accessorKey: 'commodity' },
    { header: 'Type', accessorKey: 'type' },
    { header: 'Ownership', accessorKey: 'ownership' },
  ];

  const cropsColumns = [
    { header: 'Crop', accessorKey: 'crop' },
    { header: 'Season', accessorKey: 'season' },
    { header: 'Year', accessorKey: 'year' },
    { header: 'Parcel', accessorKey: 'parcel' },
    { header: 'Area', accessorKey: 'area' },
    { header: 'Yield', accessorKey: 'yield' },
  ];

  const livestockColumns = [
    { header: 'Type', accessorKey: 'type' },
    { header: 'Breed', accessorKey: 'breed' },
    { header: 'Count', accessorKey: 'count' },
    { header: 'Purpose', accessorKey: 'purpose' },
    { header: 'Health', accessorKey: 'health' },
  ];

  const handleDelete = () => {
    if (confirm('Delete this farmer and all associated data?')) {
      setLoading(true);
      router.delete(`/admin/farmers/${farmer.id}`, {
        onSuccess: () => {
          toast.success('Farmer deleted successfully');
          router.visit('/admin/farmers');
        },
        onError: () => setLoading(false),
      });
    }
  };

  // Mock geojson - backend will provide real
  const mockGeoJSON = {
    type: 'FeatureCollection',
    features: parcelsData.slice(0, 3).map((p, i) => ({
      type: 'Feature',
      properties: p,
      geometry: {
        type: 'Polygon',
        coordinates: [[ [121 + i*0.01, 14.6 + i*0.01], [121 + i*0.01, 14.6 + i*0.02], [121 + i*0.02, 14.6 + i*0.02], [121 + i*0.02, 14.6 + i*0.01] ]]
      }
    }))
  };

  return (
    <AdminLayout title={`Farmer Profile: ${farmer.last_name}, ${farmer.first_name}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Header */}
        <Card title="">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
            <div className="flex-shrink-0">
              {farmer.photo_path ? (
                <img 
                  src={`/storage/${farmer.photo_path}`} 
                  alt="Profile"
                  className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl object-cover ring-4 ring-green-200 shadow-2xl hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-32 h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl flex items-center justify-center text-4xl shadow-2xl">
                  👨‍🌾
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                {farmer.last_name}, {farmer.first_name} {farmer.middle_name}
              </h1>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="green">RSBSA: {farmer.rsbsa_no || 'N/A'}</Badge>
                {farmer.pwd && <Badge variant="blue">PWD</Badge>}
                {farmer.is_4ps && <Badge variant="purple">4Ps Beneficiary</Badge>}
                {farmer.is_indigenous && <Badge variant="orange">Indigenous People</Badge>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{farmer.barangay}, {farmer.city_municipality}</span>
                </div>
                {farmer.mobile_no && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <Phone className="h-4 w-4 text-green-600" />
                    <span>{farmer.mobile_no}</span>
                  </div>
                )}
                {farmer.email && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <Mail className="h-4 w-4 text-emerald-600" />
                    <span>{farmer.email}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Icon-only, matching the registry toolbar. Five labelled buttons
                pushed the farmer's own details off a laptop screen, and these
                are the same five actions on every profile — staff learn them
                by position. Each keeps its colour so the row still reads at a
                glance, and every one carries a title and an aria-label, since
                an icon with neither is unusable to a screen reader and a
                guess to everyone else. */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* The QR lives on the back of the ID card now, beside the photo,
                  rather than floating on its own in a modal. Only a verified
                  farmer can be issued one, so the button is hidden otherwise. */}
              {farmer.verification_status === 'verified' && (
                <a
                  href={`/admin/farmers/${farmer.id}/id-card`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open the RSBSA ID card (front and back) to print"
                  aria-label="Open the RSBSA ID card to print"
                  className="flex items-center justify-center p-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  <IdCard className="h-5 w-5" />
                </a>
              )}
              {/* Opens the official RSBSA Enrollment Form (LEGAL size) in a new tab. */}
              <a
                href={`/admin/farmers/${farmer.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                title="Print the RSBSA Enrollment Form (Legal size)"
                aria-label="Print the RSBSA Enrollment Form"
                className="flex items-center justify-center p-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                <Printer className="h-5 w-5" />
              </a>
              {/* Writing to a farmer is the same level of trust as changing
                  their record, so it rides on the same permission. Hidden
                  outright when there is no address to write to — a button that
                  could only ever fail reads as a fault rather than as missing
                  data on the record. */}
              {can('edit farmers') && farmer.contact_email && (
                <button
                  onClick={() => setEmailOpen(true)}
                  title={`Send an email to ${farmer.contact_email}`}
                  aria-label={`Send an email to ${farmer.contact_email}`}
                  className="flex items-center justify-center p-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  <Mail className="h-5 w-5" />
                </button>
              )}
              {can('edit farmers') && (
                <Link
                  href={`/admin/farmers/${farmer.id}/edit`}
                  title="Edit this farmer's profile"
                  aria-label="Edit this farmer's profile"
                  className="flex items-center justify-center p-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  {/* A pencil, not the person icon this used to carry: on a
                      profile page a person icon reads as "the farmer", not as
                      "edit". */}
                  <Pencil className="h-5 w-5" />
                </Link>
              )}
              {can('delete farmers') && (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  title="Delete this farmer"
                  aria-label="Delete this farmer"
                  className="flex items-center justify-center p-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Main Tabs */}
        <Tabs
          tabs={[
            {
              id: 'profile',
              label: (
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </span>
              ),
              content: (
                <div className="space-y-6">
                  {/* Farm summary strip */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                    {[
                      { label: 'Parcels', value: summary.parcels, tone: 'text-green-600' },
                      { label: 'Land (ha)', value: summary.hectares.toFixed(2), tone: 'text-emerald-600' },
                      // Latest year only — see the note beside plantedLatest.
                      { label: latestYear ? `Planted ${latestYear} (ha)` : 'Planted (ha)',
                        value: plantedLatest.toFixed(2), tone: 'text-lime-600' },
                      { label: 'Livestock Head', value: summary.animalHeads, tone: 'text-green-600' },
                      { label: 'Tree Crops', value: summary.treeCrops, tone: 'text-lime-600' },
                      { label: 'Fishponds', value: summary.fishponds, tone: 'text-emerald-600' },
                      { label: 'Assistance', value: summary.assistance, tone: 'text-emerald-600' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <div className={`text-2xl font-bold ${stat.tone}`}>{stat.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <Section icon={User} title="Personal Information">
                      <Field label="RSBSA Number" value={farmer.rsbsa_no} />
                      <Field label="Full Name" value={farmer.full_name} />
                      <Field label="Sex" value={farmer.sex} />
                      <Field label="Birthdate" value={farmer.birthdate ? formatDate(farmer.birthdate, 'date-only') : null} />
                      <Field label="Place of Birth" value={joined([farmer.birth_city_municipality, farmer.birth_province])} />
                      <Field label="Civil Status" value={farmer.civil_status} />
                      {/* Asked for on the form only when married, so shown here
                          on the same condition - a Spouse row against a Single
                          farmer reads as missing data rather than none. */}
                      {farmer.civil_status === 'Married' && (
                        <Field
                          label="Name of Spouse"
                          value={joined([
                            farmer.spouse_first_name,
                            farmer.spouse_middle_name,
                            farmer.spouse_last_name,
                            farmer.spouse_ext_name,
                          ], ' ')}
                        />
                      )}
                      <Field label="Religion" value={farmer.religion} />
                      <Field label="Highest Education" value={farmer.highest_education} />
                      <Field
                        label="Mother's Maiden Name"
                        value={joined([farmer.mother_first_name, farmer.mother_middle_name, farmer.mother_last_name], ' ')
                          || farmer.mother_maiden_name}
                      />

                      {/* One row per child rather than a comma-separated list:
                          each carries a birthday and sex of its own, which a
                          single line could not hold legibly. Rendered only when
                          there are children, so a farmer with none does not get
                          an empty "Children" row reading "Not provided" - that
                          would state something the office never recorded. */}
                      {farmer.children?.length > 0 && (
                        <Field
                          label={farmer.children.length === 1 ? 'Child' : 'Children'}
                          value={
                            <ul className="space-y-0.5">
                              {farmer.children.map((child) => (
                                <li key={child.id}>
                                  {child.name}
                                  {(child.sex || child.birthdate) && (
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {' — '}
                                      {[
                                        child.sex,
                                        child.birthdate ? formatDate(child.birthdate, 'date-only') : null,
                                      ].filter(Boolean).join(', ')}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          }
                        />
                      )}
                    </Section>

                    <Section icon={Phone} title="Contact & Identification">
                      <Field label="Mobile Number" value={farmer.mobile_no} />
                      <Field label="Email" value={farmer.email} />
                      <Field label="Valid ID Type" value={farmer.valid_id_type} />
                      <Field label="ID Number" value={farmer.id_number} />
                      <Field label="Livelihood Type" value={farmer.livelihood_type} />
                    </Section>

                    <Section icon={MapPin} title="Address">
                      <Field label="House / Lot No." value={farmer.house_lot_number} />
                      <Field label="Street / Sitio" value={farmer.street_sitio} />
                      <Field label="Barangay" value={farmer.barangay} />
                      <Field label="City / Municipality" value={farmer.city_municipality} />
                      <Field label="Province" value={farmer.province} />
                      <Field label="Region" value={farmer.region} />
                    </Section>

                    {hasProvincialAddress && (
                      <Section icon={MapPin} title="Provincial Address">
                        <Field label="House / Lot No." value={farmer.provincial_house_lot} />
                        <Field label="Street / Sitio" value={farmer.provincial_street_sitio} />
                        <Field label="Barangay" value={farmer.provincial_barangay} />
                        <Field label="City / Municipality" value={farmer.provincial_city_municipality} />
                        <Field label="Province" value={farmer.provincial_province} />
                        <Field label="Region" value={farmer.provincial_region} />
                      </Section>
                    )}

                    <Section icon={Users} title="Classification">
                      <Field label="Person with Disability (PWD)" value={yesNo(farmer.pwd)} />
                      <Field label="4Ps Beneficiary" value={yesNo(farmer.is_4ps)} />
                      <Field label="Indigenous Group" value={yesNo(farmer.is_indigenous)} />
                      <Field label="Indigenous Community" value={farmer.indigenous_community} />
                      <Field label="Risk Status" value={farmer.risk_status} />
                    </Section>

                    <Section icon={Award} title="Organizations">
                      <Field label="Organization 1" value={farmer.organization_name} />
                      <Field label="Organization 2" value={farmer.organization_name_2} />
                      <Field label="Organization 3" value={farmer.organization_name_3} />
                    </Section>

                    <Section icon={Calendar} title="Registration & Verification">
                      <Field
                        label="Status"
                        value={
                          <Badge variant={
                            farmer.verification_status === 'verified' ? 'green'
                              : farmer.verification_status === 'rejected' ? 'red' : 'yellow'
                          }>
                            {(farmer.verification_status || 'unknown').toUpperCase()}
                          </Badge>
                        }
                      />
                      <Field label="Reference Code" value={farmer.reference_code} />
                      <Field label="Submitted Online" value={farmer.submitted_online_at ? formatDate(farmer.submitted_online_at, 'long') : null} />
                      <Field label="Reviewed On" value={farmer.verified_at ? formatDate(farmer.verified_at, 'long') : null} />
                      <Field label="Reviewed By" value={farmer.verifier?.name} />
                      <Field label="Rejection Reason" value={farmer.rejection_reason} />
                    </Section>

                    <Section icon={Download} title="Documents">
                      <div className="grid grid-cols-2 gap-4">
                        <DocumentPreview label="Photo" path={farmer.photo_path} />
                        <DocumentPreview label="ID Proof" path={farmer.id_proof_path} />
                      </div>
                    </Section>
                  </div>
                </div>
              )
            },
            {
              id: 'parcels',
              label: (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Parcels ({parcelsData.length})
                </span>
              ),
              content: <DataTable columns={parcelsColumns} data={parcelsData} filename={`farmer-${farmer.id}-parcels`} />
            },
            {
              // Sits beside the farm record rather than in Reports: staff read
              // it while advising this farmer, not while compiling figures.
              id: 'risk',
              label: (
                <span className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Risk
                  {farmer.latest_risk_assessment?.risk_level && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${RISK_TONE[farmer.latest_risk_assessment.risk_level] ?? 'bg-gray-100 text-gray-700'}`}>
                      {farmer.latest_risk_assessment.risk_level}
                    </span>
                  )}
                </span>
              ),
              content: (
                <RiskAssessmentTab
                  latest={farmer.latest_risk_assessment}
                  history={farmer.risk_assessments ?? []}
                />
              )
            },
            {
              // Directly after Parcels, because a season is planted on one.
              id: 'crops',
              label: (
                <span className="flex items-center gap-2">
                  <Sprout className="h-4 w-4" />
                  Crops ({cropsData.length})
                </span>
              ),
              content: (
                <>
                  <p className="mb-3 text-xs text-gray-500">
                    Cropping seasons recorded against this farmer&rsquo;s parcels. Add or edit them in{' '}
                    <Link href={`/admin/farm-inventory?farmer_id=${farmer.id}`}
                      className="font-semibold text-[#006400] hover:underline">Farm Assets</Link>
                    {' '}or{' '}
                    <Link href="/admin/seasonal" className="font-semibold text-[#006400] hover:underline">
                      Seasonal Tracking
                    </Link>.
                  </p>
                  <DataTable columns={cropsColumns} data={cropsData} filename={`farmer-${farmer.id}-crops`} />
                </>
              )
            },
            {
              id: 'map',
              label: (
                <span className="flex items-center gap-2">
                  <MapIcon className="h-4 w-4" />
                  Farm Map
                </span>
              ),
              content: (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="h-[500px]">
                    <MapViewer geojson={mockGeoJSON} />
                  </div>
                  <div className="space-y-4">
                    <Card title="Map Legend">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 p-3 bg-green-100 rounded-xl">
                          <div className="w-8 h-8 bg-green-500 rounded opacity-70"></div>
                          <span className="text-sm">Rice Fields</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-amber-100 rounded-xl">
                          <div className="w-8 h-8 bg-amber-500 rounded opacity-70"></div>
                          <span className="text-sm">Corn/Other</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )
            },
            {
              id: 'livestock',
              label: (
                <span className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Livestock ({livestockData.length})
                </span>
              ),
              content: <DataTable columns={livestockColumns} data={livestockData} filename={`farmer-${farmer.id}-livestock`} />
            },
            {
              id: 'tree-crops',
              label: (
                <span className="flex items-center gap-2">
                  <TreePine className="h-4 w-4" />
                  Tree Crops ({(farmer.tree_crops || []).length})
                </span>
              ),
              content: (
                <div className="space-y-4">
                  {can('create inventory') && (
                    <button
                      onClick={() => setAssetModal({ open: true, type: 'tree', record: null })}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      + Add Tree Crop
                    </button>
                  )}
                  <DataTable
                    columns={[
                      { header: 'Crop Type', accessorKey: 'crop_type' },
                      { header: 'Quantity/Trees', accessorKey: 'quantity', cell: ({ row: { original: row } }) => row.quantity || '—' },
                      { header: 'Area (ha)', accessorKey: 'area_hectares', cell: ({ row: { original: row } }) => row.area_hectares || '—' },
                      ...(can('edit inventory') || can('delete inventory') ? [{
                        header: 'Actions',
                        cell: ({ row: { original: row } }) => (
                          <div className="flex gap-2">
                            {can('edit inventory') && (
                              <button
                                onClick={() => setAssetModal({ open: true, type: 'tree', record: row })}
                                className="text-green-600 hover:underline text-sm"
                              >
                                Edit
                              </button>
                            )}
                            {can('delete inventory') && (
                              <button
                                onClick={() => {
                                  if (confirm('Delete this record?')) {
                                    router.delete(`/admin/tree-crops/${row.id}`, {
                                      preserveState: true,
                                      preserveScroll: true,
                                    });
                                  }
                                }}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )
                      }] : [])
                    ]}
                    data={farmer.tree_crops || []}
                    filename={`farmer-${farmer.id}-tree-crops`}
                  />
                </div>
              )
            },
            {
              id: 'fishponds',
              label: (
                <span className="flex items-center gap-2">
                  <Fish className="h-4 w-4" />
                  Fishponds ({(farmer.fishponds || []).length})
                </span>
              ),
              content: (
                <div className="space-y-4">
                  {can('create inventory') && (
                    <button
                      onClick={() => setAssetModal({ open: true, type: 'fishpond', record: null })}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      + Add Fishpond
                    </button>
                  )}
                  <DataTable
                    columns={[
                      { header: 'Species', accessorKey: 'species' },
                      { header: 'Area (ha)', accessorKey: 'area_hectares' },
                      ...(can('edit inventory') || can('delete inventory') ? [{
                        header: 'Actions',
                        cell: ({ row: { original: row } }) => (
                          <div className="flex gap-2">
                            {can('edit inventory') && (
                              <button
                                onClick={() => setAssetModal({ open: true, type: 'fishpond', record: row })}
                                className="text-green-600 hover:underline text-sm"
                              >
                                Edit
                              </button>
                            )}
                            {can('delete inventory') && (
                              <button
                                onClick={() => {
                                  if (confirm('Delete this record?')) {
                                    router.delete(`/admin/fishponds/${row.id}`, {
                                      preserveState: true,
                                      preserveScroll: true,
                                    });
                                  }
                                }}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )
                      }] : [])
                    ]}
                    data={farmer.fishponds || []}
                    filename={`farmer-${farmer.id}-fishponds`}
                  />
                </div>
              )
            },
            {
              id: 'ruminants',
              label: (
                <span className="flex items-center gap-2">
                  <Beef className="h-4 w-4" />
                  Ruminants ({(farmer.large_ruminants || []).length + (farmer.small_ruminants || []).length})
                </span>
              ),
              content: (
                <div className="space-y-6">
                  <Card title="Large Ruminants (Cattle, Carabao)">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'large-ruminant', record: null })}
                        className="mb-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        + Add Large Ruminant
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Type', accessorKey: 'animal_type' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: ({ row: { original: row } }) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: ({ row: { original: row } }) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'large-ruminant', record: row })}
                                  className="text-green-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/large-ruminants/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.large_ruminants || []}
                    />
                  </Card>

                  <Card title="Small Ruminants (Goat, Sheep)">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'small-ruminant', record: null })}
                        className="mb-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        + Add Small Ruminant
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Type', accessorKey: 'animal_type' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: ({ row: { original: row } }) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: ({ row: { original: row } }) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'small-ruminant', record: row })}
                                  className="text-green-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/small-ruminants/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.small_ruminants || []}
                    />
                  </Card>
                </div>
              )
            },
            {
              id: 'swine-poultry',
              label: (
                <span className="flex items-center gap-2">
                  <Egg className="h-4 w-4" />
                  Swine & Poultry
                </span>
              ),
              content: (
                <div className="space-y-6">
                  <Card title="Native Pigs">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'native-pig', record: null })}
                        className="mb-4 px-4 py-2 bg-[#006400] text-white rounded-lg hover:bg-[#228B22]"
                      >
                        + Add Native Pig
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: ({ row: { original: row } }) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: ({ row: { original: row } }) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'native-pig', record: row })}
                                  className="text-green-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/native-pigs/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.native_pigs || []}
                    />
                  </Card>

                  <Card title="Swine Hybrid">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'swine-hybrid', record: null })}
                        className="mb-4 px-4 py-2 bg-[#006400] text-white rounded-lg hover:bg-[#228B22]"
                      >
                        + Add Swine Hybrid
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Variety', accessorKey: 'variety' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: ({ row: { original: row } }) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: ({ row: { original: row } }) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'swine-hybrid', record: row })}
                                  className="text-green-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/swine-hybrid/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.swine_hybrid || []}
                    />
                  </Card>

                  <Card title="Poultry">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'poultry', record: null })}
                        className="mb-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        + Add Poultry
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Bird Type', accessorKey: 'bird_type' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: ({ row: { original: row } }) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: ({ row: { original: row } }) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'poultry', record: row })}
                                  className="text-green-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                onClick={() => {
                                  if (confirm('Delete?')) {
                                    router.delete(`/admin/poultry/${row.id}`, {
                                      preserveState: true,
                                      preserveScroll: true,
                                    });
                                  }
                                }}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.poultry || []}
                    />
                  </Card>
                </div>
              )
            },
          ]}
        />

        {/* Send Email */}
        <ModalShell
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          title={`Send Email to ${farmer.full_name || `${farmer.first_name} ${farmer.last_name}`}`}
          size="lg"
          as="form"
          onSubmit={sendEmail}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="px-5 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={emailForm.processing}
                className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Mail className="h-4 w-4" />
                {emailForm.processing ? 'Sending...' : 'Send Email'}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Recipient
              </label>
              {/* Read-only by construction: this is a div, not an input, and
                  the address is never posted back. */}
              <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-gray-800 break-all">
                {farmer.contact_email}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Taken from this farmer&apos;s registration record and confirmed again on the server.
              </p>
            </div>

            <div>
              <label htmlFor="email-subject" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Subject
              </label>
              <input
                id="email-subject"
                value={emailForm.data.subject}
                onChange={e => emailForm.setData('subject', e.target.value)}
                maxLength={200}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-sm"
              />
              {emailForm.errors.subject && (
                <p className="mt-1.5 text-sm text-red-600">{emailForm.errors.subject}</p>
              )}
            </div>

            <div>
              <label htmlFor="email-message" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Message
              </label>
              <textarea
                id="email-message"
                value={emailForm.data.message}
                onChange={e => emailForm.setData('message', e.target.value)}
                rows={9}
                maxLength={10000}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-sm leading-relaxed"
              />
              {emailForm.errors.message && (
                <p className="mt-1.5 text-sm text-red-600">{emailForm.errors.message}</p>
              )}
            </div>
          </div>
        </ModalShell>

        {/* Agricultural Assets Modal */}
        <Modal
          isOpen={assetModal.open}
          onClose={() => setAssetModal({ open: false, type: null, record: null })}
          title={`${assetModal.record ? 'Edit' : 'Add'} ${assetModal.type?.replace('-', ' ').toUpperCase()}`}
        >
          {assetModal.type === 'tree' && (
            <TreeCropForm
              farmerId={farmer.id}
              crop={assetModal.record}
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'fishpond' && (
            <FishpondForm
              farmerId={farmer.id}
              fishpond={assetModal.record}
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'large-ruminant' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="large"
              endpoint="/admin/large-ruminants"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'small-ruminant' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="small"
              endpoint="/admin/small-ruminants"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'native-pig' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="native"
              endpoint="/admin/native-pigs"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'swine-hybrid' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="swine"
              endpoint="/admin/swine-hybrid"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'poultry' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="poultry"
              endpoint="/admin/poultry"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}

