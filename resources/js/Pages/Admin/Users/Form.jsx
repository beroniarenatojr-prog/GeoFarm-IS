import AdminLayout from '@/Layouts/AdminLayout';
import { useForm } from '@inertiajs/react';

export default function UserForm({ user, roles }) {
    const isEdit = !!user;
    const { data, setData, post, put, processing, errors } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        role: user?.roles?.[0]?.name ?? '',
        is_active: user?.is_active ?? true,
        password: '',
        password_confirmation: '',
    });

    const submit = e => {
        e.preventDefault();
        isEdit
            ? put(`/admin/users/${user.id}`)
            : post('/admin/users');
    };

    return (
        <AdminLayout title={isEdit ? 'Edit User' : 'Add User'}>
            <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 max-w-lg space-y-4">
                {[['Name', 'name'], ['Email', 'email', 'email']].map(([label, key, type = 'text']) => (
                    <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        <input type={type} value={data[key]} onChange={e => setData(key, e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                        {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
                    </div>
                ))}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={data.role} onChange={e => setData('role', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="">Select role</option>
                        {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                    {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep)</span>}
                    </label>
                    <input type="password" value={data.password} onChange={e => setData('password', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <input type="password" value={data.password_confirmation}
                        onChange={e => setData('password_confirmation', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>

                {isEdit && (
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={data.is_active} onChange={e => setData('is_active', e.target.checked)} />
                        Active
                    </label>
                )}

                <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={processing}
                        className="bg-green-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-800">
                        {processing ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
                    </button>
                    <a href="/admin/users" className="px-6 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</a>
                </div>
            </form>
        </AdminLayout>
    );
}
