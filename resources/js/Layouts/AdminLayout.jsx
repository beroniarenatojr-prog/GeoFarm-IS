import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';

import GlobalSearch from '@/Components/ui/GlobalSearch';
import FarmerScanButton from '@/Components/ui/FarmerScanButton';
import UserMenu from '@/Components/ui/UserMenu';
import {
    LayoutDashboard,
    Users,
    Mail,
    Bell,
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
    Boxes,
    ClipboardList
} from 'lucide-react';

/*
 * Which sidebar groups the user left open. Per-browser convenience only.
 *
 * The key carries a version because the default changed: groups now start
 * closed. Reading the old key would hand every existing user the all-open
 * state they had saved and the new default would never be seen.
 */
const SECTIONS_KEY = 'geofarm.sidebar.sections.v2';

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
            /*
             * Everything that reaches a farmer, in one place.
             *
             * The verification queue used to live only behind the header bell,
             * which meant the one screen with a number on it was also the one
             * screen not in the menu. It sits here now, beside the other way
             * the office contacts somebody, and the header no longer carries a
             * bell at all.
             */
            {
                label: 'Notifications',
                icon: Bell,
                children: [
                    { label: 'Send Email', href: '/admin/farmer-email', icon: Mail, permission: 'edit farmers' },
                    {
                        label: 'Notifications',
                        href: '/admin/farmer-verification',
                        icon: Bell,
                        permission: 'view farmers',
                        // Reads the same live count the bell did.
                        badge: 'pendingFarmers',
                    },
                ],
            },
            { label: 'Parcels', href: '/admin/parcels', icon: MapPin, permission: 'view parcels' },
            { label: 'GIS Map', href: '/admin/gis/map', icon: Globe, permission: 'view maps' },
            { label: 'Seasonal Tracking', href: '/admin/seasonal', icon: Calendar, permission: 'view seasonal' },
            // Farm Analysis takes the Crop Estimator's place in the menu. The
            // estimator answered one narrow question — how much might this
            // hectare yield — while the office's actual question is which
            // farmer needs attention and why, which is what Farm Analysis
            // answers. Its route and controller are untouched and still reachable
            // by URL; only the menu entry is replaced.
            { label: 'Farm Analysis', href: '/admin/analytics/farms', icon: TrendingUp, permission: 'view predictive' },
            // The queue the analysis feeds: work the office opened and has yet
            // to close. Guarded on assistance rather than predictive because
            // it commits staff time rather than only reporting.
            { label: 'Interventions', href: '/admin/interventions', icon: ClipboardList, permission: 'view assistance' },
            { label: 'Forecast & Advisory', href: '/admin/analytics/predictive', icon: LineChart, permission: 'view predictive' },
            //
            // Inventory is the LGU's own supply store, and it still runs behind
            // Assistance: confirming a distribution deducts stock from it. Only
            // the menu entry is gone — the module, its routes and that deduction
            // are untouched.
            // { label: 'Inventory', href: '/admin/inventory', icon: Boxes, permission: 'view supplies' },
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

