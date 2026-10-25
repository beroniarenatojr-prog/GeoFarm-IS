import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import AuthCardShell from '@/Layouts/AuthCardShell';

/**
 * Setting the new password, from an emailed link.
 *
 * The token and email arrive in the URL and are posted straight back; the
 * server checks them together. Neither is editable here — the email field is
 * shown read-only so the person can see which account they are changing, which
 * matters on a shared office machine where several people may have requested a
 * link.
 */
export default function ResetPassword({ token, email }) {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        token,
        email: email ?? '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post('/reset-password');
    };

    return (
        <AuthCardShell title="Set a new password" backHref="/login" backLabel="Back to sign in">
            <div className="mb-8">
                <h2 className="mb-2 text-3xl font-bold text-gray-900">Set a new password</h2>
                <p className="text-gray-600">
                    Choose a password you have not used on this account before.
                </p>
            </div>

            <form onSubmit={submit} className="space-y-6">
                {/* Read-only, not hidden: on a shared machine it matters that
                    you can see which account you are about to change. */}
                <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                        Account
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </span>
                        <input
                            id="email"
                            type="email"
                            value={data.email}
                            readOnly
                            className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-gray-600"
                        />
                    </div>
                </div>

                <PasswordField
                    id="password"
                    label="New password"
                    value={data.password}
                    onChange={(v) => setData('password', v)}
                    error={errors.password}
                    show={showPassword}
                    onToggle={() => setShowPassword((s) => !s)}
                    autoComplete="new-password"
                    autoFocus
                    hint="At least 8 characters."
                />

                <PasswordField
                    id="password_confirmation"
                    label="Confirm new password"
                    value={data.password_confirmation}
                    onChange={(v) => setData('password_confirmation', v)}
                    error={errors.password_confirmation}
                    show={showPassword}
                    onToggle={() => setShowPassword((s) => !s)}
                    autoComplete="new-password"
                />

                {/* An invalid or expired token comes back on the email field,
                    which is not shown as editable — so it is surfaced here
                    instead of being invisible. */}
                {errors.email && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-medium text-red-800">{errors.email}</p>
                            <a href="/forgot-password" className="mt-1 inline-block text-sm font-semibold text-red-700 underline">
                                Request a new link
                            </a>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={processing}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a3a2e] px-4 py-3.5 font-semibold text-white transition-colors hover:bg-[#2d5a45] disabled:opacity-60"
                >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {processing ? 'Saving…' : 'Change password'}
                </button>

                {/* Told up front, because an administrator who expects to land
                    on the dashboard will otherwise read the verification screen
                    as the reset having failed. */}
                <p className="text-center text-xs leading-relaxed text-gray-500">
                    You will be asked to sign in with your new password. Office accounts will also
                    receive a verification code, as usual.
                </p>
            </form>
        </AuthCardShell>
    );
}

function PasswordField({ id, label, value, onChange, error, show, onToggle, hint, ...rest }) {
    return (
        <div>
            <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
                {label}
            </label>

            <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>

                <input
                    id={id}
                    name={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
                    className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-11 focus:border-[#1a3a2e] focus:outline-none focus:ring-1 focus:ring-[#1a3a2e]"
                    {...rest}
                />

                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                    {show ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
            </div>

            {hint && !error && (
                <p id={`${id}-hint`} className="mt-2 text-xs text-gray-500">{hint}</p>
            )}

            {error && (
                <p id={`${id}-error`} className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            )}
        </div>
    );
}
