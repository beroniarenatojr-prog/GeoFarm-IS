import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import ModalShell from './ModalShell';

const field = 'w-full border border-gray-300 rounded-lg px-2.5 py-2 pr-9 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

/**
 * Confirms a lock or unlock with the user's personal lock password — which is
 * deliberately not their login password, so a signed-in session left open is
 * not on its own enough to freeze or release a programme's figures.
 *
 * Someone who has not set one yet creates it here, on first use, rather than
 * being sent away to a settings page mid-task.
 */
export default function LockConfirmModal({ program, hasLockPassword, onClose }) {
    const locking = !program.is_locked;
    const [reveal, setReveal] = useState(false);

    const form = useForm({
        lock_password: '',
        new_lock_password: '',
        new_lock_password_confirmation: '',
    });

    const submit = e => {
        e.preventDefault();
        form.patch(`/admin/assistance/${program.id}/lock`, {
            preserveScroll: true,
            onSuccess: onClose,
            // Never leave a typed secret sitting in component state.
            onFinish: () => form.reset('lock_password', 'new_lock_password', 'new_lock_password_confirmation'),
        });
    };

    const Icon = locking ? Lock : Unlock;

    return (
        <ModalShell
            title={locking ? 'Lock this program' : 'Unlock this program'}
            size="sm"
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
                        className={`px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${
                            locking ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#006400] hover:bg-[#228B22]'
                        }`}>
                        {form.processing ? 'Confirming…' : locking ? 'Lock program' : 'Unlock program'}
                    </button>
                </>
            }
        >
            <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-gray-50 p-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${locking ? 'text-amber-600' : 'text-[#006400]'}`} />
                <p className="text-sm text-gray-700">
                    <span className="font-semibold">{program.program_name}</span>
                    {locking
                        ? ' will be frozen — no edits, no deletion and no new distributions until it is unlocked.'
                        : ' will be editable again, and new distributions can be recorded against it.'}
                </p>
            </div>

            {hasLockPassword ? (
                <div>
                    <label className={labelCls}>Your lock password</label>
                    <div className="relative">
                        <input
                            type={reveal ? 'text' : 'password'}
                            autoFocus
                            autoComplete="off"
                            className={field}
                            value={form.data.lock_password}
                            onChange={e => form.setData('lock_password', e.target.value)}
                        />
                        <RevealToggle on={reveal} onToggle={() => setReveal(r => !r)} />
                    </div>
                    {form.errors.lock_password && (
                        <p className="mt-1 text-xs text-red-600">{form.errors.lock_password}</p>
                    )}
                    <p className="mt-1.5 text-[11px] text-gray-400">
                        This is your lock password, not your login password.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 p-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#006400]" />
                        <p className="text-xs text-green-900">
                            You have not set a lock password yet. Create one now — it is used only
                            to confirm locking and unlocking, and it must be different from your
                            login password.
                        </p>
                    </div>

                    <div>
                        <label className={labelCls}>New lock password</label>
                        <div className="relative">
                            <input
                                type={reveal ? 'text' : 'password'}
                                autoFocus
                                autoComplete="new-password"
                                className={field}
                                value={form.data.new_lock_password}
                                onChange={e => form.setData('new_lock_password', e.target.value)}
                            />
                            <RevealToggle on={reveal} onToggle={() => setReveal(r => !r)} />
                        </div>
                        {form.errors.new_lock_password && (
                            <p className="mt-1 text-xs text-red-600">{form.errors.new_lock_password}</p>
                        )}
                        <p className="mt-1 text-[11px] text-gray-400">At least 6 characters.</p>
                    </div>

                    <div>
                        <label className={labelCls}>Confirm lock password</label>
                        <input
                            type={reveal ? 'text' : 'password'}
                            autoComplete="new-password"
                            className={field}
                            value={form.data.new_lock_password_confirmation}
                            onChange={e => form.setData('new_lock_password_confirmation', e.target.value)}
                        />
                    </div>
                </div>
            )}
        </ModalShell>
    );
}

function RevealToggle({ on, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            tabIndex={-1}
            aria-label={on ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-gray-400 hover:text-gray-600"
        >
            {on ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
    );
}
