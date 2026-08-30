import './bootstrap';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { router } from '@inertiajs/react';
import '../css/app.css';

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
    },
    title: title => `${title} - GeoFarm IS`,
});
