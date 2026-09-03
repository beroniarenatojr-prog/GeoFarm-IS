import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    Search, X, Plus, Pencil, Trash2, ShieldCheck, UserCog, Sprout, Eye, Users as UsersIcon,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTime } from '@/utils/dateFormatter';
import ModalShell from '@/Components/ui/ModalShell';

/**
 * Roles carry different weight, so they do not all look alike. The two that can
 * change other people's access are the ones that should stand out in a list.
 */
const ROLE_TONE = {
    'Super Admin': { chip: 'bg-emerald-600 text-white', icon: ShieldCheck },
    Admin:         { chip: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200', icon: ShieldCheck },
    Staff:         { chip: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200', icon: UserCog },
    Viewer:        { chip: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200', icon: Eye },
    Farmer:        { chip: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200', icon: Sprout },
};
const toneFor = (role) => ROLE_TONE[role] ?? { chip: 'bg-gray-100 text-gray-600', icon: UserCog };

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';

/** How long ago, for scanning; the exact stamp stays alongside. */
function ago(iso) {
    if (!iso) return null;
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return null;
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`;
}

function RoleChip({ role }) {
    const { chip, icon: Icon } = toneFor(role);
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
            <Icon className="h-3 w-3" /> {role ?? 'No role'}
        </span>
    );
}

function Avatar({ name, active }) {
    return (
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            active ? 'bg-[#006400] text-white' : 'bg-gray-200 text-gray-500'
        }`}>
            {(name ?? '?').charAt(0).toUpperCase()}
        </span>
    );
}

/**
 * Deleting a login is not the same as deleting a person.
 *
 * farmers.user_id is ON DELETE SET NULL, so a farmer's registry entry, parcels
 * and assistance history all survive — they simply lose portal access. Saying
 * that plainly stops a clerk assuming the opposite in either direction.
 */
function DeleteDialog({ user, busy, onCancel, onConfirm }) {
    return (
        <ModalShell title="Delete this account?" size="sm" onClose={onCancel}
            footer={
                <>
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} disabled={busy}
                        className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                        {busy ? 'Deleting…' : 'Delete account'}
                    </button>
                </>
            }
        >
            <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <Avatar name={user.name} active={user.is_active} />
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span className="ml-auto"><RoleChip role={user.roles?.[0]?.name} /></span>
                </div>

                {user.has_farmer ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">This login belongs to a registered farmer.</p>
                        <p className="mt-1 text-xs">
                            Their farmer record, parcels and assistance history are kept — only the
                            ability to sign in to the Farmer Portal is removed.
                        </p>
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-gray-600">
                        This removes the account and its access. Work they recorded stays in the
                        system, but the audit trail will no longer name them.
                    </p>
                )}

                <p className="mt-3 text-xs font-semibold text-red-600">This action cannot be undone.</p>
            </div>
        </ModalShell>
    );
}

