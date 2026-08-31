import './bootstrap';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { router } from '@inertiajs/react';
import '../css/app.css';

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
