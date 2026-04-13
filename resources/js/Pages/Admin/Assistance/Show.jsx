import AdminLayout from '@/Layouts/AdminLayout';
import { useForm, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function AssistanceShow({ program, distributions, summary, flash }) {
    const [searchTerm, setSearchTerm] = useState('');
    const { data, setData, post, processing, reset, errors } = useForm({
        farmer_id: '', distribution_date: '', quantity_given: '', amount_given: '', notes: '',
    });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    const submit = e => {
        e.preventDefault();
        post(`/admin/assistance/${program.id}/distribute`, { 
            onSuccess: () => {
                reset();
                toast.success('Distribution recorded successfully!');
            },
            onError: (errors) => {
                console.error('Distribution errors:', errors);
                toast.error('Failed to record distribution. Please check the form.');
            }
        });
    };

    // Filter distributions based on search term
    const filteredDistributions = distributions.data.filter(d => {
        if (!searchTerm) return true;
        const farmerName = `${d.farmer?.first_name} ${d.farmer?.last_name}`.toLowerCase();
        const farmerId = d.farmer?.id?.toString() || '';
        const search = searchTerm.toLowerCase();
        return farmerName.includes(search) || farmerId.includes(search);
    });

    // Context-aware labels based on distribution type
    const distributionType = program.assistance_type?.distribution_type || 'financial';
    const labels = {
        financial: { 
            record: 'Record Distribution', 
            amount: 'Amount (₱)', 
            quantity: 'Quantity',
            action: 'Distribution'
        },
        material: { 
            record: 'Record Distribution', 
            amount: 'Value (₱)', 
            quantity: 'Quantity',
            action: 'Distribution'
        },
        training: { 
            record: 'Record Participant', 
            amount: 'Allowance (₱)', 
            quantity: 'Days Attended',
            action: 'Participation'
        },
        service: { 
            record: 'Record Service', 
            amount: 'Premium/Value (₱)', 
            quantity: 'Coverage',
            action: 'Service'
        }
    };
    const label = labels[distributionType];

    return (
        <AdminLayout title={program.program_name}>
            {/* Program Info */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">Type</p>
                        <p className="font-medium">{program.assistance_type?.type_name}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Budget</p>
                        <p className="font-medium">₱{Number(program.total_budget ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Period</p>
                        <p className="font-medium">{program.start_date} to {program.end_date}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Status</p>
                        <span className={`text-xs px-2 py-1 rounded-full
                            ${program.status === 'active' ? 'bg-green-100 text-green-700' :
                              program.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                              program.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-600'}`}>
                            {program.status}
                        </span>
                    </div>
                    {program.barangays && program.barangays.length > 0 && (
                        <div className="col-span-2">
                            <p className="text-gray-500 mb-2">Target Barangays ({program.barangays.length})</p>
                            <div className="flex flex-wrap gap-1">
                                {program.barangays.map(b => (
                                    <span key={b.id} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                                        {b.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    ['Total', summary.total],
                    ['Claimed', summary.claimed],
                    ['Pending', summary.pending],
                    ['Disbursed', `₱${Number(summary.disbursed ?? 0).toLocaleString()}`],
                ].map(([label, val]) => (
                    <div key={label} className="bg-white rounded-xl shadow-sm p-4">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-2xl font-bold text-green-700">{val}</p>
                    </div>
                ))}
            </div>

            {/* Add distribution */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">{label.record}</h3>
                {Object.keys(errors).length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800 mb-1">Please fix the following errors:</p>
                        <ul className="text-sm text-red-600 list-disc list-inside">
                            {Object.entries(errors).map(([key, message]) => (
                                <li key={key}>{message}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <form onSubmit={submit} className="grid grid-cols-3 gap-3">
                    <div>
                        <input placeholder="Farmer ID" type="number" value={data.farmer_id}
                            onChange={e => setData('farmer_id', e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-green-500 outline-none ${errors.farmer_id ? 'border-red-500' : ''}`}
                            required />
                        {errors.farmer_id && <p className="text-xs text-red-500 mt-1">{errors.farmer_id}</p>}
                    </div>
                    <div>
                        <input type="date" value={data.distribution_date}
                            onChange={e => setData('distribution_date', e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-green-500 outline-none ${errors.distribution_date ? 'border-red-500' : ''}`}
                            required />
                        {errors.distribution_date && <p className="text-xs text-red-500 mt-1">{errors.distribution_date}</p>}
                    </div>
                    <div>
                        <input placeholder={label.amount} type="number" value={data.amount_given}
                            onChange={e => setData('amount_given', e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-green-500 outline-none ${errors.amount_given ? 'border-red-500' : ''}`} />
                        {errors.amount_given && <p className="text-xs text-red-500 mt-1">{errors.amount_given}</p>}
                    </div>
                    <div>
                        <input placeholder={label.quantity} type="number" value={data.quantity_given}
                            onChange={e => setData('quantity_given', e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-green-500 outline-none ${errors.quantity_given ? 'border-red-500' : ''}`} />
                        {errors.quantity_given && <p className="text-xs text-red-500 mt-1">{errors.quantity_given}</p>}
                    </div>
                    <div>
                        <input placeholder="Notes" value={data.notes}
                            onChange={e => setData('notes', e.target.value)}
                            className={`border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-green-500 outline-none ${errors.notes ? 'border-red-500' : ''}`} />
                        {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes}</p>}
                    </div>
                    <button type="submit" disabled={processing}
                        className="bg-green-700 text-white rounded-lg text-sm hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed">
                        {processing ? 'Recording...' : 'Record'}
                    </button>
                </form>
            </div>

            {/* Distributions table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Search filter */}
                <div className="p-4 border-b bg-gray-50">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by farmer name or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-96 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                        />
                        <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    {searchTerm && (
                        <p className="text-xs text-gray-500 mt-2">
                            Found {filteredDistributions.length} result(s)
                        </p>
                    )}
                </div>
                
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Farmer</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Qty</th>
                            <th className="px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDistributions.length > 0 ? (
                            filteredDistributions.map(d => (
                                <tr key={d.id} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3">{d.farmer?.first_name} {d.farmer?.last_name}</td>
                                    <td className="px-4 py-3">{d.distribution_date}</td>
                                    <td className="px-4 py-3">₱{Number(d.amount_given ?? 0).toLocaleString()}</td>
                                    <td className="px-4 py-3">{d.quantity_given ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full
                                            ${d.status === 'claimed' ? 'bg-green-100 text-green-700' :
                                              d.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-red-100 text-red-600'}`}>
                                            {d.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                    {searchTerm ? 'No farmers found matching your search.' : 'No distributions recorded yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
