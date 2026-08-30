import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, router } from '@inertiajs/react';
import { Check, X, Eye, ClipboardCheck, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

function Detail({ label, value }) {
    return (
        <div>
            <p className="text-gray-500">{label}</p>
            <p className="font-medium text-gray-900 break-words">{value || '—'}</p>
        </div>
    );
}

export default function FarmerVerificationModal({ isOpen, onClose }) {
    const { can } = usePermissions();
    const [status, setStatus] = useState('pending');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ submissions: [], counts: { pending: 0, rejected: 0 } });
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async (nextStatus = status, nextSearch = search) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status: nextStatus });
            if (nextSearch) params.set('search', nextSearch);

            const res = await fetch(`/admin/farmer-verification/queue?${params}`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e) {
            toast.error('Could not load the verification queue.');
        } finally {
            setLoading(false);
        }
    }, [status, search]);

    // Load fresh every time it opens; the queue changes as staff work through it.
    useEffect(() => {
        if (isOpen) {
            setRejecting(null);
            setReason('');
            load(status, search);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            if (rejecting) setRejecting(null);
            else onClose();
        };

        document.addEventListener('keydown', onKeyDown);
        document.body.classList.add('overflow-hidden');

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.classList.remove('overflow-hidden');
        };
    }, [isOpen, rejecting, onClose]);

    if (!isOpen || typeof document === 'undefined') return null;

    const switchStatus = (next) => {
        setStatus(next);
        load(next, search);
    };

    const approve = (farmer) => {
        if (!confirm(`Approve ${farmer.name}? This activates their login.`)) return;

        setBusyId(farmer.id);
        router.post(`/admin/farmer-verification/${farmer.id}/approve`, {}, {
            preserveScroll: true,
            preserveState: true,
            // The redirect refreshes shared props, so the bell badge updates too.
            onSuccess: () => { toast.success('Farmer verified and account activated'); load(); },
            onError: () => toast.error('Could not approve this submission'),
            onFinish: () => setBusyId(null),
        });
    };

    const submitRejection = () => {
        if (!reason.trim()) {
            toast.error('Please provide a reason for rejecting');
            return;
        }

        setBusyId(rejecting.id);
        router.post(`/admin/farmer-verification/${rejecting.id}/reject`, { rejection_reason: reason }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                toast.success('Submission rejected');
                setRejecting(null);
                setReason('');
                load();
            },
            onError: () => toast.error('Could not reject this submission'),
            onFinish: () => setBusyId(null),
        });
    };

    // Rendered into <body>: the header owns a backdrop-filter, which makes it a
    // containing block for fixed positioning, so an inline modal would be
    // trapped inside the header's box instead of covering the viewport.
    return createPortal(
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 max-h-[90vh] flex flex-col overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-label="Farmer verification queue"
            >
                {/* header */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-[#006400] to-[#228B22] flex-shrink-0">
                    <div className="flex items-center gap-2.5 text-white">
                        <ClipboardCheck className="h-5 w-5" />
                        <h3 className="text-lg font-bold">Farmer Verification</h3>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* filters */}
                <div className="flex flex-col lg:flex-row gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
                    <div className="relative flex-1">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && load(status, search)}
                            placeholder="Search name or reference number..."
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => switchStatus('pending')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                                status === 'pending'
                                    ? 'bg-amber-500 text-white shadow-md'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            Pending ({data.counts.pending})
                        </button>
                        <button
                            onClick={() => switchStatus('rejected')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                                status === 'rejected'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            Rejected ({data.counts.rejected})
                        </button>
                    </div>
                </div>

                {/* body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Loader2 className="h-8 w-8 animate-spin mb-3" />
                            <p className="text-sm">Loading submissions…</p>
                        </div>
                    ) : data.submissions.length === 0 ? (
                        <div className="text-center py-16">
                            <ClipboardCheck className="mx-auto h-14 w-14 text-gray-300 mb-4" />
                            <h4 className="text-lg font-semibold text-gray-900 mb-1">Nothing to review</h4>
                            <p className="text-gray-500 text-sm">
                                {status === 'pending'
                                    ? 'No farmers are waiting for verification right now.'
                                    : 'No rejected submissions.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {data.submissions.map(farmer => (
                                <div
                                    key={farmer.id}
                                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-green-300 transition"
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                <h4 className="text-lg font-bold text-gray-900">{farmer.name}</h4>
                                                {farmer.reference_code && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700">
                                                        {farmer.reference_code}
                                                    </span>
                                                )}
                                                {farmer.verification_status === 'rejected' && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                                                        REJECTED
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <Detail label="Birthdate" value={farmer.birthdate ? formatDate(farmer.birthdate, 'date-only') : null} />
                                                <Detail label="Barangay" value={farmer.barangay} />
                                                <Detail label="Livelihood" value={farmer.livelihood_type} />
                                                <Detail label="Parcels declared" value={farmer.parcels_count ?? 0} />
                                                <Detail label="Contact" value={farmer.mobile_no} />
                                                <Detail label="Email" value={farmer.email} />
                                                <Detail
                                                    label="Valid ID"
                                                    value={farmer.valid_id_type
                                                        ? `${farmer.valid_id_type}${farmer.id_number ? ` · ${farmer.id_number}` : ''}`
                                                        : null}
                                                />
                                                <Detail label="Submitted" value={farmer.submitted_at ? formatDate(farmer.submitted_at) : null} />
                                            </div>

                                            {farmer.rejection_reason && (
                                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                    <p className="text-xs text-red-700 font-semibold uppercase mb-1">Rejection reason</p>
                                                    <p className="text-sm text-red-800">{farmer.rejection_reason}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex lg:flex-col gap-2 flex-shrink-0">
                                            <Link
                                                href={`/admin/farmers/${farmer.id}`}
                                                onClick={onClose}
                                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-green-600 border border-green-300 rounded-lg hover:bg-green-50 transition"
                                            >
                                                <Eye className="h-4 w-4" />
                                                View
                                            </Link>

                                            {farmer.verification_status === 'pending' && can('edit farmers') && (
                                                <>
                                                    <button
                                                        onClick={() => approve(farmer)}
                                                        disabled={busyId === farmer.id}
                                                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                                    >
                                                        <Check className="h-4 w-4" />
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => { setRejecting(farmer); setReason(''); }}
                                                        disabled={busyId === farmer.id}
                                                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* rejection reason — stacked above the queue modal */}
            {rejecting && (
                <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Reject submission</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            {rejecting.name} · {rejecting.reference_code}
                        </p>

                        <label htmlFor="rejection_reason" className="block text-sm font-medium text-gray-700 mb-2">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="rejection_reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={4}
                            maxLength={500}
                            autoFocus
                            placeholder="e.g. Documents did not match the submitted information."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />

                        <div className="flex justify-end gap-3 mt-5">
                            <button
                                onClick={() => setRejecting(null)}
                                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitRejection}
                                disabled={busyId === rejecting.id}
                                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50"
                            >
                                Confirm rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
