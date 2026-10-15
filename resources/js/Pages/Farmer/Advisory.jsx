import { Link } from '@inertiajs/react';
import FarmerLayout from '@/Layouts/FarmerLayout';
import {
    Lightbulb, Mail, ClipboardList, AlertTriangle, ArrowRight, CalendarDays,
} from 'lucide-react';

const date = (iso) => (iso
    ? new Date(iso).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null);

const PRIORITY = {
    high:   { label: 'Act soon', chip: 'bg-red-50 text-red-700 ring-red-200' },
    medium: { label: 'Worth doing', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
    low:    { label: 'When you can', chip: 'bg-gray-100 text-gray-600 ring-gray-200' },
};

/**
 * Advisory — advice raised for this farmer, and letters from the office.
 *
 * Every item is a real record: the advisories come from the same
 * recommendation engine the office reads, scoped to this farmer, and the
 * messages are what staff actually wrote.
 *
 * There is no announcements board, because the system has no table for one. An
 * empty section captioned "no announcements" would be a reasonable thing to
 * build; a section filled with invented notices would not, so this screen shows
 * what exists and nothing else.
 */
export default function Advisory({ advisories = [], messages = [], assessment }) {
    const nothingAtAll = advisories.length === 0 && messages.length === 0;

    return (
        <FarmerLayout title="Advisory" subtitle="Advice and messages from the office">
            {/*
                The questionnaire is what produces most advice, so a farmer with
                none is usually a farmer who has not been assessed — and that is
                actionable, unlike an empty list.
            */}
            {!assessment && (
                <div className="mb-4 rounded-xl border border-[#006400]/25 bg-green-50 p-4">
                    <div className="flex items-start gap-3">
                        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-[#006400]" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                                No risk assessment on file
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-gray-600">
                                Most advice here comes from the climate and financial risk
                                questionnaire. Answering it lets the office work out what your farm
                                is exposed to.
                            </p>
                            <Link
                                href="/farmer/risk-assessment"
                                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#006400] px-3 py-2 text-xs font-medium text-white hover:bg-[#004d00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006400]"
                            >
                                Answer the questionnaire
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {assessment && (
                <p className="mb-4 flex items-center gap-1.5 text-xs text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    Last assessed {date(assessment.assessed_on)} ·{' '}
                    <Link href="/farmer/risk-assessment" className="font-medium text-[#006400] hover:underline">
                        update it
                    </Link>
                </p>
            )}

            {/* ---------------------------------------- advisories --- */}
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Advice for your farm</h2>

            {advisories.length === 0 ? (
                <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    No advice has been raised for your farm yet.
                </p>
            ) : (
                <ul className="space-y-2">
                    {advisories.map((item) => {
                        const tone = PRIORITY[item.priority] ?? PRIORITY.medium;

                        return (
                            <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-2.5">
                                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#006400]" aria-hidden="true" />
                                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                                    </div>

                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${tone.chip}`}>
                                        {tone.label}
                                    </span>
                                </div>

                                {item.reason && (
                                    <p className="mt-2 pl-6 text-xs leading-relaxed text-gray-600">
                                        {item.reason}
                                    </p>
                                )}

                                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                                    {item.about && <span>About: {item.about}</span>}
                                    {item.commodity && <span>{item.commodity}</span>}
                                    {item.raised_on && <span>Raised {date(item.raised_on)}</span>}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* ------------------------------------------ messages --- */}
            <h2 className="mb-2 mt-6 text-sm font-semibold text-gray-900">
                Messages from the office
            </h2>

            {messages.length === 0 ? (
                <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    No messages yet.
                </p>
            ) : (
                <ul className="space-y-2">
                    {messages.map((message) => (
                        <li key={message.id} className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex items-start gap-2.5">
                                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#006400]" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900">
                                        {message.subject || 'Message'}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-gray-500">
                                        {message.from} · {date(message.sent_on)}
                                    </p>
                                    {/* whitespace-pre-line: staff write these as
                                        plain text with real line breaks. */}
                                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-700">
                                        {message.body}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {nothingAtAll && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    This page fills in as the office assesses your farm and writes to you. There
                    is nothing to show yet — that is not an error.
                </p>
            )}
        </FarmerLayout>
    );
}
