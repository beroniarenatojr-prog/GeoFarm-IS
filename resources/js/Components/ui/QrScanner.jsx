import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertTriangle } from 'lucide-react';
import ModalShell from './ModalShell';

/**
 * Reads the QR on the back of a farmer's ID card using the device camera.
 *
 * Built on the browser's own BarcodeDetector rather than a bundled decoder.
 * That keeps a QR library — and the megabyte it costs on a rural connection —
 * out of a build the office loads over mobile data. The trade is support:
 * Chrome and Edge have it, Firefox and iOS Safari do not, so this says so
 * plainly and the handheld scanner remains the way in on those.
 *
 * The camera stream is stopped on every exit path. A viewfinder left running
 * behind a closed dialog is both a battery drain and a light on the laptop
 * that nobody can account for.
 */
export default function QrScanner({ open, onClose, onScan }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [error, setError] = useState(null);

    const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

    useEffect(() => {
        if (!open || !supported) return;

        let cancelled = false;
        let frame = null;

        const stop = () => {
            cancelled = true;
            if (frame) cancelAnimationFrame(frame);
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        };

        (async () => {
            try {
                // The back camera on a phone or tablet; a laptop has only one
                // and ignores the hint.
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });

                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

                const read = async () => {
                    if (cancelled || !videoRef.current) return;

                    try {
                        const found = await detector.detect(videoRef.current);

                        if (found.length > 0 && found[0].rawValue) {
                            // One scan per opening: the card stays in frame for
                            // several frames after it is read, and firing on
                            // each would look up the same farmer repeatedly.
                            stop();
                            onScan(found[0].rawValue);
                            return;
                        }
                    } catch {
                        /* a frame that could not be decoded — try the next */
                    }

                    frame = requestAnimationFrame(read);
                };

                frame = requestAnimationFrame(read);
            } catch (e) {
                if (cancelled) return;

                setError(
                    e?.name === 'NotAllowedError'
                        ? 'The camera was blocked. Allow camera access for this site, then try again.'
                        : 'No camera could be opened on this device.',
                );
            }
        })();

        return stop;
    }, [open, supported, onScan]);

    if (!open) return null;

    return (
        <ModalShell
            open
            onClose={onClose}
            title="Scan the farmer's ID card"
            size="md"
            footer={
                <button type="button" onClick={onClose}
                    className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                </button>
            }
        >
            {!supported ? (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="text-sm text-amber-900">
                        <p className="font-semibold">This browser cannot use the camera to scan.</p>
                        <p className="mt-1 text-amber-800">
                            Chrome or Edge can. A handheld barcode scanner works here either
                            way — point it at the card with the farmer box focused.
                        </p>
                    </div>
                </div>
            ) : error ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="text-sm text-red-900">{error}</p>
                </div>
            ) : (
                <div>
                    <div className="relative overflow-hidden rounded-xl bg-black">
                        <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
                        {/* A frame to aim with. Purely a guide — the detector
                            reads the whole picture. */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="h-40 w-40 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                        </div>
                    </div>
                    <p className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                        <Camera className="h-3.5 w-3.5" />
                        Hold the back of the card inside the square.
                    </p>
                </div>
            )}
        </ModalShell>
    );
}