export default function AdminLayout({
    children,
    title,
    showBack = true,
    // Pins the back arrow to one destination. Pages that live inside a module
    // set this to their own list so staff always land back where they came
    // from conceptually, not wherever browser history happens to point.
    backHref = null,
    backLabel = 'Go back',
    /*
     * The page has locked itself.
     *
     * Navigation away is refused by the page's own guard either way. This
     * makes that visible rather than merely broken: the back arrow shows a
     * padlock, and the sidebar is taken off screen for as long as the lock
     * holds, so the only way out on offer is releasing it.
     */
    backLocked = false,
}) {
    const page = usePage();
    const { auth } = page.props;
    const { can } = usePermissions();
    const [hovering, setHovering] = useState(false);

    // The account panel is portalled outside the sidebar, so moving the mouse
    // onto it would otherwise count as leaving and collapse the sidebar behind
    // it. Keep the sidebar open for as long as that panel is.
    const [menuOpen, setMenuOpen] = useState(false);
    const expanded = hovering || menuOpen;

    // Closed to begin with: the menu opens as three headings, and a group is
    // expanded when it is wanted. Whatever the user opens is remembered.
    const [openSections, setOpenSections] = useState(
        () => readOpenSections() ?? Object.fromEntries(nav.map(s => [s.section, false]))
    );

    const handleBack = () => {
        window.history.back();
    };

    const backClass = backLocked
        ? 'flex-shrink-0 rounded-lg p-1.5 text-amber-600 bg-amber-50 cursor-not-allowed'
        : 'flex-shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-green-50 hover:text-[#006400]';

    const backIcon = backLocked ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
    ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
    );

    const backTitle = backLocked ? 'This page is locked — unlock it to leave' : backLabel;

    /*
     * Filter navigation by permission, children included.
     *
     * A group whose every child is hidden is itself hidden — an empty
     * "Notifications" that opens onto nothing would be worse than no entry.
     */
    const allowed = item => !item.permission || can(item.permission);

    const visibleNav = nav.map(section => ({
        ...section,
        items: section.items
            .map(item => (item.children
                ? { ...item, children: item.children.filter(allowed) }
                : item))
            .filter(item => (item.children ? item.children.length > 0 : allowed(item))),
    })).filter(section => section.items.length > 0);

    // Which sidebar group owns this page, for the header breadcrumb.

    const isActive = (href) =>
        href === '/admin' ? page.url === '/admin' : page.url.startsWith(href);

    /*
     * The number on a menu item, read from the shared notification props.
     *
     * Derived live on every request rather than stored, which is why it cannot
     * drift and why a refresh cannot double it — the same reason the header
     * bell it replaces was left alone when Laravel's notifications table was
     * considered.
     */
    const badgeCount = (key) => (key ? page.props.notifications?.[key]?.count ?? 0 : 0);

    /*
     * Whether a menu entry owns the current page, nesting included.
     *
     * A group has no href of its own, so asking isActive(item.href) about one
     * compares the URL against undefined and always says no — the section
     * marker and the breadcrumb would both go blank on the pages inside it.
     */
    const entryActive = (item) => (item.children
        ? item.children.some(child => isActive(child.href))
        : isActive(item.href));

    // Which sidebar group owns this page, for the header breadcrumb. Declared
    // after entryActive, which it calls.
    const crumb = visibleNav.find(s => s.items.some(entryActive))?.section;

    const toggleSection = (name) => setOpenSections(prev => {
        // !prev[name], not prev[name] === false: a group absent from the saved
        // state is closed, and comparing against false would leave it closed
        // no matter how often its heading was clicked.
        const next = { ...prev, [name]: !prev[name] };
        try {
            localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
        } catch {
            // Not being able to remember the choice is not worth breaking over.
        }
        return next;
    });

    /*
     * The group holding the current page is NOT forced open any more.
     *
     * It used to be, so the user always had a cue for where they were. With
     * groups closed by default that rule undid the default on every single
     * page load — the current section would spring open and the menu was never
     * actually collapsed.
     *
     * The cue survives without it: a closed group holding the current page
     * shows a dot beside its heading, and the header breadcrumb names the
     * section outright.
     */

    return (
        <div className="min-h-screen flex">
            {/* LAYER 1: Sidebar - Deep Forest Green

                Hidden entirely while the page is locked. The lock exists to
                keep a clerk on one screen through a hand-out queue, and it
                already refuses navigation — but leaving the menu on screen
                invites clicks that are only answered with a refusal. A door
                that will not open is better not shown. */}
            {!backLocked && <aside
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
                    {/* The municipal seal. It is a dark emblem on white, so it
                        sits in a white roundel against the green sidebar and is
                        contained rather than cropped — object-cover would shave
                        the lettering that runs around its rim. */}
                    <img
                        src="/images/Logo.jpeg"
                        alt="Seal of the Municipality of Tumauini, Isabela"
                        className="w-10 h-10 flex-shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-white/30"
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
                        const hasActive = section.items.some(entryActive);

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
                        // Open only when explicitly opened — an unseen group is
                        // closed, which is what makes the default hold.
                        const isOpen = openSections[section.section] === true;
                        const activeCount = section.items.filter(entryActive).length;

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
                                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/50 transition-colors group-hover:text-white/80">
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

                                {/* Section Items

                                    The border-l is the guide line down the left
                                    of an opened group. It is what tells you at a
                                    glance which heading these rows belong to
                                    once two groups are open at the same time —
                                    without it the items of one run straight into
                                    the heading of the next. */}
                                {isOpen && (
                                    <div className="ml-6 space-y-0.5 border-l border-white/20 pl-2">
                                        {section.items.map(item => {
                                            const Icon = item.icon;

                                            // A group of its own, one level in.
                                            if (item.children) {
                                                const key = `${section.section}/${item.label}`;
                                                const subOpen = openSections[key] === true;
                                                const subActive = item.children.some(c => isActive(c.href));
                                                const subCount = item.children
                                                    .reduce((n, c) => n + badgeCount(c.badge), 0);

                                                return (
                                                    <div key={key}>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSection(key)}
                                                            aria-expanded={subOpen}
                                                            className={`mr-2 flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-[13px] transition-colors ${
                                                                subActive
                                                                    ? 'bg-white/20 font-semibold text-white'
                                                                    : 'text-white/95 hover:bg-white/15 hover:text-white'
                                                            }`}
                                                        >
                                                            <Icon className="h-4 w-4 flex-shrink-0" />
                                                            <span className="whitespace-nowrap">{item.label}</span>
                                                            {/* The count rides on the closed group, so a
                                                                queue waiting is visible without opening it. */}
                                                            {!subOpen && subCount > 0 && (
                                                                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                                                    {subCount > 99 ? '99+' : subCount}
                                                                </span>
                                                            )}
                                                            <ChevronDown
                                                                className={`h-3.5 w-3.5 text-white/40 transition-transform duration-200 ${
                                                                    subCount > 0 && !subOpen ? 'ml-1.5' : 'ml-auto'
                                                                } ${subOpen ? '' : '-rotate-90'}`}
                                                            />
                                                        </button>

                                                        {subOpen && (
                                                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/20 pl-2">
                                                                {item.children.map(child => {
                                                                    const ChildIcon = child.icon;
                                                                    const childActive = isActive(child.href);
                                                                    const count = badgeCount(child.badge);

                                                                    return (
                                                                        <Link
                                                                            key={child.href}
                                                                            href={child.href}
                                                                            aria-current={childActive ? 'page' : undefined}
                                                                            className={`mr-2 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-[13px] transition-colors ${
                                                                                childActive
                                                                                    ? 'bg-white/20 font-semibold text-white'
                                                                                    : 'text-white/95 hover:bg-white/15 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            <ChildIcon className="h-4 w-4 flex-shrink-0" />
                                                                            <span className="whitespace-nowrap">{child.label}</span>
                                                                            {count > 0 && (
                                                                                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                                                                    {count > 99 ? '99+' : count}
                                                                                </span>
                                                                            )}
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            const active = isActive(item.href);

                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={`mr-2 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-[13px] transition-colors ${
                                                        active
                                                            ? 'bg-white/20 text-white font-semibold'
                                                            : 'text-white/95 hover:text-white hover:bg-white/15'
                                                    }`}
                                                >
                                                    <Icon className="h-4 w-4 flex-shrink-0" />
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
            </aside>}

            {/* Main content, over plain paper and the seal.

                The left offset only clears the sidebar's collapsed width, so
                it goes with it — otherwise a locked page would sit against a
                16-unit strip of nothing. */}
            <div className={`flex-1 flex flex-col min-w-0 relative overflow-hidden ${backLocked ? '' : 'ml-16'}`}>
                {/* The paper. Flat now — the contour lines and the two green
                    washes that used to sit here have gone, so the seal is the
                    only thing behind the content. */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: '#F7FBF7' }}
                />
                
                {/*
                    The municipal seal — now the only thing behind the content.

                    Held at its own square aspect and centred rather than
                    stretched to fill: an official seal distorted across a
                    widescreen reads as a mistake, and its white surround would
                    put a bright block behind the cards. Multiply blending drops
                    that white into the paper so only the emblem tints.

                    Raised to 7% and enlarged now that it stands alone — at the
                    5% that suited it layered over contour lines it all but
                    vanished on a plain ground.
                */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 bg-center bg-no-repeat opacity-[0.07] mix-blend-multiply"
                    style={{
                        backgroundImage: "url('/images/Logo.jpeg')",
                        backgroundSize: 'min(70vw, 680px)',
                    }}
                />

                {/* z-30 keeps the header above <main> (z-10) so the notification
                    dropdown is not painted over by page content. */}
                <header className="bg-white/90 backdrop-blur-sm shadow-sm px-4 sm:px-6 py-3 relative z-30 border-b-2 border-[#006400]/70">
                    <div className="flex items-center gap-3">
                        {showBack && (backHref ? (
                            <Link href={backHref} className={backClass} title={backTitle} aria-label={backTitle}>
                                {backIcon}
                            </Link>
                        ) : (
                            <button onClick={handleBack} className={backClass} title={backTitle} aria-label={backTitle}>
                                {backIcon}
                            </button>
                        ))}

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
                            {/* Between the search and the bell: the two ways of
                                finding a farmer sit together — type the name,
                                or scan the card when you have it in hand.
                                Behind "view farmers", the same permission the
                                profile it opens is behind. */}
                            {/* The bell is gone from here. Its queue is a menu
                                item now — Records › Notifications — carrying
                                the same live count, so the one screen with a
                                number on it is no longer the one screen
                                missing from the menu. */}
                            {can('view farmers') && <FarmerScanButton />}
                        </div>
                    </div>
                </header>
                {/* Flash messages are announced globally from app.jsx, for every
                    page and every role. Repeating them as a banner here meant
                    admin screens notified twice while the farmer portal and the
                    login page said nothing at all. */}
                <main className="flex-1 p-6 relative z-10">
                    {children}
                </main>
            </div>
        </div>
    );
}
