import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import ModalShell from '@/Components/ui/ModalShell';
import {
    ClipboardList, AlertTriangle, User, MapPin, Calendar, CheckCircle2,
    Clock, UserCheck, XCircle, ChevronRight, Building2,
} from 'lucide-react';

/**
 * The office's work queue.
 *
 * This page is where a suggestion becomes work somebody is actually doing. Two
 * things it is careful never to blur:
 *
 *   "Recommended because" — why the system put this forward
 *   "Action taken"        — what a person actually did
 *
 * They are rendered in separate blocks with different labels, and the second
 * only ever appears once a staff member has written it. Completing is a form
 * that demands that text; there is no one-click "done", because a tick that
 * records nothing would let the register claim visits that never happened.
 */

const STATUS = {
    pending:     { label: 'Pending',     chip: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    assigned:    { label: 'Assigned',    chip: 'bg-sky-100 text-sky-800 border-sky-200',       icon: UserCheck },
    in_progress: { label: 'In Progress', chip: 'bg-sky-100 text-sky-800 border-sky-200',       icon: Clock },
    completed:   { label: 'Completed',   chip: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
    cancelled:   { label: 'Cancelled',   chip: 'bg-slate-100 text-slate-600 border-slate-300 border-dashed', icon: XCircle },
};

const PRIORITY = {
    high:   { label: 'High',   chip: 'bg-red-100 text-red-800',     bar: 'bg-red-500' },
    medium: { label: 'Medium', chip: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
    low:    { label: 'Low',    chip: 'bg-green-100 text-green-800', bar: 'bg-green-600' },
};

const onDate = (value) =>
    value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : null;

export default function InterventionsIndex({ interventions, filters, counts, staff = [], types = {} }) {
    const [working, setWorking] = useState(null);

    const filterBy = (next) =>
        router.get('/admin/interventions', { ...filters, ...next }, { preserveState: true, preserveScroll: true, replace: true });

    const tabs = [
        { key: 'open',        label: 'Open',        count: counts.pending + counts.assigned + counts.in_progress },
        { key: 'pending',     label: 'Pending',     count: counts.pending },
        { key: 'in_progress', label: 'In progress', count: counts.in_progress },
        { key: 'completed',   label: 'Completed',   count: counts.completed },
        { key: 'all',         label: 'All',         count: null },
    ];

    return (
        <AdminLayout title="Interventions">
            <div className="mb-5">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
                    <ClipboardList className="h-6 w-6 text-[#006400]" />
                    Agricultural Interventions
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Work the office has opened in response to a farm analysis. Every record here was
                    opened by a person, and closing one means writing down what was actually done.
                </p>
            </div>

            {counts.overdue > 0 && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-red-600" />
                    <p className="text-sm text-red-900">
                        <strong>{counts.overdue}</strong> open intervention{counts.overdue === 1 ? ' is' : 's are'} past
                        {counts.overdue === 1 ? ' its' : ' their'} target date.
                    </p>
                </div>
            )}

            {/* ------------------------------------------------------- filters */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => filterBy({ status: tab.key })}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                            filters.status === tab.key
                                ? 'bg-[#006400] text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {tab.label}
                        {tab.count !== null && (
                            <span className={`ml-1.5 tabular-nums ${filters.status === tab.key ? 'text-white/75' : 'text-gray-400'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}

                <select
                    value={filters.priority ?? ''}
                    onChange={(e) => filterBy({ priority: e.target.value || undefined })}
                    className="ml-auto rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                >
                    <option value="">Any priority</option>
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                </select>
            </div>

            {/* -------------------------------------------------------- the list */}
            {interventions.data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
                    <Building2 className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-3 font-semibold text-gray-900">Nothing on the queue</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                        Interventions appear here when staff open one from a farm analysis. The system
                        never opens work on its own.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {interventions.data.map((row) => {
                        const status = STATUS[row.status] ?? STATUS.pending;
                        const priority = PRIORITY[row.priority] ?? PRIORITY.medium;
                        const StatusIcon = status.icon;

                        return (
                            <div key={row.id} className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
                                <div className="flex">
                                    {/* Priority reads as a spine down the card, so the
                                        queue can be scanned without reading chips. */}
                                    <span className={`w-1.5 flex-none ${priority.bar}`} aria-hidden="true" />

                                    <div className="min-w-0 flex-1 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="flex items-center gap-2 font-bold text-gray-900">
                                                    <User className="h-4 w-4 flex-none text-gray-400" />
                                                    <Link
                                                        href={`/admin/farmers/${row.farmer_id}/analysis`}
                                                        className="truncate hover:text-[#006400] hover:underline"
                                                    >
                                                        {row.farmer}
                                                    </Link>
                                                </p>
                                                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                                                    {row.barangay && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <MapPin className="h-3.5 w-3.5" />{row.barangay}
                                                        </span>
                                                    )}
                                                    {row.parcel && (
                                                        <span>
                                                            {[row.parcel, row.commodity, row.area_ha ? `${row.area_ha} ha` : null]
                                                                .filter(Boolean).join(' • ')}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex flex-none flex-wrap items-center gap-2">
                                                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${priority.chip}`}>
                                                    {priority.label}
                                                </span>
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${status.chip}`}>
                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                    {status.label}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="mt-3 font-semibold text-gray-900">{row.type_label}</p>

                                        {/* Why it was put forward. */}
                                        <p className="mt-1 text-sm text-gray-600">
                                            <span className="font-semibold text-gray-500">Recommended because:</span>{' '}
                                            {row.reason}
                                        </p>

                                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
                                            {row.assignee && (
                                                <span className="inline-flex items-center gap-1">
                                                    <UserCheck className="h-3.5 w-3.5" />{row.assignee}
                                                </span>
                                            )}
                                            {row.target_date && (
                                                <span className={`inline-flex items-center gap-1 ${row.is_overdue ? 'font-semibold text-red-600' : ''}`}>
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    Target {onDate(row.target_date)}
                                                    {row.is_overdue && ' — overdue'}
                                                </span>
                                            )}
                                        </div>

                                        {row.notes && (
                                            <p className="mt-2 rounded-lg bg-gray-50 p-2.5 text-sm text-gray-600">{row.notes}</p>
                                        )}

                                        {/* What was actually done. A separate block with its
                                            own label, shown only when a person wrote it. */}
                                        {row.action_taken && (
                                            <div className="mt-3 rounded-lg border border-green-200 bg-green-50/60 p-3">
                                                <p className="text-[11px] font-bold uppercase tracking-wide text-[#006400]">
                                                    Action taken
                                                </p>
                                                <p className="mt-1 text-sm text-gray-800">{row.action_taken}</p>
                                                <p className="mt-1.5 text-[11px] text-gray-500">
                                                    Recorded by {row.completed_by ?? 'staff'} on {onDate(row.completed_at)}
                                                    {row.follow_up_date && ` · follow-up ${onDate(row.follow_up_date)}`}
                                                </p>
                                                {row.follow_up_notes && (
                                                    <p className="mt-1 text-sm text-gray-600">{row.follow_up_notes}</p>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setWorking(row)}
                                                className="rounded-lg bg-[#006400] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-800"
                                            >
                                                {row.status === 'completed' ? 'View / edit record' : 'Update'}
                                            </button>

                                            <Link
                                                href={`/admin/farmers/${row.farmer_id}/analysis`}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                            >
                                                View analysis
                                                <ChevronRight className="h-4 w-4" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {interventions.last_page > 1 && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                    {interventions.links.map((link, i) => (
                        <button
                            key={i}
                            type="button"
                            disabled={!link.url}
                            onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                            className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                link.active
                                    ? 'bg-[#006400] text-white'
                                    : link.url
                                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        : 'cursor-not-allowed border border-gray-200 text-gray-300'
                            }`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </div>
            )}

            {working && (
                <UpdateModal
                    intervention={working}
                    staff={staff}
                    onClose={() => setWorking(null)}
                />
            )}
        </AdminLayout>
    );
}

/**
 * Assign, progress, or close the record.
 *
 * Completing reveals a required "what was actually done" box. It is required
 * by the server too — this is a courtesy to the person typing, not the rule
 * itself.
 */
function UpdateModal({ intervention, staff, onClose }) {
    const { data, setData, put, processing, errors } = useForm({
        status:          intervention.status,
        assigned_to:     intervention.assigned_to ?? '',
        priority:        intervention.priority,
        target_date:     intervention.target_date ?? '',
        notes:           intervention.notes ?? '',
        action_taken:    intervention.action_taken ?? '',
        follow_up_date:  intervention.follow_up_date ?? '',
        follow_up_notes: intervention.follow_up_notes ?? '',
    });

    const completing = data.status === 'completed';

    const submit = (e) => {
        e.preventDefault();
        put(`/admin/interventions/${intervention.id}`, { onSuccess: onClose, preserveScroll: true });
    };

    return (
        <ModalShell
            open
            onClose={onClose}
            title={`${intervention.type_label} — ${intervention.farmer}`}
            size="lg"
            as="form"
            onSubmit={submit}
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-lg bg-[#006400] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
                    >
                        {processing ? 'Saving…' : 'Save'}
                    </button>
                </div>
            }
        >
            <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <span className="font-semibold text-gray-500">Recommended because:</span> {intervention.reason}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status" error={errors.status}>
                    <select
                        value={data.status}
                        onChange={(e) => setData('status', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                    >
                        {Object.entries(STATUS).map(([key, s]) => (
                            <option key={key} value={key}>{s.label}</option>
                        ))}
                    </select>
                </Field>

                <Field label="Priority" error={errors.priority}>
                    <select
                        value={data.priority}
                        onChange={(e) => setData('priority', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                    >
                        {Object.entries(PRIORITY).map(([key, p]) => (
                            <option key={key} value={key}>{p.label}</option>
                        ))}
                    </select>
                </Field>

                <Field label="Assigned to" error={errors.assigned_to}>
                    <select
                        value={data.assigned_to}
                        onChange={(e) => setData('assigned_to', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">Nobody yet</option>
                        {staff.map((person) => (
                            <option key={person.id} value={person.id}>{person.name}</option>
                        ))}
                    </select>
                </Field>

                <Field label="Target date" error={errors.target_date}>
                    <input
                        type="date"
                        value={data.target_date}
                        onChange={(e) => setData('target_date', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                    />
                </Field>
            </div>

            <div className="mt-4">
                <Field label="Notes" error={errors.notes}>
                    <textarea
                        rows={2}
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        placeholder="Anything staff should know before the visit"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                    />
                </Field>
            </div>

            {completing && (
                <div className="mt-4 rounded-xl border-2 border-green-200 bg-green-50/50 p-4">
                    <Field
                        label="What was actually done"
                        required
                        error={errors.action_taken}
                        hint="Required. This is the record of the work itself, not the reason it was recommended."
                    >
                        <textarea
                            rows={3}
                            value={data.action_taken}
                            onChange={(e) => setData('action_taken', e.target.value)}
                            placeholder="e.g. Drainage assessed and technical guidance given to the farmer."
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                        />
                    </Field>

                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label="Follow-up date" error={errors.follow_up_date}>
                            <input
                                type="date"
                                value={data.follow_up_date}
                                onChange={(e) => setData('follow_up_date', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                            />
                        </Field>

                        <Field label="Follow-up notes" error={errors.follow_up_notes}>
                            <input
                                type="text"
                                value={data.follow_up_notes}
                                onChange={(e) => setData('follow_up_notes', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-green-500"
                            />
                        </Field>
                    </div>
                </div>
            )}
        </ModalShell>
    );
}

function Field({ label, required = false, hint, error, children }) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            {children}
            {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}
