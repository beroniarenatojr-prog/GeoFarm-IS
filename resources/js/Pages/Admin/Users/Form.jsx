import AdminLayout from '@/Layouts/AdminLayout';
import { Link } from '@inertiajs/react';
import { useUserForm, UserFormFields } from '@/Components/Users/UserForm';

/**
 * The standalone add/edit page.
 *
 * Adding now happens in a modal on the index, so this is mostly reached when
 * editing — and by anyone who has the URL. Kept rather than removed: a form
 * that only exists inside a dialog cannot be linked to, and the fields are
 * shared with that dialog, so the two cannot disagree.
 */
export default function UserForm({ user, roles }) {
    const isEdit = !!user;
    const form = useUserForm(user);

    const submit = e => {
        e.preventDefault();
        isEdit ? form.put(`/admin/users/${user.id}`) : form.post('/admin/users');
    };

    return (
        <AdminLayout title={isEdit ? 'Edit User' : 'Add User'} backHref="/admin/users" backLabel="Back to Users">
            <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
                <UserFormFields form={form} roles={roles} isEdit={isEdit} />

                <div className="flex gap-3 border-t border-gray-100 pt-4">
                    <button type="submit" disabled={form.processing}
                        className="rounded-lg bg-green-700 px-6 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                        {form.processing ? 'Saving…' : isEdit ? 'Update user' : 'Create user'}
                    </button>
                    <Link href="/admin/users"
                        className="rounded-lg border px-6 py-2 text-sm hover:bg-gray-50">
                        Cancel
                    </Link>
                </div>
            </form>
        </AdminLayout>
    );
}
