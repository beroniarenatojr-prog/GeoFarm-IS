import ModalShell from './ModalShell';

/**
 * Kept for existing callers. The behaviour now lives in ModalShell so every
 * dialog in the app portals, caps to the viewport and traps focus the same way.
 */
export default function Modal({ isOpen, onClose, title, children }) {
    return (
        <ModalShell open={isOpen} onClose={onClose} title={title} size="sm" tone="plain">
            {children}
        </ModalShell>
    );
}
