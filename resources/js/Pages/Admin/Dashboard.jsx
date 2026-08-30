import AdminLayout from '@/Layouts/AdminLayout';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Link } from '@inertiajs/react';
import Card from '@/Components/ui/Card';
import { Users, MapPin, Beef, HandHeart, Activity, ClipboardCheck, Sprout, Ruler } from 'lucide-react';
import { formatDate } from '@/utils/dateFormatter';

/*
 * One family of greens, deep to pale. Using tints of a single hue instead of
 * unrelated blues/oranges keeps the whole screen reading as Tumauini's colour
 * while still letting each figure be told apart.
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

function MetricCard({ label, value, hint, icon: Icon, tone = 'deep', href }) {
    const body = (
        <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm hover:shadow-lg hover:border-green-300 transition-all duration-300 h-full">
            <div className="flex items-start gap-4">
                <span
                    className="flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: GREEN[tone] }}
                >
                    <Icon className="h-6 w-6 text-white" />
                </span>
                <div className="min-w-0">
                    <p className="text-sm text-gray-600">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 leading-tight">{value ?? 0}</p>
                    {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
                </div>
            </div>
        </div>
    );

    return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/** Recharts' default tooltip is grey and boxy; this one matches the palette. */
const GreenTooltip = ({ active, payload, label, format }) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="bg-white border border-green-200 rounded-lg shadow-lg px-3 py-2">
            <p className="text-xs font-semibold text-gray-500 mb-0.5">{label ?? payload[0].name}</p>
            <p className="text-sm font-bold text-[#006400]">
                {format ? format(payload[0].value) : Number(payload[0].value).toLocaleString('en-PH')}
            </p>
        </div>
    );
};

export default function Dashboard({ metrics, charts, quickStats }) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const farmersData = (charts?.farmers_per_month ?? []).map(r => ({ month: months[r.month - 1], count: r.count }));
    const cropData = (charts?.crop_production ?? []).map(r => ({ name: String(r.cropping_year), yield: Number(r.total_yield) }));
    const aidData = (charts?.aid_by_program ?? []).map(r => ({ name: r.name ?? 'Unnamed', value: Number(r.value) }));

    const pending = metrics?.pending_verification ?? 0;

    return (
        <AdminLayout title="Dashboard">
            {/* Pending registrations are the one thing needing action, so they
                lead rather than sitting unused in the payload. */}
            {pending > 0 && (
                <div className="mb-6 flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#006400]">
                        <ClipboardCheck className="h-5 w-5 text-white" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">
                            {pending} farmer {pending === 1 ? 'registration is' : 'registrations are'} waiting for review
                        </p>
                        <p className="text-sm text-gray-600">Check their documents to activate the accounts.</p>
                    </div>
                    <Link
                        href="/admin/farmer-verification"
                        className="flex-shrink-0 rounded-xl bg-[#006400] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#228B22]"
                    >
                        Review
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                <MetricCard
                    label="Registered Farmers" value={metrics?.total_farmers}
                    hint="Verified by the office" icon={Users} tone="deep" href="/admin/farmers"
                />
                <MetricCard
                    label="Farm Parcels" value={metrics?.total_parcels}
                    hint={quickStats ? `${quickStats.hectares_mapped} hectares mapped` : 'Mapped land'}
                    icon={MapPin} tone="forest" href="/admin/parcels"
                />
                <MetricCard
                    label="Livestock Heads" value={metrics?.total_livestock}
                    hint="Across all farmers" icon={Beef} tone="mid" href="/admin/farm-inventory"
                />
                <MetricCard
                    label="Recent Aid" value={metrics?.recent_distributions?.length}
                    hint="Latest distributions" icon={HandHeart} tone="light" href="/admin/assistance"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <Card title="New Farmers by Month">
                    {farmersData.length === 0 ? (
                        <Empty icon={Users} text="No farmers registered yet this year" />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
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

                <Card title="Crop Yield by Year">
                    {cropData.length === 0 ? (
                        <Empty icon={Sprout} text="No harvests recorded yet" />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={cropData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F0E8" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} stroke="#6B7280" />
                                <YAxis axisLine={false} tickLine={false} tickMargin={10} fontSize={12} stroke="#6B7280" />
                                <Tooltip content={<GreenTooltip format={v => `${Number(v).toLocaleString('en-PH')} kg`} />} />
                                <Line
                                    type="monotone" dataKey="yield" stroke={GREEN.deep} strokeWidth={3}
                                    dot={{ fill: GREEN.deep, r: 4 }} activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Recent Assistance">
                    <div className="space-y-2">
                        {(metrics?.recent_distributions ?? []).slice(0, 5).map(d => (
                            <div key={d.id} className="flex gap-3 p-3 rounded-xl hover:bg-green-50 transition-colors">
                                <span className="h-10 w-10 flex-shrink-0 rounded-xl bg-green-100 flex items-center justify-center">
                                    <Activity className="h-5 w-5 text-[#006400]" />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm truncate">
                                        {[d.farmer?.first_name, d.farmer?.last_name].filter(Boolean).join(' ') || 'Unknown farmer'}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{d.program?.program_name ?? 'Unnamed program'}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs text-gray-500">{formatDate(d.distribution_date, 'date-only')}</p>
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                        d.status === 'claimed'
                                            ? 'bg-green-100 text-green-800'
                                            : d.status === 'pending'
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {d.status ?? 'unknown'}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {(metrics?.recent_distributions ?? []).length === 0 && (
                            <Empty icon={HandHeart} text="No distributions recorded yet" />
                        )}
                    </div>
                </Card>

                <Card title="Aid by Program">
                    {aidData.length === 0 ? (
                        <Empty icon={HandHeart} text="No aid distributed yet" />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={aidData} cx="50%" cy="45%"
                                    innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value"
                                >
                                    {aidData.map((_, i) => (
                                        <Cell key={i} fill={PIE_GREENS[i % PIE_GREENS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<GreenTooltip format={peso} />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle"
                                    formatter={v => <span className="text-xs text-gray-600">{v}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card title="At a Glance">
                    <div className="space-y-3">
                        <Stat icon={Sprout} label="Crops in the ground" value={quickStats?.active_seasons ?? 0}
                            hint="Planted, not yet harvested" />
                        <Stat icon={ClipboardCheck} label="Unclaimed aid" value={quickStats?.pending_claims ?? 0}
                            hint="Distributions still pending" />
                        <Stat icon={Ruler} label="Average yield" tone="sage"
                            value={quickStats?.avg_yield_per_ha ? `${quickStats.avg_yield_per_ha} kg` : '—'}
                            hint="Per hectare, from recorded harvests" />
                    </div>
                </Card>
            </div>
        </AdminLayout>
    );
}

function Stat({ icon: Icon, label, value, hint }) {
    return (
        <div className="flex items-center gap-3 rounded-xl bg-green-50/70 p-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white">
                <Icon className="h-4 w-4 text-[#006400]" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700">{label}</p>
                {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
            </div>
            <span className="text-xl font-bold text-[#006400] whitespace-nowrap">{value}</span>
        </div>
    );
}

function Empty({ icon: Icon, text }) {
    return (
        <div className="py-14 text-center">
            <Icon className="mx-auto mb-3 h-10 w-10 text-green-200" />
            <p className="text-sm text-gray-500">{text}</p>
        </div>
    );
}
