import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    ShieldAlert, TrendingDown, TrendingUp, Minus, Sprout, Beef, Fish,
    MapPin, Calendar, BarChart3, ChevronRight, Building2, ArrowLeft,
    CheckCircle2, Circle, Layers, HelpCircle, ClipboardList, Lock, CloudRain, Mail,
} from 'lucide-react';
// Shared with the farmer profile's Risk tab, so the same answer never reads
// differently on two screens about the same farmer.
import { readable, readableList, peso, onDate } from '@/utils/instrument';

/**
 * One farmer's farm, analysed parcel by parcel.
 *
 * The page is ordered the way the reader's questions arrive: what is the
 * result, where is the problem, why, what should be done, what does the record
 * show, and finally what was actually used to reach it. The actions sit in a
 * rail beside the verdict on a wide screen and directly after "why" on a
 * phone, so they are never buried under the evidence — a farmer handed a
 * technical report and a list of actions at the bottom reads neither.
 *
 * Four states, not three. "Insufficient data" is drawn in neutral slate with a
 * dashed edge so it can never be mistaken for the green of low risk: nothing
 * being known about a parcel is not the same as that parcel being fine, and
 * the whole design fails if those two ever look alike.
 */

/* ------------------------------------------------------------- risk styling */

const RISK = {
    high: {
        label: 'High Risk',
        dot: 'bg-red-500',
        ring: 'ring-red-200',
        chip: 'bg-red-100 text-red-800 border-red-200',
        hero: 'from-red-500 to-red-600',
        text: 'text-red-700',
        edge: 'border-red-200',
    },
    moderate: {
        label: 'Moderate Risk',
        dot: 'bg-amber-500',
        ring: 'ring-amber-200',
        chip: 'bg-amber-100 text-amber-800 border-amber-200',
        hero: 'from-amber-500 to-orange-500',
        text: 'text-amber-700',
        edge: 'border-amber-200',
    },
    low: {
        label: 'Low Risk',
        dot: 'bg-green-600',
        ring: 'ring-green-200',
        chip: 'bg-green-100 text-green-800 border-green-200',
        hero: 'from-green-600 to-emerald-600',
        text: 'text-green-700',
        edge: 'border-green-200',
    },
};

/** Deliberately not a shade of green, and deliberately dashed. */
const INSUFFICIENT = {
    label: 'Insufficient Data',
    dot: 'bg-slate-300',
    ring: 'ring-slate-200',
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    hero: 'from-slate-400 to-slate-500',
    text: 'text-slate-600',
    edge: 'border-slate-300 border-dashed',
};

const styleFor = (level) => RISK[level] ?? INSUFFICIENT;

const KIND_ICON = { crop: Sprout, livestock: Beef, aquaculture: Fish };

const PRIORITY = {
    high:   { label: 'High priority',   chip: 'bg-red-100 text-red-800' },
    medium: { label: 'Medium priority', chip: 'bg-amber-100 text-amber-800' },
    low:    { label: 'Maintenance',     chip: 'bg-green-100 text-green-800' },
};

const TREND = {
    improving: { icon: TrendingUp,   text: 'text-green-700', label: 'Improving' },
    declining: { icon: TrendingDown, text: 'text-red-700',   label: 'Declining' },
    steady:    { icon: Minus,        text: 'text-gray-600',  label: 'Steady' },
};

const SUFFICIENCY_LABEL = {
    sufficient: 'Historical evidence available',
    limited:    'Limited historical data',
    none:       'No historical records',
};

const number = (v, digits = 2) =>
    v === null || v === undefined ? '—' : Number(v).toLocaleString('en-PH', { maximumFractionDigits: digits });

/* ------------------------------------------------------------------ the page */

