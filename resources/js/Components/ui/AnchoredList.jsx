import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A suggestion list that escapes whatever is trying to clip it.
 *
 * Every type-ahead here used an absolutely-positioned list, which works right
 * up until the box sits inside something that scrolls — and the modals do:
 * ModalShell's body is overflow-y:auto so the panel can scroll without pushing
 * the buttons off screen. An absolute child of a scrolling container is cut off
 * at its edge, so in a short dialog the farmer's name appeared as a sliver with
 * the rest below the fold and no way to reach it.
 *
 * So the list is portalled to <body> and positioned fixed, measured from the
 * field it belongs to. Being outside the dialog in the DOM, nothing can clip
 * it; being fixed, it tracks the field when the page or the dialog scrolls.
 *
 * It flips above the field when there is more room up there, which is what
 * makes it usable in a dialog only a couple of rows tall.
 */
/*
 * `align` and `matchWidth` exist for the action menus.
 *
 * A type-ahead hangs under a wide input and should be exactly as wide as it,
 * left-aligned. A dropdown menu hangs off a 32 px icon button and should be
 * neither — matching that width would give a 32 px menu, and left-aligning it
 * would push it off the right edge of the table. The defaults keep every
 * existing caller behaving exactly as before.
 */
export default function AnchoredList({
    anchorRef,
    open,
    children,
    className = '',
    maxHeight = 240,
    align = 'left',
    matchWidth = true,
}) {
    const listRef = useRef(null);
    const [style, setStyle] = useState(null);

    // Before paint, so the list never shows for a frame in the wrong place.
    useLayoutEffect(() => {
        if (!open) {
            setStyle(null);
            return;
        }

        const place = () => {
            const anchor = anchorRef.current;
            if (!anchor) return;

            const rect = anchor.getBoundingClientRect();
            const below = window.innerHeight - rect.bottom;
            const above = rect.top;

            // Drop down by default; flip up only when below genuinely cannot
            // hold the list and above has more to offer.
            const flip = below < Math.min(maxHeight, 160) && above > below;
            const room = Math.max(120, Math.min(maxHeight, (flip ? above : below) - 12));

            setStyle({
                position: 'fixed',
                maxHeight: room,

                /*
                 * Right-aligned menus are pinned by their RIGHT edge, so a
                 * wide menu grows leftward into the page instead of off the
                 * side of the table it was opened from.
                 */
                ...(align === 'right'
                    ? { right: Math.max(4, window.innerWidth - rect.right) }
                    : { left: rect.left }),

                ...(matchWidth ? { width: rect.width } : {}),

                ...(flip
                    ? { bottom: window.innerHeight - rect.top + 4 }
                    : { top: rect.bottom + 4 }),
            });
        };

        place();

        // Capture phase, so scrolling inside the dialog counts and not only
        // the window. Passive: this never blocks the scroll it is following.
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);

        return () => {
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [open, anchorRef, maxHeight, align, matchWidth]);

    if (!open || !style) return null;

    return createPortal(
        <div
            ref={listRef}
            style={style}
            /*
             * Marks this as part of its field, not the page behind it.
             *
             * The type-aheads close themselves when a mousedown lands outside
             * their own element. Now that the list is portalled to <body> it IS
             * outside, so without this a click on a suggestion would be read as
             * clicking away and the box would reset instead of accepting the
             * choice. The handlers look for this attribute.
             */
            data-anchored-list=""
            // Above ModalShell's own z-index, or the list would open behind
            // the dialog it was opened from.
            className={`z-[200] overflow-y-auto overscroll-contain ${className}`}
        >
            {children}
        </div>,
        document.body,
    );
}
