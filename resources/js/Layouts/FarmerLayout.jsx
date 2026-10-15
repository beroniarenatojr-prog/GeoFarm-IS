import { Head, router } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import FarmerTabBar from '@/Components/ui/FarmerTabBar';

/**
 * The shell the farmer portal's newer screens sit in.
 *
 * Mobile first, because this is the interface a farmer uses on a phone in a
 * field: a compact green header, generous tap targets, and the navigation at
 * the bottom where a thumb reaches.
 *
 * The dashboard, the questionnaire and the farm analysis predate this layout
 * and keep their own headers; they mount FarmerTabBar directly, so every screen
 * in the portal navigates the same way.
 */
export default function FarmerLayout({ title, subtitle, children }) {
    return (
        <div className="min-h-screen bg-gray-50">
            <Head title={title} />

            <header className="sticky top-0 z-40 bg-gradient-to-r from-[#004d00] via-[#006400] to-[#228B22] shadow-sm">
                <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
                    <img
                        src="/icons/icon-192.png"
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg bg-white/90 p-0.5"
                    />

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold leading-tight text-white">
                            {title || 'GeoFarm-IS'}
                        </p>
                        {subtitle && <p className="truncate text-xs text-white/80">{subtitle}</p>}
                    </div>

                    {/*
                        A button, not a link: signing out is a POST, so the
                        session is actually invalidated and the CSRF token
                        rotated. A GET logout can be fired by anything that
                        manages to render a link to it.
                    */}
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        aria-label="Sign out"
                        className="-mr-1 rounded-lg p-2 text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                        <LogOut className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <FarmerTabBar variant="inline" />
            </header>

            {/*
                pb-24 on small screens so the last card clears the bottom bar.
                Without it the final row of every list sits under the navigation
                and can be neither read nor tapped.
            */}
            <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:pb-10">
                {children}
            </main>

            <FarmerTabBar />
        </div>
    );
}
