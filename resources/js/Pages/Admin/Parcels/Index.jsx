import AdminLayout from '@/Layouts/AdminLayout';
import { Link } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';

export default function ParcelsIndex({ parcels }) {
    const { can } = usePermissions();
    
    return (
        <AdminLayout title="Farm Parcel Management">
            <div className="flex justify-end mb-4">
                {can('create parcels') && (
                    <Link href="/admin/parcels/create"
                        className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                        + Add Parcel
                    </Link>
                )}
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Parcel #</th>
                            <th className="px-4 py-3">Farmer</th>
                            <th className="px-4 py-3">Barangay</th>
                            <th className="px-4 py-3">Area (ha)</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Has Map</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parcels.data.map(p => (
                            <tr key={p.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3">{p.parcel_number ?? '—'}</td>
                                <td className="px-4 py-3">{p.farmer?.last_name}, {p.farmer?.first_name}</td>
                                <td className="px-4 py-3">{p.barangay}</td>
                                <td className="px-4 py-3">{p.total_area_ha}</td>
                                <td className="px-4 py-3">{p.farm_type?.type_name}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.geom ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {p.geom ? 'Yes' : 'No'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 flex gap-2">
                                    {can('edit parcels') && (
                                        <Link href={`/admin/parcels/${p.id}/edit`} className="text-green-600 hover:underline">Edit</Link>
                                    )}
                                    {can('delete parcels') && (
                                        <Link href={`/admin/parcels/${p.id}`} method="delete" as="button"
                                            className="text-red-500 hover:underline"
                                            onBefore={() => confirm('Delete this parcel?')}>
                                            Delete
                                        </Link>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
