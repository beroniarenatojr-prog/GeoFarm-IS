import axios from 'axios';

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

/*
 * CSRF is deliberately NOT configured by hand here.
 *
 * axios already reads the XSRF-TOKEN cookie on every request and sends it as
 * X-XSRF-TOKEN, and Laravel reissues that cookie on every response — so the
 * value is always current, including straight after login or logout, when the
 * session token is regenerated.
 *
 * Pinning X-CSRF-TOKEN from the <meta> tag (as this file used to) breaks that.
 * The document is never reloaded in a single-page app, so the pinned value
 * goes stale as soon as the session regenerates, and Laravel checks
 * X-CSRF-TOKEN *before* the cookie — meaning the stale header wins and every
 * POST fails with 419 "Page Expired". Logging out and back in reproduced it
 * every time.
 */
