import { Link, usePage } from '@inertiajs/react';
import { Home, Map, HandCoins, Lightbulb, User } from 'lucide-react';

/**
 * The farmer portal's primary navigation.
 *
 * A bottom bar on phones, because that is where a thumb reaches and because
 * these five destinations are the whole portal — hiding them behind a hamburger
 * would hide everything the app does. An inline row on wider screens.
 *
 * Its own component rather than part of FarmerLayout so the screens that
 * predate the layout — the dashboard, the questionnaire and the farm analysis —
 * can show the same navigation without having their existing design unpicked.
 */

export const FARMER_TABS = [
    { href: '/farmer/dashboard',   label: 'Home',       icon: Home },
    { href: '/farmer/farms',       label: 'My Farms',   icon: Map },
    { href: '/farmer/assistance',  label: 'Assistance', icon: HandCoins },
    { href: '/farmer/advisory',    label: 'Advisory',   icon: Lightbulb },
    { href: '/farmer/profile',     label: 'Profile',    icon: User },
];

/**
 * @param variant  'bottom' for the fixed phone bar, 'inline' for the row that
 *   sits under a desktop header.
 */
export default function FarmerTabBar({ variant = 'bottom' }) {
    const { url } = usePage();

    // Pathname only: a filtered or paged URL is still the same tab.
    const path = url.split('?')[0];

    if (variant === 'inline') {
        return (
            <nav aria-label="Sections" className="hidden border-t border-white/15 md:block">
                <div className="mx-auto flex max-w-5xl gap-1 px-4">
                    {FARMER_TABS.map(({ href, label, icon: Icon }) => {
                        const active = path === href;

                        return (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                    active
                                        ? 'border-white text-white'
                                        : 'border-transparent text-white/75 hover:text-white'
                                }`}
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        );
    }

    return (
        <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white md:hidden"
            /*
             * Padding for the iPhone home indicator. Paired with
             * viewport-fit=cover in the Blade head: without both, the bar either
             * floats above a white band or has its labels cut off.
             */
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <div className="flex">
                {FARMER_TABS.map(({ href, label, icon: Icon }) => {
                    const active = path === href;

                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            /*
                             * min-h-14 puts every target comfortably past the
                             * 44px minimum, for a thumb in a field rather than a
                             * mouse at a desk.
                             */
                            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#006400] ${
                                active ? 'text-[#006400]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon
                                className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`}
                                aria-hidden="true"
                            />
                            {/* Colour alone does not mark the active tab — the
                                weight changes too, and aria-current carries it
                                to a screen reader. */}
                            <span className={`text-[11px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
