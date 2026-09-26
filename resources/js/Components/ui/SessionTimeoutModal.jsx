import { useEffect, useRef } from 'react';
import { Clock, Lock, LogOut, ShieldCheck } from 'lucide-react';
import ModalShell from './ModalShell';

/**
 * "You are about to be signed out."
 *
 * Built on ModalShell rather than a new dialog, so it portals to <body>, traps
 * focus and closes on Escape exactly as every other dialog in GeoFarm-IS does
 * — which is most of what §15 asks for, already written and already tested.
 *
 * It is deliberately NOT dismissable by clicking away. A warning you can
 * remove by brushing the backdrop is a warning that gets removed by accident,
 * and the next thing the user sees is the login page with no explanation.
 * Continue and Log out are the only two ways out, and both are honest about
 * what they do.
 */
const pad = (n) => String(n).padStart(2, '0');

export default function SessionTimeoutModal({ open, secondsLeft, locked, onContinue, onLogout }) {
    const continueRef = useRef(null);

    /*
     * Focus lands on Continue, not Log out.
     *
     * Someone returning to their desk and hitting Enter or Space to dismiss a
     * dialog should keep working, not be signed out. The destructive action is
     * never the default.
     */
    useEffect(() => {
        if (open) {
            const id = setTimeout(() => continueRef.current?.focus(), 50);
            return () => clearTimeout(id);
        }
        return undefined;
    }, [open]);

    const minutes = Math.floor(Math.max(0, secondsLeft) / 60);
    const seconds = Math.max(0, secondsLeft) % 60;

    return (
        <ModalShell
            open={open}
            // No onClose handler: see the note above. ModalShell needs the prop,
            // so it is given one that deliberately does nothing.
            onClose={() => {}}
            title={locked ? 'Session held open' : 'Session expiring'}
            size="sm"
            tone="plain"
        >
            <div className="text-center">
                <div
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
                        locked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                    aria-hidden="true"
                >
                    {locked ? <Lock className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                </div>

                {locked ? (
                    <>
                        <p className="mt-4 text-sm leading-6 text-slate-600">
                            You have been inactive, but this screen is locked, so you will
                            <span className="font-semibold text-slate-900"> not be signed out</span>.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Release the lock when the hand-out is finished.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="mt-4 text-sm leading-6 text-slate-600">
                            You have been inactive for a while. Your session will expire in
                        </p>

                        {/*
                            aria-live so a screen reader announces the countdown, but
                            "polite" and only every 10 seconds below — announcing a
                            number every second would make the dialog unusable.
                        */}
                        <p
                            className="mt-2 text-4xl font-semibold tabular-nums text-slate-900"
                            role="timer"
                            aria-live={secondsLeft % 10 === 0 ? 'polite' : 'off'}
                        >
                            {pad(minutes)}:{pad(seconds)}
                        </p>

                        <p className="mt-3 text-sm leading-6 text-slate-600">
                            Would you like to continue your session?
                        </p>
                    </>
                )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Log out
                </button>

                <button
                    ref={continueRef}
                    type="button"
                    onClick={onContinue}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
                >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {locked ? 'Dismiss' : 'Continue session'}
                </button>
            </div>

            <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">
                Sessions end automatically to protect farmer records on shared office computers.
            </p>
        </ModalShell>
    );
}
