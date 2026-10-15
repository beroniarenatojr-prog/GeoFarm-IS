import FarmerLayout from '@/Layouts/FarmerLayout';
import {
    HandCoins, PackageCheck, Clock, XCircle, CheckCircle2, Info, CalendarDays,
} from 'lucide-react';

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

const date = (iso) => (iso
    ? new Date(iso).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null);

/*
 * The farmer's words for the three states, not the database's.
 *
 * "claimed" and "forfeited" are the office's vocabulary for stock movements;
 * what a farmer needs to know is whether they have it, are waiting for it, or
 * missed it.
 */
const STATUS = {
    claimed: {
        label: 'Received',
        icon: CheckCircle2,
        chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    },
    pending: {
        label: 'Ready for collection',
        icon: Clock,
        chip: 'bg-amber-50 text-amber-800 ring-amber-200',
    },
    forfeited: {
        label: 'Not collected',
        icon: XCircle,
        chip: 'bg-gray-100 text-gray-600 ring-gray-200',
    },
};

/**
 * Assistance — what this farmer has received, and what the office is running.
 *
 * The two lists are kept apart deliberately. The first is fact: records of
 * goods and cash that were actually issued to them. The second is information
 * only — a programme appearing there is not a promise, and nothing on this
 * screen can put anyone on a programme. Eligibility is decided at the office by
 * staff, which is why there is no apply button here to imply otherwise.
 */
export default function Assistance({ distributions = [], summary, programs = [] }) {
    return (
        <FarmerLayout title="Assistance" subtitle="Your records and current programmes">
            <div className="mb-4 grid grid-cols-3 gap-2">
                <Tile icon={PackageCheck} label="Received" value={summary.received} tone="text-emerald-600" />
                <Tile icon={Clock} label="Ready" value={summary.awaiting} tone="text-amber-600" />
                <Tile icon={HandCoins} label="Cash received" value={peso(summary.cash_total)} small />
            </div>

            {summary.awaiting > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                        You have <b>{summary.awaiting}</b>{' '}
                        {summary.awaiting === 1 ? 'allocation' : 'allocations'} waiting at the
                        Agriculture Office. Bring a valid ID when you collect.
                    </p>
                </div>
            )}

            {/* ------------------------------------------ own history --- */}
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Your assistance history</h2>

            {distributions.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
                    <HandCoins className="mx-auto h-9 w-9 text-green-200" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-gray-900">
                        Nothing recorded yet
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
                        When the office issues you seed, fertiliser, equipment or cash, it will be
                        listed here with the date and the programme it came from.
                    </p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {distributions.map((row) => {
                        const state = STATUS[row.status] ?? STATUS.pending;
                        const StateIcon = state.icon;

                        return (
                            <li key={row.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {row.program_name}
                                        </p>
                                        {row.type && (
                                            <p className="text-xs text-gray-500">{row.type}</p>
                                        )}
                                    </div>

                                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${state.chip}`}>
                                        <StateIcon className="h-3 w-3" aria-hidden="true" />
                                        {state.label}
                                    </span>
                                </div>

                                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                                    {row.date && (
                                        <div className="flex items-center gap-1 text-gray-600">
                                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                            <dt className="sr-only">Date</dt>
                                            <dd>{date(row.date)}</dd>
                                        </div>
                                    )}

                                    {Number(row.amount_given) > 0 && (
                                        <div>
                                            <dt className="inline text-gray-500">Cash: </dt>
                                            <dd className="inline font-semibold text-gray-900">
                                                {peso(row.amount_given)}
                                            </dd>
                                        </div>
                                    )}

                                    {row.reference_no && (
                                        <div>
                                            <dt className="inline text-gray-500">Ref: </dt>
                                            <dd className="inline font-mono text-gray-900">{row.reference_no}</dd>
                                        </div>
                                    )}
                                </dl>

                                {row.items.length > 0 && (
                                    <ul className="mt-2 flex flex-wrap gap-1">
                                        {row.items.map((item, i) => (
                                            <li
                                                key={`${row.id}-${i}`}
                                                className="rounded bg-green-50 px-2 py-0.5 text-[11px] text-[#006400]"
                                            >
                                                {item.quantity} {item.unit || ''} {item.item_name || 'item'}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* -------------------------------------- open programmes --- */}
            <h2 className="mb-2 mt-6 text-sm font-semibold text-gray-900">
                Programmes running now
            </h2>

            {programs.length === 0 ? (
                <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    No programmes are open for your barangay at the moment.
                </p>
            ) : (
                <ul className="space-y-2">
                    {programs.map((program) => (
                        <li key={program.id} className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900">
                                        {program.program_name}
                                    </p>
                                    {program.type && (
                                        <p className="text-xs text-gray-500">{program.type}</p>
                                    )}
                                </div>

                                {program.already_on && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                        You are on this
                                    </span>
                                )}
                            </div>

                            <p className="mt-2 text-xs text-gray-600">
                                {date(program.start_date)} – {date(program.end_date)}
                                {Number(program.standard_cash_amount) > 0 && (
                                    <> · {peso(program.standard_cash_amount)} per beneficiary</>
                                )}
                            </p>

                            {program.barangays.length > 0 && (
                                <p className="mt-1 text-[11px] text-gray-500">
                                    Covers {program.barangays.join(', ')}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {/*
                Said explicitly, because a list of programmes on your own screen
                reads like a list of things you are getting.
            */}
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Programmes listed here are open in your area. Being listed is not the same as
                being enrolled — the Agriculture Office decides who each programme covers.
                Ask at the office to be considered.
            </p>
        </FarmerLayout>
    );
}

function Tile({ icon: Icon, label, value, tone = 'text-gray-900', small = false }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
            <Icon className="h-4 w-4 text-[#006400]" aria-hidden="true" />
            <p className={`mt-1.5 font-bold leading-tight ${small ? 'text-xs' : 'text-base'} ${tone}`}>
                {value}
            </p>
            <p className="text-[11px] text-gray-500">{label}</p>
        </div>
    );
}
