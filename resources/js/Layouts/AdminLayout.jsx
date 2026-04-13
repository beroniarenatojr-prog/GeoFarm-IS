import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';


const nav = [
    { label: 'Dashboard',         href: '/admin', permission: null },
    { label: 'Farmers',           href: '/admin/farmers', permission: 'view farmers' },
    { label: 'Parcels',           href: '/admin/parcels', permission: 'view parcels' },
    { label: 'GIS Map',           href: '/admin/gis/map', permission: 'view maps' },
    { label: 'Seasonal Tracking', href: '/admin/seasonal', permission: 'view seasonal' },
    { label: 'Crop Estimator',    href: '/admin/crop-estimator', permission: 'view predictive' },
    { label: 'Farm Inventory',    href: '/admin/farm-inventory', permission: 'view inventory' },
    { label: 'Assistance',        href: '/admin/assistance', permission: 'view assistance' },
    { label: 'Reports',           href: '/admin/reports', permission: 'view reports' },
    { label: 'Lookups',           href: '/admin/lookups', permission: 'manage lookups' },
    { label: 'Users',             href: '/admin/users', permission: 'view users' },
    { label: 'Audit Logs',        href: '/admin/audit-logs', permission: 'view audit logs' },
];

export default function AdminLayout({ children, title, showBack = true }) {
    const { auth, flash } = usePage().props;
    const { can } = usePermissions();
    const [expanded, setExpanded] = useState(false);

    const handleBack = () => {
        window.history.back();
    };

    // Filter navigation items based on permissions
    const visibleNav = nav.filter(item => !item.permission || can(item.permission));

    return (
        <div className="min-h-screen flex">
            {/* LAYER 1: Sidebar - Deep Forest Green */}
            <aside
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={() => setExpanded(false)}
                className={`relative flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${expanded ? 'w-64' : 'w-16'} overflow-hidden`}
                style={{ 
                    background: '#006400',
                    boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
                }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 h-16 border-b border-white/10 px-3 overflow-hidden relative z-10">
                    <span className="text-2xl flex-shrink-0">🌾</span>
                    {expanded && (
                        <span className="text-base font-bold whitespace-nowrap transition-opacity duration-200 text-white">
                            GeoFarm-IS
                        </span>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex-1 py-3 space-y-0.5 overflow-hidden relative z-10">
                    {visibleNav.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={!expanded ? item.label : undefined}
                            className="flex items-center py-2.5 text-sm rounded mx-2 px-4 transition-colors hover:bg-white/15 text-white/95 hover:text-white"
                        >
                            {expanded && (
                                <span className="whitespace-nowrap">{item.label}</span>
                            )}
                            {!expanded && (
                                <span className="text-xs font-semibold">{item.label.substring(0, 2).toUpperCase()}</span>
                            )}
                        </Link>
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
            <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
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
