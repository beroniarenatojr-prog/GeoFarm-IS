import AdminLayout from '@/Layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { DeleteButton } from '@/Components/ui/ActionButtons';

function LookupTable({ title, items, nameKey, extraKey, addRoute, deleteRoute }) {
    // A null extraKey (Associations) must not become a literal "null" field.
    const { data, setData, post, reset, processing, errors, clearErrors } = useForm(
        extraKey ? { [nameKey]: '', [extraKey]: '' } : { [nameKey]: '' }
    );

    const handleAdd = e => {
        e.preventDefault();

        post(addRoute, {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                toast.success(`Added to ${title}.`);
            },
            // Without this the server's rejection was discarded and the click
            // looked like it did nothing at all.
            onError: errs => toast.error(Object.values(errs)[0] || 'Could not add this entry.'),
        });
    };

    const handleDelete = (id) => {
        if (confirm('Delete this item?')) {
            router.delete(`${deleteRoute}/${id}`, {
                preserveScroll: true,
                onError: errs => toast.error(Object.values(errs)[0] || 'Could not delete this item.'),
            });
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3">{title}</h3>
            <form onSubmit={handleAdd} className="mb-4">
                <div className="flex gap-2">
                    <input
                        placeholder="Name"
                        value={data[nameKey]}
                        onChange={e => { setData(nameKey, e.target.value); clearErrors(nameKey); }}
                        className={`border rounded-lg px-3 py-1.5 text-sm flex-1 focus:ring-2 outline-none ${
                            errors[nameKey]
                                ? 'border-red-400 focus:ring-red-500'
                                : 'focus:ring-green-500'
                        }`}
                    />
                    {extraKey && (
                        <input
                            placeholder="Category/Description"
                            value={data[extraKey]}
                            onChange={e => { setData(extraKey, e.target.value); clearErrors(extraKey); }}
                            className={`border rounded-lg px-3 py-1.5 text-sm flex-1 focus:ring-2 outline-none ${
                                errors[extraKey]
                                    ? 'border-red-400 focus:ring-red-500'
                                    : 'focus:ring-green-500'
                            }`}
                        />
                    )}
                    <button
                        type="submit"
                        disabled={processing}
                        className="bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? 'Adding…' : 'Add'}
                    </button>
                </div>

                {(errors[nameKey] || (extraKey && errors[extraKey])) && (
                    <p className="text-xs text-red-600 mt-1.5">
                        {errors[nameKey] || errors[extraKey]}
                    </p>
                )}
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
                    deleteRoute="/admin/lookups/crops" />
                <LookupTable title="Farm Types" items={farmTypes} nameKey="type_name" extraKey="description"
                    addRoute="/admin/lookups/farm-types"
                    deleteRoute="/admin/lookups/farm-types" />
                <LookupTable title="Livestock Types" items={livestockTypes} nameKey="type_name" extraKey="category"
                    addRoute="/admin/lookups/livestock-types"
                    deleteRoute="/admin/lookups/livestock-types" />
                <LookupTable title="Associations" items={associations} nameKey="association_name" extraKey={null}
                    addRoute="/admin/lookups/associations"
                    deleteRoute="/admin/lookups/associations" />
            </div>
        </AdminLayout>
    );
}
