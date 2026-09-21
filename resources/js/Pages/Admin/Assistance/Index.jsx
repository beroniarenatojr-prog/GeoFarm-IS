import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Lock, Unlock, Plus } from 'lucide-react';
import { StandardActionMenu } from '@/Components/ui/ActionMenu';
import ModalShell from '@/Components/ui/ModalShell';
import LockConfirmModal from '@/Components/ui/LockConfirmModal';
import { ProgramFormFields, useProgramForm } from '@/Components/Assistance/ProgramForm';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

// Completed and cancelled are endings — reopening one is a deliberate act that
// belongs in the edit form, not a single click in a list. Mirrors
// FinancialAssistance::TOGGLEABLE on the server.
const TOGGLEABLE = ['draft', 'active', 'inactive'];

const STATUS_STYLE = {
    active:    'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 ring-1 ring-green-200',
    inactive:  'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 ring-1 ring-amber-200',
    draft:     'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-600 ring-1 ring-gray-200',
    completed: 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-emerald-200',
    cancelled: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 ring-1 ring-red-200',
};

export default function AssistanceIndex({
    programs, canLock, hasLockPassword, assistanceTypes = [], barangays = [], stockItems = [],
}) {
    const { can } = usePermissions();

    // null = closed, 'new' = create, otherwise the programme being edited.
    const [editing, setEditing] = useState(null);
    // The programme whose lock is being confirmed.
    const [confirmingLock, setConfirmingLock] = useState(null);

    return (
        <AdminLayout title="Agricultural Assistance Programs">
            <div className="flex justify-end mb-4">
                {can('create assistance') && (
                    <button type="button" onClick={() => setEditing('new')}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg transition-all">
                        <Plus className="h-4 w-4" /> New Program
                    </button>
                )}
            </div>
            <div className="bg-white rounded-xl shadow-md border border-green-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-b-2 border-green-200 text-gray-700 text-left">
                        <tr>
                            <th className="px-4 py-3.5 font-semibold">Program</th>
                            <th className="px-4 py-3.5 font-semibold">Type</th>
                            <th className="px-4 py-3.5 font-semibold">Status</th>
                            <th className="px-4 py-3.5 font-semibold">Period</th>
                            <th className="px-4 py-3.5 font-semibold">Barangays</th>
                            <th className="px-4 py-3.5 font-semibold">Distributions</th>
                            <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
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
                                onToggleLock={() => setConfirmingLock(p)}
                            />
                        ))}
                        {programs.data.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
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
                    stockItems={stockItems}
                    onClose={() => setEditing(null)}
                />
            )}

            {confirmingLock && (
                <LockConfirmModal
                    key={confirmingLock.id}
                    program={confirmingLock}
                    hasLockPassword={hasLockPassword}
                    onClose={() => setConfirmingLock(null)}
                />
            )}
        </AdminLayout>
    );
}

function ProgramFormModal({ program, assistanceTypes, barangays, stockItems, onClose }) {
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
                stockItems={stockItems}
            />
        </ModalShell>
    );
}

function ProgramRow({ program: p, canLock, can, onEdit, onToggleLock }) {
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
        <tr className={`border-t border-green-50 ${locked ? 'bg-gradient-to-r from-amber-50/50 to-yellow-50/30' : 'hover:bg-gradient-to-r hover:from-green-50/40 hover:to-emerald-50/20 transition-all'}`}>
            <td className="px-4 py-3.5 font-semibold text-gray-900">
                <span className="flex items-center gap-2">
                    {p.program_name}
                    {locked && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                            <Lock className="h-3 w-3 shrink-0" aria-label="Locked" />
                            Locked
                        </span>
                    )}
                </span>
            </td>

            <td className="px-4 py-3.5">
                <span className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full ring-1 ring-green-200">
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

            <td className="px-4 py-3.5 text-gray-600 text-xs whitespace-nowrap">
                <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{formatDate(p.start_date, 'date-only')}</span>
                    <span className="text-gray-400">to {formatDate(p.end_date, 'date-only')}</span>
                </div>
            </td>

            <td className="px-4 py-3.5">
                {p.barangays && p.barangays.length > 0
                    ? <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full ring-1 ring-blue-200">
                        {p.barangays.length} selected
                    </span>
                    : <span className="text-xs text-gray-400 italic">All barangays</span>}
            </td>

            <td className="px-4 py-3.5">
                <span className="inline-flex items-center justify-center bg-purple-50 text-purple-700 font-bold text-sm px-2.5 py-1 rounded-lg ring-1 ring-purple-200">
                    {p.distributions_count}
                </span>
            </td>

            <td className="px-4 py-3.5 text-right">
                <div className="flex items-center gap-2">
                    {/* Lock/Unlock button - visible outside dropdown */}
                    {canLock && (
                        <button
                            type="button"
                            onClick={onToggleLock}
                            disabled={busy === 'lock'}
                            aria-pressed={locked}
                            title={locked
                                ? `Locked${lockedNote} — click to unlock`
                                : 'Lock this program (freezes edits, deletion and new distributions)'}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow ${
                                locked
                                    ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 hover:from-amber-200 hover:to-yellow-200 ring-1 ring-amber-300'
                                    : 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-500 hover:from-gray-100 hover:to-slate-100 hover:text-gray-700 ring-1 ring-gray-200'
                            }`}
                        >
                            {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                    )}
                    
                    {/* Action dropdown menu */}
                    <StandardActionMenu
                        viewHref={`/admin/assistance/${p.id}`}
                        viewPermission="view assistance"
                        editOnClick={onEdit}
                        editPermission="edit assistance"
                        editDisabled={locked}
                        editDisabledTitle="Locked — unlock this program before editing"
                        deletePermission="delete assistance"
                        deleteDisabled={locked}
                        deleteDisabledTitle="Locked — unlock this program before deleting"
                        onDelete={() => router.delete(`/admin/assistance/${p.id}`, {
                            preserveState: true,
                            preserveScroll: true,
                        })}
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
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[status] ?? STATUS_STYLE.draft}`}>
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
