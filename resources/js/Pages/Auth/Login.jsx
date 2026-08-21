import { useForm, Link } from '@inertiajs/react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Leaf } from 'lucide-react';
import { useState } from 'react';

export default function Login() {
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-800 via-teal-700 to-green-600 p-8">
            {/* Centered Login Card */}
            <div className="w-full max-w-5xl flex rounded-3xl shadow-2xl overflow-hidden bg-white">
                {/* Left Panel - Dark Green */}
                <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1a3a2e] to-[#0d1f19] p-12 flex-col justify-between relative overflow-hidden">
                    {/* Decorative Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-20 left-20 w-64 h-64 border border-[#f4d58d] rounded-full"></div>
                        <div className="absolute bottom-20 right-20 w-96 h-96 border border-[#f4d58d] rounded-full"></div>
                    </div>

                    {/* Logo and Branding */}
                    <div className="relative z-10">
                        <div className="flex items-center space-x-3 mb-8">
                            <div className="bg-[#f4d58d] p-3 rounded-xl">
                                <Leaf className="h-8 w-8 text-[#1a3a2e]" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">GeoFarm-IS</h1>
                                <p className="text-[#f4d58d] text-sm">Geographic Farm Information System</p>
                            </div>
                        </div>

                        <div className="h-px bg-[#f4d58d]/30 mb-8"></div>

                        <div className="space-y-2 text-sm text-[#f4d58d]/80">
                            <p>LGU AGRICULTURE OFFICE • TUMAUINI,</p>
                            <p>ISABELA</p>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="relative z-10">
                        <h2 className="text-5xl font-bold text-white mb-4 leading-tight">
                            Every parcel,<br />
                            <span className="text-[#f4d58d] italic">mapped and</span><br />
                            <span className="text-[#f4d58d] italic">known.</span>
                        </h2>
                        <p className="text-gray-300 text-lg">
                            Sign in to manage farmer records, monitor<br />
                            harvests, and coordinate assistance programs<br />
                            across Tumauini's fields.
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="relative z-10">
                        <div className="h-px bg-[#f4d58d]/30 mb-4"></div>
                        <p className="text-gray-400 text-sm">
                            © 2026 GeoFarm Information System
                        </p>
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
                                            placeholder="admin1@gmail.com"
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

                                {/* Register Link */}
                                <div className="text-center">
                                    <p className="text-gray-600">
                                        Registered farmer in Tumauini?{' '}
                                        <Link
                                            href="/register"
                                            className="font-medium text-[#1a3a2e] hover:text-[#2d5a45]"
                                        >
                                            Create an account
                                        </Link>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Need access? Contact your system administrator
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
