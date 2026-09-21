import { useForm, Link, usePage } from '@inertiajs/react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export default function Login() {
    const { flash } = usePage().props;
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 p-8">
            {/* Centered Login Card */}
            <div className="w-full max-w-5xl flex rounded-3xl shadow-2xl overflow-hidden bg-white">
                {/* Left Panel - Dark Green */}
                <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#004d00] via-[#006400] to-[#228B22] p-12 flex-col justify-center items-center relative overflow-hidden">
                    {/* Decorative Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-10 left-10 w-72 h-72 border-2 border-white/30 rounded-full"></div>
                        <div className="absolute bottom-10 right-10 w-96 h-96 border-2 border-white/30 rounded-full"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/20 rounded-full"></div>
                    </div>

                    {/* Content Container - Centered */}
                    <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-md">
                        {/* Logo - Large and Centered */}
                        <div className="flex flex-col items-center space-y-4">
                            <img
                                src="/images/Logo.jpeg"
                                alt="Seal of the Municipality of Tumauini, Isabela"
                                className="h-32 w-32 rounded-full bg-white object-contain p-2 ring-4 ring-white/40 shadow-2xl"
                            />
                            
                            {/* Municipal Office Title */}
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-white tracking-wide">
                                    MUNICIPAL AGRICULTURIST OFFICE
                                </h2>
                                <p className="text-[#90EE90] text-lg font-semibold tracking-wider">
                                    TUMAUINI, ISABELA
                                </p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-32 h-px bg-white/40"></div>

                        {/* System Branding */}
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-white">GeoFarm-IS</h1>
                            <p className="text-[#90EE90] text-base font-medium">
                                Geographic Farm Information System
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="w-32 h-px bg-white/40"></div>

                        {/* Tagline */}
                        <div className="space-y-3">
                            <h3 className="text-2xl font-bold text-white leading-snug">
                                Every parcel,<br />
                                <span className="text-[#FFD700] italic">mapped and known.</span>
                            </h3>
                            <p className="text-white/90 text-sm leading-relaxed">
                                Manage farmer records, monitor harvests,<br />
                                and coordinate assistance programs<br />
                                across Tumauini's fields.
                            </p>
                        </div>
                    </div>

                    {/* Footer - Absolute Bottom */}
                    <div className="absolute bottom-8 left-0 right-0 px-12">
                        <div className="relative z-10">
                            <div className="h-px bg-white/20 mb-3"></div>
                            <p className="text-white/60 text-xs text-center">
                                © 2026 GeoFarm Information System
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Login Form */}
                <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-white">
                    <div className="w-full max-w-md">
                        {/* Back to Home Link */}
                        <Link
                            href="/"
                            className="inline-flex items-center text-[#1a3a2e] hover:text-[#2d5a45] mb-8 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Link>

                        {/* Form Container */}
                        <div>
                            <div className="mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
                                <p className="text-gray-600">Sign in to access your dashboard</p>
                            </div>

                            {/* Why the user was sent here — an expired session
                                lands on this page with a flashed reason. */}
                            {flash?.error && (
                                <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <p className="text-sm text-amber-800">{flash.error}</p>
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-6">
                                {/* Email Input */}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                        Email address
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            id="email"
                                            type="email"
                                            value={data.email}
                                            onChange={e => setData('email', e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a3a2e] focus:border-transparent transition-all"
                                            required
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="mt-2 text-sm text-red-600">{errors.email}</p>
                                    )}
                                </div>

                                {/* Password Input */}
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={e => setData('password', e.target.value)}
                                            className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a3a2e] focus:border-transparent transition-all"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                            ) : (
                                                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="mt-2 text-sm text-red-600">{errors.password}</p>
                                    )}
                                </div>

                                {/* Remember Me & Forgot Password */}
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={data.remember}
                                            onChange={e => setData('remember', e.target.checked)}
                                            className="h-4 w-4 text-[#1a3a2e] focus:ring-[#1a3a2e] border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-600">Remember me for 30 days</span>
                                    </label>
                                    <a href="#" className="text-sm text-[#1a3a2e] hover:text-[#2d5a45]">
                                        Forgot password?
                                    </a>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-[#1a3a2e] text-white rounded-lg hover:bg-[#2d5a45] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a3a2e] transition-colors font-medium disabled:opacity-50"
                                >
                                    Sign in to dashboard
                                    <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
                                </button>

                                {/* Divider */}
                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-gray-500">New to GeoFarm-IS</span>
                                    </div>
                                </div>

                                {/*
                                    One way in from here: the full RSBSA form,
                                    for somebody not in the registry yet.

                                    Note for anyone tempted to point this at
                                    /register instead — that route claims a
                                    login for a farmer who is ALREADY on the
                                    registry, matching their RSBSA number,
                                    surname and birthdate. The two are not
                                    interchangeable: rsbsa_no is unique, so an
                                    existing farmer sent through the RSBSA form
                                    fills in seven steps and is refused at the
                                    final submit.
                                */}
                                <div className="space-y-3">
                                    <Link
                                        href="/farmer-registration"
                                        className="flex items-center justify-between gap-3 rounded-lg border-2 border-[#1a3a2e] px-4 py-3 transition-colors hover:bg-[#1a3a2e]/5"
                                    >
                                        <span>
                                            <span className="block text-sm font-semibold text-[#1a3a2e]">
                                                Register as a farmer
                                            </span>
                                            <span className="block text-xs text-gray-500">
                                                You are not in the RSBSA registry yet
                                            </span>
                                        </span>
                                        <ArrowLeft className="h-4 w-4 flex-shrink-0 rotate-180 text-[#1a3a2e]" />
                                    </Link>

                                    {/*
                                        The "Create an account" link to /register
                                        was removed from here on request.

                                        That route still exists and still works,
                                        but nothing in the app links to it now.
                                        It was the only way a farmer the office
                                        entered in person could claim a login:
                                        FarmerController@store creates a farmer
                                        record and no user, and verification only
                                        activates a user that already exists. So
                                        those farmers now need an account created
                                        for them in User Management.
                                    */}
                                    <p className="text-center text-xs text-gray-500">
                                        Already registered but cannot sign in? Ask the Municipal
                                        Agriculture Office to set up your account.
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
