import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The shared modal shell. Two details here are load-bearing:
 *
 * 1. It portals to <body>. The admin header uses backdrop-blur, and a filtered
 *    element becomes the containing block for its fixed-position descendants —
 *    so a modal rendered inside the layout is trapped beneath the header no
 *    matter how high its z-index climbs.
 *
 * 2. The panel is capped to the viewport and scrolls in its own body, which
 *    keeps the title bar and the footer buttons on screen. Letting the backdrop
 *    scroll instead pushes Save off the bottom of a laptop display.
 *
 * Pass as="form" with onSubmit when the footer holds a submit button, so the
 * button stays inside the form element.
 */
export default function ModalShell({
    open = true,
    onClose,
    title,
    size = 'md',
    tone = 'green',
    as: Tag = 'div',
    onSubmit,
    footer,
    bodyClass = 'p-6',
    children,
}) {
    const panel = useRef(null);
    const previouslyFocused = useRef(null);

    useEffect(() => {
        if (!open) return;
        previouslyFocused.current = document.activeElement;

        const onKey = e => {
            if (e.key === 'Escape') return onClose?.();
            if (e.key !== 'Tab' || !panel.current) return;

            // Keep Tab inside the dialog rather than walking the page behind it.
            const items = [...panel.current.querySelectorAll(FOCUSABLE)]
                .filter(el => el.offsetParent !== null);
            if (!items.length) return;

            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Next frame, so a child's own autoFocus wins if it set one.
        const frame = requestAnimationFrame(() => {
            if (panel.current && !panel.current.contains(document.activeElement)) {
                panel.current.querySelector(FOCUSABLE)?.focus();
            }
        });

        return () => {
            document.removeEventListener('keydown', onKey);
            cancelAnimationFrame(frame);
            document.body.style.overflow = previousOverflow;
            previouslyFocused.current?.focus?.();
        };
    }, [open, onClose]);

    if (!open) return null;

    const green = tone === 'green';

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            // mousedown rather than click: a text drag that starts inside the
            // panel and releases on the backdrop should not close the dialog.
            onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <Tag
                ref={panel}
                onSubmit={onSubmit}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                className={`flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${SIZES[size] ?? SIZES.md}`}
            >
                <div className={`flex shrink-0 items-center justify-between px-5 py-3 ${
                    green ? 'bg-gradient-to-r from-[#006400] to-[#228B22]' : 'border-b border-gray-100'
                }`}>
                    <h2 className={`truncate pr-3 text-sm font-bold ${green ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className={`rounded-lg p-1 ${
                            green
                                ? 'text-white/80 hover:bg-white/15 hover:text-white'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                        }`}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className={`flex-1 overflow-y-auto overscroll-contain ${bodyClass}`}>
                    {children}
                </div>

                {footer && (
                    <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
                        {footer}
                    </div>
                )}
            </Tag>
        </div>,
        document.body,
    );
}
