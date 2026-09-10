import AdminLayout from '@/Layouts/AdminLayout';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Link } from '@inertiajs/react';
import Card from '@/Components/ui/Card';
import {
    Users, MapPin, Beef, HandHeart, Activity, ClipboardCheck, Sprout, Ruler,
    AlertTriangle, CheckCircle2, Mail, ArrowRight, ShieldAlert, Coins, Globe,
} from 'lucide-react';
import { formatDate } from '@/utils/dateFormatter';

/*
 * One family of greens, deep to pale. Using tints of a single hue instead of
 * unrelated blues/oranges keeps the whole screen reading as Tumauini's colour
 * while still letting each figure be told apart.
 *
 * Risk is the deliberate exception: red, amber and green there carry meaning a
 * tint of one hue cannot, and each is paired with a word so the meaning does
 * not rest on colour alone.
 */
const GREEN = {
    deep:   '#006400',
    forest: '#228B22',
    mid:    '#4CAF50',
    light:  '#81C784',
    pale:   '#C8E6C9',
    sage:   '#8B9D83',
};

const PIE_GREENS = [GREEN.deep, GREEN.forest, GREEN.mid, GREEN.light, GREEN.sage, GREEN.pale];

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const num = (n) => Number(n ?? 0).toLocaleString('en-PH');

/* ─────────────────────────────────────────────── building blocks ── */

/**
 * A KPI tile.
 *
 * The number is the loudest thing in it — a dashboard is read at a glance, and
 * the label is only needed once the figure has caught the eye.
 */
function MetricCard({ label, value, hint, icon: Icon, tone = 'deep', href, loading }) {
    const body = (
        <div className="h-full rounded-2xl border border-green-100 bg-white p-5 shadow-sm transition-all duration-200 hover:border-green-300 hover:shadow-md">
            <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: GREEN[tone] }}>
                    <Icon className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0">
                    <p className="text-sm text-gray-600">{label}</p>
                    {loading
                        ? <div className="mt-1 h-8 w-20 animate-pulse rounded bg-green-50" />
                        : <p className="text-3xl font-bold leading-tight text-gray-900 tabular-nums">{value}</p>}
                    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
                </div>
            </div>
        </div>
    );

    return href
        ? <Link href={href} className="block h-full rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500">{body}</Link>
        : body;
}

/** Recharts' default tooltip is grey and boxy; this one matches the palette. */
const GreenTooltip = ({ active, payload, label, format }) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-lg border border-green-200 bg-white px-3 py-2 shadow-lg">
            <p className="mb-0.5 text-xs font-semibold text-gray-500">{label ?? payload[0].name}</p>
            <p className="text-sm font-bold text-[#006400]">
                {format ? format(payload[0].value) : num(payload[0].value)}
            </p>
        </div>
    );
};

function Empty({ icon: Icon, text, action, href }) {
    return (
        <div className="py-12 text-center">
            <Icon className="mx-auto mb-3 h-10 w-10 text-green-200" />
            <p className="text-sm text-gray-500">{text}</p>
            {action && href && (
                <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#006400] hover:underline">
                    {action} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            )}
        </div>
    );
}

/** A panel still streaming in. Deferred props arrive after the first paint. */
function Loading({ rows = 3 }) {
    return (
        <div className="space-y-3 py-2" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading…</span>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-green-50" />
            ))}
        </div>
    );
}

/** One row of a breakdown: name, a proportional bar, and its figure. */
function BarRow({ name, value, total, href, suffix }) {
    const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0;

    const inner = (
        <>
            <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-gray-700">{name}</span>
                <span className="flex-shrink-0 text-sm font-bold tabular-nums text-gray-900">
                    {num(value)}{suffix ? ` ${suffix}` : ''}
                </span>
            </div>
            {/* The bar is a second reading of the same number, not the only
                one — the figure is always printed beside it. */}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-green-50">
                <div className="h-full rounded-full bg-[#4CAF50]" style={{ width: `${pct}%` }} />
            </div>
        </>
    );

    return href
        ? <Link href={href} className="block rounded-lg px-1 py-1.5 hover:bg-green-50/60 focus:outline-none focus:ring-2 focus:ring-green-500">{inner}</Link>
        : <div className="px-1 py-1.5">{inner}</div>;
}

/* ───────────────────────────────────────────────────── the page ── */

