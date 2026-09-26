import AdminLayout from '@/Layouts/AdminLayout';
import { Deferred, Link, router } from '@inertiajs/react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import {
    AlertTriangle, TrendingUp, TrendingDown, Minus, Info, CalendarDays,
    Sprout, UserX, Database, MapPin, Trophy, LineChart, ChevronRight, ShieldAlert,
} from 'lucide-react';
import Card from '@/Components/ui/Card';
import ConfidenceBadge from '@/Components/ui/ConfidenceBadge';
import { formatDate } from '@/utils/dateFormatter';
import Tabs from '@/Components/ui/Tabs';
import PredictionStatusBadge from '@/Components/ui/PredictionStatusBadge';
import PredictionFilters from '@/Components/Analytics/PredictionFilters';
import YieldForecastChart from '@/Components/Analytics/YieldForecastChart';
import { usePermissions } from '@/hooks/usePermissions';

const kg = (value) =>
    value === null || value === undefined
        ? '—'
        : new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(value);

const Loading = ({ label }) => (
    <div className="py-12 text-center text-sm text-gray-500">Loading {label}…</div>
);

const Empty = ({ icon: Icon, title, hint }) => (
    <div className="py-12 text-center">
        <Icon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{hint}</p>
    </div>
);

const TrendIcon = ({ direction }) => {
    if (direction === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (direction === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />;
    if (direction === 'stable') return <Minus className="h-4 w-4 text-gray-500" />;
    return <Info className="h-4 w-4 text-gray-400" />;
};


/**
 * Crop yield outlook, built from per-parcel predictions.
 *
 * Coverage leads, before any total. A forecast covering a third of the parcels
 * is a different claim from one covering all of them, and a headline number
 * with no denominator hides which it is.
 */
/** A headline figure with its icon, meaning and, where honest, a comparison. */
function MetricCard({ icon: Icon, label, value, unit, hint, change }) {
    const tone = change === null || change === undefined
        ? 'text-gray-500'
        : change >= 0 ? 'text-green-700' : 'text-amber-700';

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-green-700" aria-hidden="true" />
                <span className="truncate">{label}</span>
            </div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-900">
                {value}
                {unit && <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>}
            </div>
            {change !== null && change !== undefined && (
                <div className={`mt-0.5 text-xs font-medium ${tone}`}>
                    {change >= 0 ? '+' : ''}{change}% vs historical
                </div>
            )}
            {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
        </div>
    );
}

/** A farmer's existing assessment, summarised. Read, never recomputed. */
function AssessmentCell({ riskStatus, assessedAt }) {
    if (!assessedAt) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                Not assessed
            </span>
        );
    }

    const tone = {
        low: 'text-green-700',
        medium: 'text-amber-700',
        high: 'text-orange-700',
        critical: 'text-red-700',
    }[riskStatus] ?? 'text-gray-600';

    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {riskStatus ? `${riskStatus[0].toUpperCase()}${riskStatus.slice(1)} risk` : 'Assessed'}
        </span>
    );
}

/** Wide tables scroll sideways rather than breaking the page on a phone. */
function ScrollTable({ head, children, minWidth = 'min-w-[720px]' }) {
    return (
        <div className="overflow-x-auto">
            <table className={`w-full ${minWidth} text-sm`}>
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>{head}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">{children}</tbody>
            </table>
        </div>
    );
}

const Change = ({ value }) => (
    <span className={
        value === null || value === undefined ? 'text-gray-400'
            : value >= 0 ? 'text-green-700' : 'text-amber-700'
    }
    >
        {value === null || value === undefined ? '—' : `${value >= 0 ? '+' : ''}${value}%`}
    </span>
);

/**
 * Crop yield outlook, built from per-parcel predictions.
 *
 * Coverage leads, before any total. A forecast covering a third of the parcels
 * is a different claim from one covering all of them, and a headline number
 * with no denominator hides which it is.
 *
 * Every tab below groups the SAME parcel predictions a different way, so no
 * two tabs can disagree and nothing is double counted.
 */
/**
 * Why there is no forecast, in the office's own numbers.
 *
 * "No data available" is useless to people who know perfectly well they have
 * data. GeoFarm-IS can hold hundreds of farmers, parcels and crop records and
 * still produce nothing here, because a yield prediction needs one specific
 * combination: a cropping row carrying BOTH a planted area and a harvested
 * yield. A crop recorded without its harvest cannot predict a harvest.
 *
 * So this counts each step and names the one that is missing, rather than
 * leaving staff to guess whether the page is broken.
 */