export default function UsersIndex({
    users, roles, canCreateAdmin, canDeleteAdmin, canCreate, currentUserId, filters, stats,
}) {
    const { can } = usePermissions();
    const [f, setF] = useState(filters ?? {});
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const set = (key, value) => setF(prev => ({ ...prev, [key]: value }));

    const apply = (next = f) => {
        const query = Object.fromEntries(
            Object.entries(next).filter(([, v]) => v !== '' && v != null),
        );
        router.get('/admin/users', query, { preserveState: true, preserveScroll: true });
    };

    const clear = () => { setF({}); router.get('/admin/users', {}, { preserveState: true }); };

    const activeCount = Object.values(filters ?? {}).filter(Boolean).length;

    const confirmDelete = () => {
        setDeleting(true);
        router.delete(`/admin/users/${pendingDelete.id}`, {
            preserveScroll: true,
            onFinish: () => { setDeleting(false); setPendingDelete(null); },
        });
    };

    return (
        <AdminLayout title="User Management">
            {/* Who can get into the system, at a glance. Counts describe the
                whole registry rather than the filtered page — otherwise
                "how many staff do we have" changes as you type. */}
            <div className="mb-5 grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#006400]">
                        <UsersIcon className="h-5 w-5 text-white" />
                    </span>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 leading-tight">{stats?.total ?? 0}</p>
                        <p className="text-xs text-gray-500">
                            accounts · <span className="text-emerald-700 font-medium">{stats?.active ?? 0} active</span>
                            {stats?.inactive > 0 && <> · <span className="text-red-600 font-medium">{stats.inactive} inactive</span></>}
                        </p>
                    </div>
                </div>

                <div className="xl:col-span-2 bg-white rounded-2xl border border-green-100 shadow-sm p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">By role</p>
                    <div className="flex flex-wrap gap-2">
                        {(stats?.byRole ?? []).map(r => (
                            <button key={r.name} type="button"
                                onClick={() => { const next = { ...f, role: f.role === r.name ? '' : r.name }; setF(next); apply(next); }}
                                title={`Show only ${r.name}`}
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                                    filters?.role === r.name ? 'ring-2 ring-[#006400] ring-offset-1' : ''
                                } ${toneFor(r.name).chip}`}>
                                {r.name}
                                <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-bold text-gray-700">{r.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-5 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input className={`${field} pl-9`} placeholder="Search name or email…"
                            value={f.search ?? ''} onChange={e => set('search', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()} />
                    </div>

                    <select className={`${field} w-auto`} value={f.role ?? ''}
                        onChange={e => { const next = { ...f, role: e.target.value }; setF(next); apply(next); }}>
                        <option value="">All roles</option>
                        {(stats?.byRole ?? []).map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                    </select>

                    <select className={`${field} w-auto`} value={f.status ?? ''}
                        onChange={e => { const next = { ...f, status: e.target.value }; setF(next); apply(next); }}>
                        <option value="">Any status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    <button onClick={() => apply()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#006400] px-5 py-2 text-sm font-semibold text-white hover:bg-[#228B22]">
                        <Search className="h-4 w-4" /> Search
                    </button>

                    {activeCount > 0 && (
                        <button onClick={clear}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                            <X className="h-4 w-4" /> Clear
                        </button>
                    )}

                    {/* Gated on being able to create, not merely to look. */}
                    {canCreate && (
                        <Link href="/admin/users/create"
                            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#006400] px-5 py-2 text-sm font-semibold text-white hover:bg-[#228B22]">
                            <Plus className="h-4 w-4" /> Add User
                        </Link>
                    )}
                </div>
            </div>

            {/* Accounts */}
            <div className="rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
                {users.data.length === 0 ? (
                    <div className="py-20 text-center">
                        <p className="text-sm font-medium text-gray-600">No accounts match those filters</p>
                        <p className="mt-1 text-xs text-gray-400">Clear the filters to see everyone.</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">User</th>
                                        <th className="px-4 py-3 font-semibold">Role</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold">Last sign-in</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-green-50">
                                    {users.data.map(u => {
                                        const role = u.roles?.[0]?.name;
                                        const isAdminUser = role === 'Admin' || role === 'Super Admin';
                                        const mayEdit = canCreateAdmin || !isAdminUser;
                                        const isSelf = u.id === currentUserId;
                                        // The server refuses self-deletion outright, so the
                                        // button says so rather than failing on click.
                                        const mayDelete = (canDeleteAdmin || !isAdminUser) && !isSelf;

                                        return (
                                            <tr key={u.id} className="hover:bg-green-50/60 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <Avatar name={u.name} active={u.is_active} />
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900 truncate">
                                                                {u.name}
                                                                {isSelf && <span className="ml-1.5 text-[11px] font-semibold text-[#006400]">(you)</span>}
                                                            </p>
                                                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3"><RoleChip role={role} /></td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                                        u.is_active ? 'text-emerald-700' : 'text-red-600'
                                                    }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                        {u.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {u.last_login ? (
                                                        <>
                                                            <p className="text-gray-700">{ago(u.last_login)}</p>
                                                            <p className="text-xs text-gray-400">{formatDateTime(u.last_login)}</p>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Never signed in</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {mayEdit ? (
                                                            <Link href={`/admin/users/${u.id}/edit`} title="Edit"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Link>
                                                        ) : (
                                                            <span aria-disabled="true" title="Only a Super Admin can edit an Admin account"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-300 cursor-not-allowed">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </span>
                                                        )}
                                                        {mayDelete ? (
                                                            <button onClick={() => setPendingDelete(u)} title="Delete"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        ) : (
                                                            <span aria-disabled="true"
                                                                title={isSelf ? 'You cannot delete your own account' : 'Only a Super Admin can delete an Admin account'}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-300 cursor-not-allowed">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <ul className="lg:hidden divide-y divide-green-50">
                            {users.data.map(u => {
                                const role = u.roles?.[0]?.name;
                                const isAdminUser = role === 'Admin' || role === 'Super Admin';
                                const mayEdit = canCreateAdmin || !isAdminUser;
                                const isSelf = u.id === currentUserId;
                                const mayDelete = (canDeleteAdmin || !isAdminUser) && !isSelf;

                                return (
                                    <li key={u.id} className="flex items-start gap-3 p-4">
                                        <Avatar name={u.name} active={u.is_active} />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900 truncate">
                                                {u.name}
                                                {isSelf && <span className="ml-1.5 text-[11px] font-semibold text-[#006400]">(you)</span>}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                <RoleChip role={role} />
                                                <span className={`text-[11px] font-semibold ${u.is_active ? 'text-emerald-700' : 'text-red-600'}`}>
                                                    {u.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <span className="text-[11px] text-gray-400">
                                                    {u.last_login ? ago(u.last_login) : 'never signed in'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-shrink-0 items-center gap-1.5">
                                            {mayEdit && (
                                                <Link href={`/admin/users/${u.id}/edit`} title="Edit"
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Link>
                                            )}
                                            {mayDelete && (
                                                <button onClick={() => setPendingDelete(u)} title="Delete"
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}

                {/* The list was paginated server-side all along, but nothing
                    rendered the controls — past twenty accounts the rest were
                    simply unreachable. */}
                {users.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-100 bg-gray-50/60 px-4 py-3">
                        <span className="text-xs text-gray-500">
                            Showing {users.from}–{users.to} of {users.total}
                        </span>
                        <div className="flex items-center gap-1">
                            {users.links.map((link, i) => (
                                link.url ? (
                                    <Link key={i} href={link.url} preserveState preserveScroll
                                        className={`inline-flex items-center rounded-lg border px-3 py-1 text-sm transition-colors ${
                                            link.active
                                                ? 'border-[#006400] bg-[#006400] font-semibold text-white'
                                                : 'border-gray-200 hover:bg-gray-100'
                                        }`}>
                                        <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                    </Link>
                                ) : (
                                    <span key={i} className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-300">
                                        <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                    </span>
                                )
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {pendingDelete && (
                <DeleteDialog
                    user={pendingDelete}
                    busy={deleting}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </AdminLayout>
    );
}
