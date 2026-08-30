import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Bell, ClipboardCheck, ChevronRight } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import FarmerVerificationModal from '@/Components/ui/FarmerVerificationModal';

/** "just now" / "3h ago" / "2d ago" — precise enough for a queue that is
 *  reviewed the same week, and shorter than a full timestamp. */
function relativeTime(iso) {
    if (!iso) return null;

    const then = new Date(iso);
    if (isNaN(then.getTime())) return null;

    const seconds = Math.floor((Date.now() - then.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotificationBell() {
    const { can } = usePermissions();
    const { notifications } = usePage().props;
    const [open, setOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const wrapperRef = useRef(null);

    /** Review happens in a modal so staff keep the page they were working on. */
    const openQueue = () => {
        setOpen(false);
        setModalOpen(true);
    };

    const pending = notifications?.pendingFarmers ?? { count: 0, recent: [] };
    const count = pending.count ?? 0;

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    // Same gate as the verification queue itself.
    if (!can('view farmers')) return null;

    const label = count > 0
        ? `${count} farmer registration${count === 1 ? '' : 's'} awaiting review`
        : 'No pending registrations';

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                title={label}
                aria-label={label}
                aria-haspopup="true"
                aria-expanded={open}
                className={`gf-ring-stop relative flex items-center justify-center h-10 w-10 rounded-xl transition-colors ${
                    count > 0
                        ? 'text-[#006400] hover:bg-green-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
                {/* Only swings while something is actually waiting. */}
                <Bell className={`h-5 w-5 ${count > 0 ? 'gf-ring' : ''}`} />

                {count > 0 && (
                    <>
                        {/* pulse ring draws the eye when something is waiting */}
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        </span>
                        <span className="gf-ring-badge absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold shadow ring-2 ring-white">
                            {count > 99 ? '99+' : count}
                        </span>
                    </>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#006400] to-[#228B22]">
                        <div className="flex items-center gap-2 text-white">
                            <ClipboardCheck className="h-4 w-4" />
                            <span className="font-semibold text-sm">Farmer Verification</span>
                        </div>
                        {count > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">
                                {count} pending
                            </span>
                        )}
                    </div>

                    {pending.recent?.length > 0 ? (
                        <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                            {pending.recent.map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={openQueue}
                                        className="block w-full text-left px-4 py-3 hover:bg-green-50/60 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">
                                                    {item.name || 'Unnamed registration'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                    Registered online
                                                    {item.barangay ? ` · ${item.barangay}` : ''}
                                                </p>
                                                {item.reference_code && (
                                                    <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                                                        {item.reference_code}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                                                {relativeTime(item.submitted_at)}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="px-4 py-10 text-center">
                            <ClipboardCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No pending registrations</p>
                            <p className="text-xs text-gray-400 mt-1">
                                New online sign-ups will appear here.
                            </p>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={openQueue}
                        className="flex w-full items-center justify-center gap-1 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-[#006400] border-t border-gray-100 transition-colors"
                    >
                        Open verification queue
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}

            <FarmerVerificationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
    );
}
