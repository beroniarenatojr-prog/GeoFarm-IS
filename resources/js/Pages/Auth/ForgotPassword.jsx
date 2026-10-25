import { useForm, usePage, Link } from '@inertiajs/react';
import { Mail, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import AuthCardShell from '@/Layouts/AuthCardShell';

/**
 * "I have forgotten my password."
 *
 * The confirmation deliberately does not say whether the address is
 * registered — see PasswordResetController for why — so this screen must not
 * imply it did. It reports that a link is on its way *if* the address belongs
 * to an account, and that wording is the server's, not this page's.
 */
export default function ForgotPassword() {
    const { flash } = usePage().props;

    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (e) => {
        e.preventDefault();
        post('/forgot-password');
    };

    return (
        <AuthCardShell title="Forgot password" backHref="/login" backLabel="Back to sign in">
            <div className="mb-8">
                <h2 className="mb-2 text-3xl font-bold text-gray-900">Forgot your password?</h2>
                <p className="text-gray-600">
                    Enter the email address on your account and we will send you a link to set a
                    new password.
                </p>
            </div>

            {/*
                Shown instead of the form once a request has gone through. The
                form is not left on screen, because a second submission would
                only hit the broker's one-per-minute limit and look like a
                failure.
            */}
            {flash?.success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <div>
                            <p className="font-semibold text-emerald-900">Check your email</p>
                            <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                                {flash.success}
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/login"
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a3a2e] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#2d5a45]"
                    >
                        Back to sign in
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                            Email address
                        </label>

                        <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                            </span>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                required
                                autoFocus
                                autoComplete="email"
                                placeholder="Enter Email address"
                                aria-invalid={errors.email ? 'true' : undefined}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                                className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 focus:border-[#1a3a2e] focus:outline-none focus:ring-1 focus:ring-[#1a3a2e]"
                            />
                        </div>

                        {errors.email && (
                            <p id="email-error" className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a3a2e] px-4 py-3.5 font-semibold text-white transition-colors hover:bg-[#2d5a45] disabled:opacity-60"
                    >
                        {processing ? 'Sending…' : 'Send reset link'}
                        {!processing && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                    </button>

                    <p className="text-center text-xs leading-relaxed text-gray-500">
                        No email on your account, or no longer have access to it? Visit the
                        Municipal Agriculture Office and staff can reset it for you.
                    </p>
                </form>
            )}
        </AuthCardShell>
    );
}
