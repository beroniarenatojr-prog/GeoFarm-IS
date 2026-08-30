import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, usePage } from '@inertiajs/react';
import { LogOut, Mail, ShieldCheck, ChevronRight, UserRound } from 'lucide-react';

/**
 * The signed-in user's block at the foot of the sidebar. Clicking it opens a
 * small panel beside the sidebar holding their details and the logout control.
 *
 * The panel is portalled to <body>: the sidebar sets overflow-y-auto, which
 * would otherwise clip anything extending past its edge.
 */
export default function UserMenu({ expanded, onOpenChange }) {
    const page = usePage();
    const user = page.props.auth?.user;

    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState(null);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);

    const place = () => {
        if (triggerRef.current) {
            setRect(triggerRef.current.getBoundingClientRect());
        }
    };

    // Inertia reuses this layout across page changes, so the panel's state
    // survives navigation unless it is closed explicitly.
    useEffect(() => {
        setOpen(false);
    }, [page.url]);

    // Let the sidebar know, so it does not collapse out from under the panel.
    useEffect(() => {
        onOpenChange?.(open);
    }, [open, onOpenChange]);

    // The trigger moves when the sidebar changes width; follow it.
    useEffect(() => {
        if (open) {
            place();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded]);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (e) => {
            if (
                !triggerRef.current?.contains(e.target)
                && !panelRef.current?.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        const onKeyDown = (e) => e.key === 'Escape' && setOpen(false);

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open]);

    if (!user) return null;

    const initials = (user.name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase();

    const toggle = () => {
        place();
        setOpen(o => !o);
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
                title={!expanded ? user.name : undefined}
                className={`w-full flex items-center rounded-lg transition-colors hover:bg-white/15 ${
                    open ? 'bg-white/15' : ''
                } ${expanded ? 'gap-3 px-2 py-2' : 'justify-center py-2'}`}
            >
                <span className="flex-shrink-0 h-9 w-9 rounded-full bg-white/20 text-white font-bold text-xs flex items-center justify-center">
                    {initials || '?'}
                </span>

                {expanded && (
                    <>
                        <span className="min-w-0 flex-1 text-left">
                            <span className="block text-white/95 text-sm truncate">{user.name}</span>
                            <span className="block text-white/60 text-xs truncate">{user.role}</span>
                        </span>
                        <ChevronRight
                            className={`h-4 w-4 text-white/50 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                        />
                    </>
                )}
            </button>

            {open && rect && typeof document !== 'undefined' && createPortal(
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label="Account"
                    className="fixed z-[60] w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                    style={{
                        left: rect.right + 10,
                        // Sits level with the trigger, but never off the top.
                        top: Math.max(8, Math.min(rect.bottom - 190, window.innerHeight - 260)),
                    }}
                >
                    <div className="px-4 py-3 bg-gradient-to-r from-[#006400] to-[#228B22] flex items-center gap-3">
                        <span className="h-10 w-10 rounded-full bg-white/20 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                            {initials || '?'}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-white font-semibold text-sm truncate">{user.name}</span>
                            <span className="block text-white/75 text-xs truncate">{user.role}</span>
                        </span>
                    </div>

                    <div className="px-4 py-3 space-y-2">
                        <div className="flex items-start gap-2.5">
                            <Mail className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700 break-all">{user.email}</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <ShieldCheck className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">{user.role}</span>
                        </div>
                    </div>

                    <Link
                        href="/admin/profile"
                        onClick={() => setOpen(false)}
                        className="w-full flex items-center justify-between gap-2.5 px-4 py-3 text-sm font-semibold
                                   text-[#006400] border-t border-gray-100 hover:bg-green-50 transition-colors"
                    >
                        <span className="flex items-center gap-2.5">
                            <UserRound className="h-4 w-4" />
                            My Profile
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                    </Link>

                    <Link
                        href="/logout"
                        method="post"
                        as="button"
                        onClick={() => setOpen(false)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-red-600
                                   border-t border-gray-100 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Link>
                </div>,
                document.body
            )}
        </>
    );
}
