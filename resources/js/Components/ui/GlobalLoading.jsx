import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';

/**
 * "Something is happening" — once, for the whole application.
 *
 * Mounted beside the Toaster in app.jsx, so every button, link, row click and
 * form submit is covered without touching any of them. Inertia routes every
 * one of those through the same visit lifecycle, which is what makes a single
 * listener here better than a spinner added page by page: there is nothing to
 * forget on the next screen somebody builds.
 *
 * THE DELAY IS THE WHOLE DESIGN.
 *
 * Most navigations in this app finish in well under a quarter of a second.
 * An overlay that appeared instantly would flash on screen and vanish on every
 * click — which reads as the interface glitching, not as progress. So nothing
 * is shown for the first 400 ms; only a visit slow enough to leave somebody
 * wondering gets an answer.
 *
 * It also swallows clicks while visible. That is deliberate: a second click on
 * a button whose first click is still in flight is the usual way to send a
 * form twice, and on this system that means two distributions recorded
 * against one farmer.
 */

/** Below this, a visit is fast enough that saying nothing is kinder. */
const SHOW_AFTER_MS = 400;

export default function GlobalLoading() {
    const [visible, setVisible] = useState(false);
    const [percent, setPercent] = useState(null);
    const timer = useRef(null);

    useEffect(() => {
        const clear = () => {
            if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        };

        const stopStart = router.on('start', () => {
            clear();
            setPercent(null);
            timer.current = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
        });

        /*
         * Upload percentage, when there is one.
         *
         * Inertia reports this only for requests carrying files — the RSBSA
         * photo and the boundary import. A farmer's ID photograph over a
         * municipal connection is the one wait here long enough that a
         * percentage is worth more than a spinner.
         */
        const stopProgress = router.on('progress', (event) => {
            const loaded = event.detail?.progress?.percentage;
            if (typeof loaded === 'number') setPercent(Math.round(loaded));
        });

        const stopFinish = router.on('finish', () => {
            clear();
            setVisible(false);
            setPercent(null);
        });

        return () => {
            clear();
            stopStart();
            stopProgress();
            stopFinish();
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            /*
             * aria-live polite, not assertive: a screen reader should mention
             * this when it reaches a pause, not cut off whatever it was
             * reading. role="status" carries the same meaning for the ones
             * that ignore aria-live.
             */
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-[300] flex items-center justify-center bg-white/55 backdrop-blur-[1px]"
        >
            <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-white px-5 py-3.5 shadow-xl">
                <Loader2 className="h-5 w-5 animate-spin text-green-700" aria-hidden="true" />
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                        {percent === null ? 'Loading…' : `Uploading… ${percent}%`}
                    </p>
                    <p className="text-xs text-gray-500">
                        {percent === null ? 'Please wait a moment.' : 'Keep this page open until it finishes.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
