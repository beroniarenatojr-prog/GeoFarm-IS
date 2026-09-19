import './bootstrap';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { router } from '@inertiajs/react';
import '../css/app.css';

import { setWorkerUrl } from 'maplibre-gl';
/*
 * Tell MapLibre where its worker actually is.
 *
 * MapLibre 6 ships the worker as a SEPARATE module (maplibre-gl-worker.mjs)
 * instead of inlining it as a blob, and it works out the URL at runtime:
 *
 *   let e = import.meta.url;
 *   let t = e.endsWith('-dev.mjs') ? 'maplibre-gl-worker-dev.mjs' : 'maplibre-gl-worker.mjs';
 *   return new URL(`./${t}`, e).href;
 *
 * Because that path is assembled from a runtime string rather than a literal
 * `new URL('./file', import.meta.url)`, Vite cannot see it, never emits the
 * file, and never rewrites the reference. In a production build the bundle
 * therefore asks for /build/assets/maplibre-gl-worker.mjs, which 404s.
 *
 * The consequence is specific and very easy to misread: raster tiles are
 * decoded on the main thread and keep working, so the satellite basemap looks
 * perfectly healthy, while EVERY GeoJSON source silently yields zero tiles —
 * because tiling GeoJSON is precisely what the worker does. That is why the
 * parcel polygons, the parcel pins, the municipal boundary and the drawing
 * preview were all invisible at once, with the data present, the layers built
 * in the right order, and no style error anywhere.
 *
 * `?worker&url` is the suffix that works, and the distinction matters:
 *
 *   ?url         copies the file verbatim and returns its path
 *   ?worker&url  BUNDLES it as a worker chunk and returns that chunk's path
 *
 * Plain `?url` is not enough here, because maplibre-gl-worker.mjs is only
 * 18 KB of glue whose first statement is
 *
 *   import{...}from"./maplibre-gl-shared.mjs"
 *
 * a 482 KB sibling. Copied verbatim into assets/, that import resolves to
 * /build/assets/maplibre-gl-shared.mjs, which does not exist — so the worker
 * was served with a 200 and then failed to initialise, which looks almost
 * identical to the 404: satellite imagery (raster, main thread) still true,
 * every GeoJSON source still false, and isStyleLoaded() false with it, because
 * a style is only "loaded" once all its sources are.
 *
 * `?worker&url` makes Vite bundle the glue and the shared module into one
 * self-contained chunk, so there is no sibling left to resolve at runtime.
 *
 * Set here, in the entry point, because all three map screens need it: the GIS
 * map, the parcel form and the farmer portal viewer.
 */
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);

import toast from 'react-hot-toast';
import { Toaster } from './Components/Toaster.jsx'

/*
 * CSRF
 *
 * Do NOT pin X-CSRF-TOKEN as an axios default. This is a single-page app, so
 * the document is never reloaded, but Laravel regenerates the session token on
 * both login (session()->regenerate()) and logout (invalidate() +
 * regenerateToken()). A token read once at boot goes stale the moment either
 * happens, and Laravel reads X-CSRF-TOKEN *before* falling back to the
 * XSRF-TOKEN cookie — so a stale header beats the cookie and every POST fails
 * with 419 "Page Expired".
 *
 * Axios already sends the XSRF-TOKEN cookie as X-XSRF-TOKEN, reading it fresh
 * on every request, and Laravel reissues that cookie on every response. That
 * path is self-healing, so leave it to do its job.
 *
 * The <meta name="csrf-token"> tag is still refreshed below for any plain
 * fetch()/form code that reads it.
 */
router.on('success', (event) => {
    const fresh = event.detail.page?.props?.csrf_token;
    const meta = document.head.querySelector('meta[name="csrf-token"]');

    if (fresh && meta && meta.content !== fresh) {
        meta.content = fresh;
    }
});

/*
 * Flash notifications
 *
 * Every outcome is announced, success or failure, on every page and for every
 * role — the admin screens, the farmer portal and the auth pages alike. This
 * lives on the router rather than in a layout so no page can be missed, and so
 * a page cannot quietly decide not to tell the user something failed.
 *
 * Announcements are keyed on flash.id, a one-shot value the server sets only
 * when there is a message. Inertia's partial reloads keep whatever props they
 * did not ask for, so without the id the previous message would be repeated
 * every time somebody typed in a search box.
 */
let lastFlashId = null;

const announce = (page) => {
    const flash = page?.props?.flash;
    if (!flash?.id || flash.id === lastFlashId) return;

    lastFlashId = flash.id;

    /*
     * Deferred by a tick so this lands AFTER any onSuccess handler the page
     * runs. Toasts share an id per outcome (see Toaster.jsx), so the last one
     * wins — and the server's message is the one worth keeping: "Distribution
     * recorded and 2 item(s) deducted from stock" beats a page's generic
     * "Saved!".
     */
    setTimeout(() => {
        if (flash.success) {
            toast.success(flash.success, { duration: 4000 });
        }

        // Failures stay longer: they usually need reading and acting on.
        if (flash.error) {
            toast.error(flash.error, { duration: 7000 });
        }
    }, 0);
};

router.on('success', (event) => announce(event.detail.page));

createInertiaApp({
    resolve: name => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        return pages[`./Pages/${name}.jsx`];
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <>
                <App {...props} />
                <Toaster />
            </>
        );

        // A full page load carries its own flash — a redirect after login, for
        // instance — and fires no router event.
        announce(props.initialPage);
    },
    title: title => `${title} - GeoFarm IS`,
});
