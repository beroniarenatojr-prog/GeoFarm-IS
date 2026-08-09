import './bootstrap';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { router } from '@inertiajs/react';
import axios from 'axios';
import '../css/app.css';

import { Toaster } from './Components/Toaster.jsx'

// Configure Axios to include CSRF token
const token = document.head.querySelector('meta[name="csrf-token"]');
if (token) {
    axios.defaults.headers.common['X-CSRF-TOKEN'] = token.content;
}

// Handle 419 errors (CSRF token mismatch) by reloading the page
router.on('error', (event) => {
    if (event.detail.errors && event.detail.errors.status === 419) {
        console.warn('CSRF token expired, reloading page...');
        window.location.reload();
    }
});

// Also handle via interceptor
axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 419) {
            console.warn('CSRF token expired, reloading page...');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

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
