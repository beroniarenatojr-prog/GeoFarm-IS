/*
 * GeoFarm-IS service worker.
 *
 * Scope is the whole origin, so this file sits in public/ and is served from
 * /sw.js. It is deliberately hand-written rather than generated: the build
 * output in public/build is committed to git and its filenames are
 * content-hashed, so a generated precache manifest would have to be rebuilt and
 * recommitted on every deploy, and precaching it would pull the entire 2.8 MB
 * bundle plus the 468 KB MapLibre worker down on first visit — on the slow
 * connections this app is meant to work on.
 *
 * WHAT THIS CACHES
 *
 *   - an offline fallback page and the app icons, precached on install
 *   - immutable hashed build assets and static images, cached when first used
 *
 * WHAT THIS MUST NEVER CACHE, and why
 *
 *   HTML documents. This is an Inertia application: every page is server
 *   rendered with the signed-in user's own data embedded in the <div
 *   data-page> attribute. A cached document is therefore a cached copy of one
 *   person's records — their RSBSA number, their parcels, their assistance —
 *   and the Cache Storage API is shared by everyone who uses the device. On a
 *   shared phone at a barangay hall, serving a cached document would hand one
 *   farmer another farmer's record. So navigations go to the network, and when
 *   the network is not there the offline page is shown instead of anything
 *   belonging to anybody.
 *
 *   Anything authenticated. The same reasoning covers JSON endpoints, the
 *   farmer portal, the admin screens and the auth pages. Caching a response
 *   that depended on a session cookie means serving it to whoever asks next.
 *
 *   Identity documents. ID proofs are already served with
 *   "Cache-Control: private, no-store" by the controller that guards them.
 *   This worker honours no-store rather than quietly overriding it.
 *
 *   Map tiles. They are cross-origin and belong to the basemap provider, whose
 *   caching rules are expressed in their own headers. The browser's HTTP cache
 *   applies those correctly; a service worker cache would not.
 *
 * Bump CACHE_VERSION whenever this file or the offline page changes. The old
 * caches are deleted on activate.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `geofarm-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `geofarm-assets-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

/*
 * Precached on install. Small, static, and true for every user — there is
 * nothing here that belongs to a particular person.
 */
const SHELL_FILES = [
    OFFLINE_URL,
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
];

/** Paths whose responses depend on who is signed in. Never cached. */
const PRIVATE_PATHS = [
    '/admin',
    '/farmer',
    '/login',
    '/logout',
    '/register',
    '/farmer-registration',
    '/verify-otp',
    '/claim-account',
    '/password',
];

/**
 * Static files that are safe to keep: the hashed build output, the app icons
 * and the office's own images. Hashed assets are immutable by construction —
 * a change produces a new filename — so cache-first can never serve a stale
 * one.
 */
function isCacheableAsset(url) {
    return url.pathname.startsWith('/build/assets/')
        || url.pathname.startsWith('/icons/')
        || url.pathname.startsWith('/images/');
}

function isPrivatePath(url) {
    return PRIVATE_PATHS.some(
        (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_FILES))
            /*
             * Take over straight away. Safe here only because no HTML is ever
             * cached: there is no old shell that could be paired with new
             * assets, and a hashed asset the new worker does not hold is simply
             * fetched from the network.
             */
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name.startsWith('geofarm-') && name !== SHELL_CACHE && name !== ASSET_CACHE)
                    .map((name) => caches.delete(name)),
            ))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('message', (event) => {
    // Lets the page ask a waiting worker to take over, for the "update
    // available" prompt.
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    /*
     * Only GET. A POST is a state change — recording a hand-out, submitting a
     * questionnaire — and must reach the server or fail loudly, never be served
     * from a cache or replayed.
     */
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // Someone else's origin, including basemap tiles. Left entirely to the
    // browser and the provider's own headers.
    if (url.origin !== self.location.origin) {
        return;
    }

    /*
     * Navigations: network, with the offline page as the only fallback.
     *
     * Note what is NOT here — there is no cached document to fall back to, by
     * design. Showing the offline page is honest; showing a stale page of
     * somebody's farm records would not be.
     */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })),
        );
        return;
    }

    if (isPrivatePath(url)) {
        return;   // straight to the network, never cached
    }

    if (isCacheableAsset(url)) {
        event.respondWith(cacheFirst(request));
    }

    // Everything else — JSON endpoints, anything unrecognised — falls through
    // to the network untouched. The default is "do not cache".
});

/**
 * Serve from the cache, otherwise fetch and keep a copy.
 *
 * Only ever reached for immutable, non-personal files. The response is
 * inspected before it is stored: an opaque or error response must not be
 * cached (it would pin a failure until the next version bump), and a server
 * that says no-store is obeyed.
 */
async function cacheFirst(request) {
    const cached = await caches.match(request, { cacheName: ASSET_CACHE });

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);

        const directives = response.headers.get('Cache-Control') || '';
        const storable = response.ok
            && response.type === 'basic'
            && !directives.includes('no-store')
            && !directives.includes('private');

        if (storable) {
            // Cloned before the body is read: a Response body can only be
            // consumed once, and the page is the one that needs it.
            const copy = response.clone();
            const cache = await caches.open(ASSET_CACHE);
            await cache.put(request, copy);
        }

        return response;
    } catch (error) {
        /*
         * Offline and not held. Returning a 504 rather than throwing keeps the
         * failure legible in the network panel instead of surfacing as an
         * unhandled rejection in the worker.
         */
        return new Response('', {
            status: 504,
            statusText: 'Offline and this file is not in the cache.',
        });
    }
}
