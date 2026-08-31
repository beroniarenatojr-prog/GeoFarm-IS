import { Toaster as HotToaster } from 'react-hot-toast';

/**
 * App-wide notification surface.
 *
 * The previous styling referenced hsl(var(--background)) and friends, none of
 * which are defined in this project's CSS. An undefined custom property makes
 * the whole declaration invalid, so toasts were rendering with no background
 * of their own — unreadable over the page behind them. Real colours here.
 *
 * Success and failure are told apart by colour and by icon, not colour alone.
 */
const Toaster = () => (
    <HotToaster
        position="top-right"
        gutter={10}
        containerClassName="!z-[200]"   // above modals, which sit at z-100
        toastOptions={{
            duration: 4000,
            style: {
                maxWidth: '26rem',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1f2937',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.12), 0 4px 10px -6px rgb(0 0 0 / 0.1)',
            },
            /*
             * One slot per outcome.
             *
             * Roughly twenty pages already toast their own "Saved!" inside
             * onSuccess, and the server flashes a message for the same action.
             * Sharing an id makes the second toast REPLACE the first instead of
             * stacking, so a single save produces a single notification —
             * without rewriting thirty-five call sites, each of which also does
             * other work in that callback.
             *
             * The cost: two genuinely different successes fired at the same
             * instant would show only the later one. In practice these are
             * sequential user actions, so the newest is the one that matters.
             */
            success: {
                id: 'app-success',
                iconTheme: { primary: '#006400', secondary: '#ffffff' },
                style: { border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#14532d' },
            },
            error: {
                id: 'app-error',
                duration: 7000,
                iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
                style: { border: '1px solid #fecaca', background: '#fef2f2', color: '#7f1d1d' },
            },
        }}
    />
);

export { Toaster };
