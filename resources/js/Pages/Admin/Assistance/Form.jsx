import AdminLayout from '@/Layouts/AdminLayout';
import { ProgramFormFields, useProgramForm } from '@/Components/Assistance/ProgramForm';

/**
 * Full-page form. The index opens the same fields in a modal; this route stays
 * for direct links and for anyone who lands on it from a bookmark.
 */
export default function AssistanceForm({ program, assistanceTypes = [], barangays = [] }) {
    const isEdit = !!program;
    const form = useProgramForm(program);

    const submit = e => {
        e.preventDefault();
        isEdit
            ? form.put(`/admin/assistance/${program.id}`)
            : form.post('/admin/assistance');
    };

    return (
        <AdminLayout title={isEdit ? 'Edit Program' : 'New Agricultural Assistance Program'}>
            <div className="max-w-4xl mx-auto">
                <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <ProgramFormFields
                        form={form}
                        assistanceTypes={assistanceTypes}
                        barangays={barangays}
                    />
                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={form.processing}
                            className="bg-green-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-800 disabled:opacity-50">
                            {form.processing ? 'Saving...' : isEdit ? 'Update' : 'Create Program'}
                        </button>
                        <a href="/admin/assistance" className="px-6 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</a>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