export default function Dashboard({
    metrics, attention, farmers, livestock, assistance, risk, charts, activity, quickStats,
}) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const farmersData = (charts?.farmers_per_month ?? []).map(r => ({ month: months[r.month - 1], count: r.count }));
    const cropData = (charts?.crop_production ?? []).map(r => ({ name: String(r.cropping_year), yield: Number(r.total_yield) }));
    const aidData = (charts?.aid_by_program ?? []).map(r => ({ name: r.name ?? 'Unnamed', value: Number(r.value) }));
    const byCrop = (charts?.by_crop ?? []).map(r => ({ name: r.name, total: Number(r.total) }));

    /*
     * What actually needs doing, in one list.
     *
     * Built from the counts rather than written out, so a row only exists when
     * its number is above zero — an "attention" panel listing four things that
     * are all fine trains people to ignore it.
     */
    const todo = [
        {
            key: 'verify',
            count: attention?.pending_verification ?? 0,
            icon: ClipboardCheck,
            label: n => `${n} farmer ${n === 1 ? 'registration is' : 'registrations are'} waiting for review`,
            note: 'Check their documents to activate the accounts.',
            href: '/admin/farmer-verification',
            tone: 'amber',
        },
        {
            key: 'risk',
            count: attention?.high_risk ?? 0,
            icon: ShieldAlert,
            label: n => `${n} ${n === 1 ? 'farmer is' : 'farmers are'} at high climate risk`,
            note: 'Their latest assessment scored in the high band.',
            href: '/admin/farmers',
            tone: 'red',
        },
        {
            key: 'claims',
            count: attention?.pending_claims ?? 0,
            icon: HandHeart,
            label: n => `${n} assistance ${n === 1 ? 'record has' : 'records have'} not been claimed`,
            note: 'Recorded as pending — confirm or forfeit them.',
            href: '/admin/assistance',
            tone: 'amber',
        },
        {
            key: 'uncosted',
            count: attention?.seasons_uncosted ?? 0,
            icon: Coins,
            label: n => `${n} harvested ${n === 1 ? 'season has' : 'seasons have'} no cost recorded`,
            note: 'Cost per kilo and net income cannot be worked out without it.',
            href: '/admin/seasonal',
            tone: 'amber',
        },
    ].filter(item => item.count > 0);

    const TONE = {
        amber: { chip: 'bg-amber-100 text-amber-700', ring: 'border-amber-200 bg-amber-50/60' },
        red:   { chip: 'bg-red-100 text-red-700',     ring: 'border-red-200 bg-red-50/60' },
    };

    const riskTotal = (risk?.high ?? 0) + (risk?.moderate ?? 0) + (risk?.low ?? 0);

    return (
        <AdminLayout title="Dashboard">

            {/* ── 1. What needs attention ─────────────────────────────── */}
            {/* First, deliberately. The office opens this screen to find out
                what it has to do, not to admire totals. */}
            <section aria-labelledby="attention-heading" className="mb-6">
                <h2 id="attention-heading" className="sr-only">Needs attention</h2>

                {attention === undefined ? (
                    <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"><Loading rows={2} /></div>
                ) : todo.length === 0 ? (
                    <div className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50/70 px-5 py-4">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#006400]">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                        </span>
                        <div>
                            <p className="font-semibold text-gray-900">Everything is up to date</p>
                            <p className="text-sm text-gray-600">No urgent actions require your attention.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {todo.map(item => {
                            const Icon = item.icon;
                            const tone = TONE[item.tone];

                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={`flex items-center gap-4 rounded-2xl border px-5 py-3.5 transition-colors hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-500 ${tone.ring}`}
                                >
                                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tone.chip}`}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-semibold text-gray-900">{item.label(item.count)}</span>
                                        <span className="block text-sm text-gray-600">{item.note}</span>
                                    </span>
                                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── 2. The headline figures ─────────────────────────────── */}
            <section aria-labelledby="kpi-heading" className="mb-6">
                <h2 id="kpi-heading" className="sr-only">Summary</h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    <MetricCard
                        label="Registered Farmers" value={num(metrics?.total_farmers)}
                        hint={metrics ? `${num(metrics.pending_verification)} awaiting verification` : 'Verified by the office'}
                        icon={Users} tone="deep" href="/admin/farmers" loading={metrics === undefined}
                    />
                    <MetricCard
                        label="Farm Parcels" value={num(metrics?.total_parcels)}
                        hint={metrics ? `${num(metrics.hectares_mapped)} hectares mapped` : 'Mapped land'}
                        icon={MapPin} tone="forest" href="/admin/parcels" loading={metrics === undefined}
                    />
                    <MetricCard
                        label="Livestock Heads" value={num(metrics?.total_livestock)}
                        hint={metrics ? `${num(metrics.livestock_types)} ${metrics.livestock_types === 1 ? 'type' : 'types'} recorded` : 'Across all farmers'}
                        icon={Beef} tone="mid" href="/admin/farm-inventory" loading={metrics === undefined}
                    />
                    <MetricCard
                        label="Assistance" value={metrics ? peso(metrics.assistance_total) : '—'}
                        hint={metrics ? `${num(metrics.farmers_assisted)} farmers assisted` : 'Distributed'}
                        icon={HandHeart} tone="light" href="/admin/assistance" loading={metrics === undefined}
                    />
                    <MetricCard
                        label="Needs Attention" value={num(todo.reduce((n, i) => n + i.count, 0))}
                        hint={todo.length === 0 ? 'Nothing outstanding' : `Across ${todo.length} ${todo.length === 1 ? 'area' : 'areas'}`}
                        icon={AlertTriangle} tone="sage" loading={attention === undefined}
                    />
                    <MetricCard
                        label="Messages Sent"
                        // null means the messages table has not been migrated
                        // yet — saying so beats printing a confident zero.
                        value={metrics?.unread_messages === null ? '—' : num(metrics?.unread_messages)}
                        hint={metrics?.unread_messages === null ? 'Not available yet' : 'To farmers, all time'}
                        icon={Mail} tone="forest" href="/admin/farmer-email" loading={metrics === undefined}
                    />
                </div>
            </section>

            {/* ── 3. Farmers and livestock ────────────────────────────── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">

                <Card title="Farmer Overview" action={
                    <Link href="/admin/farmers" className="text-xs font-semibold text-[#006400] hover:underline">View all</Link>
                }>
                    {farmers === undefined ? <Loading rows={4} /> : (
                        <div className="space-y-1">
                            <BarRow name="Verified" value={farmers.total} total={farmers.total} href="/admin/farmers" />
                            <BarRow name="Awaiting verification" value={farmers.pending} total={farmers.total || 1} href="/admin/farmer-verification" />
                            <BarRow name="With mapped parcels" value={farmers.with_parcels} total={farmers.total || 1} href="/admin/parcels" />
                            <BarRow name="With livestock" value={farmers.with_livestock} total={farmers.total || 1} href="/admin/farm-inventory" />
                            <BarRow name="Receiving assistance" value={farmers.assisted} total={farmers.total || 1} href="/admin/assistance" />
                            {farmers.rejected > 0 && (
                                <BarRow name="Rejected registrations" value={farmers.rejected} total={farmers.total || 1} href="/admin/farmer-verification?status=rejected" />
                            )}
                        </div>
                    )}
                </Card>

                <Card title="Livestock Overview" action={
                    <Link href="/admin/farm-inventory" className="text-xs font-semibold text-[#006400] hover:underline">View records</Link>
                }>
                    {livestock === undefined ? <Loading rows={4} /> : livestock.total === 0 ? (
                        <Empty icon={Beef} text="No livestock records yet"
                            action="Add a livestock record" href="/admin/farm-inventory" />
                    ) : (
                        <>
                            <div className="mb-4 flex items-baseline gap-2">
                                <span className="text-3xl font-bold tabular-nums text-gray-900">{num(livestock.total)}</span>
                                <span className="text-sm text-gray-500">
                                    heads across {livestock.categories.length}{' '}
                                    {livestock.categories.length === 1 ? 'category' : 'categories'}
                                </span>
                            </div>
                            <div className="space-y-1">
                                {livestock.categories.map(c => (
                                    <BarRow key={c.name} name={c.name} value={c.heads}
                                        total={livestock.total} href="/admin/farm-inventory" />
                                ))}
                            </div>
                        </>
                    )}
                </Card>
            </div>

            {/* ── 4. Assistance and risk ──────────────────────────────── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">

                <Card title="Assistance Overview" action={
                    <Link href="/admin/assistance" className="text-xs font-semibold text-[#006400] hover:underline">View programmes</Link>
                }>
                    {assistance === undefined ? <Loading rows={4} /> : assistance.distributions === 0 ? (
                        <Empty icon={HandHeart} text="No assistance distributed yet"
                            action="Open assistance programmes" href="/admin/assistance" />
                    ) : (
                        <>
                            <div className="mb-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-2xl font-bold tabular-nums text-gray-900">{peso(assistance.total_amount)}</p>
                                    <p className="text-xs text-gray-500">Total distributed</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold tabular-nums text-gray-900">{num(assistance.farmers_assisted)}</p>
                                    <p className="text-xs text-gray-500">Farmers assisted</p>
                                </div>
                            </div>

                            <div className="space-y-1 border-t border-green-50 pt-3">
                                {assistance.by_type.map(t => (
                                    <BarRow key={t.name} name={t.name} value={Number(t.value)}
                                        total={assistance.total_amount || 1} />
                                ))}
                            </div>
                        </>
                    )}
                </Card>

                <Card title="Climate & Farm Risk" action={
                    <Link href="/admin/farmers" className="text-xs font-semibold text-[#006400] hover:underline">View farmers</Link>
                }>
                    {risk === undefined ? <Loading rows={3} /> : riskTotal === 0 ? (
                        <Empty icon={ShieldAlert} text="No risk assessments completed yet" />
                    ) : (
                        <>
                            {/* Colour AND a word: a red dot alone is unreadable
                                to anyone who cannot separate red from green. */}
                            <div className="space-y-2">
                                {[
                                    { key: 'high',     label: 'High risk',     dot: 'bg-red-500',   text: 'text-red-700' },
                                    { key: 'moderate', label: 'Moderate risk', dot: 'bg-amber-500', text: 'text-amber-700' },
                                    { key: 'low',      label: 'Low risk',      dot: 'bg-[#006400]', text: 'text-[#006400]' },
                                ].map(band => (
                                    <div key={band.key} className="flex items-center gap-3 rounded-xl bg-green-50/50 px-4 py-3">
                                        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${band.dot}`} />
                                        <span className="flex-1 text-sm text-gray-700">{band.label}</span>
                                        <span className={`text-xl font-bold tabular-nums ${band.text}`}>{num(risk[band.key])}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-3 text-xs text-gray-500">
                                From the most recent assessment of each of {num(risk.assessed)}{' '}
                                {risk.assessed === 1 ? 'farmer' : 'farmers'}.
                            </p>
                        </>
                    )}
                </Card>
            </div>

            {/* ── 5. Production ───────────────────────────────────────── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">

                <Card title="New Farmers by Month">
                    {charts === undefined ? <Loading rows={5} />
                        : farmersData.length === 0 ? (
                            <Empty icon={Users} text="No farmers registered yet this year" />
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={farmersData}>
                                    <defs>
                                        <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={GREEN.forest} />
                                            <stop offset="100%" stopColor={GREEN.pale} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F0E8" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} stroke="#6B7280" />
                                    <YAxis axisLine={false} tickLine={false} tickMargin={10} fontSize={12} stroke="#6B7280" allowDecimals={false} />
                                    <Tooltip content={<GreenTooltip />} cursor={{ fill: '#F1F8F1' }} />
                                    <Bar dataKey="count" fill="url(#barGreen)" radius={[8, 8, 0, 0]} maxBarSize={56} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                </Card>

                <Card title="Crop Production">
                    {charts === undefined ? <Loading rows={5} />
                        : cropData.length === 0 ? (
                            <Empty icon={Sprout} text="No harvests recorded yet"
                                action="Open seasonal tracking" href="/admin/seasonal" />
                        ) : cropData.length === 1 ? (
                            /*
                             * One year is not a trend.
                             *
                             * A line chart through a single point draws a shape
                             * that says nothing — worse, it implies a direction.
                             * With one year on file, the figure and the crops
                             * behind it are the honest presentation.
                             */
                            <div>
                                <div className="mb-4">
                                    <p className="text-3xl font-bold tabular-nums text-gray-900">
                                        {num(cropData[0].yield)} <span className="text-base font-normal text-gray-500">kg</span>
                                    </p>
                                    <p className="text-xs text-gray-500">Recorded in {cropData[0].name} — the only year with harvests on file</p>
                                </div>
                                {byCrop.length > 0 && (
                                    <div className="space-y-1 border-t border-green-50 pt-3">
                                        {byCrop.map(c => (
                                            <BarRow key={c.name} name={c.name} value={c.total}
                                                total={byCrop[0].total} suffix="kg" href="/admin/seasonal" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={cropData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F0E8" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} stroke="#6B7280" />
                                    <YAxis axisLine={false} tickLine={false} tickMargin={10} fontSize={12} stroke="#6B7280" />
                                    <Tooltip content={<GreenTooltip format={v => `${num(v)} kg`} />} />
                                    <Line type="monotone" dataKey="yield" stroke={GREEN.deep} strokeWidth={3}
                                        dot={{ fill: GREEN.deep, r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                </Card>
            </div>

            {/* ── 6. Activity, aid split, and the glance panel ────────── */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

                <Card title="Recent Activity" className="xl:col-span-1">
                    {activity === undefined ? <Loading rows={5} /> : activity.length === 0 ? (
                        <Empty icon={Activity} text="Nothing recorded yet" />
                    ) : (
                        <ol className="space-y-3">
                            {activity.slice(0, 8).map(entry => (
                                <li key={entry.id} className="flex gap-3">
                                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#4CAF50]" />
                                    <div className="min-w-0">
                                        <p className="text-sm text-gray-800">
                                            <span className="font-semibold capitalize">{entry.action}</span>
                                            {' '}on {entry.table?.replace(/_/g, ' ')}
                                            {entry.what && <> — <span className="text-gray-600">{entry.what}</span></>}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {entry.who} · {formatDate(entry.when)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>

                <Card title="Aid by Programme">
                    {charts === undefined ? <Loading rows={5} /> : aidData.length === 0 ? (
                        <Empty icon={HandHeart} text="No aid distributed yet" />
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={aidData} cx="50%" cy="45%" innerRadius={45} outerRadius={80}
                                    paddingAngle={3} dataKey="value">
                                    {aidData.map((_, i) => <Cell key={i} fill={PIE_GREENS[i % PIE_GREENS.length]} />)}
                                </Pie>
                                <Tooltip content={<GreenTooltip format={peso} />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle"
                                    formatter={v => <span className="text-xs text-gray-600">{v}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card title="At a Glance" action={
                    <Link href="/admin/gis/map" className="inline-flex items-center gap-1 text-xs font-semibold text-[#006400] hover:underline">
                        <Globe className="h-3.5 w-3.5" /> Full map
                    </Link>
                }>
                    {quickStats === undefined ? <Loading rows={4} /> : (
                        <div className="space-y-3">
                            <Stat icon={MapPin} label="Land mapped"
                                value={`${num(quickStats.hectares_mapped)} ha`}
                                hint="Total area across all parcels" />
                            <Stat icon={Sprout} label="Crops in the ground" value={num(quickStats.active_seasons)}
                                hint="Planted, not yet harvested" />
                            <Stat icon={ClipboardCheck} label="Unclaimed aid" value={num(quickStats.pending_claims)}
                                hint="Distributions still pending" />
                            <Stat icon={Ruler} label="Average yield"
                                value={quickStats.avg_yield_per_ha ? `${num(quickStats.avg_yield_per_ha)} kg` : '—'}
                                hint="Per hectare, from recorded harvests" />
                        </div>
                    )}
                </Card>
            </div>

            {/* Recent hand-outs, full width — it reads as a list, not a tile. */}
            <div className="mt-6">
                <Card title="Recent Assistance" action={
                    <Link href="/admin/assistance" className="text-xs font-semibold text-[#006400] hover:underline">View all</Link>
                }>
                    {assistance === undefined ? <Loading rows={3} /> : assistance.recent.length === 0 ? (
                        <Empty icon={HandHeart} text="No distributions recorded yet" />
                    ) : (
                        <div className="space-y-1">
                            {assistance.recent.map(d => (
                                <div key={d.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-green-50">
                                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-green-100">
                                        <Activity className="h-4 w-4 text-[#006400]" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-gray-900">{d.farmer}</p>
                                        <p className="truncate text-xs text-gray-500">{d.program}</p>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <p className="text-sm font-bold tabular-nums text-gray-900">{peso(d.amount)}</p>
                                        <p className="text-xs text-gray-500">{formatDate(d.date, 'date-only')}</p>
                                    </div>
                                    <span className={`hidden flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-block ${
                                        d.status === 'claimed' ? 'bg-green-100 text-green-800'
                                            : d.status === 'pending' ? 'bg-amber-100 text-amber-800'
                                                : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {d.status ?? 'unknown'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </AdminLayout>
    );
}

function Stat({ icon: Icon, label, value, hint }) {
    return (
        <div className="flex items-center gap-3 rounded-xl bg-green-50/70 p-3.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white">
                <Icon className="h-4 w-4 text-[#006400]" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700">{label}</p>
                {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
            </div>
            <span className="whitespace-nowrap text-lg font-bold tabular-nums text-[#006400]">{value}</span>
        </div>
    );
}
