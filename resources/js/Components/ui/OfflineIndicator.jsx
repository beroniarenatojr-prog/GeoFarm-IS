import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * A bar across the top of every page while the connection is gone.
 *
 * Mounted once, beside the toaster, so no screen can forget it — and so the
 * admin dashboard gets it too. Staff recording a hand-out on a tablet in a
 * barangay hall need to know the save is going to fail before they fill the
 * form in, not after.
 *
 * navigator.onLine is not a reliable test of reachability — it reports whether
 * there is a network interface, not whether the office server answers — so the
 * wording says "No connection" rather than claiming anything about the server,
 * and the bar never says a save will succeed.
 */
export default function OfflineIndicator() {
    /*
     * Assume online until told otherwise. Starting from navigator.onLine would
     * make the server-rendered markup and the first client render disagree
     * whenever the page was loaded offline, and React would warn about it.
     */
    const [online, setOnline] = useState(true);

    // Shown briefly when the connection returns, so a farmer who has been
    // waiting sees that it is worth retrying.
    const [justReconnected, setJustReconnected] = useState(false);

    useEffect(() => {
        const goOnline = () => {
            setOnline(true);
            setJustReconnected(true);
        };

        const goOffline = () => {
            setOnline(false);
            setJustReconnected(false);
        };

        setOnline(navigator.onLine);

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    useEffect(() => {
        if (!justReconnected) return undefined;

        const timer = setTimeout(() => setJustReconnected(false), 4000);

        return () => clearTimeout(timer);
    }, [justReconnected]);

    if (online && !justReconnected) return null;

    return (
        <div
            // polite, not assertive: losing signal should not interrupt a screen
            // reader mid-sentence, and the bar stays until it is true again.
            role="status"
            aria-live="polite"
            className={`fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white shadow-md ${
                online ? 'bg-[#006400]' : 'bg-gray-800'
            }`}
        >
            {online
                ? <><Wifi className="h-4 w-4" aria-hidden="true" /> Back online</>
                : <><WifiOff className="h-4 w-4" aria-hidden="true" /> No connection — your records are at the office and need a signal</>}
        </div>
    );
}
