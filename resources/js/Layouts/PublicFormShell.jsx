import { Head, Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';

/**
 * Minimal public wrapper used when a farmer fills the RSBSA wizard themselves.
 * Mirrors the admin page padding so the form renders identically, but without
 * the sidebar, navigation or anything that assumes an authenticated staff user.
 */
export default function PublicFormShell({ title = 'Farmer Registration', children }) {
    return (
        <div className="min-h-screen bg-gray-50">
            <Head title={title} />

            <header className="bg-[#006400] shadow-lg">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src="/images/Logo.jpeg"
                            alt="Seal of the Municipality of Tumauini, Isabela"
                            className="h-11 w-11 flex-shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-white/30"
                        />
                        <div>
                            <p className="text-lg font-bold text-white leading-tight">GeoFarm-IS</p>
                            <p className="text-xs text-white/90">RSBSA Farmer Registration</p>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-1 px-4 py-2 text-sm text-white border border-white/60 rounded-lg hover:bg-white/15 transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back to home
                    </Link>
                </div>
            </header>

            <main className="py-8 px-4 sm:px-6 lg:px-8">{children}</main>

            <footer className="py-6 text-center text-sm text-gray-500">
                LGU Agriculture Office, Tumauini, Isabela
            </footer>
        </div>
    );
}
