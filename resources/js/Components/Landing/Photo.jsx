import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * A photograph slot that is presentable before the photograph exists.
 *
 * The office is still gathering pictures, so every slot on the landing page
 * goes through here. With no `src` it draws a labelled blank that says what
 * belongs there and at what size; with one it draws the photo. Either way the
 * layout is identical, so dropping the real files in later cannot reflow the
 * page.
 *
 * It also catches a src that 404s and falls back to the same blank, because the
 * browser's torn-image icon on a public municipal page reads as a broken site
 * rather than as a photo nobody has supplied yet.
 */
export default function Photo({
    photo,
    className = '',
    imageClass = '',
    /** Slow zoom on hover. Off for the decorative slots that already move. */
    zoomOnHover = true,
    /** Rendered over the photo — a caption, a badge. */
    children,
}) {
    const [failed, setFailed] = useState(false);

    const showPlaceholder = !photo?.src || failed;

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {showPlaceholder ? (
                <Blank label={photo?.label} hint={photo?.hint} />
            ) : (
                <img
                    src={photo.src}
                    alt={photo.alt ?? ''}
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                    className={`h-full w-full object-cover transition-transform duration-700 ${
                        zoomOnHover ? 'group-hover:scale-105' : ''
                    } ${imageClass}`}
                />
            )}

            {children}
        </div>
    );
}

/**
 * The blank itself.
 *
 * Styled to look deliberate rather than failed: the brand's own green, a soft
 * shimmer so it reads as "coming", and the caption naming the picture that goes
 * here. aria-hidden on the icon only — the text is real information for whoever
 * is assembling the page.
 */
function Blank({ label, hint }) {
    return (
        <div className="gf-placeholder absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#006400]/20 bg-[#F2F8F2] p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#006400]/10">
                <ImageIcon className="h-6 w-6 text-[#006400]/50" aria-hidden="true" />
            </span>

            {label && (
                <p className="text-sm font-semibold text-[#006400]/70">{label}</p>
            )}

            {hint && (
                <p className="text-xs text-[#006400]/45">{hint}</p>
            )}
        </div>
    );
}
