import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { ViewButton, EditButton, DeleteButton } from '@/Components/ui/ActionButtons';
import { usePermissions } from '@/hooks/usePermissions';

export default function AssistanceIndex({ programs }) {
    const { can } = usePermissions();
    
    return (
        <AdminLayout title="Agricultural Assistance Programs">
            <div className="flex justify-end mb-4">
                {can('create assistance') && (
                    <Link href="/admin/assistance/create"
                        className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                        + New Program
                    </Link>
                )}
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Program</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Budget</th>
                            <th className="px-4 py-3">Period</th>
                            <th className="px-4 py-3">Barangays</th>
                            <th className="px-4 py-3">Distributions</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {programs.data.map(p => (
                            <tr key={p.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{p.program_name}</td>
                                <td className="px-4 py-3">
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                        {p.assistance_type?.type_name || '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                                        ${p.status === 'active' ? 'bg-green-100 text-green-700' :
                                          p.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                          p.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                          'bg-gray-100 text-gray-700'}`}>
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">₱{Number(p.total_budget ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-gray-500 text-xs">{p.start_date} – {p.end_date}</td>
                                <td className="px-4 py-3">
                                    {p.barangays && p.barangays.length > 0 ? (
                                        <span className="text-xs text-gray-600">
                                            {p.barangays.length} selected
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400">All</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">{p.distributions_count}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <ViewButton href={`/admin/assistance/${p.id}`} permission="view assistance" />
                                        <EditButton href={`/admin/assistance/${p.id}/edit`} permission="edit assistance" />
                                        <DeleteButton 
                                            permission="delete assistance"
                                            onConfirm={() => {
                                                router.delete(`/admin/assistance/${p.id}`, {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                });
                                            }}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
