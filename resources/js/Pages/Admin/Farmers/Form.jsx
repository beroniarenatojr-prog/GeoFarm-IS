import AdminLayout from '@/Layouts/AdminLayout';
import { useForm } from '@inertiajs/react';

export default function FarmerForm({ farmer }) {
    const isEdit = !!farmer;
    const { data, setData, post, put, processing, errors } = useForm({
        rsbsa_no: farmer?.rsbsa_no ?? '',
        first_name: farmer?.first_name ?? '',
        last_name: farmer?.last_name ?? '',
        middle_name: farmer?.middle_name ?? '',
        suffix: farmer?.suffix ?? '',
        birthdate: farmer?.birthdate ?? '',
        sex: farmer?.sex ?? '',
        civil_status: farmer?.civil_status ?? '',
        mobile_no: farmer?.mobile_no ?? '',
        email: farmer?.email ?? '',
        barangay: farmer?.barangay ?? '',
        city_municipality: farmer?.city_municipality ?? '',
        province: farmer?.province ?? '',
        pwd: farmer?.pwd ?? false,
        is_4ps: farmer?.is_4ps ?? false,
        is_indigenous: farmer?.is_indigenous ?? false,
        organization_name: farmer?.organization_name ?? '',
        highest_education: farmer?.highest_education ?? '',
        photo: null,
    });

    const submit = e => {
        e.preventDefault();
        isEdit
            ? put(`/admin/farmers/${farmer.id}`)
            : post('/admin/farmers');
    };

    const field = (label, key, type = 'text', opts = {}) => (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input type={type} value={data[key] ?? ''}
                onChange={e => setData(key, type === 'file' ? e.target.files[0] : e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                {...opts} />
            {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
        </div>
    );

    return (
        <AdminLayout title={isEdit ? 'Edit Farmer' : 'Add Farmer'}>
            <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 max-w-3xl space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    {field('RSBSA No.', 'rsbsa_no')}
                    {field('First Name *', 'first_name')}
                    {field('Last Name *', 'last_name')}
                    {field('Middle Name', 'middle_name')}
                    {field('Suffix', 'suffix')}
                    {field('Birthdate', 'birthdate', 'date')}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                        <select value={data.sex} onChange={e => setData('sex', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="">Select</option>
                            <option>Male</option><option>Female</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Civil Status</label>
                        <select value={data.civil_status} onChange={e => setData('civil_status', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="">Select</option>
                            <option>Single</option><option>Married</option>
                            <option>Widowed</option><option>Separated</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {field('Mobile No.', 'mobile_no')}
                    {field('Email', 'email', 'email')}
                    {field('Barangay', 'barangay')}
                    {field('City/Municipality', 'city_municipality')}
                    {field('Province', 'province')}
                    {field('Highest Education', 'highest_education')}
                </div>

                <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={data.pwd} onChange={e => setData('pwd', e.target.checked)} />
                        PWD
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={data.is_4ps} onChange={e => setData('is_4ps', e.target.checked)} />
                        4Ps Beneficiary
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={data.is_indigenous} onChange={e => setData('is_indigenous', e.target.checked)} />
                        Indigenous People
                    </label>
                </div>

                <div>
                    {field('Organization/Cooperative/Association', 'organization_name')}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                    <input type="file" accept="image/*" onChange={e => setData('photo', e.target.files[0])}
                        className="text-sm" />
                </div>

                <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={processing}
                        className="bg-green-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-800">
                        {processing ? 'Saving...' : isEdit ? 'Update Farmer' : 'Add Farmer'}
                    </button>
                    <a href="/admin/farmers" className="px-6 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</a>
                </div>
            </form>
        </AdminLayout>
    );
}
