import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

/**
 * Keeps staff on one screen until they deliberately release it.
 *
 * Distribution happens at a counter with farmers queued in front of it. A
 * stray click on the header back arrow or a sidebar item throws the clerk out
 * of the programme mid-hand-out. Locking blocks every way out of the page
 * except switching the lock off again.
 *
 * What is still allowed while locked is the work itself: form submissions, and
 * any refresh of this same screen (searching the payout list, paging through
 * it). Only navigation that would leave the page is refused.
 *
 * The state is remembered per key for the tab's lifetime, so a refresh does
 * not quietly release the lock.
 */
export function usePageLock(key, { onBlocked } = {}) {
    const storageKey = `geofarm:page-lock:${key}`;

    const [locked, setLocked] = useState(() => {
        try {
            return window.sessionStorage.getItem(storageKey) === '1';
        } catch {
            return false;
        }
    });

    // The guards below are registered once and read the current values through
    // refs, so toggling the lock does not tear listeners down and rebuild them.
    const lockedRef = useRef(locked);
    const blockedRef = useRef(onBlocked);
    lockedRef.current = locked;
    blockedRef.current = onBlocked;

    useEffect(() => {
        try {
            if (locked) window.sessionStorage.setItem(storageKey, '1');
            else window.sessionStorage.removeItem(storageKey);
        } catch {
            // A tab that refuses storage still locks — it just forgets on reload.
        }
    }, [locked, storageKey]);

    useEffect(() => {
        // `before` fires for every Inertia visit — sidebar links, the header
        // back arrow, global search, router.visit — so this one guard covers
        // all of them. Returning false cancels the visit.
        const stopListening = router.on('before', (event) => {
            if (!lockedRef.current) return;

            const visit = event.detail.visit;

            // Submitting the form is the job, not an escape. Compared loosely
            // on purpose: wrongly blocking a hand-out would be far worse than
            // wrongly permitting a navigation.
            if (String(visit.method ?? 'get').toLowerCase() !== 'get') return;

            // Same screen, different query: searching and paging the payout
            // list. Blocking those would make the lock unusable.
            let pathname;
            try {
                pathname = new URL(String(visit.url), window.location.origin).pathname;
            } catch {
                return;   // unreadable target — let Inertia deal with it
            }
            if (pathname === window.location.pathname) return;

            blockedRef.current?.();
            return false;
        });

        // Covers reloads, tab closes and typed URLs, which never reach Inertia.
        // The browser shows its own wording here; ours is not used.
        const warnOnUnload = (e) => {
            if (!lockedRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', warnOnUnload);

        return () => {
            stopListening();
            window.removeEventListener('beforeunload', warnOnUnload);
        };
    }, []);

    return {
        locked,
        lock: useCallback(() => setLocked(true), []),
        unlock: useCallback(() => setLocked(false), []),
        toggle: useCallback(() => setLocked(v => !v), []),
    };
}

export default usePageLock;
