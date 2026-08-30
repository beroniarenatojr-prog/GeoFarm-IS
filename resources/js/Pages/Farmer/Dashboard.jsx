import { router } from '@inertiajs/react';
import {
    Leaf, MapPin, LogOut, FileText, Sprout, ShieldCheck, ShieldAlert, ShieldX,
    Beef, Bird, Fish, TreePine, PiggyBank, Mail, Phone, User, Calendar,
    BadgeCheck, Ruler, Banknote,
} from 'lucide-react';

const peso = (value) =>
    `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VERIFICATION = {
    verified: {
        label: 'Verified',
        note: 'Confirmed by the Agriculture Office',
        icon: ShieldCheck,
        ring: 'ring-emerald-300/60',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        tile: 'from-emerald-500 to-green-600',
        glow: 'bg-emerald-400/20',
    },
    pending: {
        label: 'Pending',
        note: 'Awaiting document check',
        icon: ShieldAlert,
        ring: 'ring-amber-300/60',
        chip: 'bg-amber-50 text-amber-700 border-amber-200',
        tile: 'from-amber-500 to-lime-500',
        glow: 'bg-amber-400/20',
    },
    rejected: {
        label: 'Rejected',
        note: 'See the reason below',
        icon: ShieldX,
        ring: 'ring-red-300/60',
        chip: 'bg-red-50 text-red-700 border-red-200',
        tile: 'from-red-500 to-rose-600',
        glow: 'bg-red-400/20',
    },
};

const FALLBACK_STATUS = {
    label: 'Unknown',
    note: 'Status unavailable',
    icon: ShieldAlert,
    ring: 'ring-gray-300/60',
    chip: 'bg-gray-50 text-gray-700 border-gray-200',
    tile: 'from-gray-400 to-gray-500',
    glow: 'bg-gray-400/20',
};

/* ------------------------------------------------------------------ pieces */

function StatCard({ icon: Icon, tile, glow, value, label, detail }) {
    return (
        <div className="group relative bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            {/* soft colour wash that intensifies on hover */}
            <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl ${glow} opacity-60 group-hover:opacity-100 transition-opacity`} />

            <div className="relative">
                <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${tile} shadow-lg mb-5`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>

                <p className="text-3xl font-bold text-gray-900 tracking-tight leading-none mb-2">{value}</p>
                <p className="text-sm font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
            </div>
        </div>
    );
}

function SectionHeading({ icon: Icon, title, aside }) {
    return (
        <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-[#006400]/10">
                    <Icon className="h-5 w-5 text-[#006400]" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
            </div>
            {aside && <span className="text-sm font-medium text-gray-500">{aside}</span>}
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-3 py-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gray-100 flex-shrink-0 mt-0.5">
                <Icon className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="font-semibold text-gray-900 break-words">{value}</p>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------- page */

export default function FarmerDashboard({ auth, farmer, stats }) {
    const handleLogout = () => {
        router.post('/logout');
    };

    const status = VERIFICATION[farmer.verification_status] ?? FALLBACK_STATUS;
    const StatusIcon = status.icon;

    const initials = [farmer.first_name, farmer.last_name]
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase();

    const fullAddress = [farmer.barangay, farmer.city_municipality, farmer.province]
        .filter(Boolean)
        .join(', ');

    // Animals and standing assets live across several RSBSA tables. Only the
    // groups the farmer actually has anything recorded in are rendered.
    const assetGroups = [
        { key: 'large_ruminants', label: 'Large Ruminants', icon: Beef, tint: 'bg-amber-50 text-amber-600 border-amber-100', rows: farmer.large_ruminants, describe: (a) => a.animal_type, qty: (a) => a.total_heads, unit: 'head' },
        { key: 'small_ruminants', label: 'Small Ruminants', icon: Beef, tint: 'bg-lime-50 text-lime-600 border-lime-100', rows: farmer.small_ruminants, describe: (a) => a.animal_type, qty: (a) => a.total_heads, unit: 'head' },
        { key: 'native_pigs', label: 'Native Pigs', icon: PiggyBank, tint: 'bg-green-50 text-green-700 border-green-100', rows: farmer.native_pigs, describe: () => 'Native pig', qty: (a) => a.total_heads, unit: 'head' },
        { key: 'swine_hybrid', label: 'Hybrid Swine', icon: PiggyBank, tint: 'bg-teal-50 text-teal-700 border-teal-100', rows: farmer.swine_hybrid, describe: (a) => a.variety, qty: (a) => a.total_heads, unit: 'head' },
        { key: 'poultry', label: 'Poultry', icon: Bird, tint: 'bg-emerald-50 text-emerald-600 border-emerald-100', rows: farmer.poultry, describe: (a) => a.bird_type, qty: (a) => a.total_heads, unit: 'bird' },
        { key: 'livestock', label: 'Other Livestock', icon: Sprout, tint: 'bg-emerald-50 text-emerald-600 border-emerald-100', rows: farmer.livestock, describe: (a) => a.livestock_type?.type_name || a.breed, qty: (a) => a.count, unit: 'head' },
        { key: 'tree_crops', label: 'Tree Crops', icon: TreePine, tint: 'bg-green-50 text-green-700 border-green-100', rows: farmer.tree_crops, describe: (a) => a.crop_type, qty: (a) => a.quantity, unit: 'tree' },
        { key: 'fishponds', label: 'Fishponds', icon: Fish, tint: 'bg-emerald-50 text-emerald-600 border-emerald-100', rows: farmer.fishponds, describe: (a) => a.species, qty: (a) => a.area_hectares, unit: 'ha' },
    ].filter((group) => group.rows?.length > 0);

    return (
        <div className="min-h-screen bg-[#FAF8F3]">
            {/* ------------------------------------------------------------ nav */}
            <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-[#006400] to-[#228B22] p-2 rounded-xl shadow-md">
                                <Leaf className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-[#006400] leading-tight">GeoFarm-IS</h1>
                                <p className="text-xs text-gray-500">Farmer Portal</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold text-gray-900 leading-tight">{auth.user.name}</p>
                                <p className="text-xs text-gray-500">{auth.user.email}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-sm font-semibold shadow-sm"
                            >
                                <LogOut className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* --------------------------------------------------------- hero */}
                <div
                    className="relative rounded-3xl overflow-hidden mb-8 shadow-xl"
                    style={{
                        backgroundImage: [
                            'radial-gradient(circle at 12% 20%, rgba(144,238,144,0.22) 0%, transparent 45%)',
                            'radial-gradient(circle at 88% 85%, rgba(255,255,255,0.14) 0%, transparent 50%)',
                            'linear-gradient(135deg, #004d00 0%, #006400 45%, #228B22 100%)',
                        ].join(', '),
                    }}
                >
                    {/* decorative rings */}
                    <svg
                        className="absolute -right-16 -top-20 h-80 w-80 text-white/[0.07] pointer-events-none"
                        viewBox="0 0 200 200" fill="none" aria-hidden="true"
                    >
                        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="100" cy="100" r="66" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="100" cy="100" r="42" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="100" cy="100" r="18" stroke="currentColor" strokeWidth="1.5" />
                    </svg>

                    <div className="relative p-6 sm:p-9">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                            {/* avatar */}
                            <div className={`flex-shrink-0 h-24 w-24 rounded-2xl ring-4 ${status.ring} overflow-hidden bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg`}>
                                {farmer.photo_path ? (
                                    <img
                                        src={`/storage/${farmer.photo_path}`}
                                        alt=""
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="text-3xl font-bold text-white tracking-tight">{initials || '—'}</span>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-white/70 text-sm font-medium mb-1">Welcome back,</p>
                                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4 break-words">
                                    {farmer.full_name || farmer.first_name}
                                </h1>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-medium">
                                        <BadgeCheck className="h-4 w-4" />
                                        RSBSA {farmer.rsbsa_no || 'not yet assigned'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-medium">
                                        <MapPin className="h-4 w-4" />
                                        {farmer.barangay || 'No barangay'}
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${status.chip}`}>
                                        <StatusIcon className="h-4 w-4" />
                                        {status.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* rejected submissions need the reason front and centre */}
                {farmer.verification_status === 'rejected' && farmer.rejection_reason && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-8 flex items-start gap-4">
                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-100 flex-shrink-0">
                            <ShieldX className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-1">Registration rejected</h2>
                            <p className="text-red-900">{farmer.rejection_reason}</p>
                            <p className="text-sm text-red-700 mt-2">
                                Please visit the Agriculture Office with your documents to resolve this.
                            </p>
                        </div>
                    </div>
                )}

                {/* -------------------------------------------------------- stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                    <StatCard
                        icon={MapPin}
                        tile="from-green-500 to-green-600"
                        glow="bg-green-400/20"
                        value={stats.parcels}
                        label="Farm Parcels"
                        detail={`${Number(stats.total_area).toFixed(2)} hectares total`}
                    />
                    <StatCard
                        icon={Sprout}
                        tile="from-emerald-500 to-green-600"
                        glow="bg-emerald-400/20"
                        value={Number(stats.animal_heads).toLocaleString('en-PH')}
                        label="Livestock & Poultry"
                        detail={`${stats.animal_records} ${stats.animal_records === 1 ? 'record' : 'records'} on file`}
                    />
                    <StatCard
                        icon={Banknote}
                        tile="from-emerald-500 to-emerald-600"
                        glow="bg-emerald-400/20"
                        value={peso(stats.assistance_total)}
                        label="Assistance Received"
                        detail={`Across ${stats.assistance} ${stats.assistance === 1 ? 'program' : 'programs'}`}
                    />
                    <StatCard
                        icon={StatusIcon}
                        tile={status.tile}
                        glow={status.glow}
                        value={status.label}
                        label="Account Status"
                        detail={status.note}
                    />
                </div>

                {/* ------------------------------------------------------ profile */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6">
                        <SectionHeading icon={User} title="Personal Information" />
                        <div className="divide-y divide-gray-100">
                            <InfoRow icon={User} label="Full Name" value={farmer.full_name || '—'} />
                            <InfoRow icon={BadgeCheck} label="RSBSA Number" value={farmer.rsbsa_no || 'Not yet assigned'} />
                            <InfoRow
                                icon={Calendar}
                                label="Birthdate"
                                value={farmer.birthdate
                                    ? new Date(farmer.birthdate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                    : 'Not provided'}
                            />
                            <div className="grid grid-cols-2">
                                <InfoRow icon={User} label="Sex" value={farmer.sex || 'N/A'} />
                                <InfoRow icon={User} label="Civil Status" value={farmer.civil_status || 'N/A'} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6">
                        <SectionHeading icon={MapPin} title="Contact & Location" />
                        <div className="divide-y divide-gray-100">
                            <InfoRow icon={Mail} label="Email" value={farmer.email || 'Not provided'} />
                            <InfoRow icon={Phone} label="Mobile Number" value={farmer.mobile_no || 'Not provided'} />
                            <InfoRow icon={MapPin} label="Address" value={fullAddress || 'Not provided'} />
                        </div>
                    </div>
                </div>

                {/* ------------------------------------------------------ parcels */}
                {farmer.parcels?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 mb-8">
                        <SectionHeading
                            icon={Ruler}
                            title="My Farm Parcels"
                            aside={`${Number(stats.total_area).toFixed(2)} ha across ${stats.parcels} ${stats.parcels === 1 ? 'parcel' : 'parcels'}`}
                        />

                        {/* desktop table */}
                        <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-[#006400] to-[#228B22]">
                                        {['Parcel #', 'Barangay', 'Farm Type', 'Commodity', 'Ownership', 'Area (ha)'].map((h, i) => (
                                            <th
                                                key={h}
                                                className={`px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {farmer.parcels.map((parcel) => (
                                        <tr key={parcel.id} className="hover:bg-green-50/50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{parcel.parcel_number || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.barangay || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.farm_type?.type_name || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.commodity || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.ownership_type || '—'}</td>
                                            <td className="px-4 py-3 text-sm font-bold text-[#006400] text-right tabular-nums">
                                                {parcel.total_area_ha != null ? Number(parcel.total_area_ha).toFixed(2) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                                        <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                                        <td className="px-4 py-3 text-sm font-bold text-[#006400] text-right tabular-nums">
                                            {Number(stats.total_area).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* mobile cards */}
                        <div className="md:hidden space-y-3">
                            {farmer.parcels.map((parcel) => (
                                <div key={parcel.id} className="border border-gray-200 rounded-xl p-4">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <p className="font-bold text-gray-900">Parcel {parcel.parcel_number || '—'}</p>
                                            <p className="text-sm text-gray-500">{parcel.barangay || '—'}</p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-lg bg-green-50 text-[#006400] font-bold text-sm tabular-nums whitespace-nowrap">
                                            {parcel.total_area_ha != null ? `${Number(parcel.total_area_ha).toFixed(2)} ha` : '—'}
                                        </span>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <dt className="text-gray-500 text-xs uppercase tracking-wide">Farm Type</dt>
                                            <dd className="text-gray-800 font-medium">{parcel.farm_type?.type_name || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500 text-xs uppercase tracking-wide">Commodity</dt>
                                            <dd className="text-gray-800 font-medium">{parcel.commodity || '—'}</dd>
                                        </div>
                                        <div className="col-span-2">
                                            <dt className="text-gray-500 text-xs uppercase tracking-wide">Ownership</dt>
                                            <dd className="text-gray-800 font-medium">{parcel.ownership_type || '—'}</dd>
                                        </div>
                                    </dl>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ------------------------------------------------------- assets */}
                {assetGroups.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 mb-8">
                        <SectionHeading
                            icon={Sprout}
                            title="My Livestock & Assets"
                            aside={`${Number(stats.animal_heads).toLocaleString('en-PH')} head total`}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {assetGroups.map((group) => {
                                const GroupIcon = group.icon;

                                return (
                                    <div key={group.key} className={`rounded-xl border p-4 ${group.tint}`}>
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <GroupIcon className="h-5 w-5 flex-shrink-0" />
                                            <h3 className="text-sm font-bold uppercase tracking-wide">{group.label}</h3>
                                        </div>
                                        <ul className="space-y-2">
                                            {group.rows.map((row) => (
                                                <li
                                                    key={row.id}
                                                    className="flex items-center justify-between gap-3 text-sm bg-white/70 rounded-lg px-3 py-2"
                                                >
                                                    <span className="text-gray-700 truncate">{group.describe(row) || '—'}</span>
                                                    <span className="font-bold text-gray-900 whitespace-nowrap tabular-nums">
                                                        {Number(group.qty(row) || 0).toLocaleString('en-PH')}
                                                        <span className="font-medium text-gray-500 ml-1">{group.unit}</span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* --------------------------------------------------- assistance */}
                {farmer.distributions?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6">
                        <SectionHeading
                            icon={FileText}
                            title="Assistance Received"
                            aside={`${peso(stats.assistance_total)} total`}
                        />
                        <div className="space-y-3">
                            {farmer.distributions.map((dist) => (
                                <div
                                    key={dist.id}
                                    className="relative flex items-center justify-between gap-4 p-4 pl-5 bg-gray-50/70 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/40 transition-colors overflow-hidden"
                                >
                                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#006400] to-[#228B22]" />

                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">
                                            {dist.program?.program_name || 'Unnamed program'}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                            <span className="text-sm text-gray-500">
                                                {dist.distribution_date
                                                    ? new Date(dist.distribution_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                                    : 'Date not recorded'}
                                            </span>
                                            {dist.status && (
                                                <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-600 capitalize">
                                                    {dist.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-lg font-bold text-[#006400] whitespace-nowrap tabular-nums">
                                        {peso(dist.amount_given)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ------------------------------------------------------- footer */}
                <div className="mt-10 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                    <p className="font-medium text-gray-600">LGU Agriculture Office, Tumauini, Isabela</p>
                    <p className="mt-1 text-xs">&copy; 2026 GeoFarm-IS. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
