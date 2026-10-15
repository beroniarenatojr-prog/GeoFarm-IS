import FarmerLayout from '@/Layouts/FarmerLayout';
import {
    ShieldCheck, ShieldAlert, ShieldX, User, Phone, Mail, MapPin, Users, Lock,
} from 'lucide-react';

const date = (iso) => (iso
    ? new Date(iso).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null);

const VERIFICATION = {
    verified: {
        label: 'Verified',
        note: 'Your records have been confirmed by the Agriculture Office.',
        icon: ShieldCheck,
        chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    },
    pending: {
        label: 'Awaiting verification',
        note: 'The office is still checking your documents. You can be considered for assistance once that is done.',
        icon: ShieldAlert,
        chip: 'bg-amber-50 text-amber-800 ring-amber-200',
    },
    rejected: {
        label: 'Not verified',
        note: 'Visit the Agriculture Office to find out what is needed.',
        icon: ShieldX,
        chip: 'bg-red-50 text-red-700 ring-red-200',
    },
};

/**
 * Profile — the farmer's own record as the office holds it.
 *
 * Read-only, deliberately. A farmer who could edit their own RSBSA number or
 * flip their verification status would defeat the verification step that the
 * whole assistance workflow depends on, so this screen shows what is on file
 * and says where to go to have it changed.
 */
export default function Profile({ farmer, account, household = [] }) {
    const state = VERIFICATION[farmer.verification_status] ?? VERIFICATION.pending;
    const StateIcon = state.icon;

    const where = [farmer.street_sitio, farmer.barangay, farmer.municipality, farmer.province]
        .filter(Boolean)
        .join(', ');

    return (
        <FarmerLayout title="Profile" subtitle={farmer.name}>
            {/* ------------------------------------------- identity --- */}
            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-50">
                        <User className="h-6 w-6 text-[#006400]" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-bold text-gray-900">{farmer.name}</h2>

                        {/* The RSBSA number is the thing a farmer is most often
                            asked for at a counter, so it is set in a monospace
                            face and given room to be read aloud. */}
                        {farmer.rsbsa_no ? (
                            <p className="mt-0.5 font-mono text-sm text-gray-700">{farmer.rsbsa_no}</p>
                        ) : (
                            <p className="mt-0.5 text-xs italic text-gray-400">
                                No RSBSA number issued yet
                            </p>
                        )}

                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${state.chip}`}>
                            <StateIcon className="h-3 w-3" aria-hidden="true" />
                            {state.label}
                        </span>
                    </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-gray-600">{state.note}</p>

                {farmer.reference_code && (
                    <p className="mt-2 text-[11px] text-gray-500">
                        Reference code <span className="font-mono text-gray-700">{farmer.reference_code}</span>
                        {farmer.submitted_online_at && <> · submitted {date(farmer.submitted_online_at)}</>}
                    </p>
                )}
            </section>

            {/* ------------------------------------------- details --- */}
            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">Your details</h2>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <Detail term="Date of birth" value={date(farmer.birthdate)} />
                    <Detail term="Sex" value={farmer.sex} />
                    <Detail term="Civil status" value={farmer.civil_status} />
                    <Detail term="Category" value={farmer.livelihood_type} />
                </dl>

                {where && (
                    <p className="mt-3 flex items-start gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-700">
                        <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                        {where}
                    </p>
                )}

                <div className="mt-2 flex flex-col gap-1.5 text-xs text-gray-700">
                    {farmer.mobile_no && (
                        <p className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                            {farmer.mobile_no}
                        </p>
                    )}
                    {farmer.email && (
                        <p className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                            {farmer.email}
                        </p>
                    )}
                </div>

                {(farmer.is_4ps || farmer.is_indigenous || farmer.pwd) && (
                    <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                        {farmer.is_4ps && <Flag>4Ps beneficiary</Flag>}
                        {farmer.is_indigenous && <Flag>Indigenous person</Flag>}
                        {farmer.pwd && <Flag>Person with disability</Flag>}
                    </ul>
                )}
            </section>

            {/* ----------------------------------------- household --- */}
            {household.length > 0 && (
                <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
                    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        <Users className="h-4 w-4 text-[#006400]" aria-hidden="true" />
                        Household
                    </h2>

                    <ul className="divide-y divide-gray-100">
                        {household.map((person, i) => (
                            <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-xs first:pt-0 last:pb-0">
                                <span className="min-w-0">
                                    <span className="block truncate font-medium text-gray-900">{person.name}</span>
                                    {person.location && (
                                        <span className="block truncate text-[11px] text-gray-500">
                                            {person.location}
                                        </span>
                                    )}
                                </span>

                                {person.occupation && (
                                    <span className="shrink-0 text-gray-600">{person.occupation}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ------------------------------------------- account --- */}
            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-900">Sign-in account</h2>

                <p className="text-xs text-gray-700">{account.email}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">Signed in as {account.name}</p>
            </section>

            <p className="flex items-start gap-2 rounded-xl bg-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                These details are held by the Municipal Agriculture Office and cannot be edited
                from this app. That is what makes them worth something when you apply for
                assistance. Visit the office to have anything corrected.
            </p>
        </FarmerLayout>
    );
}

/** Blank fields are left out entirely rather than shown as an empty row. */
function Detail({ term, value }) {
    if (!value) return null;

    return (
        <div>
            <dt className="font-medium text-gray-500">{term}</dt>
            <dd className="mt-0.5 text-gray-900">{value}</dd>
        </div>
    );
}

function Flag({ children }) {
    return (
        <li className="rounded bg-green-50 px-2 py-1 text-[11px] font-medium text-[#006400]">
            {children}
        </li>
    );
}