export default function FarmAnalysisReport({
    analysis,
    topActions = [],
    allActions = [],
    periods = [],
    assistance = [],
    suggestedInterventions = [],
    openInterventions = [],
    audience = 'office',
    backHref = null,
    backLabel = null,
}) {
    const [showAllActions, setShowAllActions] = useState(false);
    const [openUnit, setOpenUnit] = useState(null);

    const { farmer, period, overall, affected, units, why, data_used: dataUsed, method, assessment } = analysis;

    const tone = styleFor(overall.level);
    const actions = showAllActions ? allActions : topActions;

    return (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

                {/* ------------------------------------------------- breadcrumb */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <Link
                        href={backHref ?? `/admin/farmers/${farmer.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#006400]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {backLabel ?? `Back to ${farmer.name}`}
                    </Link>

                    {periods.length > 0 && (
                        <select
                            value={`${period.season}|${period.year}`}
                            onChange={(e) => {
                                const [season, year] = e.target.value.split('|');
                                router.get(`/admin/farmers/${farmer.id}/analysis`, { season, year }, { preserveScroll: true });
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium focus:border-transparent focus:ring-2 focus:ring-green-500"
                        >
                            {periods.map((p) => (
                                <option key={p.label} value={`${p.season}|${p.year}`}>
                                    {p.label}{p.is_upcoming ? ' — upcoming' : ''}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* ------------------------------------------------ 1. THE RESULT */}
                <div className={`overflow-hidden rounded-2xl bg-gradient-to-br ${tone.hero} shadow-sm`}>
                    <div className="px-5 py-6 sm:px-8 sm:py-8">
                        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                            Farm Predictive Analysis
                        </p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                            {farmer.name}
                        </h1>

                        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm text-white/75">Analysis for</p>
                                <p className="text-lg font-bold text-white">{period.label}</p>
                                {farmer.barangay && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/75">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {farmer.barangay}
                                    </p>
                                )}
                            </div>

                            <div className="rounded-2xl bg-white/15 px-6 py-4 text-center backdrop-blur-sm">
                                <p className="text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
                                    {overall.level ? RISK[overall.level].label : 'Insufficient Data'}
                                </p>
                                {/* Shown only when the rules actually produced a
                                    figure. No score is invented to fill the space. */}
                                {overall.score !== null && overall.score !== undefined ? (
                                    <p className="mt-1 text-sm font-semibold text-white/80">
                                        Risk score {overall.score} of 100
                                    </p>
                                ) : (
                                    <p className="mt-1 text-sm text-white/80">No score can be calculated yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/20 bg-black/10 px-5 py-2.5 sm:px-8">
                        <p className="text-[11px] leading-relaxed text-white/80">
                            Rule-based analysis of recorded farm data and the current assessment
                            {method?.version ? ` (rules ${method.version})` : ''}. Not a trained model,
                            and not a probability.
                        </p>
                    </div>
                </div>

                {/* ------------------------------------------- 2. AT A GLANCE */}
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Glance icon={Sprout} label="Affected commodity" value={affected?.commodity ?? '—'} />
                    <Glance icon={MapPin} label="Affected parcel" value={affected?.label ?? 'None identified'} />
                    <Glance icon={Calendar} label="Season" value={period.label} />
                    <Glance
                        icon={BarChart3}
                        label="Evidence"
                        value={
                            affected?.history?.comparable_seasons
                                ? `${affected.history.comparable_seasons} comparable season${affected.history.comparable_seasons === 1 ? '' : 's'}`
                                : 'Limited'
                        }
                        muted={!affected?.history?.comparable_seasons}
                    />
                </div>

                {/*
                    Two columns on a wide screen, one on a phone.

                    The placement is explicit rather than left to flow: "Why"
                    is short and the action rail beside it is long, so a
                    full-width band underneath left a large empty gap below
                    "Why" while the rail ran on. Everything after "Why" now
                    continues in the same column, closing that gap.

                    On a phone the DOM order does the work instead — why, then
                    the actions, then the evidence — so the recommendations are
                    never buried under a technical report.
                */}
                <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

                    {/* ------------------------------------------- 3. WHY */}
                    <section className="space-y-5 lg:col-start-1 lg:row-start-1">
                        <Panel title="Why this result?" icon={ShieldAlert}>
                            {why.length === 0 ? (
                                <Empty>
                                    No risk factors were raised. That is either a genuinely clean
                                    result or a sign that too little has been recorded — the
                                    “Analysis based on” panel below says which.
                                </Empty>
                            ) : (
                                <ul className="space-y-3">
                                    {why.map((factor) => (
                                        <li key={factor.key} className="rounded-xl border border-gray-200 p-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-gray-900">
                                                    {factor.label}
                                                </span>
                                                {/* Where it came from, always. A recorded figure and
                                                    a remembered one are not equal evidence. */}
                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                    factor.source === 'history'
                                                        ? 'border-[#006400]/20 bg-green-50 text-[#006400]'
                                                        : 'border-sky-200 bg-sky-50 text-sky-700'
                                                }`}>
                                                    {factor.source === 'history' ? 'From records' : 'From assessment'}
                                                </span>
                                            </div>

                                            {factor.evidence && (
                                                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                                                    {Object.entries(factor.evidence).map(([k, v]) => (
                                                        <div key={k} className="flex gap-1">
                                                            <dt className="capitalize">{k.replace(/_/g, ' ')}:</dt>
                                                            <dd className="font-semibold text-gray-700">{number(v)}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        {/* Directly under "why": the reader has just been told
                            what the rules concluded, and the natural next
                            question is what the farmer actually said. It also
                            fills the column beside the action rail, which is
                            taller than "why" on its own. */}
                        <AnswersPanel assessment={assessment} audience={audience} />
                    </section>

                    {/* -------------------------- 5. WHAT SHOULD BE DONE (rail) */}
                    <aside className="space-y-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                        <Panel
                            title={overall.level === 'low' ? 'Recommended maintenance' : 'What should you do?'}
                            icon={CheckCircle2}
                        >
                            <p className="-mt-1 mb-3 text-xs text-gray-500">
                                Drawn from the factors above. Nothing here is generated — each line
                                is the office’s own wording for a condition that was found true.
                            </p>

                            <ol className="space-y-3">
                                {actions.map((action, i) => (
                                    <li key={action.key} className="rounded-xl border border-gray-200 p-3.5">
                                        <div className="flex items-start gap-2.5">
                                            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#006400] text-[11px] font-bold text-white">
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-semibold leading-snug text-gray-900">
                                                    <span className="mr-1">{action.icon}</span>
                                                    {action.title}
                                                </p>
                                                <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${PRIORITY[action.priority]?.chip ?? PRIORITY.medium.chip}`}>
                                                    {PRIORITY[action.priority]?.label ?? action.priority}
                                                </span>
                                                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                                                    {action.text}
                                                </p>
                                                <p className="mt-1.5 text-[11px] text-gray-400">
                                                    {action.category_label}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>

                            {allActions.length > topActions.length && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllActions((v) => !v)}
                                    className="mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                                >
                                    {showAllActions
                                        ? 'Show top actions only'
                                        : `View all ${allActions.length} recommendations`}
                                </button>
                            )}
                        </Panel>

                        {/* ------------------------------ 6. WHAT THE OFFICE CAN DO */}
                        {/* The farmer sees what support exists; only the office
                            sees it framed as an intervention to decide on. */}
                        <Panel
                            title={audience === 'farmer' ? 'Support available' : 'Office action'}
                            icon={Building2}
                        >
                            <p className="text-sm leading-relaxed text-gray-600">
                                {audience === 'farmer'
                                    ? (overall.level === 'high'
                                        ? 'Visit the Municipal Agriculture Office before the coming season — a technical visit may be available to you.'
                                        : overall.level === 'moderate'
                                            ? 'Acting now may keep this from becoming a high-risk season. The office can advise on what applies to your farm.'
                                            : overall.level === 'low'
                                                ? 'Nothing needs fixing right now. Keep your records up to date so this stays accurate.'
                                                : 'Too little has been recorded to say much yet. Ask the office to record your harvests so future analyses have something to work from.')
                                    : (overall.level === 'high'
                                        ? 'This farm may warrant a technical visit before the coming season.'
                                        : overall.level === 'moderate'
                                            ? 'Preventive support now may stop this becoming a high-risk result.'
                                            : overall.level === 'low'
                                                ? 'No intervention is indicated. Keep the records current so this stays accurate.'
                                                : 'Too little is recorded to indicate an intervention. Recording production outcomes is the first step.')}
                            </p>

                            {assistance.length > 0 ? (
                                <div className="mt-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                        Programmes on file
                                    </p>
                                    <ul className="mt-1.5 space-y-1">
                                        {assistance.map((a) => (
                                            <li key={a.id} className="text-sm text-gray-700">• {a.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <p className="mt-3 text-xs italic text-gray-400">
                                    No assistance programmes are recorded yet.
                                </p>
                            )}

                            {audience === 'office' && (
                                <Link
                                    href="/admin/assistance"
                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#006400] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
                                >
                                    View assistance options
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            )}
                        </Panel>

                        {audience === 'office' && (
                            <>
                                <AlertFarmerPanel
                                    farmerId={farmer.id}
                                    hasFactors={why.length > 0}
                                />

                                <InterventionsPanel
                                    farmerId={farmer.id}
                                    assessmentId={assessment?.id ?? null}
                                    affectedParcelId={affected?.parcel_id ?? null}
                                    suggestions={suggestedInterventions}
                                    open={openInterventions}
                                />
                            </>
                        )}
                    </aside>

                    {/* ------------------ 2b. WHERE / 4. HISTORY / 7. DATA USED */}
                    <div className="space-y-5 lg:col-start-1 lg:row-start-2">

                        <Panel title="Farm parcel analysis" icon={Layers}>
                            <div className="space-y-3">
                                {units.length === 0 && (
                                    <Empty>No parcels, livestock or ponds are recorded for this farmer.</Empty>
                                )}

                                {units.map((unit) => (
                                    <UnitRow
                                        key={unit.id}
                                        unit={unit}
                                        open={openUnit === unit.id}
                                        onToggle={() => setOpenUnit(openUnit === unit.id ? null : unit.id)}
                                    />
                                ))}
                            </div>
                        </Panel>

                        <Panel title="Historical performance" icon={BarChart3}>
                            <HistoryPanel units={units} />
                        </Panel>

                        <Panel title="Analysis based on" icon={HelpCircle}>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Used</p>
                                    <ul className="mt-2 space-y-1.5">
                                        {dataUsed.used.map((line) => (
                                            <li key={line} className="flex items-start gap-2 text-sm text-gray-700">
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#006400]" />
                                                {line}
                                            </li>
                                        ))}
                                        {dataUsed.used.length === 0 && (
                                            <li className="text-sm italic text-gray-400">Nothing was available to use.</li>
                                        )}
                                    </ul>
                                </div>

                                <div>
                                    {/* Both halves, always. Listing only what was used
                                        lets the reader assume the rest was checked. */}
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Not available</p>
                                    <ul className="mt-2 space-y-1.5">
                                        {dataUsed.missing.map((line) => (
                                            <li key={line} className="flex items-start gap-2 text-sm text-gray-500">
                                                <Circle className="mt-0.5 h-4 w-4 flex-none text-slate-300" />
                                                {line}
                                            </li>
                                        ))}
                                        {dataUsed.missing.length === 0 && (
                                            <li className="text-sm italic text-gray-400">Nothing was missing.</li>
                                        )}
                                    </ul>
                                </div>
                            </div>

                            {assessment && (
                                <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                                    Assessment recorded{' '}
                                    {new Date(assessment.assessed_at).toLocaleDateString('en-PH', {
                                        year: 'numeric', month: 'long', day: 'numeric',
                                    })}
                                    {assessment.is_stale && ' — over a year old, and may no longer describe this farm'}.
                                </p>
                            )}
                        </Panel>
                    </div>
                </div>
        </div>
    );
}

/* ------------------------------------------------------------- small pieces */

function Panel({ title, icon: Icon, children }) {
    return (
        <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                <span className="rounded-lg bg-green-50 p-1.5 text-[#006400]">
                    <Icon className="h-4 w-4" />
                </span>
                {title}
            </h2>
            {children}
        </section>
    );
}

function Glance({ icon: Icon, label, value, muted = false }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </p>
            <p className={`mt-1 truncate font-bold ${muted ? 'text-slate-400' : 'text-gray-900'}`} title={value}>
                {value}
            </p>
        </div>
    );
}

function Empty({ children }) {
    return (
        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4 text-sm leading-relaxed text-gray-500">
            {children}
        </p>
    );
}

/** One parcel, pond or herd. Expands to its own evidence. */
function UnitRow({ unit, open, onToggle }) {
    const tone = styleFor(unit.level);
    const Icon = KIND_ICON[unit.kind] ?? Sprout;
    const trend = unit.history?.trend ? TREND[unit.history.trend] : null;

    return (
        <div className={`rounded-xl border bg-white ${tone.edge}`}>
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-3 p-4 text-left"
            >
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ring-2 ${tone.ring} bg-white`}>
                    <Icon className="h-4 w-4 text-gray-700" />
                </span>

                <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">
                        {unit.label}
                    </span>
                    <span className="block truncate text-sm text-gray-500">
                        {unit.commodity || 'Commodity not recorded'} • {number(unit.size.value)} {unit.size.unit}
                    </span>
                </span>

                <span className="flex flex-none flex-col items-end gap-1">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${tone.chip}`}>
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                        {unit.level ? RISK[unit.level].label : 'Insufficient Data'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                        {SUFFICIENCY_LABEL[unit.data_sufficiency]}
                    </span>
                </span>

                <ChevronRight className={`h-4 w-4 flex-none text-gray-400 transition ${open ? 'rotate-90' : ''}`} />
            </button>

            {open && (
                <div className="border-t border-gray-100 px-4 py-4">
                    {unit.note && (
                        <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                            <strong className="font-semibold">{unit.note}.</strong>{' '}
                            {unit.history.summary}
                        </p>
                    )}

                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        {unit.barangay && <Detail label="Barangay" value={unit.barangay} />}
                        {unit.farm_type && <Detail label="Farm type" value={unit.farm_type} />}
                        <Detail label="Comparable seasons" value={unit.history.comparable_seasons} />
                        <Detail
                            label="Trend"
                            value={trend ? trend.label : 'Not established'}
                            tone={trend ? trend.text : 'text-slate-400'}
                        />
                    </dl>

                    {unit.factors.length > 0 && (
                        <div className="mt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Factors on this {unit.kind === 'crop' ? 'parcel' : 'record'}
                            </p>
                            <ul className="mt-1.5 space-y-1">
                                {unit.factors.map((f) => (
                                    <li key={f.key} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
                                        {f.label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!unit.note && unit.factors.length === 0 && (
                        <p className="mt-3 text-sm text-gray-500">{unit.history.summary}</p>
                    )}
                </div>
            )}
        </div>
    );
}

function Detail({ label, value, tone = 'text-gray-900' }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
            <dd className={`font-semibold ${tone}`}>{value}</dd>
        </div>
    );
}

/**
 * Recorded seasons, drawn as bars rather than a line.
 *
 * With the two to four comparable records a parcel typically has, a line chart
 * implies a continuous series that was never measured. Bars show exactly the
 * points that exist and nothing between them — and no trend line is drawn when
 * the records cannot support one.
 */
function HistoryPanel({ units }) {
    const withHistory = units.filter((u) => u.history?.records?.length > 0);

    if (withHistory.length === 0) {
        return (
            <Empty>
                Not enough historical records to establish a reliable trend. Continue
                recording production outcomes each season so future analyses have
                something to compare against.
            </Empty>
        );
    }

    return (
        <div className="space-y-6">
            {withHistory.map((unit) => {
                const records = unit.history.records;
                const peak = Math.max(...records.map((r) => r.yield_per_ha));
                const trend = unit.history.trend ? TREND[unit.history.trend] : null;
                const TrendIcon = trend?.icon;

                return (
                    <div key={unit.id}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-gray-900">
                                {unit.commodity} — {unit.label}
                            </p>
                            {trend && (
                                <span className={`inline-flex items-center gap-1 text-sm font-semibold ${trend.text}`}>
                                    <TrendIcon className="h-4 w-4" />
                                    {trend.label}
                                    {unit.history.change_percent !== null && (
                                        <span className="font-normal text-gray-400">
                                            ({unit.history.change_percent > 0 ? '+' : ''}
                                            {unit.history.change_percent}%)
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>

                        <ul className="space-y-2">
                            {records.map((r) => (
                                <li key={r.id} className="flex items-center gap-3">
                                    <span className="w-28 flex-none text-xs font-medium text-gray-600">
                                        {r.season === 'wet' ? 'Wet' : 'Dry'} {r.year}
                                    </span>
                                    <span className="h-6 flex-1 overflow-hidden rounded bg-gray-100">
                                        <span
                                            className="block h-full rounded bg-[#006400]/80"
                                            style={{ width: `${peak > 0 ? (r.yield_per_ha / peak) * 100 : 0}%` }}
                                        />
                                    </span>
                                    <span className="w-32 flex-none text-right text-xs font-semibold tabular-nums text-gray-700">
                                        {number(r.yield_per_ha, 0)} {r.unit}/ha
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-2 text-[11px] text-gray-400">
                            Comparable recorded seasons only — {unit.history.summary}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * The farmer's own answers, exactly as given.
 *
 * Read-only, and labelled as such. The questionnaire is the farmer's account
 * of their own season; an office edit would quietly turn a survey response
 * into an office opinion while leaving the risk score attached to it. If an
 * answer is wrong, the farmer reassesses — which adds a row rather than
 * overwriting one, so the correction is visible as a correction.
 *
 * Shown beneath the analysis rather than above it: the reader wants the result
 * first and the raw responses when they start asking where it came from.
 */
function AnswersPanel({ assessment, audience }) {
    // Open by default. The answers are the evidence behind the verdict above
    // them, and a reader who has to press a button to see the evidence mostly
    // does not. The toggle stays for anyone who wants the page shorter.
    const [open, setOpen] = useState(true);

    if (!assessment) {
        return (
            <Panel title="The farmer's answers" icon={ClipboardList}>
                <Empty>
                    {audience === 'farmer'
                        ? 'You have not completed the climate and financial risk questionnaire yet. Your answers will appear here once you do.'
                        : 'This farmer has not completed the climate and financial risk questionnaire, so there are no answers to show.'}
                </Empty>
            </Panel>
        );
    }

    const a = assessment.answers ?? {};

    const groups = [
        {
            title: 'Climate and weather',
            icon: CloudRain,
            rows: [
                ['Events experienced', readableList(a.climate_events)],
                ['Flooding', readable(a.flood_frequency)],
                ['Drought', readable(a.drought_frequency)],
                ['Extreme heat', readable(a.heat_frequency)],
                ['Storms / strong winds', readable(a.storm_frequency)],
            ],
        },
        {
            title: 'Effect on production',
            icon: TrendingDown,
            rows: [
                ['Worst effect', readable(a.worst_effect)],
                ['Losses experienced', readableList(a.loss_types)],
                ['Financial loss', readable(a.had_financial_loss)],
                ['Estimated loss', peso(a.estimated_loss_amount)],
                ['Costs increased', readable(a.had_cost_increase)],
                ['Estimated extra cost', peso(a.estimated_extra_cost)],
                ['Against last season', readable(a.season_comparison)],
            ],
        },
        {
            title: 'Adaptation',
            icon: Sprout,
            rows: [
                ['Practices used', readableList(a.adaptation_practices)],
                ['How effective', readable(a.adaptation_effectiveness)],
                ['Main barrier', readable(a.adaptation_barrier)],
            ],
        },
        {
            title: 'Assistance and expectation',
            icon: Building2,
            rows: [
                ['Received assistance', readable(a.received_assistance)],
                ['Type received', readableList(a.assistance_types)],
                ['How helpful', readable(a.assistance_helpfulness)],
                [audience === 'farmer' ? 'You expect loss' : 'Farmer expects loss', readable(a.perceived_risk)],
                ['Factors expected', readableList(a.anticipated_factors)],
            ],
        },
    ];

    return (
        <Panel title="The farmer's answers" icon={ClipboardList}>
            <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                    <Lock className="h-3 w-3" />
                    Read-only
                </span>
                <span className="text-xs text-gray-500">
                    Answered {onDate(assessment.assessed_at) ?? 'on a date not recorded'}
                    {assessment.is_stale && ' — over a year ago'}.
                    {' '}{audience === 'farmer'
                        ? 'To change an answer, take the assessment again.'
                        : 'Only the farmer can change these, by reassessing.'}
                </span>
            </div>

            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mb-4 w-full rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
                {open ? 'Hide the answers' : 'Show the answers'}
            </button>

            {open && (
                <div className="grid gap-4 xl:grid-cols-2">
                    {groups.map((group) => (
                        <div key={group.title} className="rounded-xl border border-gray-200 p-4">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                                <group.icon className="h-4 w-4 text-[#006400]" />
                                {group.title}
                            </h3>
                            <dl className="space-y-2">
                                {group.rows.map(([label, value]) => (
                                    <div key={label} className="grid grid-cols-5 gap-3 text-sm">
                                        <dt className="col-span-2 text-gray-500">{label}</dt>
                                        <dd className={`col-span-3 ${value ? 'font-medium text-gray-900' : 'italic text-gray-400'}`}>
                                            {value ?? 'Not answered'}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

/**
 * Suggested office work, and what is already open.
 *
 * The third sentence in the chain, and deliberately not the second: the rail
 * above tells the farmer what to do; this tells the office what IT might do.
 * Collapsing the two would let a page advise a farmer and then report it as
 * work the office had in hand.
 *
 * Nothing here is created by the system. Each line is a proposal with an
 * "Open" button beside it, and the queue only ever contains records a person
 * chose to open. What is already open is listed first, so two staff reading
 * the same analysis do not raise the same visit twice.
 */
function InterventionsPanel({ farmerId, assessmentId, affectedParcelId, suggestions, open }) {
    const { post, processing } = useForm({});
    const [opening, setOpening] = useState(null);

    const openOne = (suggestion) => {
        setOpening(suggestion.factor_key);

        router.post('/admin/interventions', {
            farmer_id: farmerId,
            factor_key: suggestion.factor_key,
            farm_parcel_id: affectedParcelId,
            climate_risk_assessment_id: assessmentId,
            priority: suggestion.priority,
        }, {
            preserveScroll: true,
            onFinish: () => setOpening(null),
        });
    };

    const alreadyOpen = new Set(open.map((row) => row.factor_key));
    const outstanding = suggestions.filter((s) => !alreadyOpen.has(s.factor_key));

    return (
        <Panel title="Office intervention" icon={ClipboardList}>
            {open.length > 0 && (
                <div className="mb-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Already open
                    </p>
                    <ul className="mt-1.5 space-y-2">
                        {open.map((row) => (
                            <li key={row.id} className="rounded-lg border border-sky-200 bg-sky-50/60 p-2.5 text-sm">
                                <p className="font-semibold text-gray-900">{row.type_label}</p>
                                <p className="mt-0.5 text-xs text-gray-600">
                                    {row.status.replace('_', ' ')}
                                    {row.assignee && ` · ${row.assignee}`}
                                    {row.target_date && ` · target ${row.target_date}`}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {outstanding.length === 0 ? (
                <p className="text-sm leading-relaxed text-gray-600">
                    {suggestions.length === 0
                        ? 'No intervention is suggested. Either nothing was raised against this farm, or the office has not set a plan for the factors that were.'
                        : 'Every suggested intervention for this farm is already open.'}
                </p>
            ) : (
                <>
                    <p className="-mt-1 mb-3 text-xs text-gray-500">
                        Suggested from the factors above. Nothing is opened until you open it.
                    </p>

                    <ul className="space-y-2.5">
                        {outstanding.map((suggestion) => (
                            <li key={suggestion.factor_key} className="rounded-xl border border-gray-200 p-3">
                                <p className="font-semibold leading-snug text-gray-900">
                                    <span className="mr-1">{suggestion.icon}</span>
                                    {suggestion.type_label}
                                </p>

                                <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${PRIORITY[suggestion.priority]?.chip ?? PRIORITY.medium.chip}`}>
                                    {PRIORITY[suggestion.priority]?.label ?? suggestion.priority}
                                </span>

                                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                                    <span className="font-semibold text-gray-500">Because:</span> {suggestion.reason}
                                </p>

                                <button
                                    type="button"
                                    disabled={processing || opening === suggestion.factor_key}
                                    onClick={() => openOne(suggestion)}
                                    className="mt-2.5 w-full rounded-lg border border-[#006400] px-3 py-1.5 text-sm font-semibold text-[#006400] transition hover:bg-green-50 disabled:opacity-50"
                                >
                                    {opening === suggestion.factor_key ? 'Opening…' : 'Open intervention'}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <Link
                href="/admin/interventions"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#006400] hover:underline"
            >
                View the office queue
                <ChevronRight className="h-4 w-4" />
            </Link>
        </Panel>
    );
}

/**
 * Email the farmer what this analysis found.
 *
 * The message is composed server-side from the same factors shown above, so
 * it cannot say anything the page does not. The button is absent entirely when
 * nothing was raised: an alert about a risk nobody identified is precisely the
 * notification this feature must never send.
 */
function AlertFarmerPanel({ farmerId, hasFactors }) {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    if (!hasFactors) {
        return null;
    }

    const send = () => {
        setSending(true);

        router.post(`/admin/farmers/${farmerId}/analysis/alert`, {}, {
            preserveScroll: true,
            onSuccess: () => setSent(true),
            onFinish: () => setSending(false),
        });
    };

    return (
        <Panel title="Tell the farmer" icon={Mail}>
            <p className="text-sm leading-relaxed text-gray-600">
                Emails this farmer the level, the main concern and the recommended actions —
                composed from the factors above, not typed. Sent to the address on their own
                record.
            </p>

            <button
                type="button"
                disabled={sending}
                onClick={send}
                className="mt-3 w-full rounded-lg border border-[#006400] px-4 py-2.5 text-sm font-semibold text-[#006400] transition hover:bg-green-50 disabled:opacity-50"
            >
                {sending ? 'Sending…' : sent ? 'Send again' : 'Send risk alert'}
            </button>

            {sent && (
                <p className="mt-2 text-xs font-medium text-[#006400]">
                    Sent, and logged with the farmer&rsquo;s other correspondence.
                </p>
            )}
        </Panel>
    );
}