function DataDiagnostics({ diagnostics }) {
    if (!diagnostics) return null;

    const {
        crop_seasons: seasons,
        with_area: withArea,
        with_yield: withYield,
        usable,
        parcels,
        parcels_cropped: cropped,
        min_for_own_history: minRecords,
    } = diagnostics;

    /*
     * The first unmet condition, in the order they must be met. Only one is
     * shown: a list of four problems is a wall, a single next step is a task.
     */
    const blocker = (() => {
        if (parcels === 0) return {
            what: 'No farm parcels are recorded yet.',
            next: 'Add parcels to farmers, then record their croppings.',
        };
        if (seasons === 0) return {
            what: 'No crop seasons are recorded against any parcel.',
            next: 'Record croppings under Seasonal Tracking, including the area planted.',
        };
        if (withYield === 0) return {
            what: `${seasons} cropping${seasons === 1 ? ' is' : 's are'} recorded, but none has a harvested yield.`,
            next: 'Open a completed cropping and fill in the harvested yield in kilograms. That figure is what every forecast is built from.',
        };
        if (withArea === 0) return {
            what: `${withYield} harvest${withYield === 1 ? ' is' : 's are'} recorded, but none has a planted area.`,
            next: 'Add the area planted (ha) to those croppings. Yield alone cannot give a yield per hectare.',
        };
        if (usable === 0) return {
            what: 'No cropping has both a planted area and a harvested yield.',
            next: 'Croppings need both figures together on the same record before they can be used.',
        };
        return null;
    })();

    const rows = [
        ['Farm parcels', parcels],
        ['Parcels with a cropping', cropped],
        ['Croppings recorded', seasons],
        ['…with a planted area', withArea],
        ['…with a harvested yield', withYield],
        ['…usable for prediction (both)', usable],
    ];

    return (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-left">
            <h4 className="text-sm font-semibold text-gray-900">What the records currently hold</h4>

            <dl className="mt-3 divide-y divide-gray-100">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-1.5 text-sm">
                        <dt className={label.startsWith('…') ? 'pl-3 text-gray-500' : 'text-gray-700'}>
                            {label}
                        </dt>
                        <dd className={`tabular-nums font-semibold ${value > 0 ? 'text-gray-900' : 'text-amber-700'}`}>
                            {value ?? 0}
                        </dd>
                    </div>
                ))}
            </dl>

            {blocker ? (
                <div className="mt-3 rounded-lg bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-900">{blocker.what}</p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">{blocker.next}</p>
                </div>
            ) : (
                <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-600">
                    There are {usable} usable cropping{usable === 1 ? '' : 's'}. A parcel needs {minRecords} comparable
                    harvests before its own history is trusted; below that the forecast falls back to the barangay,
                    then to the municipality.
                </p>
            )}

            <Link
                href="/admin/seasonal"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-900"
            >
                Open Seasonal Tracking
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
        </div>
    );
}

