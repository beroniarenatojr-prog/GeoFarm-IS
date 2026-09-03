import { useForm, Link } from '@inertiajs/react';
import { Lock, Mail, ArrowLeft, Eye, EyeOff, User, IdCard, Calendar } from 'lucide-react';
import { useState } from 'react';

export default function Register() {
    const { data, setData, post, processing, errors } = useForm({
        rsbsa_no: '',
        last_name: '',
        birthdate: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const submit = e => {
        e.preventDefault();
        post('/register');
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Decorative Panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#006400] via-[#228B22] to-[#32CD32] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse delay-1000"></div>
                </div>
                
                <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
                    <div>
                        <div className="flex items-center space-x-3 mb-8">
                            <img
                                src="/images/Logo.jpeg"
                                alt="Seal of the Municipality of Tumauini, Isabela"
                                className="h-14 w-14 flex-shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-white/30"
                            />
                            <div>
                                <h1 className="text-2xl font-bold">GeoFarm-IS</h1>
                                <p className="text-white/80 text-sm">Farmer Registration</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4 max-w-md">
                            <h2 className="text-4xl font-bold leading-tight">
                                Register Your Account
                            </h2>
                            <p className="text-white/90 text-lg">
                                Create your account to access your farm information, track assistance, and manage your agricultural data.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                            <h3 className="font-semibold mb-2">🔒 Security Verification:</h3>
                            <ul className="text-sm space-y-1 text-white/90">
                                <li>✓ RSBSA Number (must be registered)</li>
                                <li>✓ Last Name (must match records)</li>
                                <li>✓ Birthdate (must match records)</li>
                            </ul>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                            <h3 className="font-semibold mb-2">📋 Requirements:</h3>
                            <ul className="text-sm space-y-1 text-white/90">
                                <li>✓ Must be a registered farmer in Tumauini, Isabela</li>
                                <li>✓ Personal information must match our records</li>
                                <li>✓ Valid email address</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 text-white/80">
                        <IdCard className="h-4 w-4" />
                        <span className="text-sm">LGU Agriculture Office, Tumauini, Isabela</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Registration Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#FAF8F3]">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex items-center space-x-3 bg-[#006400] text-white pl-2 pr-6 py-2 rounded-2xl mb-4">
                            <img
                                src="/images/Logo.jpeg"
                                alt="Seal of the Municipality of Tumauini, Isabela"
                                className="h-9 w-9 flex-shrink-0 rounded-full bg-white object-contain p-0.5"
                            />
                            <span className="text-xl font-bold">GeoFarm-IS</span>
                        </div>
                    </div>

                    {/* Back Links */}
                    <div className="flex justify-between items-center mb-6">
                        <Link 
                            href="/" 
                            className="inline-flex items-center text-[#006400] hover:text-[#005200] transition-colors group"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-sm font-medium">Back to Home</span>
                        </Link>
                        <Link 
                            href="/login" 
                            className="text-sm font-medium text-gray-600 hover:text-[#006400] transition-colors"
                        >
                            Sign In
                        </Link>
                    </div>

                    {/* Registration Card */}
                    <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Farmer Account</h2>
                            <p className="text-gray-600">Register to access your farm dashboard</p>
                        </div>

                        <form onSubmit={submit} className="space-y-5">
                            {/* General Verification Error */}
                            {errors.verification && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                                    <div className="flex items-center">
                                        <span className="text-red-500 font-semibold mr-2">⚠️ Verification Failed</span>
                                    </div>
                                    <p className="text-red-700 text-sm mt-1">{errors.verification}</p>
                                </div>
                            )}

                            {/* RSBSA Number */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    RSBSA Number <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <IdCard className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={data.rsbsa_no}
                                        onChange={e => setData('rsbsa_no', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#006400]/10 focus:border-[#006400] outline-none transition-all text-gray-900 placeholder:text-gray-400" 
                                        placeholder="Enter your RSBSA number"
                                        required 
                                    />
                                </div>
                                {errors.rsbsa_no && (
                                    <p className="text-red-500 text-sm mt-2 flex items-center">
                                        <span className="inline-block w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                                        {errors.rsbsa_no}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Must be registered in Tumauini, Isabela</p>
                            </div>

                            {/* Last Name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Last Name <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={data.last_name}
                                        onChange={e => setData('last_name', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#006400]/10 focus:border-[#006400] outline-none transition-all text-gray-900 placeholder:text-gray-400" 
                                        placeholder="As registered in the system"
                                        required 
                                    />
                                </div>
                                {errors.last_name && (
                                    <p className="text-red-500 text-sm mt-2 flex items-center">
                                        <span className="inline-block w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                                        {errors.last_name}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Must match your registered last name</p>
                            </div>

                            {/* Birthdate */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Birthdate <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Calendar className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input 
                                        type="date" 
                                        value={data.birthdate}
                                        onChange={e => setData('birthdate', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#006400]/10 focus:border-[#006400] outline-none transition-all text-gray-900 placeholder:text-gray-400" 
                                        required 
                                    />
                                </div>
                                {errors.birthdate && (
                                    <p className="text-red-500 text-sm mt-2 flex items-center">
                                        <span className="inline-block w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                                        {errors.birthdate}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Must match your registered birthdate</p>
                            </div>

                            {/* Email Field */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input 
                                        type="email" 
                                        value={data.email}
                                        onChange={e => setData('email', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#006400]/10 focus:border-[#006400] outline-none transition-all text-gray-900 placeholder:text-gray-400" 
                                        placeholder="your@email.com"
                                        required 
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-red-500 text-sm mt-2 flex items-center">
                                        <span className="inline-block w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password Field */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        value={data.password}
                                        onChange={e => setData('password', e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#006400]/10 focus:border-[#006400] outline-none transition-all text-gray-900 placeholder:text-gray-400"
                                        placeholder="Minimum 8 characters"
                                        required 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-500 text-sm mt-2 flex items-center">
                                        <span className="inline-block w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password Field */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Confirm Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input 
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={data.password_confirmation}
                                        onChange={e => setData('password_confirmation', e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-[#006400]/10 focus:border-[#006400] outline-none transition-all text-gray-900 placeholder:text-gray-400"
                                        placeholder="Re-enter your password"
                                        required 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button 
                                type="submit" 
                                disabled={processing}
                                className="w-full bg-gradient-to-r from-[#006400] to-[#228B22] text-white py-4 rounded-xl hover:from-[#005200] hover:to-[#1a6b1a] transition-all duration-300 font-semibold text-base shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {processing ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating Account...
                                    </span>
                                ) : 'Create Farmer Account'}
                            </button>
                        </form>

                        {/* Additional Info */}
                        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                            <p className="text-sm text-gray-600">
                                Already have an account?{' '}
                                <Link href="/login" className="text-[#006400] font-semibold hover:text-[#005200] transition-colors">
                                    Sign in here
                                </Link>
                            </p>
                        </div>

                        <div className="mt-4 text-center">
                            <p className="text-xs text-gray-500">
                                Need help? Contact the Agriculture Office
                            </p>
                        </div>
                    </div>

                    {/* Footer Text */}
                    <div className="text-center mt-8 text-sm text-gray-500">
                        <p>&copy; 2026 GeoFarm-IS. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
