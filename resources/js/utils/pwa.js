/**
 * Service worker registration and install-prompt plumbing.
 *
 * Kept out of app.jsx so the entry point stays readable, and so none of this
 * runs during tests or in development.
 */

/** Where the worker lives. Served from public/, so its scope is the origin. */
const SW_URL = '/sw.js';

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
