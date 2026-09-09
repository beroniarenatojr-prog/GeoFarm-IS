import { useEffect, useRef, useState } from 'react';
import { Camera, AlertTriangle } from 'lucide-react';
import jsQR from 'jsqr';
import ModalShell from './ModalShell';

/**
 * Reads the QR on the back of a farmer's ID card using the device camera.
 *
 * Two decoders, in that order:
 *
 *   1. BarcodeDetector, the browser's own, where it exists. It is faster and
 *      hardware-accelerated, and costs nothing to use.
 *   2. jsQR otherwise.
 *
 * The fallback is not optional. BarcodeDetector ships on Android, macOS and
 * ChromeOS — but NOT on Chrome for Windows, and Brave disables it outright.
 * Windows desktop is exactly what sits on the distribution counter, so a
 * camera feature resting on the native API alone would have failed on the one
 * machine it was built for.
 *
 * The camera stream is stopped on every exit path. A viewfinder left running
 * behind a closed dialog is both a battery drain and a light on the laptop
 * that nobody can account for.
 */
export default function QrScanner({ open, onClose, onScan }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;

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

                const native = 'BarcodeDetector' in window
                    ? new window.BarcodeDetector({ formats: ['qr_code'] })
                    : null;

                /** One frame through whichever decoder this browser has. */
                const decode = async video => {
                    if (native) {
                        const found = await native.detect(video);
                        return found[0]?.rawValue ?? null;
                    }

                    // jsQR reads pixels, so the frame goes through a canvas.
                    const canvas = canvasRef.current;
                    const { videoWidth: w, videoHeight: h } = video;

                    // Zero until the stream's metadata arrives.
                    if (!canvas || !w || !h) return null;

                    canvas.width = w;
                    canvas.height = h;

                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(video, 0, 0, w, h);

                    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
                        // The card is held up to the camera, so only the normal
                        // orientation needs trying — half the work per frame.
                        inversionAttempts: 'dontInvert',
                    })?.data ?? null;
                };

                const read = async () => {
                    if (cancelled || !videoRef.current) return;

                    try {
                        const value = await decode(videoRef.current);

                        if (value) {
                            // One scan per opening: the card stays in frame for
                            // several frames after it is read, and firing on
                            // each would look up the same farmer repeatedly.
                            stop();
                            onScan(value);
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
    }, [open, onScan]);

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
            {error ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="text-sm text-red-900">{error}</p>
                </div>
            ) : (
                <div>
                    <div className="relative overflow-hidden rounded-xl bg-black">
                        <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
                        {/* Never shown. jsQR reads pixels, and this is where
                            each frame is put for it to read. */}
                        <canvas ref={canvasRef} className="hidden" />
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
