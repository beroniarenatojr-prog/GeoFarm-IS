import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Lock, Unlock, Plus } from 'lucide-react';
import { ViewButton, EditButton, DeleteButton } from '@/Components/ui/ActionButtons';
import ModalShell from '@/Components/ui/ModalShell';
import { ProgramFormFields, useProgramForm } from '@/Components/Assistance/ProgramForm';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

// Completed and cancelled are endings — reopening one is a deliberate act that
// belongs in the edit form, not a single click in a list. Mirrors
// FinancialAssistance::TOGGLEABLE on the server.
const TOGGLEABLE = ['draft', 'active', 'inactive'];

const STATUS_STYLE = {
    active:    'bg-green-100 text-green-700',
    inactive:  'bg-amber-100 text-amber-700',
    draft:     'bg-gray-100 text-gray-600',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
};

export default function AssistanceIndex({ programs, canLock, assistanceTypes = [], barangays = [] }) {
    const { can } = usePermissions();

    // null = closed, 'new' = create, otherwise the programme being edited.
    const [editing, setEditing] = useState(null);

    return (
        <AdminLayout title="Agricultural Assistance Programs">
            <div className="flex justify-end mb-4">
                {can('create assistance') && (
                    <button type="button" onClick={() => setEditing('new')}
                        className="inline-flex items-center gap-1.5 bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                        <Plus className="h-4 w-4" /> New Program
                    </button>
                )}
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Program</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Budget</th>
                            <th className="px-4 py-3">Period</th>
                            <th className="px-4 py-3">Barangays</th>
                            <th className="px-4 py-3">Distributions</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {programs.data.map(p => (
                            <ProgramRow
                                key={p.id}
                                program={p}
                                canLock={canLock}
                                can={can}
                                onEdit={() => setEditing(p)}
                            />
                        ))}
                        {programs.data.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                                    No assistance programs yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {editing && (
                // Keyed so switching rows starts a clean form rather than
                // carrying the previous programme's values over.
                <ProgramFormModal
                    key={editing === 'new' ? 'new' : editing.id}
                    program={editing === 'new' ? null : editing}
                    assistanceTypes={assistanceTypes}
                    barangays={barangays}
                    onClose={() => setEditing(null)}
                />
            )}
        </AdminLayout>
    );
}

function ProgramFormModal({ program, assistanceTypes, barangays, onClose }) {
    const isEdit = !!program;
    const form = useProgramForm(program);

    const submit = e => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        isEdit
            ? form.put(`/admin/assistance/${program.id}`, options)
            : form.post('/admin/assistance', options);
    };

    return (
        <ModalShell
            title={isEdit ? `Edit — ${program.program_name}` : 'New assistance program'}
            size="xl"
            onClose={onClose}
            as="form"
            onSubmit={submit}
            bodyClass="px-5 py-4"
            footer={
                <>
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={form.processing}
                        className="px-5 py-2 bg-[#006400] text-white rounded-lg text-sm font-semibold hover:bg-[#228B22] disabled:opacity-50">
                        {form.processing ? 'Saving…' : isEdit ? 'Save changes' : 'Create program'}
                    </button>
                </>
            }
        >
            <ProgramFormFields
                form={form}
                assistanceTypes={assistanceTypes}
                barangays={barangays}
            />
        </ModalShell>
    );
}

