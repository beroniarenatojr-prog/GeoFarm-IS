import AdminLayout from '@/Layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import { DeleteButton } from '@/Components/ui/ActionButtons';

function LookupTable({ title, items, nameKey, extraKey, addRoute, updateRoute, deleteRoute }) {
    const { data, setData, post, reset, processing } = useForm({ [nameKey]: '', [extraKey]: '' });
    const [editing, setEditing] = useState(null);
    const editForm = useForm({});

    const handleAdd = e => {
        e.preventDefault();
        post(addRoute, { onSuccess: () => reset() });
    };

    const handleDelete = (id) => {
        if (confirm('Delete this item?')) {
            router.delete(`${deleteRoute}/${id}`, {
                preserveState: true,
                preserveScroll: true,
            });
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3">{title}</h3>
            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                <input placeholder="Name" value={data[nameKey]} onChange={e => setData(nameKey, e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm flex-1 focus:ring-2 focus:ring-green-500 outline-none" />
                {extraKey && (
                    <input placeholder="Category/Description" value={data[extraKey]} onChange={e => setData(extraKey, e.target.value)}
                        className="border rounded-lg px-3 py-1.5 text-sm flex-1 focus:ring-2 focus:ring-green-500 outline-none" />
                )}
                <button type="submit" disabled={processing}
                    className="bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-800">
                    Add
                </button>
            </form>
            <table className="w-full text-sm">
                <tbody>
                    {items.map(item => (
                        <tr key={item.id} className="border-t">
                            <td className="py-2">{item[nameKey]}</td>
                            <td className="py-2 text-gray-400">{item[extraKey]}</td>
                            <td className="py-2 text-right">
                                <DeleteButton 
                                    onConfirm={() => handleDelete(item.id)}
                                />
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr><td colSpan={3} className="py-3 text-center text-gray-400 text-xs">No items yet</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default function LookupsIndex({ farmTypes, crops, livestockTypes, associations }) {
    return (
        <AdminLayout title="Lookup Table Management">
            <div className="grid grid-cols-2 gap-6">
                <LookupTable title="Crops" items={crops} nameKey="crop_name" extraKey="category"
                    addRoute="/admin/lookups/crops"
                    updateRoute="/admin/lookups/crops"
                    deleteRoute="/admin/lookups/crops" />
                <LookupTable title="Farm Types" items={farmTypes} nameKey="type_name" extraKey="description"
                    addRoute="/admin/lookups/farm-types"
                    updateRoute="/admin/lookups/farm-types"
                    deleteRoute="/admin/lookups/farm-types" />
                <LookupTable title="Livestock Types" items={livestockTypes} nameKey="type_name" extraKey="category"
                    addRoute="/admin/lookups/livestock-types"
                    updateRoute="/admin/lookups/livestock-types"
                    deleteRoute="/admin/lookups/livestock-types" />
                <LookupTable title="Associations" items={associations} nameKey="association_name" extraKey={null}
                    addRoute="/admin/lookups/associations"
                    updateRoute="/admin/lookups/associations"
                    deleteRoute="/admin/lookups/associations" />
            </div>
        </AdminLayout>
    );
}
