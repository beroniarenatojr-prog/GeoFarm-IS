import AdminLayout from '@/Layouts/AdminLayout';
import { useForm } from '@inertiajs/react';

export default function AssistanceForm({ program, assistanceTypes = [], barangays = [] }) {
    const isEdit = !!program;
    
    // Helper to format date from Laravel for input[type="date"]
    const formatDate = (date) => {
        if (!date) return '';
        
        // If it's already a string in YYYY-MM-DD format
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
            return date.split(' ')[0]; // Remove time if present
        }
        
        // If it's a Carbon object serialization
        if (typeof date === 'object' && date.date) {
            return date.date.split(' ')[0];
        }
        
        // Try to parse as Date
        try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
        } catch (e) {
            console.error('Date parsing error:', e);
        }
        
        return '';
    };
    
    const { data, setData, post, put, processing, errors } = useForm({
        program_name:        program?.program_name ?? '',
        assistance_type_id:  program?.assistance_type_id ?? '',
        description:         program?.description ?? '',
        total_budget:        program?.total_budget ?? '',
        start_date:          formatDate(program?.start_date),
        end_date:            formatDate(program?.end_date),
        status:              program?.status ?? 'draft',
        barangay_ids:        program?.barangays?.map(b => b.id) ?? [],
    });

    const toggleBarangay = (id) => {
        setData('barangay_ids', 
            data.barangay_ids.includes(id) 
                ? data.barangay_ids.filter(bid => bid !== id)
                : [...data.barangay_ids, id]
        );
    };

    const selectAllBarangays = () => {
        setData('barangay_ids', barangays.map(b => b.id));
    };

    const clearAllBarangays = () => {
        setData('barangay_ids', []);
    };

    const submit = e => {
        e.preventDefault();
        isEdit ? put(`/admin/assistance/${program.id}`) : post('/admin/assistance');
    };

    return (
        <AdminLayout title={isEdit ? 'Edit Program' : 'New Agricultural Assistance Program'}>
            <div className="max-w-4xl mx-auto">
                <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Program Name</label>
                        <input value={data.program_name} onChange={e => setData('program_name', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            required />
                        {errors.program_name && <p className="text-red-500 text-xs mt-1">{errors.program_name}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assistance Type</label>
                        <select value={data.assistance_type_id} onChange={e => setData('assistance_type_id', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            required>
                            <option value="">Select type</option>
                            {assistanceTypes.map(type => (
                                <option key={type.id} value={type.id}>
                                    {type.category} - {type.type_name}
                                </option>
                            ))}
                        </select>
                        {errors.assistance_type_id && <p className="text-red-500 text-xs mt-1">{errors.assistance_type_id}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea value={data.description} onChange={e => setData('description', e.target.value)} rows={3}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget (₱)</label>
                        <input type="number" step="0.01" value={data.total_budget} onChange={e => setData('total_budget', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            required />
                        {errors.total_budget && <p className="text-red-500 text-xs mt-1">{errors.total_budget}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input type="date" value={data.start_date} onChange={e => setData('start_date', e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                required />
                            {errors.start_date && <p className="text-red-500 text-xs mt-1">{errors.start_date}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input type="date" value={data.end_date} onChange={e => setData('end_date', e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                required />
                            {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date}</p>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select value={data.status} onChange={e => setData('status', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        {errors.status && <p className="text-red-500 text-xs mt-1">{errors.status}</p>}
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">Target Barangays</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={selectAllBarangays}
                                    className="text-xs text-green-700 hover:underline">
                                    Select All
                                </button>
                                <button type="button" onClick={clearAllBarangays}
                                    className="text-xs text-gray-600 hover:underline">
                                    Clear All
                                </button>
                            </div>
                        </div>
                        <div className="border rounded-lg p-3 max-h-64 overflow-y-auto bg-gray-50">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {barangays.map(barangay => (
                                    <label key={barangay.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded">
                                        <input type="checkbox"
                                            checked={data.barangay_ids.includes(barangay.id)}
                                            onChange={() => toggleBarangay(barangay.id)}
                                            className="rounded text-green-700 focus:ring-green-500" />
                                        <span className="text-gray-700">{barangay.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {data.barangay_ids.length === 0 
                                ? 'No barangays selected - program will be available to all barangays' 
                                : `${data.barangay_ids.length} barangay(s) selected`}
                        </p>
                        {errors.barangay_ids && <p className="text-red-500 text-xs mt-1">{errors.barangay_ids}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={processing}
                            className="bg-green-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-800 disabled:opacity-50">
                            {processing ? 'Saving...' : isEdit ? 'Update' : 'Create Program'}
                        </button>
                        <a href="/admin/assistance" className="px-6 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</a>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