function ProgramRow({ program: p, canLock, can, onEdit }) {
    // Local pending flag, so toggling one row does not grey out the whole table.
    const [busy, setBusy] = useState(null);

    const locked = !!p.is_locked;

    const patch = (what, url) => {
        setBusy(what);
        router.patch(url, {}, {
            preserveScroll: true,
            onFinish: () => setBusy(null),
        });
    };

    const lockedNote = p.locker?.name
        ? ` by ${p.locker.name}${p.locked_at ? ` on ${formatDate(p.locked_at, 'date-only')}` : ''}`
        : '';

    return (
        <tr className={`border-t ${locked ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`}>
            <td className="px-4 py-3 font-medium">
                <span className="flex items-center gap-1.5">
                    {p.program_name}
                    {locked && (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Locked" />
                    )}
                </span>
            </td>

            <td className="px-4 py-3">
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                    {p.assistance_type?.type_name || '—'}
                </span>
            </td>

            <td className="px-4 py-3">
                <StatusToggle
                    status={p.status}
                    locked={locked}
                    busy={busy === 'status'}
                    canEdit={can('edit assistance')}
                    onToggle={() => patch('status', `/admin/assistance/${p.id}/status`)}
                />
            </td>

            <td className="px-4 py-3">₱{Number(p.total_budget ?? 0).toLocaleString()}</td>

            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                {formatDate(p.start_date, 'date-only')} – {formatDate(p.end_date, 'date-only')}
            </td>

            <td className="px-4 py-3">
                {p.barangays && p.barangays.length > 0
                    ? <span className="text-xs text-gray-600">{p.barangays.length} selected</span>
                    : <span className="text-xs text-gray-400">All</span>}
            </td>

            <td className="px-4 py-3">{p.distributions_count}</td>

            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <ViewButton href={`/admin/assistance/${p.id}`} permission="view assistance" />

                    <EditButton
                        onClick={onEdit}
                        permission="edit assistance"
                        disabled={locked}
                        disabledTitle="Locked — unlock this program before editing"
                    />

                    <DeleteButton
                        permission="delete assistance"
                        disabled={locked}
                        disabledTitle="Locked — unlock this program before deleting"
                        onConfirm={() => router.delete(`/admin/assistance/${p.id}`, {
                            preserveState: true,
                            preserveScroll: true,
                        })}
                    />

                    <LockButton
                        locked={locked}
                        canLock={canLock}
                        busy={busy === 'lock'}
                        note={lockedNote}
                        onToggle={() => patch('lock', `/admin/assistance/${p.id}/lock`)}
                    />
                </div>
            </td>
        </tr>
    );
}

/**
 * A switch rather than a clickable badge: the point is that this is something
 * you can change, and a badge does not read as pressable.
 */
function StatusToggle({ status, locked, busy, canEdit, onToggle }) {
    const badge = (
        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[status] ?? STATUS_STYLE.draft}`}>
            {status}
        </span>
    );

    const settled = !TOGGLEABLE.includes(status);

    if (!canEdit || locked || settled) {
        const why = locked
            ? 'Locked — unlock to change the status'
            : settled
                ? 'Reopen this program from the edit form'
                : undefined;
        return <span title={why}>{badge}</span>;
    }

    const on = status === 'active';

    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`Program is ${status}. Switch ${on ? 'off' : 'on'}.`}
            onClick={onToggle}
            disabled={busy}
            title={on ? 'Click to deactivate' : 'Click to activate'}
            className="group inline-flex items-center gap-2 disabled:opacity-50"
        >
            <span className={`relative h-5 w-9 rounded-full transition-colors ${
                on ? 'bg-green-600 group-hover:bg-green-700' : 'bg-gray-300 group-hover:bg-gray-400'
            }`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    on ? 'left-[1.125rem]' : 'left-0.5'
                }`} />
            </span>
            {badge}
        </button>
    );
}

/**
 * Shown to everyone so the state is legible, but actionable only for roles
 * holding "lock assistance" — for anyone else it is a padlock indicator.
 */
function LockButton({ locked, canLock, busy, note, onToggle }) {
    if (!canLock) {
        // Nothing useful to say about a record that is already open.
        if (!locked) return null;
        return (
            <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"
                title={`Locked${note}. Only an administrator can unlock it.`}
            >
                <Lock className="h-4 w-4" />
            </span>
        );
    }

    const Icon = locked ? Lock : Unlock;

    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-pressed={locked}
            title={locked
                ? `Locked${note} — click to unlock`
                : 'Lock this program (freezes edits, deletion and new distributions)'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                locked
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}
