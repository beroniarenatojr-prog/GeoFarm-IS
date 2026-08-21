import { useForm, Link } from '@inertiajs/react';
import { Leaf, MapPin, Lock, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({
        email: '', password: '', remember: false,
    });

    const [showPassword, setShowPassword] = useState(false);

    const submit = e => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Decorative Panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#006400] via-[#228B22] to-[#32CD32] relative overflow-hidden">
                {/* Animated Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse delay-1000"></div>
                </div>
                
                <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
                    {/* Logo & Branding */}
                    <div>
                        <div className="flex items-center space-x-3 mb-8">
                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl">
                                <Leaf className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">GeoFarm-IS</h1>
                                <p className="text-white/80 text-sm">Geographic Farm Information System</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4 max-w-md">
                            <h2 className="text-4xl font-bold leading-tight">
                                Modern Agriculture Management System
                            </h2>
                            <p className="text-white/90 text-lg">
                                Comprehensive digital solution for managing farmer data, farm parcels, and agricultural programs.
                            </p>
                        </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <span className="text-sm">GIS Mapping & Spatial Analysis</span>
                        </div>
                        <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Leaf className="h-5 w-5" />
                            </div>
                            <span className="text-sm">Crop & Livestock Inventory Tracking</span>
                        </div>
                        <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Lock className="h-5 w-5" />
                            </div>
                            <span className="text-sm">Secure Role-Based Access Control</span>
                        </div>
                    </div>

                    {/* Location Badge */}
                    <div className="flex items-center space-x-2 text-white/80">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">LGU Agriculture Office, Tumauini, Isabela</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#FAF8F3]">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex items-center space-x-3 bg-[#006400] text-white px-6 py-3 rounded-2xl mb-4">
                            <Leaf className="h-6 w-6" />
                            <span className="text-xl font-bold">GeoFarm-IS</span>
                        </div>
                    </div>

                    {/* Back to Home Link */}
                    <Link 
                        href="/" 
                        className="inline-flex items-center text-[#006400] hover:text-[#005200] mb-6 transition-colors group"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>

                    {/* Login Card */}
                    <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back!</h2>
                            <p className="text-gray-600">Sign in to access your dashboard</p>
                        </div>

                        <form onSubmit={submit} className="space-y-6">
                            {/* Email Field */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Email Address
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
                                        placeholder="admin@geofarm.local"
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
                                    Password
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
                                        placeholder="Enter your password"
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

                            {/* Remember Me */}
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="remember"
                                    checked={data.remember}
                                    onChange={e => setData('remember', e.target.checked)}
                                    className="h-4 w-4 text-[#006400] focus:ring-[#006400] border-gray-300 rounded cursor-pointer"
                                />
                                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                                    Remember me for 30 days
                                </label>
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
                                        Signing in...
                                    </span>
                                ) : 'Sign In to Dashboard'}
                            </button>
                        </form>

                        {/* Additional Info */}
                        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                            <p className="text-sm text-gray-600">
                                Are you a registered farmer in Tumauini?{' '}
                                <Link href="/register" className="text-[#006400] font-semibold hover:text-[#005200] transition-colors">
                                    Create an account
                                </Link>
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                Need access? Contact your system administrator
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
