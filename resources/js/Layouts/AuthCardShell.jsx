import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

/**
 * The two-panel card the sign-in, forgot-password and reset-password screens
 * all sit in.
 *
 * Extracted from Login.jsx when the password reset screens were added, rather
 * than copied into each of them: the left panel is ninety lines of municipal
 * branding, and three copies of it would drift the moment one was touched.
 *
 * Only the right-hand panel differs between the three, so that is `children`.
 */
export default function AuthCardShell({ title, children, backHref = '/', backLabel = 'Back to Home' }) {
    return (
        /*
            Tumauini's own farmland behind the sign-in card.

            bg-green-900 sits UNDER the photo on purpose. It is a 960 KB image,
            so on the office's connection there is a moment before it paints —
            and the card's left panel is white text on a transparent-to-dark
            gradient. Without a colour underneath, that text would be white on
            white until the photo arrived, and unreadable again if it ever
            failed to load.
        */
        <div
            className="relative min-h-screen flex items-center justify-center bg-green-900 bg-cover bg-center bg-no-repeat p-4 sm:p-8"
            style={{ backgroundImage: "url('/images/backgroundpage.jpeg')" }}
        >
            {/*
                A wash over the photo.

                Aerial farmland is busy and bright in patches, and a white card
                edge disappears against a pale field. This darkens it just
                enough for the card to read as sitting on top rather than
                dissolving into it, while leaving the fields clearly visible.
            */}
            <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

            {/* Centered Login Card. Above the wash. */}
            <div className="relative z-10 w-full max-w-5xl flex rounded-3xl shadow-2xl overflow-hidden bg-white">
                {/* Left Panel - Dark Green */}
                <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#004d00] via-[#006400] to-[#228B22] p-12 flex-col justify-center items-center relative overflow-hidden">
                    {/* Decorative Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-10 left-10 w-72 h-72 border-2 border-white/30 rounded-full"></div>
                        <div className="absolute bottom-10 right-10 w-96 h-96 border-2 border-white/30 rounded-full"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/20 rounded-full"></div>
                    </div>

                    {/* Content Container - Centered */}
                    <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-md">
                        {/* Logo - Large and Centered */}
                        <div className="flex flex-col items-center space-y-4">
                            <img
                                src="/images/Logo.jpeg"
                                alt="Seal of the Municipality of Tumauini, Isabela"
                                className="h-32 w-32 rounded-full bg-white object-contain p-2 ring-4 ring-white/40 shadow-2xl"
                            />
                            
                            {/* Municipal Office Title */}
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-white tracking-wide">
                                    MUNICIPAL AGRICULTURIST OFFICE
                                </h2>
                                <p className="text-[#90EE90] text-lg font-semibold tracking-wider">
                                    TUMAUINI, ISABELA
                                </p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-32 h-px bg-white/40"></div>

                        {/* System Branding */}
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-white">GeoFarm-IS</h1>
                            <p className="text-[#90EE90] text-base font-medium">
                                Geographic Farm Information System
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="w-32 h-px bg-white/40"></div>

                        {/* Tagline */}
                        <div className="space-y-3">
                            <h3 className="text-2xl font-bold text-white leading-snug">
                                Every parcel,<br />
                                <span className="text-[#FFD700] italic">mapped and known.</span>
                            </h3>
                            <p className="text-white/90 text-sm leading-relaxed">
                                Manage farmer records, monitor harvests,<br />
                                and coordinate assistance programs<br />
                                across Tumauini's fields.
                            </p>
                        </div>
                    </div>

                    {/* Footer - Absolute Bottom */}
                    <div className="absolute bottom-8 left-0 right-0 px-12">
                        <div className="relative z-10">
                            <div className="h-px bg-white/20 mb-3"></div>
                            <p className="text-white/60 text-xs text-center">
                                © 2026 GeoFarm Information System
                            </p>
                        </div>
                    </div>
                </div>


                {/* Right Panel — whichever form this screen is */}
                <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-white">
                    <div className="w-full max-w-md">
                        <Head title={title} />

                        <Link
                            href={backHref}
                            className="inline-flex items-center text-[#1a3a2e] hover:text-[#2d5a45] mb-8 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            {backLabel}
                        </Link>

                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