function YieldOutlook({ yieldOutlook, canIntervene }) {
    if (!yieldOutlook?.available) {
        return (
            <Card>
                <Empty
                    icon={Database}
                    title="No yield forecast for these filters"
                    hint={yieldOutlook?.reason
                        || "Record cropping seasons with a planted area and a harvested yield, and a forecast will appear here."}
                />
                {/* Says WHICH record is missing, counted from the database,
                    rather than leaving staff to wonder if the page is broken. */}
                <div className="mx-auto max-w-lg">
                    <DataDiagnostics diagnostics={yieldOutlook?.diagnostics} />
                </div>
            </Card>
        );
    }

    const { coverage, municipal, byBarangay, byCrop, byFarmer, watchlist } = yieldOutlook;
    const pct = coverage.parcels > 0
        ? Math.round((coverage.predictable / coverage.parcels) * 100)
        : 0;

    const overview = (
        <div className="space-y-5 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    icon={LineChart}
                    label="Predicted production"
                    value={kg(municipal?.predicted_total_kg)}
                    unit="kg"
                    change={municipal?.expected_change_pct}
                />
                <MetricCard
                    icon={Sprout}
                    label="Average predicted yield"
                    value={kg(municipal?.avg_predicted_per_ha)}
                    unit="kg/ha"
                    hint="Across parcels with a prediction"
                />
                <MetricCard
                    icon={MapPin}
                    label="Farm area"
                    value={municipal?.area_ha ?? 0}
                    unit="ha"
                    hint="Covered by this forecast"
                />
                <MetricCard
                    icon={Trophy}
                    label="Forecast coverage"
                    value={`${pct}%`}
                    hint={`${coverage.predictable} of ${coverage.parcels} parcels`}
                />
            </div>

            {/* What the forecast rests on. A prediction drawn from municipal
                averages is a far weaker claim than one from the farmer's own
                record, and saying which is the difference between a forecast
                and a guess. */}
            <div className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                    <span>Records each prediction is based on</span>
                    <span className="tabular-nums">{coverage.predictable} of {coverage.parcels} parcels</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    {[
                        ['Own history', coverage.by_basis.farmer, 'the farmer’s own harvests'],
                        ['Barangay', coverage.by_basis.barangay, 'neighbouring farms'],
                        ['Municipal', coverage.by_basis.municipal, 'the whole municipality'],
                        ['No data', coverage.by_basis.none, 'no prediction made'],
                    ].map(([label, count, hint]) => (
                        <div key={label} className="rounded-lg bg-white p-2.5" title={hint}>
                            <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
                            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{count ?? 0}</dd>
                        </div>
                    ))}
                </dl>

                {coverage.insufficient > 0 && (
                    <p className="mt-3 text-xs leading-5 text-amber-700">
                        {coverage.insufficient} parcel{coverage.insufficient === 1 ? " has" : "s have"} insufficient
                        historical data and {coverage.insufficient === 1 ? "is" : "are"} excluded from every total
                        above. They are not counted as zero.
                    </p>
                )}

                {/* Nothing at all could be predicted. The totals above are
                    therefore all zero, and the office deserves to know which
                    missing record caused that rather than doubting the page. */}
                {coverage.predictable === 0 && (
                    <DataDiagnostics diagnostics={yieldOutlook.diagnostics} />
                )}
            </div>
        </div>
    );

    const farmerTab = (
        <div className="p-4">
            {byFarmer.length === 0 ? (
                <Empty icon={UserX} title="No farmers match these filters" hint="Try widening the filters above." />
            ) : (
                <ScrollTable
                    minWidth="min-w-[880px]"
                    head={(
                        <>
                            <th className="px-3 py-2 text-left">Farmer</th>
                            <th className="px-3 py-2 text-left">Barangay</th>
                            <th className="px-3 py-2 text-left">Crop</th>
                            <th className="px-3 py-2 text-left">Assessment</th>
                            <th className="px-3 py-2 text-right">Historical</th>
                            <th className="px-3 py-2 text-right">Predicted</th>
                            <th className="px-3 py-2 text-right">Change</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2" />
                        </>
                    )}
                >
                    {byFarmer.map((row) => (
                        <tr key={`${row.parcel_id}-${row.crop_id}`} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                                <div className="font-medium text-gray-800">{row.farmer_name || 'Unassigned'}</div>
                                {row.rsbsa_no && <div className="font-mono text-[11px] text-gray-400">{row.rsbsa_no}</div>}
                            </td>
                            <td className="px-3 py-2 text-gray-700">{row.barangay || '—'}</td>
                            <td className="px-3 py-2 text-gray-700">{row.crop_name}</td>
                            <td className="px-3 py-2">
                                <AssessmentCell riskStatus={row.risk_status} assessedAt={row.assessed_at} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                {kg(row.historical_average_kg)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">
                                {/* Never 0 for an unpredictable parcel. */}
                                {row.predicted_yield_kg === null
                                    ? <span className="text-xs font-normal italic text-gray-400">Insufficient data</span>
                                    : kg(row.predicted_yield_kg)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                                <Change value={row.expected_change_pct} />
                            </td>
                            <td className="px-3 py-2">
                                <PredictionStatusBadge status={row.prediction_status} />
                            </td>
                            <td className="px-3 py-2 text-right">
                                <Link
                                    href={`/admin/farmers/${row.farmer_id}/analysis`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900"
                                >
                                    View
                                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                </Link>
                            </td>
                        </tr>
                    ))}
                </ScrollTable>
            )}
        </div>
    );

    const barangayTab = (
        <div className="p-4">
            {byBarangay.length === 0 ? (
                <Empty icon={MapPin} title="Nothing to group yet" hint="No parcel has enough history to predict." />
            ) : (
                <ScrollTable
                    head={(
                        <>
                            <th className="px-3 py-2 text-left">Barangay</th>
                            <th className="px-3 py-2 text-right">Farmers</th>
                            <th className="px-3 py-2 text-right">Parcels</th>
                            <th className="px-3 py-2 text-right">Area (ha)</th>
                            <th className="px-3 py-2 text-right">Historical</th>
                            <th className="px-3 py-2 text-right">Predicted</th>
                            <th className="px-3 py-2 text-right">Change</th>
                            <th className="px-3 py-2 text-right">No data</th>
                            <th className="px-3 py-2" />
                        </>
                    )}
                >
                    {byBarangay.map((row) => (
                        <tr key={row.group} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-800">{row.group}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">{row.farmers}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">{row.parcels}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">{row.area_ha}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">{kg(row.historical_total_kg)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{kg(row.predicted_total_kg)}</td>
                            <td className="px-3 py-2 text-right tabular-nums"><Change value={row.expected_change_pct} /></td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-400">{row.without_prediction || '—'}</td>
                            <td className="px-3 py-2 text-right">
                                {/* The existing GIS map, filtered. No second map. */}
                                <Link
                                    href={`/admin/gis/map?barangay=${encodeURIComponent(row.group)}`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900"
                                >
                                    GIS
                                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                </Link>
                            </td>
                        </tr>
                    ))}
                </ScrollTable>
            )}
        </div>
    );

    const cropTab = (
        <div className="p-4">
            {byCrop.length === 0 ? (
                <Empty icon={Sprout} title="No crop totals yet" hint="No parcel has enough history to predict." />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {byCrop.map((row) => (
                        <div key={row.group} className="rounded-2xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-gray-800">{row.crop_name}</span>
                                <Change value={row.expected_change_pct} />
                            </div>
                            <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                                {kg(row.predicted_total_kg)}
                                <span className="ml-1 text-xs font-normal text-gray-500">kg</span>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <div>
                                    <dt className="text-gray-500">Farmers</dt>
                                    <dd className="font-medium tabular-nums text-gray-800">{row.farmers}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Area</dt>
                                    <dd className="font-medium tabular-nums text-gray-800">{row.area_ha} ha</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Avg yield</dt>
                                    <dd className="font-medium tabular-nums text-gray-800">
                                        {row.avg_predicted_per_ha === null ? '—' : `${kg(row.avg_predicted_per_ha)} kg/ha`}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Historical</dt>
                                    <dd className="font-medium tabular-nums text-gray-800">{kg(row.historical_total_kg)}</dd>
                                </div>
                            </dl>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const reviewTab = (
        <div className="p-4">
            <p className="mb-3 text-sm text-gray-600">
                Parcels predicted below their own historical average. Worth a look by Municipal
                Agriculture Office staff. This is <strong>not</strong> a determination of eligibility
                for assistance, and no intervention is created from it.
            </p>

            {watchlist.length === 0 ? (
                <Empty
                    icon={ShieldAlert}
                    title="Nothing flagged for review"
                    hint="No parcel with a prediction is tracking below its own historical average."
                />
            ) : (
                <ScrollTable
                    head={(
                        <>
                            <th className="px-3 py-2 text-left">Barangay</th>
                            <th className="px-3 py-2 text-left">Crop</th>
                            <th className="px-3 py-2 text-right">Historical</th>
                            <th className="px-3 py-2 text-right">Predicted</th>
                            <th className="px-3 py-2 text-right">Change</th>
                            <th className="px-3 py-2 text-left">Based on</th>
                            <th className="px-3 py-2" />
                        </>
                    )}
                >
                    {watchlist.map((row) => (
                        <tr key={`${row.parcel_id}-${row.crop_id}`} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{row.barangay || '—'}</td>
                            <td className="px-3 py-2 text-gray-700">{row.crop_name}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">{kg(row.historical_average_kg)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{kg(row.predicted_yield_kg)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-amber-700">{row.expected_change_pct}%</td>
                            <td className="px-3 py-2"><ConfidenceBadge level={row.confidence} dataPoints={row.data_points} /></td>
                            <td className="px-3 py-2 text-right">
                                <div className="flex justify-end gap-2">
                                    <Link
                                        href={`/admin/farmers/${row.farmer_id}/analysis`}
                                        className="text-xs font-semibold text-green-700 hover:text-green-900"
                                    >
                                        Review farmer
                                    </Link>
                                    {/*
                                        The interventions queue, not a create link.

                                        There is no GET /admin/interventions/create route
                                        — interventions are created by POST from the index
                                        page — and that page filters by status, priority
                                        and assignee only, so a ?farmer_id= link would
                                        promise a filter it does not apply.

                                        Opening an intervention stays a deliberate act by
                                        an authorised person. Nothing here creates one.
                                    */}
                                    {canIntervene && (
                                        <Link
                                            href="/admin/interventions"
                                            className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                                        >
                                            Interventions
                                        </Link>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </ScrollTable>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            <Tabs
                tabs={[
                    { id: 'overview', label: 'Overview', content: overview },
                    { id: 'farmer', label: `By farmer (${byFarmer.length})`, content: farmerTab },
                    { id: 'barangay', label: `By barangay (${byBarangay.length})`, content: barangayTab },
                    { id: 'crop', label: `By crop (${byCrop.length})`, content: cropTab },
                    { id: 'review', label: `Review (${watchlist.length})`, content: reviewTab },
                ]}
            />

            <p className="text-center text-xs text-gray-400">
                Estimates from recorded harvests, using historical medians adjusted by each
                parcel&rsquo;s own trend. Not a guarantee of future production.
                Method: {yieldOutlook.methodology}
            </p>
        </div>
    );
}

export default function PredictiveAnalytics({ readiness, filters, filterOptions, barangays, upcoming }) {
    const { can } = usePermissions();

    /*
     * Filters live in the query string, not in React state.
     *
     * That is what makes a filtered view bookmarkable, shareable and
     * survivable across a refresh, and it means the server decides what the
     * numbers are — there is no client-side copy that could disagree with it.
     *
     * Empty values are stripped so the URL stays readable and a cleared
     * filter leaves no trace behind.
     */
    const applyFilters = (next) => {
        const query = Object.fromEntries(
            Object.entries(next).filter(([, value]) => value !== null && value !== '' && value !== undefined),
        );

        router.get('/admin/analytics/predictive', query, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const changeScope = (barangay) => applyFilters({ ...filters, barangay });

    const filtersActive = Object.entries(filters ?? {})
        .some(([, value]) => value !== null && value !== '' && value !== undefined);


    const readinessCopy = {
        none: 'No completed harvests are recorded yet, so no forecasts can be produced. Record cropping seasons with yield figures to enable forecasting.',
        thin: 'Only a small number of harvests are recorded. Forecasts below are directional at best — treat them as rough indications.',
        usable: 'There is enough history for reasonable estimates, though individual crops may still be thin.',
        good: 'There is a solid history behind these forecasts.',
    };

    const readinessTone = {
        none: 'bg-red-50 border-red-300 text-red-900',
        thin: 'bg-amber-50 border-amber-300 text-amber-900',
        usable: 'bg-green-50 border-green-300 text-green-900',
        good: 'bg-green-50 border-green-300 text-green-900',
    };

    return (
        <AdminLayout title="Forecast & Advisory">
            {/* ------------------------------------------------ page heading */}
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
                    <LineChart className="h-6 w-6 text-[#006400]" />
                    Predictive Analytics
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Farm conditions, historical performance and seasonal patterns, read together to
                    show which farms need attention and what can be done about it.
                    {upcoming?.label && <> Risk figures below describe the upcoming <strong>{upcoming.label}</strong>.</>}
                </p>
            </div>

            {/* --------------------------------- who needs attention, and how many */}
            <Deferred data="riskBoard" fallback={<Loading label="risk summary" />}>
                <RiskSummary />
            </Deferred>

            <Deferred data="priorityFarmers" fallback={<Loading label="priority farmers" />}>
                <PriorityFarmers />
            </Deferred>

            {/*
                Filters first, then everything that obeys them.

                Each section below reads the same server-side filter set, so
                the page can never show a filtered table beside an unfiltered
                total — the most confusing thing an analytics screen can do.
            */}
            <PredictionFilters
                filters={filters}
                options={filterOptions}
                barangays={barangays}
                onChange={applyFilters}
                active={filtersActive}
            />

            {/*
                Recorded production per year, with the next cropping forecast.
                Deferred like every other aggregate so the page paints first.
            */}
            <Card className="mb-5">
                <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-900">
                    <LineChart className="h-4 w-4 text-green-700" aria-hidden="true" />
                    Crop yield forecast
                </h2>
                <p className="mb-4 text-sm text-gray-600">
                    Recorded production by year, with an estimate for the next cropping.
                </p>
                <Deferred data="yearlySeries" fallback={<Loading label="production history" />}>
                    <YieldForecastChart />
                </Deferred>
            </Card>

            {/*
                Crop yield outlook. Deferred like every other aggregate on this
                page, so the screen paints before the cropping history is read.
            */}
            <div className="mb-5">
                <Deferred data="yieldOutlook" fallback={<Loading label="crop yield outlook" />}>
                    <YieldOutlook canIntervene={can('edit assistance')} />
                </Deferred>
            </div>

            {/* Scope selector - municipality wide, or a single barangay */}
            <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-700" />
                    <label htmlFor="scope-barangay" className="text-sm font-semibold text-gray-800">
                        Forecast scope
                    </label>
                </div>

                <select
                    id="scope-barangay"
                    name="barangay"
                    value={filters.barangay ?? ''}
                    onChange={e => changeScope(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm min-w-64"
                >
                    <option value="">All of Tumauini (municipality-wide)</option>
                    {barangays.map(b => (
                        <option key={b} value={b}>Barangay {b}</option>
                    ))}
                </select>

                {filters.barangay && (
                    <button
                        onClick={() => changeScope('')}
                        className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-xl hover:bg-white transition"
                    >
                        Clear
                    </button>
                )}

                <span className="text-sm text-gray-600 ml-auto">
                    Showing: <strong>{readiness.scope}</strong>
                </span>
            </div>

            {/* Data readiness - explains up front why forecasts look the way they do */}
            <div className={`rounded-xl border-2 p-5 mb-6 ${readinessTone[readiness.level]}`}>
                <div className="flex items-start gap-3">
                    <Database className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-bold mb-1">Forecast data readiness</p>
                        <p className="text-sm mb-3">{readinessCopy[readiness.level]}</p>
                        <div className="flex flex-wrap gap-6 text-sm">
                            <span><strong>{readiness.seasons_with_yield}</strong> harvests with yield recorded</span>
                            <span><strong>{readiness.recorded_seasons}</strong> cropping seasons total</span>
                            <span><strong>{readiness.distinct_years}</strong> distinct years</span>
                            <span><strong>{readiness.verified_farmers}</strong> verified farmers</span>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-sm text-gray-500 mb-6">
                Forecasts use historical averages, least-squares trends and season-based rules over your own
                records. They are statistical estimates, not guarantees, and every figure is shown with the
                amount of data behind it.
            </p>

            {/* Expected harvest supply by month */}
            <Card title="">
                <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="h-5 w-5 text-green-600" />
                    <h2 className="text-xl font-bold text-gray-900">Expected harvest supply</h2>
                </div>
                <p className="text-sm text-gray-600 mb-5">
                    Projected volume reaching harvest over the next 12 months, from recorded plantings.
                    Helps anticipate supply peaks, buying and post-harvest storage needs.
                </p>

                <Deferred data="harvestCalendar" fallback={<Loading label="harvest calendar" />}>
                    <HarvestCalendar />
                </Deferred>
            </Card>

            {/* At-risk parcels */}
            <div className="mt-6">
                <Card title="">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <h2 className="text-xl font-bold text-gray-900">Farmers needing advisory</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-5">
                        Upcoming harvests exposed to typhoon or wet season timing, or farmers already flagged
                        as high risk. Use this to send advisories before the harvest window.
                    </p>

                    <Deferred data="atRisk" fallback={<Loading label="risk exposure" />}>
                        <AtRiskList />
                    </Deferred>
                </Card>
            </div>

            {/* Barangay comparison - always municipality-wide */}
            <div className="mt-6">
                <Card title="">
                    <div className="flex items-center gap-2 mb-1">
                        <Trophy className="h-5 w-5 text-green-600" />
                        <h2 className="text-xl font-bold text-gray-900">Barangay performance</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-5">
                        Area-weighted productivity per barangay against the municipal average, so a large
                        low-yield parcel is not masked by a small high-yield one. Use it to target extension
                        work where yields are lagging or falling.
                    </p>

                    <Deferred data="barangayComparison" fallback={<Loading label="barangay comparison" />}>
                        <BarangayComparison onSelect={changeScope} />
                    </Deferred>
                </Card>
            </div>

            {/* Commodity outlook */}
            <div className="mt-6">
                <Card title="">
                    <div className="flex items-center gap-2 mb-1">
                        <Sprout className="h-5 w-5 text-green-600" />
                        <h2 className="text-xl font-bold text-gray-900">Commodity outlook</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-5">
                        Productivity per crop and whether it is improving or declining across recorded years.
                    </p>

                    <Deferred data="commodityOutlook" fallback={<Loading label="commodity outlook" />}>
                        <CommodityOutlook />
                    </Deferred>
                </Card>
            </div>

            {/* Inactive farmers */}
            <div className="mt-6 mb-6">
                <Card title="">
                    <div className="flex items-center gap-2 mb-1">
                        <UserX className="h-5 w-5 text-gray-600" />
                        <h2 className="text-xl font-bold text-gray-900">No recent cropping activity</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-5">
                        Verified farmers with registered parcels but no planting recorded in the last 18 months.
                        Either they have stopped farming or data collection has lapsed — both are worth a visit.
                    </p>

                    <Deferred data="inactiveFarmers" fallback={<Loading label="activity check" />}>
                        <InactiveFarmers />
                    </Deferred>
                </Card>
            </div>
        </AdminLayout>
    );
}

function HarvestCalendar({ harvestCalendar = [] }) {
    if (harvestCalendar.length === 0) {
        return (
            <Empty
                icon={CalendarDays}
                title="No upcoming harvests projected"
                hint="Record cropping seasons with planting dates to see expected harvest volume by month."
            />
        );
    }

    const hasEstimates = harvestCalendar.some(m => m.is_estimated);

    return (
        <>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={harvestCalendar} margin={{ top: 20, right: 12, left: 12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month_label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={kg} />
                        <Tooltip formatter={(v) => [`${kg(v)} kg`, 'Expected volume']} />
                        <Bar dataKey="volume_kg" fill="#16a34a" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="volume_kg" position="top" formatter={kg} style={{ fontSize: 11, fill: '#374151' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Month</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Expected volume</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Parcels</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Leading crops</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {harvestCalendar.map(month => (
                            <tr key={month.month}>
                                <td className="px-4 py-2 font-medium text-gray-900">
                                    {month.month_label}
                                    {month.is_estimated && (
                                        <span className="ml-2 text-xs text-amber-700">estimated</span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                    {month.volume_kg === null ? 'Unknown' : `${kg(month.volume_kg)} kg`}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700">
                                    {month.parcels}
                                    {month.unknown_volume > 0 && (
                                        <span className="ml-1 text-xs text-gray-500">
                                            ({month.unknown_volume} unprojectable)
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-gray-700">
                                    {Object.entries(month.crops).slice(0, 3)
                                        .map(([name, vol]) => `${name} (${kg(vol)} kg)`).join(', ') || '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {hasEstimates && (
                <p className="mt-3 text-xs text-gray-500">
                    Months marked <span className="text-amber-700">estimated</span> include plantings with no
                    recorded yield, projected from the crop's historical average per hectare.
                    "Unknown" means the crop has no harvest history to project from at all.
                </p>
            )}
        </>
    );
}

function AtRiskList({ atRisk = [] }) {
    if (atRisk.length === 0) {
        return (
            <Empty
                icon={AlertTriangle}
                title="No upcoming harvests at risk"
                hint="Nothing scheduled to harvest inside the wet or typhoon window, and no high-risk farmers with active plantings."
            />
        );
    }

    const tone = {
        high: 'border-red-300 bg-red-50',
        medium: 'border-amber-300 bg-amber-50',
        low: 'border-gray-200 bg-white',
    };

    const badge = {
        high: 'bg-red-600 text-white',
        medium: 'bg-amber-500 text-white',
        low: 'bg-gray-400 text-white',
    };

    return (
        <div className="space-y-3">
            {atRisk.map((row, index) => (
                <div key={`${row.farmer_id}-${row.harvest_date}-${index}`} className={`border-2 rounded-xl p-4 ${tone[row.risk_level]}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <Link
                                    href={`/admin/farmers/${row.farmer_id}`}
                                    className="font-bold text-gray-900 hover:text-green-700 hover:underline"
                                >
                                    {row.farmer_name}
                                </Link>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${badge[row.risk_level]}`}>
                                    {row.risk_level}
                                </span>
                            </div>
                            <p className="text-sm text-gray-700">
                                {row.barangay || '—'} · {row.crop} · {row.area_ha} ha ·
                                harvest around <strong>{formatDate(row.harvest_date, 'date-only')}</strong>
                            </p>
                            <ul className="mt-2 text-sm text-gray-700 list-disc list-inside">
                                {row.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function BarangayComparison({ barangayComparison = [], onSelect }) {
    if (barangayComparison.length === 0) {
        return (
            <Empty
                icon={Trophy}
                title="No barangay data yet"
                hint="Barangay comparison needs harvest records linked to parcels with a barangay set."
            />
        );
    }

    const municipalAvg = barangayComparison[0]?.municipal_avg_yield_per_ha;

    return (
        <>
            {municipalAvg != null && (
                <p className="text-sm text-gray-600 mb-4">
                    Municipal average: <strong>{kg(municipalAvg)} kg/ha</strong>
                </p>
            )}

            <div className="h-72 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={barangayComparison.slice(0, 12)}
                        margin={{ top: 20, right: 12, left: 12, bottom: 4 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="barangay" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={kg} />
                        <Tooltip formatter={(v) => [`${kg(v)} kg/ha`, 'Yield per hectare']} />
                        <Bar dataKey="yield_per_ha" fill="#0d9488" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Barangay</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Yield / ha</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">vs municipal avg</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Area</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Farmers</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Trend</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Confidence</th>
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {barangayComparison.map(row => (
                            <tr key={row.barangay}>
                                <td className="px-4 py-3 font-medium text-gray-900">{row.barangay}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                    {row.yield_per_ha === null ? '—' : `${kg(row.yield_per_ha)} kg`}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {row.vs_municipal_pct === null ? '—' : (
                                        <span className={
                                            row.vs_municipal_pct > 0 ? 'text-green-700 font-semibold'
                                                : row.vs_municipal_pct < 0 ? 'text-red-700 font-semibold'
                                                    : 'text-gray-600'
                                        }>
                                            {row.vs_municipal_pct > 0 ? '+' : ''}{row.vs_municipal_pct}%
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">{row.total_area_ha} ha</td>
                                <td className="px-4 py-3 text-right text-gray-700">{row.farmers}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <TrendIcon direction={row.trend.direction} />
                                        <span className="text-gray-700 capitalize">{row.trend.direction}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <ConfidenceBadge level={row.confidence} dataPoints={row.records} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => onSelect(row.barangay)}
                                        className="text-sm text-green-700 hover:underline font-medium"
                                    >
                                        Focus
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function CommodityOutlook({ commodityOutlook = [] }) {
    if (commodityOutlook.length === 0) {
        return (
            <Empty
                icon={Sprout}
                title="No harvest history yet"
                hint="Record cropping seasons with yield figures to compare productivity across commodities."
            />
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Crop</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Area planted</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Total harvested</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Yield / ha</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Trend</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Confidence</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {commodityOutlook.map(row => (
                        <tr key={row.crop_id}>
                            <td className="px-4 py-3 font-medium text-gray-900">{row.crop_name}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{row.total_area_ha} ha</td>
                            <td className="px-4 py-3 text-right text-gray-700">{kg(row.total_yield_kg)} kg</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                {row.yield_per_ha === null ? '—' : `${kg(row.yield_per_ha)} kg`}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <TrendIcon direction={row.trend.direction} />
                                    <span className="text-gray-700 capitalize">{row.trend.direction}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{row.trend.explanation}</p>
                            </td>
                            <td className="px-4 py-3">
                                <ConfidenceBadge level={row.confidence} dataPoints={row.data_points} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function InactiveFarmers({ inactiveFarmers = [] }) {
    if (inactiveFarmers.length === 0) {
        return (
            <Empty
                icon={UserX}
                title="All farmers have recent activity"
                hint="Every verified farmer with parcels has a planting recorded in the last 18 months."
            />
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Farmer</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Barangay</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Parcels</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Total area</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Commodities</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {inactiveFarmers.map(row => (
                        <tr key={row.farmer_id}>
                            <td className="px-4 py-3">
                                <Link
                                    href={`/admin/farmers/${row.farmer_id}`}
                                    className="font-medium text-gray-900 hover:text-green-700 hover:underline"
                                >
                                    {row.farmer_name}
                                </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{row.barangay || '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{row.parcels}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{row.total_area_ha} ha</td>
                            <td className="px-4 py-3 text-gray-700">{row.commodities.join(', ') || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ------------------------------------------------------------ office board */

/**
 * Four counts, and the fourth is the point.
 *
 * "Insufficient data" is drawn in neutral slate with a dashed edge, never in
 * the green of low risk. A farm nobody has assessed is not a safe farm, and a
 * board that folds the two together sends staff to the wrong villages while
 * the unvisited ones sit quietly counted as fine.
 */
function RiskSummary({ riskBoard }) {
    if (!riskBoard) return null;

    const cards = [
        { key: 'high',     label: 'High risk',        value: riskBoard.high,     tone: 'border-red-200 bg-red-50 text-red-800',        dot: 'bg-red-500' },
        { key: 'moderate', label: 'Moderate risk',    value: riskBoard.moderate, tone: 'border-amber-200 bg-amber-50 text-amber-800',  dot: 'bg-amber-500' },
        { key: 'low',      label: 'Low risk',         value: riskBoard.low,      tone: 'border-green-200 bg-green-50 text-green-800',  dot: 'bg-green-600' },
        { key: 'none',     label: 'Insufficient data', value: riskBoard.insufficient, tone: 'border-dashed border-slate-300 bg-slate-50 text-slate-700', dot: 'bg-slate-300' },
    ];

    return (
        <div className="mb-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {cards.map((card) => (
                    <div key={card.key} className={`rounded-2xl border-2 p-4 ${card.tone}`}>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                            <span className={`h-2.5 w-2.5 rounded-full ${card.dot}`} />
                            {card.label}
                        </p>
                        <p className="mt-2 text-3xl font-bold tabular-nums">{card.value}</p>
                    </div>
                ))}
            </div>

            <p className="mt-2 text-xs text-gray-500">
                Counted from each farmer’s most recent assessment. “Insufficient data” is the
                {' '}{riskBoard.verified} verified farmer{riskBoard.verified === 1 ? '' : 's'} minus those assessed —
                not a low-risk result.
            </p>
        </div>
    );
}

/** The farms to look at first, highest score leading. */
function PriorityFarmers({ priorityFarmers = [] }) {
    if (priorityFarmers.length === 0) {
        return (
            <Card title="Priority attention" className="mb-6">
                <Empty
                    icon={ShieldAlert}
                    title="No farms are currently flagged"
                    hint="Farms appear here once a completed risk assessment comes out moderate or high."
                />
            </Card>
        );
    }

    return (
        <Card title="Priority attention" className="mb-6">
            <div className="grid gap-3 lg:grid-cols-2">
                {priorityFarmers.map((row) => {
                    const high = row.risk_level === 'high';

                    return (
                        <div
                            key={row.farmer_id}
                            className={`rounded-xl border-2 p-4 ${high ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-bold text-gray-900">{row.farmer}</p>
                                    <p className="truncate text-sm text-gray-600">
                                        {[row.parcel, row.commodity, row.area_ha ? `${row.area_ha} ha` : null]
                                            .filter(Boolean).join(' • ') || row.barangay || '—'}
                                    </p>
                                </div>

                                <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                                    high ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {row.risk_level}
                                    {row.risk_score !== null && ` · ${row.risk_score}`}
                                </span>
                            </div>

                            {/* The heaviest stated reason, verbatim. Not a summary. */}
                            {row.main_concern && (
                                <p className="mt-2 text-sm text-gray-700">
                                    <span className="font-semibold">Main concern:</span> {row.main_concern}
                                </p>
                            )}

                            {row.is_stale && (
                                <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                                    Assessment is over a year old
                                </p>
                            )}

                            <Link
                                href={`/admin/farmers/${row.farmer_id}/analysis`}
                                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#006400] hover:underline"
                            >
                                View analysis
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
