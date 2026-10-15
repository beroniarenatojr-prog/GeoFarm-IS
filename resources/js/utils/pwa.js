import { useSyncExternalStore } from 'react';

/**
 * Service worker registration, and the shared install state.
 *
 * The install state lives in a module-level store rather than in a component
 * because `beforeinstallprompt` fires ONCE per page load and the event can only
 * be used once. Two components each adding their own listener would race for it
 * and whichever prompted second would do nothing. Both the banner and the
 * sidebar entry read this one store instead.
 *
 * The listener is attached at module load, which is before any component
 * mounts — the browser can fire the event earlier than React renders, and a
 * listener added later simply never hears it.
 */

/** Where the worker lives. Served from public/, so its scope is the origin. */
const SW_URL = '/sw.js';

let deferredPrompt = null;
let installed = false;

const listeners = new Set();

/*
 * Cached, and only rebuilt when something actually changes.
 *
 * useSyncExternalStore compares snapshots by identity: returning a fresh object
 * from getSnapshot on every call would re-render forever.
 */
let snapshot = { canInstall: false, installed: false };

function publish() {
    snapshot = { canInstall: deferredPrompt !== null, installed };
    listeners.forEach((notify) => notify());
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        // Suppress Chrome's own mini-infobar so there is one prompt, at a
        // moment this app chooses, instead of two competing ones.
        event.preventDefault();
        deferredPrompt = event;
        publish();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        installed = true;
        publish();
    });
}

function subscribe(notify) {
    listeners.add(notify);

    return () => listeners.delete(notify);
}

const getSnapshot = () => snapshot;

/**
 * Whether this browser can install the app right now.
 *
 * `canInstall` false does not mean "never" — Chrome withholds the event until
 * its own engagement heuristics are satisfied, and iOS never fires it at all.
 * So callers should offer instructions rather than hiding themselves.
 */
export function useInstallPrompt() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Fire the browser's install dialog.
 *
 * @returns 'accepted' | 'dismissed' | 'unavailable'
 */
export async function promptInstall() {
    if (!deferredPrompt) {
        return 'unavailable';
    }

    const event = deferredPrompt;

    // Spent either way — the event cannot be prompted twice, and holding a used
    // one would leave the button looking available while doing nothing. Chrome
    // fires a fresh one on a later visit if the install was declined.
    deferredPrompt = null;
    publish();

    event.prompt();

    const { outcome } = await event.userChoice;

    return outcome;
}

/**
 * Register the service worker, in production only.
 *
 * Skipped in development deliberately: Vite serves modules from its dev server
 * with hot module replacement, and a worker caching those would mean editing a
 * file and seeing nothing change — the kind of bug that costs an hour before
 * anyone suspects the cache.
 *
 * Skipped without HTTPS for the same reason the browser would skip it: service
 * workers require a secure context, with localhost exempted so the production
 * build can be tested locally.
 */
export function registerServiceWorker() {
    if (!import.meta.env.PROD) return;
    if (!('serviceWorker' in navigator)) return;

    const secure = window.isSecureContext
        || location.hostname === 'localhost'
        || location.hostname === '127.0.0.1';

    if (!secure) return;

    // After load: registration competes with the page's own requests for
    // bandwidth, and the page matters more on a slow connection.
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(SW_URL).catch((error) => {
            // A failed registration must never break the page. The application
            // works without it; only the offline fallback is lost.
            console.warn('[pwa] Service worker registration failed:', error);
        });
    });
}

/**
 * Whether this page is running as an installed app rather than in a browser tab.
 *
 * Two checks because iOS does not support the display-mode media query for
 * home-screen apps; it sets navigator.standalone instead.
 */
export function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

/**
 * Roughly, is this an iPhone or iPad.
 *
 * Needed because iOS has no beforeinstallprompt event and no programmatic
 * install at all — the only route is Safari's Share menu, so the app has to
 * explain that by hand. iPadOS 13+ reports itself as a Mac, hence the touch
 * check.
 */
export function isIos() {
    const ua = window.navigator.userAgent;

    return /iPad|iPhone|iPod/.test(ua)
        || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
