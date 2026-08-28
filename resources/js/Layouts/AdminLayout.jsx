import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import { 
    LayoutDashboard, 
    Users, 
    MapPin, 
    Globe, 
    Calendar, 
    TrendingUp, 
    Package, 
    Layers, 
    FileText, 
    Search, 
    UserCog, 
    FileCheck,
    ClipboardCheck,
    LineChart
} from 'lucide-react';


const nav = [
    { 
        section: 'OVERVIEW',
        items: [
            { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: null },
        ]
    },
    {
        section: 'RECORDS',
        items: [
            { label: 'Farmers', href: '/admin/farmers', icon: Users, permission: 'view farmers' },
            { label: 'Verification', href: '/admin/farmer-verification', icon: ClipboardCheck, permission: 'view farmers' },
            { label: 'Parcels', href: '/admin/parcels', icon: MapPin, permission: 'view parcels' },
            { label: 'GIS Map', href: '/admin/gis/map', icon: Globe, permission: 'view maps' },
            { label: 'Seasonal Tracking', href: '/admin/seasonal', icon: Calendar, permission: 'view seasonal' },
            { label: 'Crop Estimator', href: '/admin/crop-estimator', icon: TrendingUp, permission: 'view predictive' },
            { label: 'Forecast & Advisory', href: '/admin/analytics/predictive', icon: LineChart, permission: 'view predictive' },
            { label: 'Farm Inventory', href: '/admin/farm-inventory', icon: Package, permission: 'view inventory' },
            { label: 'Assistance', href: '/admin/assistance', icon: Layers, permission: 'view assistance' },
        ]
    },
    {
        section: 'SYSTEM',
        items: [
            { label: 'Reports', href: '/admin/reports', icon: FileText, permission: 'view reports' },
            { label: 'Lookups', href: '/admin/lookups', icon: Search, permission: 'manage lookups' },
            { label: 'Users', href: '/admin/users', icon: UserCog, permission: 'view users' },
            { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileCheck, permission: 'view audit logs' },
        ]
    }
];

export default function AdminLayout({ children, title, showBack = true }) {
    const { auth, flash } = usePage().props;
    const { can } = usePermissions();
    const [expanded, setExpanded] = useState(false);

    const handleBack = () => {
        window.history.back();
    };

    // Filter navigation items based on permissions
    const visibleNav = nav.map(section => ({
        ...section,
        items: section.items.filter(item => !item.permission || can(item.permission))
    })).filter(section => section.items.length > 0);

    return (
        <div className="min-h-screen flex">
            {/* LAYER 1: Sidebar - Deep Forest Green */}
            <aside
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={() => setExpanded(false)}
                className={`fixed left-0 top-0 bottom-0 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${expanded ? 'w-64' : 'w-16'} overflow-y-auto z-50 sidebar-scroll`}
                style={{ 
                    background: '#006400',
                    boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
                }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 h-16 border-b border-white/10 px-3 overflow-hidden relative z-10">
                    <img 
                        src="/images/VTB.jpg" 
                        alt="VTB Logo" 
                        className="w-10 h-10 flex-shrink-0 rounded-lg object-cover"
                    />
                    {expanded && (
                        <span className="text-base font-bold whitespace-nowrap transition-opacity duration-200 text-white">
                            GeoFarm-IS
                        </span>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden relative z-10">
                    {visibleNav.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-6">
                            {/* Section Header */}
                            {expanded && (
                                <div className="px-4 mb-2">
                                    <h3 className="text-xs font-semibold text-white/50 tracking-wider">
                                        {section.section}
                                    </h3>
                                </div>
                            )}
                            
                            {/* Section Items */}
                            <div className="space-y-0.5">
                                {section.items.map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={!expanded ? item.label : undefined}
                                            className="flex items-center gap-3 py-2.5 text-sm rounded mx-2 px-3 transition-colors hover:bg-white/15 text-white/95 hover:text-white"
                                        >
                                            <Icon className="h-5 w-5 flex-shrink-0" />
                                            {expanded && (
                                                <span className="whitespace-nowrap">{item.label}</span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User footer */}
                <div className="border-t border-white/10 py-3 px-4 relative z-10">
                    {expanded && (
                        <div className="overflow-hidden mb-2">
                            <p className="text-white/90 text-sm truncate">{auth.user?.name}</p>
                            <p className="text-white/60 text-xs">{auth.user?.role}</p>
                        </div>
                    )}
                    <Link href="/logout" method="post" as="button"
                        className="text-red-300 hover:text-red-100 text-sm">
                        {expanded ? 'Logout' : 'Exit'}
                    </Link>
                </div>
            </aside>

            {/* LAYER 2 & 3: Main Content - Digital Parchment + Topographic Maps */}
            <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden ml-16">
                {/* Spacer for sidebar */}
                {/* Layer 2: Digital Parchment Background */}
                <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{ 
                        background: '#FAF8F3',
                        backgroundImage: `
                            radial-gradient(circle at 20% 50%, rgba(139, 69, 19, 0.02) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(139, 69, 19, 0.02) 0%, transparent 50%)
                        `
                    }}
                />
                
                {/* Layer 3: Topographic Map Lines - Soft Olive Green */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                    <defs>
                        <pattern id="topoMap" x="0" y="0" width="100%" height="200" patternUnits="userSpaceOnUse">
                            {/* Elegant horizontal contour lines */}
                            <path d="M 0,30 Q 150,25 300,30 T 600,30 T 900,30 T 1200,30 T 1500,30 T 1800,30 T 2100,30" 
                                  fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.25"/>
                            <path d="M 0,45 Q 150,40 300,45 T 600,45 T 900,45 T 1200,45 T 1500,45 T 1800,45 T 2100,45" 
                                  fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.25"/>
                            <path d="M 0,60 Q 150,55 300,60 T 600,60 T 900,60 T 1200,60 T 1500,60 T 1800,60 T 2100,60" 
                                  fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.25"/>
                            <path d="M 0,75 Q 150,72 300,75 T 600,75 T 900,75 T 1200,75 T 1500,75 T 1800,75 T 2100,75" 
                                  fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.25"/>
                            <path d="M 0,90 Q 150,87 300,90 T 600,90 T 900,90 T 1200,90 T 1500,90 T 1800,90 T 2100,90" 
                                  fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.25"/>
                            
                            {/* Elevation circles - representing hills/terrain */}
                            <ellipse cx="350" cy="100" rx="70" ry="50" fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.2"/>
                            <ellipse cx="350" cy="100" rx="50" ry="35" fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.2"/>
                            <ellipse cx="350" cy="100" rx="30" ry="22" fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.2"/>
                            
                            <ellipse cx="750" cy="100" rx="60" ry="45" fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.18"/>
                            <ellipse cx="750" cy="100" rx="40" ry="30" fill="none" stroke="#8B9D83" strokeWidth="1" opacity="0.18"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#topoMap)"/>
                </svg>
                
                <header className="bg-white/80 backdrop-blur-sm shadow-sm px-6 py-4 flex items-center gap-3 relative z-10 border-b border-gray-200/50">
                    {showBack && (
                        <button 
                            onClick={handleBack}
                            className="text-gray-600 hover:text-gray-900 transition-colors"
                            title="Go back"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                    )}
                    <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
                </header>
                <main className="flex-1 p-6 relative z-10">
                    {flash?.success && (
                        <div className="mb-4 bg-green-100 text-green-800 px-4 py-2 rounded text-sm">
                            {flash.success}
                        </div>
                    )}
                    {flash?.error && (
                        <div className="mb-4 bg-red-100 text-red-800 px-4 py-2 rounded text-sm">
                            {flash.error}
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}
