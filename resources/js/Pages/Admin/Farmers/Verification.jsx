import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Check, X, Eye, ClipboardCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/Components/ui/Card';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

export default function FarmerVerification({ submissions, filters, counts }) {
    const { can } = usePermissions();
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'pending');
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');

    const applyFilter = (nextStatus = status) => {
        setStatus(nextStatus);
        router.get('/admin/farmer-verification', { search, status: nextStatus }, { preserveState: true });
    };

    const approve = (farmer) => {
        if (!confirm(`Approve ${farmer.first_name} ${farmer.last_name}? This activates their login.`)) return;

        router.post(`/admin/farmer-verification/${farmer.id}/approve`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('Farmer verified and account activated'),
            onError: () => toast.error('Could not approve this submission'),
        });
    };

    const submitRejection = () => {
        if (!reason.trim()) {
            toast.error('Please provide a reason for rejecting');
            return;
        }

        router.post(`/admin/farmer-verification/${rejecting.id}/reject`, { rejection_reason: reason }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Submission rejected');
                setRejecting(null);
                setReason('');
            },
            onError: () => toast.error('Could not reject this submission'),
        });
    };

    return (
        <AdminLayout title="Farmer Verification">
            <Card title="">
                <div className="flex flex-col lg:flex-row gap-4 mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl">
                    <div className="flex flex-wrap gap-3 items-center flex-1">
                        <div className="relative">
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && applyFilter()}
                                placeholder="Search name or reference number..."
                                className="pl-10 pr-4 py-2.5 w-80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        </div>
                        <button
                            onClick={() => applyFilter()}
                            className="px-6 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all text-sm font-medium"
                        >
                            Search
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => applyFilter('pending')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                                status === 'pending'
                                    ? 'bg-amber-500 text-white shadow-md'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            Pending ({counts.pending})
                        </button>
                        <button
                            onClick={() => applyFilter('rejected')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                                status === 'rejected'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            Rejected ({counts.rejected})
                        </button>
                    </div>
                </div>

                {submissions.data.length === 0 ? (
                    <div className="text-center py-16">
                        <ClipboardCheck className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Nothing to review</h3>
                        <p className="text-gray-500">
                            {status === 'pending'
                                ? 'No farmers are waiting for verification right now.'
                                : 'No rejected submissions.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {submissions.data.map(farmer => (
                            <div key={farmer.id} className="border-2 border-gray-200 rounded-xl p-5 hover:border-green-300 transition">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {[farmer.first_name, farmer.middle_name, farmer.last_name, farmer.suffix]
                                                    .filter(Boolean).join(' ')}
                                            </h3>
                                            <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700">
                                                {farmer.reference_code}
                                            </span>
                                            {farmer.verification_status === 'rejected' && (
                                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                                                    REJECTED
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-500">Birthdate</p>
                                                <p className="font-medium text-gray-900">
                                                    {farmer.birthdate ? formatDate(farmer.birthdate, 'date-only') : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Barangay</p>
                                                <p className="font-medium text-gray-900">{farmer.barangay || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Livelihood</p>
                                                <p className="font-medium text-gray-900">{farmer.livelihood_type || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Parcels declared</p>
                                                <p className="font-medium text-gray-900">{farmer.parcels?.length ?? 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Contact</p>
                                                <p className="font-medium text-gray-900">{farmer.mobile_no || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Email</p>
                                                <p className="font-medium text-gray-900">{farmer.email || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Valid ID</p>
                                                <p className="font-medium text-gray-900">
                                                    {farmer.valid_id_type ? `${farmer.valid_id_type} · ${farmer.id_number ?? ''}` : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Submitted</p>
                                                <p className="font-medium text-gray-900">
                                                    {farmer.submitted_online_at ? formatDate(farmer.submitted_online_at) : '—'}
                                                </p>
                                            </div>
                                        </div>

                                        {farmer.rejection_reason && (
                                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <p className="text-xs text-red-700 font-semibold uppercase mb-1">Rejection reason</p>
                                                <p className="text-sm text-red-800">{farmer.rejection_reason}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 flex-shrink-0">
                                        <Link
                                            href={`/admin/farmers/${farmer.id}`}
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                                        >
                                            <Eye className="h-4 w-4" />
                                            View
                                        </Link>

                                        {farmer.verification_status === 'pending' && can('edit farmers') && (
                                            <>
                                                <button
                                                    onClick={() => approve(farmer)}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => { setRejecting(farmer); setReason(''); }}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
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
            </Card>

            {/* Rejection reason dialog */}
            {rejecting && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Reject submission</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            {rejecting.first_name} {rejecting.last_name} · {rejecting.reference_code}
                        </p>

                        <label htmlFor="rejection_reason" className="block text-sm font-medium text-gray-700 mb-2">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="rejection_reason"
                            name="rejection_reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={4}
                            maxLength={500}
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
                                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                            >
                                Confirm rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
