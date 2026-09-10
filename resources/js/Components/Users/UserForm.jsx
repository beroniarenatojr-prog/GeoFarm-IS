import { useForm } from '@inertiajs/react';

/**
 * The user form, shared by the standalone page at /admin/users/create|edit and
 * the modal on the index. Kept in one place so the two cannot drift apart —
 * the same reason the assistance programme form was extracted.
 */

export function useUserForm(user) {
    return useForm({
        name:      user?.name ?? '',
        email:     user?.email ?? '',
        role:      user?.roles?.[0]?.name ?? '',
        is_active: user?.is_active ?? true,
        password: '',
        password_confirmation: '',
    });
}

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500';
const label = 'mb-1 block text-sm font-medium text-gray-700';
const errorText = 'mt-1 text-xs text-red-500';

export function UserFormFields({ form, roles = [], isEdit = false }) {
    const { data, setData, errors } = form;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className={label}>Name</label>
                    <input value={data.name} onChange={e => setData('name', e.target.value)}
                        className={field} autoComplete="off" />
                    {errors.name && <p className={errorText}>{errors.name}</p>}
                </div>

                <div>
                    <label className={label}>Email</label>
                    <input type="email" value={data.email} onChange={e => setData('email', e.target.value)}
                        className={field} autoComplete="off" />
                    {errors.email && <p className={errorText}>{errors.email}</p>}
                </div>
            </div>

            <div>
                <label className={label}>Role</label>
                <select value={data.role} onChange={e => setData('role', e.target.value)} className={field}>
                    <option value="">Select role</option>
                    {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                {errors.role && <p className={errorText}>{errors.role}</p>}
                {/* Which roles appear is decided server-side: an Admin may
                    create Staff, only a Super Admin may create
                    another Super Admin. The list is not filtered here. */}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className={label}>
                        Password{' '}
                        {isEdit && <span className="font-normal text-gray-400">(leave blank to keep)</span>}
                    </label>
                    {/* new-password, so the browser does not helpfully fill the
                        signed-in user's own credentials into a form that
                        creates somebody else's account. */}
                    <input type="password" value={data.password} autoComplete="new-password"
                        onChange={e => setData('password', e.target.value)} className={field} />
                    {errors.password && <p className={errorText}>{errors.password}</p>}
                </div>

                <div>
                    <label className={label}>Confirm password</label>
                    <input type="password" value={data.password_confirmation} autoComplete="new-password"
                        onChange={e => setData('password_confirmation', e.target.value)} className={field} />
                </div>
            </div>

            {isEdit && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={data.is_active}
                        onChange={e => setData('is_active', e.target.checked)}
                        className="h-4 w-4 rounded text-green-700 focus:ring-green-500" />
                    Active — an inactive account cannot sign in
                </label>
            )}
        </div>
    );
}
