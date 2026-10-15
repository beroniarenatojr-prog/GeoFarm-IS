import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Share, SquarePlus, MonitorDown, Check } from 'lucide-react';
import ModalShell from '@/Components/ui/ModalShell';
import { isIos, isStandalone, promptInstall, useInstallPrompt } from '@/utils/pwa';

/**
 * "Install app" in the sidebar.
 *
 * The banner alone was not enough: it can be dismissed, and the dismissal is
 * remembered, so after one tap there was no way back to installing. This is the
 * permanent way in.
 *
 * It is shown whether or not the browser has offered an install yet, and that
 * is the point. Chrome withholds beforeinstallprompt until its own engagement
 * heuristics are met and iOS never fires it at all, so a button that hid itself
 * until the event arrived would be missing exactly when someone went looking
 * for it. When the native prompt is available this fires it; when it is not, it
 * explains how to install on the browser in front of them.
 *
 * Hidden only when the app is already running installed, where there is
 * genuinely nothing left to do.
 */
/**
 * @param expanded  Sidebar only: false collapses it to the icon.
 * @param tone      'sidebar' for the dark green rail, 'light' for a white card.
 */
export default function InstallAppButton({ expanded = true, tone = 'sidebar' }) {
    const { canInstall } = useInstallPrompt();
    const [showHelp, setShowHelp] = useState(false);

    // Read once per render rather than stored: a page open across an install
    // would otherwise keep offering it.
    if (isStandalone()) return null;

    const click = async () => {
        if (!canInstall) {
            setShowHelp(true);
            return;
        }

        const outcome = await promptInstall();

        if (outcome === 'accepted') {
            toast.success('GeoFarm-IS is installing. Look for it with your other apps.');
        } else if (outcome === 'unavailable') {
            // The event went stale between render and click. Fall back to the
            // instructions rather than doing nothing.
            setShowHelp(true);
        }
    };

    const light = tone === 'light';

    return (
        <>
            <button
                type="button"
                onClick={click}
                title={expanded ? undefined : 'Install app'}
                aria-label="Install app"
                className={light
                    ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-[#006400]/25 bg-white px-4 py-2.5 text-sm font-medium text-[#006400] transition-colors hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006400]'
                    : `flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-[13px] text-white/95 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${
                        expanded ? '' : 'justify-center'
                    }`}
            >
                <Download className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {(expanded || light) && <span className="whitespace-nowrap">Install app</span>}
            </button>

            {showHelp && <InstallHelpModal onClose={() => setShowHelp(false)} />}
        </>
    );
}

/**
 * How to install, when the browser will not do it for us.
 *
 * Platform-specific because the steps genuinely differ, and generic "add to
 * home screen" wording helps nobody standing in front of a particular menu.
 */
function InstallHelpModal({ onClose }) {
    const ios = isIos();

    return (
        <ModalShell open onClose={onClose} title="Install GeoFarm-IS" size="md">
            <p className="text-sm leading-relaxed text-gray-600">
                Installing adds GeoFarm-IS to your home screen or desktop, so it opens like an
                app without typing the address. It is the same system and the same sign-in —
                nothing is copied onto the device.
            </p>

            {ios ? (
                <Steps
                    icon={Share}
                    heading="On iPhone or iPad"
                    steps={[
                        <>Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" /> <b>Share</b> at the bottom of Safari.</>,
                        <>Scroll down and tap <SquarePlus className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" /> <b>Add to Home Screen</b>.</>,
                        <>Tap <b>Add</b>. The GeoFarm-IS icon appears with your other apps.</>,
                    ]}
                    note="Safari is the only browser on iOS that can do this — Chrome on an iPhone cannot."
                />
            ) : (
                <>
                    <Steps
                        icon={MonitorDown}
                        heading="On a computer"
                        steps={[
                            <>Look for the <b>install icon</b> in the address bar, at the right-hand end.</>,
                            <>Or open the browser menu (<b>⋮</b>) and choose <b>Install GeoFarm-IS</b> or <b>Add to desktop</b>.</>,
                        ]}
                    />

                    <Steps
                        icon={SquarePlus}
                        heading="On an Android phone"
                        steps={[
                            <>Open the browser menu (<b>⋮</b>).</>,
                            <>Choose <b>Install app</b> or <b>Add to Home screen</b>.</>,
                        ]}
                        note="Chrome sometimes waits until you have used the site a few times before it offers this. If the option is not there yet, come back after your next visit."
                    />
                </>
            )}
        </ModalShell>
    );
}

function Steps({ icon: Icon, heading, steps, note }) {
    return (
        <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Icon className="h-4 w-4 text-[#006400]" aria-hidden="true" />
                {heading}
            </h3>

            <ol className="mt-2 space-y-2">
                {steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-gray-700">
                        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#006400] text-[10px] font-bold text-white">
                            {i + 1}
                        </span>
                        <span>{step}</span>
                    </li>
                ))}
            </ol>

            {note && (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500">
                    <Check className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                    {note}
                </p>
            )}
        </section>
    );
}
