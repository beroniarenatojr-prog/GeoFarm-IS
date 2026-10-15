import './bootstrap';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { router } from '@inertiajs/react';
import '../css/app.css';


import toast from 'react-hot-toast';
import { Toaster } from './Components/Toaster.jsx'
import GlobalLoading from './Components/ui/GlobalLoading.jsx'
import OfflineIndicator from './Components/ui/OfflineIndicator.jsx'
import InstallPrompt from './Components/ui/InstallPrompt.jsx'
import { registerServiceWorker } from './utils/pwa.js'

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
    /*
     * Pages are loaded on demand, not all at once.
     *
     * An eager glob put every screen in the system into one chunk: a farmer
     * opening their dashboard on a phone downloaded the whole admin dashboard,
     * the GIS editor, the analytics charts and recharts with them — 2.8 MB
     * before anything could be drawn, on exactly the connections this app has
     * to work on.
     *
     * resolvePageComponent handles the dynamic import and, importantly, the
     * error when a chunk fails to load — which now matters, because a page
     * requested while the signal drops is a real case rather than an
     * impossibility. Inertia awaits this, so the progress bar covers the fetch.
     */
    resolve: name => resolvePageComponent(
        `./Pages/${name}.jsx`,
        import.meta.glob('./Pages/**/*.jsx'),
    ),
    setup({ el, App, props }) {
        createRoot(el).render(
            <>
                <App {...props} />
                <Toaster />
                {/*
                    One loading indicator for the whole application.

                    Every button, link, row click and form submit goes through
                    the same Inertia visit, so a single listener here covers
                    them all — and there is nothing for the next screen to
                    forget to add.
                */}
                <GlobalLoading />
                {/* Mounted here for the same reason: the connection state and
                    the install offer apply to every screen and every role. */}
                <OfflineIndicator />
                <InstallPrompt />
            </>
        );

        // A full page load carries its own flash — a redirect after login, for
        // instance — and fires no router event.
        announce(props.initialPage);

        // Last, and only in a production build. See utils/pwa.js.
        registerServiceWorker();
    },
    title: title => `${title} - GeoFarm IS`,

    /*
     * The thin bar across the top of every page change.
     *
     * Inertia shows one by default, but in Tumauini green-on-white at its
     * stock #4B5563 grey and 2 px it was effectively invisible — which is why
     * clicking a button felt like nothing had happened.
     *
     * This handles the FAST case: a 150 ms delay means an instant navigation
     * never flickers a bar, while anything slower gets a visible green line.
     * GlobalLoading handles the slow case from 400 ms. The two do not
     * overlap in purpose — one says "it is working", the other says "it is
     * still working, do not click again".
     */
    progress: {
        delay: 150,
        color: '#16a34a',
        showSpinner: true,
    },
});
