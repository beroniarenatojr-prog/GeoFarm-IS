import AdminLayout from '@/Layouts/AdminLayout';
import { Deferred, Link, router } from '@inertiajs/react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import {
    AlertTriangle, TrendingUp, TrendingDown, Minus, Info, CalendarDays,
    Sprout, UserX, Database, MapPin, Trophy,
} from 'lucide-react';
import Card from '@/Components/ui/Card';
import ConfidenceBadge from '@/Components/ui/ConfidenceBadge';
import { formatDate } from '@/utils/dateFormatter';

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

export default function PredictiveAnalytics({ readiness, filters, barangays }) {
    const changeScope = (barangay) => {
        router.get('/admin/analytics/predictive', barangay ? { barangay } : {}, {
            preserveState: true,
            preserveScroll: true,
        });
    };

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
