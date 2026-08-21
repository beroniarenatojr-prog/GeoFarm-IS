import { Link } from '@inertiajs/react';
import { 
    MapPin, 
    Leaf, 
    Users, 
    TrendingUp, 
    FileText, 
    Shield,
    Database,
    BarChart3,
    Map,
    Sprout,
    ChevronRight
} from 'lucide-react';

export default function Landing({ canLogin }) {
    const features = [
        {
            icon: Users,
            title: 'Farmer Registry',
            description: 'Comprehensive database of farmers with RSBSA integration, demographics, and profile management.'
        },
        {
            icon: Map,
            title: 'GIS Mapping',
            description: 'Interactive farm parcel mapping with GeoJSON support for precise land boundary visualization.'
        },
        {
            icon: Database,
            title: 'Farm Inventory',
            description: 'Track crops, livestock, tree crops, and fishponds with detailed inventory management.'
        },
        {
            icon: Sprout,
            title: 'Seasonal Tracking',
            description: 'Monitor crop seasons, planting schedules, yields, and agricultural inputs year-round.'
        },
        {
            icon: TrendingUp,
            title: 'Crop Estimator',
            description: 'Predictive analytics for crop yield estimation to support planning and decision-making.'
        },
        {
            icon: FileText,
            title: 'Financial Assistance',
            description: 'Manage assistance programs, track distributions, and monitor beneficiary support.'
        },
        {
            icon: BarChart3,
            title: 'Reports & Analytics',
            description: 'Generate comprehensive reports on demographics, production, livestock, and assistance.'
        },
        {
            icon: Shield,
            title: 'Secure & Role-Based',
            description: 'Multi-level user roles with granular permissions ensuring data security and compliance.'
        }
    ];

    const stats = [
        { label: 'Farmer Profiles', value: '1,000+' },
        { label: 'Farm Parcels Mapped', value: '500+' },
        { label: 'Reports Generated', value: '5,000+' },
        { label: 'Assistance Programs', value: '50+' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FAF8F3] to-white">
            {/* Hero Section with Municipal Hall Background - Header included */}
            <section className="relative overflow-hidden min-h-[700px]">
                {/* Background Image with Overlay */}
                <div className="absolute inset-0">
                    <img 
                        src="/images/Tumauni LGU.jpg" 
                        alt="Tumauini Municipal Hall" 
                        className="w-full h-full object-cover"
                    />
                    {/* Dark overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70"></div>
                </div>

                {/* Header/Navigation - positioned over the background */}
                <nav className="relative z-50 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center space-x-3">
                                <div className="bg-white p-2 rounded-lg">
                                    <Leaf className="h-6 w-6 text-[#006400]" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white drop-shadow-md">GeoFarm-IS</h1>
                                    <p className="text-xs text-white/90">Geographic Farm Information System</p>
                                </div>
                            </div>
                            {canLogin && (
                                <Link
                                    href="/login"
                                    className="inline-flex items-center px-6 py-2.5 bg-white text-[#006400] rounded-lg hover:bg-gray-100 transition-colors duration-200 font-medium shadow-lg hover:shadow-xl"
                                >
                                    Login
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Link>
                            )}
                        </div>
                    </div>
                </nav>
                
                {/* Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
                    <div className="text-center">
                        <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full mb-6 border border-white/30">
                            <MapPin className="h-4 w-4 text-white" />
                            <span className="text-sm font-medium text-white">LGU Agriculture Office, Tumauini, Isabela</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
                            Empowering Farmers
                            <span className="block text-[#90EE90]">Through Digital Innovation</span>
                        </h1>
                        <p className="text-xl text-white/95 max-w-3xl mx-auto mb-10 drop-shadow-md">
                            Comprehensive digital solution for managing farmer data, farm parcels, 
                            agricultural inventory, and assistance programs with powerful GIS mapping and analytics.
                        </p>
                        <div className="flex justify-center gap-4">
                            {canLogin && (
                                <>
                                    <Link
                                        href="/login"
                                        className="inline-flex items-center px-8 py-4 bg-white text-[#006400] rounded-lg hover:bg-gray-100 transition-colors duration-200 font-semibold text-lg shadow-xl hover:shadow-2xl"
                                    >
                                        Get Started
                                        <ChevronRight className="ml-2 h-5 w-5" />
                                    </Link>
                                    <a
                                        href="#features"
                                        className="inline-flex items-center px-8 py-4 bg-[#006400]/90 backdrop-blur-sm text-white border-2 border-white/50 rounded-lg hover:bg-[#006400] transition-colors duration-200 font-semibold text-lg shadow-xl"
                                    >
                                        Learn More
                                    </a>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                                <div className="text-4xl font-bold text-white mb-2 drop-shadow-lg">{stat.value}</div>
                                <div className="text-sm text-white/90">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Everything you need to manage agricultural data efficiently and effectively
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className="group p-6 bg-[#FAF8F3] rounded-xl border border-gray-200 hover:border-[#006400] hover:shadow-lg transition-all duration-200"
                                >
                                    <div className="bg-[#006400] w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 bg-gradient-to-b from-[#FAF8F3] to-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-4xl font-bold text-gray-900 mb-6">
                                Why Choose GeoFarm-IS?
                            </h2>
                            <div className="space-y-6">
                                <div className="flex items-start space-x-4">
                                    <div className="bg-[#006400] p-2 rounded-lg flex-shrink-0">
                                        <Shield className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">Secure & Compliant</h3>
                                        <p className="text-gray-600">Role-based access control with comprehensive audit trails for data security and compliance.</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4">
                                    <div className="bg-[#006400] p-2 rounded-lg flex-shrink-0">
                                        <TrendingUp className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">Data-Driven Decisions</h3>
                                        <p className="text-gray-600">Powerful analytics and reporting tools to support informed agricultural planning and policy-making.</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4">
                                    <div className="bg-[#006400] p-2 rounded-lg flex-shrink-0">
                                        <Map className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">Geospatial Intelligence</h3>
                                        <p className="text-gray-600">Advanced GIS mapping capabilities for precise land management and spatial analysis.</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4">
                                    <div className="bg-[#006400] p-2 rounded-lg flex-shrink-0">
                                        <Database className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">Comprehensive Database</h3>
                                        <p className="text-gray-600">Centralized repository for all agricultural data with easy access and efficient management.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="aspect-square bg-gradient-to-br from-[#006400] to-[#8B9D83] rounded-2xl shadow-2xl flex items-center justify-center">
                                <div className="text-center text-white p-8">
                                    <MapPin className="h-24 w-24 mx-auto mb-6 opacity-90" />
                                    <h3 className="text-2xl font-bold mb-2">Built for Tumauini</h3>
                                    <p className="text-white/90">Designed specifically for local agriculture management needs</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-[#006400]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to Transform Agricultural Management?
                    </h2>
                    <p className="text-xl text-white/90 mb-10">
                        Join us in modernizing agriculture data management for better planning, monitoring, and decision-making.
                    </p>
                    {canLogin && (
                        <Link
                            href="/login"
                            className="inline-flex items-center px-8 py-4 bg-white text-[#006400] rounded-lg hover:bg-gray-100 transition-colors duration-200 font-semibold text-lg shadow-lg"
                        >
                            Access System
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </Link>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center space-x-3 mb-4 md:mb-0">
                            <div className="bg-[#006400] p-2 rounded-lg">
                                <Leaf className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[#006400]">GeoFarm-IS</h3>
                                <p className="text-xs text-gray-600">LGU Agriculture Office, Tumauini, Isabela</p>
                            </div>
                        </div>
                        <div className="text-center md:text-right text-sm text-gray-600">
                            <p>&copy; 2026 GeoFarm Information System. All rights reserved.</p>
                            <p className="text-xs mt-1">Version 1.0 | Powered by Laravel & React</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
