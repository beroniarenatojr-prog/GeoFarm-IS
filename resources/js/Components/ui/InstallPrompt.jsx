import { useEffect, useState } from 'react';
import { Download, X, Share, SquarePlus } from 'lucide-react';
import { isIos, isStandalone } from '@/utils/pwa';

/*
 * Remembering a dismissal is a per-viewer convenience, so localStorage is the
 * right place for it — it is not a session, a credential or anything personal,
 * and losing it only means the banner appears once more.
 */
const DISMISSED_KEY = 'geofarm:install-dismissed';

/** Reads survive a private window or blocked site data without throwing. */
function wasDismissed() {
    try {
        return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
        return false;
    }
}

function remember() {
    try {
        localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
        // Nothing to do. The banner simply reappears next visit.
    }
}

/**
 * Offers to install the app, when the browser actually supports it.
 *
 * Two different mechanisms, because the platforms differ:
 *
 *   Android / Chromium — fires beforeinstallprompt, which can be stored and
 *   replayed from a button. This is a real install and the banner only appears
 *   once the browser has said it is possible, so there is no button that does
 *   nothing.
 *
 *   iOS / Safari — has no such event and no programmatic install whatsoever.
 *   The only route is Share → Add to Home Screen, so the banner explains that
 *   instead of offering a button it cannot honour.
 *
 * Never shown to someone already running the installed app.
 */
export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showIosHelp, setShowIosHelp] = useState(false);
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        // Already installed, or they have said no before.
        if (isStandalone() || wasDismissed()) return undefined;

        setDismissed(false);

        if (isIos()) {
            setShowIosHelp(true);
            return undefined;
        }

        const capture = (event) => {
            // Stop Chrome's own mini-infobar so there is one prompt, at a
            // moment this app chooses, rather than two competing ones.
            event.preventDefault();
            setDeferredPrompt(event);
        };

        const installed = () => {
            setDeferredPrompt(null);
            setDismissed(true);
        };

        window.addEventListener('beforeinstallprompt', capture);
        window.addEventListener('appinstalled', installed);

        return () => {
            window.removeEventListener('beforeinstallprompt', capture);
            window.removeEventListener('appinstalled', installed);
        };
    }, []);

    const close = () => {
        setDismissed(true);
        remember();
    };

    const install = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();

        /*
         * The event can only be used once. Whether they accepted or not, it is
         * spent — so it is cleared either way, and a refusal is remembered so
         * the banner does not nag on the next page.
         */
        const { outcome } = await deferredPrompt.userChoice;

        setDeferredPrompt(null);
        setDismissed(true);

        if (outcome === 'dismissed') {
            remember();
        }
    };

    if (dismissed) return null;
    if (!deferredPrompt && !showIosHelp) return null;

    return (
        <div className="fixed inset-x-3 bottom-3 z-[55] md:left-auto md:right-4 md:w-96">
            <div className="rounded-xl border border-[#006400]/25 bg-white p-4 shadow-lg">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50">
                        <Download className="h-5 w-5 text-[#006400]" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">Install GeoFarm-IS</p>

                        {showIosHelp ? (
                            <p className="mt-1 text-xs leading-relaxed text-gray-600">
                                Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-label="Share" />{' '}
                                <b>Share</b> at the bottom of Safari, then{' '}
                                <SquarePlus className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />{' '}
                                <b>Add to Home Screen</b>.
                            </p>
                        ) : (
                            <p className="mt-1 text-xs leading-relaxed text-gray-600">
                                Add it to your home screen to open it like an app, without
                                typing the address each time.
                            </p>
                        )}

                        {deferredPrompt && (
                            <button
                                type="button"
                                onClick={install}
                                className="mt-3 w-full rounded-lg bg-[#006400] px-4 py-2 text-sm font-medium text-white hover:bg-[#004d00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006400]"
                            >
                                Install
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={close}
                        aria-label="Dismiss the install suggestion"
                        className="-m-1 shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006400]"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
