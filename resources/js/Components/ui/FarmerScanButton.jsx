import { useState } from 'react';
import { router } from '@inertiajs/react';
import { ScanLine, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import QrScanner from './QrScanner';

/**
 * Header shortcut: scan a farmer's ID card to open their profile.
 *
 * The counter has the card in hand more often than it has the spelling of the
 * name, so this sits beside the search box as the other way of finding
 * somebody — search when you know the name, scan when you have the card.
 *
 * The QR carries a URL, but this never navigates to it. It sends the scanned
 * text to the server, which reads the farmer id out of it and confirms the
 * record exists; only then does the app visit its own route by id. Following
 * a URL out of a QR code would mean any card-shaped sticker could send a
 * signed-in clerk anywhere.
 */
export default function FarmerScanButton() {
    const [open, setOpen] = useState(false);
    const [looking, setLooking] = useState(false);

    const resolve = async code => {
        setLooking(true);

        try {
            const res = await fetch(`/admin/farmer-scan?code=${encodeURIComponent(code)}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });

            const body = await res.json();

            if (res.ok) {
                setOpen(false);
                router.visit(`/admin/farmers/${body.id}`);
            } else {
                // The server says why: an unverified farmer, a deleted record,
                // or a QR that belongs to something else entirely.
                toast.error(body.message ?? 'That card could not be read.');
            }
        } catch {
            toast.error('Could not reach the server to look that card up.');
        } finally {
            setLooking(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Scan a farmer's ID card to open their record"
                aria-label="Scan a farmer's ID card"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-green-50 hover:text-[#006400] focus:outline-none focus:ring-2 focus:ring-green-500"
            >
                {looking
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <ScanLine className="h-5 w-5" />}
            </button>

            <QrScanner open={open} onClose={() => setOpen(false)} onScan={resolve} />
        </>
    );
}
