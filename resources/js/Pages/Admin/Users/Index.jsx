import AdminLayout from '@/Layouts/AdminLayout';
import { Link } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTime } from '@/utils/dateFormatter';

export default function UsersIndex({ users, roles, canCreateAdmin, canDeleteAdmin }) {
    const { can } = usePermissions();
    
    return (
        <AdminLayout title="User Management">
            <div className="flex justify-end mb-4">
                {can('view users') && (
                    <Link href="/admin/users/create"
                        className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                        + Add User
                    </Link>
                )}
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Last Login</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.data.map(u => {
                            const userRole = u.roles?.[0]?.name;
                            const isAdminUser = userRole === 'Admin' || userRole === 'Super Admin';
                            const canEditThisUser = canCreateAdmin || !isAdminUser;
                            const canDeleteThisUser = canDeleteAdmin || !isAdminUser;
                            
                            return (
                                <tr key={u.id} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium">{u.name}</td>
                                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            userRole === 'Super Admin' ? 'bg-purple-100 text-purple-700' :
                                            userRole === 'Admin' ? 'bg-green-100 text-green-700' :
                                            userRole === 'Staff' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {userRole ?? '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                            {u.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400">{formatDateTime(u.last_login)}</td>
                                    <td className="px-4 py-3 flex gap-2">
                                        {canEditThisUser && (
                                            <Link href={`/admin/users/${u.id}/edit`} className="text-green-600 hover:underline">Edit</Link>
                                        )}
                                        {canDeleteThisUser && (
                                            <Link href={`/admin/users/${u.id}`} method="delete" as="button"
                                                className="text-red-500 hover:underline"
                                                onBefore={() => confirm('Delete this user?')}>
                                                Delete
                                            </Link>
                                        )}
                                        {!canEditThisUser && !canDeleteThisUser && (
                                            <span className="text-gray-400 text-xs">No actions</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
