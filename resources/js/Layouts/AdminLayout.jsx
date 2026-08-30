import { useEffect, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import NotificationBell from '@/Components/ui/NotificationBell';
import GlobalSearch from '@/Components/ui/GlobalSearch';
import UserMenu from '@/Components/ui/UserMenu';
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
    LineChart,
    ChevronDown,
    FolderOpen,
    Settings,
    Boxes
} from 'lucide-react';

/** Which sidebar groups the user left open. Per-browser convenience only. */
const SECTIONS_KEY = 'geofarm.sidebar.sections';

const readOpenSections = () => {
    try {
        const raw = localStorage.getItem(SECTIONS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        // Private windows and blocked site data both throw here.
        return null;
    }
};


const nav = [
    { 
        section: 'OVERVIEW',
        icon: LayoutDashboard,
        items: [
            { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: null },
        ]
    },
    {
        section: 'RECORDS',
        icon: FolderOpen,
        items: [
            { label: 'Farmers', href: '/admin/farmers', icon: Users, permission: 'view farmers' },
            // Verification lives in the header notification bell, not here.
            { label: 'Parcels', href: '/admin/parcels', icon: MapPin, permission: 'view parcels' },
            { label: 'GIS Map', href: '/admin/gis/map', icon: Globe, permission: 'view maps' },
            { label: 'Seasonal Tracking', href: '/admin/seasonal', icon: Calendar, permission: 'view seasonal' },
            { label: 'Crop Estimator', href: '/admin/crop-estimator', icon: TrendingUp, permission: 'view predictive' },
            { label: 'Forecast & Advisory', href: '/admin/analytics/predictive', icon: LineChart, permission: 'view predictive' },
            { label: 'Inventory', href: '/admin/inventory', icon: Boxes, permission: 'view supplies' },
            { label: 'Farm Assets', href: '/admin/farm-inventory', icon: Package, permission: 'view inventory' },
            { label: 'Assistance', href: '/admin/assistance', icon: Layers, permission: 'view assistance' },
        ]
    },
    {
        section: 'SYSTEM',
        icon: Settings,
        items: [
            { label: 'Reports', href: '/admin/reports', icon: FileText, permission: 'view reports' },
            { label: 'Lookups', href: '/admin/lookups', icon: Search, permission: 'manage lookups' },
            { label: 'Users', href: '/admin/users', icon: UserCog, permission: 'view users' },
            { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileCheck, permission: 'view audit logs' },
        ]
    }
];

export default function AdminLayout({ children, title, showBack = true }) {
    const page = usePage();
    const { auth, flash } = page.props;
    const { can } = usePermissions();
    const [hovering, setHovering] = useState(false);

    // The account panel is portalled outside the sidebar, so moving the mouse
    // onto it would otherwise count as leaving and collapse the sidebar behind
    // it. Keep the sidebar open for as long as that panel is.
    const [menuOpen, setMenuOpen] = useState(false);
    const expanded = hovering || menuOpen;

    // Groups start open so nothing is hidden from a first-time user; whatever
    // they collapse is remembered.
    const [openSections, setOpenSections] = useState(
        () => readOpenSections() ?? Object.fromEntries(nav.map(s => [s.section, true]))
    );

    const handleBack = () => {
        window.history.back();
    };

    // Filter navigation items based on permissions
    const visibleNav = nav.map(section => ({
        ...section,
        items: section.items.filter(item => !item.permission || can(item.permission))
    })).filter(section => section.items.length > 0);

    // Which sidebar group owns this page, for the header breadcrumb.
    const crumb = visibleNav.find(s => s.items.some(i =>
        i.href === '/admin' ? page.url === '/admin' : page.url.startsWith(i.href)
    ))?.section;

    const isActive = (href) =>
        href === '/admin' ? page.url === '/admin' : page.url.startsWith(href);

    const toggleSection = (name) => setOpenSections(prev => {
        const next = { ...prev, [name]: prev[name] === false };
        try {
            localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
        } catch {
            // Not being able to remember the choice is not worth breaking over.
        }
        return next;
    });

    // Never leave the user on a page whose group is collapsed — they would
    // have no visible cue for where they are.
    useEffect(() => {
        const active = visibleNav.find(s => s.items.some(i => isActive(i.href)));

        if (active && openSections[active.section] === false) {
            setOpenSections(prev => ({ ...prev, [active.section]: true }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page.url]);

    return (
        <div className="min-h-screen flex">
            {/* LAYER 1: Sidebar - Deep Forest Green */}
            <aside
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
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
                    {/* Narrow rail: one icon per category, not one per page.
                        Thirteen unlabelled icons say nothing; three do. Hovering
                        the sidebar opens the full categorised menu. */}
                    {!expanded && visibleNav.map(section => {
                        const SectionIcon = section.icon ?? FolderOpen;
                        const hasActive = section.items.some(i => isActive(i.href));

                        return (
                            <div
                                key={section.section}
                                title={section.section}
                                className={`flex items-center justify-center h-11 mx-2 mb-1 rounded transition-colors ${
                                    hasActive ? 'bg-white/20 text-white' : 'text-white/70'
                                }`}
                            >
                                <SectionIcon className="h-5 w-5" />
                            </div>
                        );
                    })}

                    {expanded && visibleNav.map(section => {
                        const isOpen = openSections[section.section] !== false;
                        const activeCount = section.items.filter(i => isActive(i.href)).length;

                        return (
                            <div key={section.section} className="mb-4">
                                {/* Section Header — click to collapse */}
                                <button
                                    type="button"
                                    onClick={() => toggleSection(section.section)}
                                    aria-expanded={isOpen}
                                    title={isOpen ? `Hide ${section.section}` : `Show ${section.section}`}
                                    className="w-full flex items-center justify-between px-4 py-1.5 mb-1 group"
                                >
                                    <h3 className="text-xs font-semibold text-white/50 group-hover:text-white/80 tracking-wider transition-colors">
                                        {section.section}
                                    </h3>
                                    <span className="flex items-center gap-1.5">
                                        {/* A collapsed group holding the current page keeps a marker. */}
                                        {!isOpen && activeCount > 0 && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-[#90EE90]" />
                                        )}
                                        <ChevronDown
                                            className={`h-3.5 w-3.5 text-white/40 group-hover:text-white/70 transition-transform duration-200 ${
                                                isOpen ? '' : '-rotate-90'
                                            }`}
                                        />
                                    </span>
                                </button>

                                {/* Section Items */}
                                {isOpen && (
                                    <div className="space-y-0.5">
                                        {section.items.map(item => {
                                            const Icon = item.icon;
                                            const active = isActive(item.href);

                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={`flex items-center gap-3 py-2.5 text-sm rounded mx-2 px-3 transition-colors ${
                                                        active
                                                            ? 'bg-white/20 text-white font-semibold'
                                                            : 'text-white/95 hover:text-white hover:bg-white/15'
                                                    }`}
                                                >
                                                    <Icon className="h-5 w-5 flex-shrink-0" />
                                                    <span className="whitespace-nowrap">{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* User footer */}
                <div className="border-t border-white/10 py-3 px-4 relative z-10">
                    {/* Profile opens a panel beside the sidebar; logout lives in it. */}
                    <UserMenu expanded={expanded} onOpenChange={setMenuOpen} />
                </div>
            </aside>

            {/* LAYER 2 & 3: Main Content - Digital Parchment + Topographic Maps */}
            <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden ml-16">
                {/* Spacer for sidebar */}
                {/* Layer 2: Digital Parchment Background */}
                <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{ 
                        background: '#F7FBF7',
                        backgroundImage: `
                            radial-gradient(circle at 20% 50%, rgba(0, 100, 0, 0.03) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(0, 100, 0, 0.03) 0%, transparent 50%)
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
                
                {/* z-30 keeps the header above <main> (z-10) so the notification
                    dropdown is not painted over by page content. */}
                <header className="bg-white/90 backdrop-blur-sm shadow-sm px-4 sm:px-6 py-3 relative z-30 border-b-2 border-[#006400]/70">
                    <div className="flex items-center gap-3">
                        {showBack && (
                            <button
                                onClick={handleBack}
                                className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-green-50 hover:text-[#006400]"
                                title="Go back"
                                aria-label="Go back"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                        )}

                        <div className="min-w-0 flex-1">
                            {/* Breadcrumb: which sidebar group this page belongs to. */}
                            {crumb && (
                                <p className="hidden sm:block text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-none mb-1">
                                    {crumb} <span className="text-gray-300">›</span> {title}
                                </p>
                            )}
                            <h1 className="truncate text-lg font-bold text-gray-900 leading-tight">{title}</h1>
                        </div>

                        {/* Hidden on the narrowest screens so the title keeps its room;
                            the registry's own search still covers those cases. */}
                        <div className="hidden md:block flex-shrink-0">
                            <GlobalSearch />
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2">
                            <NotificationBell />
                        </div>
                    </div>
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
