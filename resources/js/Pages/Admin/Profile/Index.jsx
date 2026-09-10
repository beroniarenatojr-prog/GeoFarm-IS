import AdminLayout from '@/Layouts/AdminLayout';
import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { User, Mail, ShieldCheck, Clock, CalendarDays, KeyRound, Save, Lock, Camera, Trash2 } from 'lucide-react';
import Card from '@/Components/ui/Card';
import { formatDate } from '@/utils/dateFormatter';

function Field({ label, error, children }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            {children}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
    );
}

const input = (hasError) =>
    `w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:border-transparent outline-none transition ${
        hasError ? 'border-red-400 focus:ring-red-500' : 'border-gray-200 focus:ring-green-500'
    }`;

export default function ProfileIndex({ profile }) {
    /*
     * _method: 'put' because this form carries a file.
     *
     * Inertia only sends multipart on a POST, so a real put() would arrive
     * with the picture stripped. Laravel reads _method and routes it to the
     * PUT handler regardless.
     */
    const details = useForm({
        _method: 'put',
        name: profile.name ?? '',
        email: profile.email ?? '',
        avatar: null,
        remove_avatar: false,
    });

    // Shown instead of the saved picture while a new one is chosen, so the
    // face on screen is the one about to be saved.
    const [preview, setPreview] = useState(null);

    const chooseAvatar = file => {
        if (!file) return;

        details.setData(d => ({ ...d, avatar: file, remove_avatar: false }));
        setPreview(URL.createObjectURL(file));
    };

    const dropAvatar = () => {
        details.setData(d => ({ ...d, avatar: null, remove_avatar: true }));
        setPreview(null);
    };

    // What the header and the picker should show right now.
    const shownAvatar = details.data.remove_avatar ? null : (preview ?? profile.avatar_url ?? null);
    const password = useForm({ current_password: '', password: '', password_confirmation: '' });
    const lock = useForm({
        current_password: '', current_lock_password: '',
        lock_password: '', lock_password_confirmation: '',
    });

    const initials = (profile.name || '')
        .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

    const saveDetails = e => {
        e.preventDefault();
        details.post('/admin/profile', {
            preserveScroll: true,
            // The chosen file has been saved and re-served from the server now,
            // so the local blob preview would only go stale.
            onSuccess: () => {
                setPreview(null);
                details.setData(d => ({ ...d, avatar: null, remove_avatar: false }));
            },
            onError: errs => toast.error(Object.values(errs)[0] || 'Could not save your profile.'),
        });
    };

    const savePassword = e => {
        e.preventDefault();
        password.put('/admin/profile/password', {
            preserveScroll: true,
            onSuccess: () => {
                password.reset();
                toast.success('Password changed.');
            },
            onError: errs => toast.error(Object.values(errs)[0] || 'Could not change your password.'),
        });
    };

    const saveLockPassword = e => {
        e.preventDefault();
        lock.put('/admin/profile/lock-password', {
            preserveScroll: true,
            onSuccess: () => {
                lock.reset();
                toast.success('Lock password updated.');
            },
            onError: errs => toast.error(Object.values(errs)[0] || 'Could not update your lock password.'),
        });
    };

    return (
        <AdminLayout title="My Profile">
            {/* Identity banner */}
            <div
                className="rounded-2xl p-6 mb-6 shadow-lg"
                style={{
                    backgroundImage: [
                        'radial-gradient(circle at 15% 25%, rgba(144,238,144,0.22) 0%, transparent 45%)',
                        'linear-gradient(135deg, #004d00 0%, #006400 55%, #228B22 100%)',
                    ].join(', '),
                }}
            >
                <div className="flex items-center gap-5">
                    {/* The picture, or the initials if there is none. The
                        camera button opens the file picker; the whole tile is
                        the label so the click target is the face itself. */}
                    <div className="relative h-20 w-20 flex-shrink-0">
                        <label
                            htmlFor="avatar"
                            title="Change your profile picture"
                            className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/20 backdrop-blur-sm"
                        >
                            {shownAvatar
                                ? <img src={shownAvatar} alt="" className="h-full w-full object-cover" />
                                : <span className="text-2xl font-bold tracking-tight text-white">{initials || '?'}</span>}
                        </label>

                        <input
                            id="avatar"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={e => chooseAvatar(e.target.files?.[0])}
                        />

                        <label
                            htmlFor="avatar"
                            className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white text-[#006400] shadow-md hover:bg-green-50"
                        >
                            <Camera className="h-3.5 w-3.5" />
                        </label>
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-white truncate">{profile.name}</h1>
                        <p className="text-white/80 text-sm truncate">{profile.email}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {profile.role ?? 'No role assigned'}
                            </span>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                                profile.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                                {profile.is_active ? 'Active' : 'Deactivated'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Account facts */}
                <Card title="Account">
                    <dl className="space-y-4 text-sm">
                        <div className="flex items-start gap-3">
                            <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <dt className="text-gray-500 text-xs uppercase tracking-wide">Last login</dt>
                                <dd className="font-medium text-gray-900">
                                    {profile.last_login ? formatDate(profile.last_login, 'long') : 'This is your first session'}
                                </dd>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CalendarDays className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <dt className="text-gray-500 text-xs uppercase tracking-wide">Member since</dt>
                                <dd className="font-medium text-gray-900">
                                    {profile.member_since ? formatDate(profile.member_since, 'date-only') : '—'}
                                </dd>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <dt className="text-gray-500 text-xs uppercase tracking-wide">Permissions</dt>
                                <dd className="font-medium text-gray-900">{profile.permissions?.length ?? 0} granted</dd>
                            </div>
                        </div>
                    </dl>

                    {profile.permissions?.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">What you can do</p>
                            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                                {profile.permissions.map(p => (
                                    <span key={p} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px]">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Editable details */}
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Your details">
                        <form onSubmit={saveDetails} className="space-y-4">
                            <Field label="Full name" error={details.errors.name}>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        value={details.data.name}
                                        onChange={e => { details.setData('name', e.target.value); details.clearErrors('name'); }}
                                        className={input(details.errors.name) + ' pl-10'}
                                    />
                                </div>
                            </Field>

                            <Field label="Email address" error={details.errors.email}>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="email"
                                        value={details.data.email}
                                        onChange={e => { details.setData('email', e.target.value); details.clearErrors('email'); }}
                                        className={input(details.errors.email) + ' pl-10'}
                                    />
                                </div>
                            </Field>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                {/* Says the picture is editable at all — the
                                    camera button sits up in the banner, which
                                    is easy to miss on a form-shaped page. */}
                                <p className="text-xs text-gray-500">
                                    {shownAvatar
                                        ? <>Photo set.{' '}
                                            <button type="button" onClick={dropAvatar}
                                                className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline">
                                                <Trash2 className="h-3 w-3" /> Remove
                                            </button>
                                          </>
                                        : 'Click the photo above to add a profile picture. JPG, PNG or WebP, up to 2MB.'}
                                    {details.errors.avatar && (
                                        <span className="ml-1 text-red-600">{details.errors.avatar}</span>
                                    )}
                                </p>

                                <button
                                    type="submit"
                                    disabled={details.processing}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all text-sm font-semibold disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    {details.processing ? 'Saving…' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </Card>

                    <Card title="Change password">
                        <form onSubmit={savePassword} className="space-y-4">
                            <Field label="Current password" error={password.errors.current_password}>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="password"
                                        autoComplete="current-password"
                                        value={password.data.current_password}
                                        onChange={e => { password.setData('current_password', e.target.value); password.clearErrors('current_password'); }}
                                        className={input(password.errors.current_password) + ' pl-10'}
                                    />
                                </div>
                            </Field>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="New password" error={password.errors.password}>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={password.data.password}
                                        onChange={e => { password.setData('password', e.target.value); password.clearErrors('password'); }}
                                        className={input(password.errors.password)}
                                    />
                                </Field>
                                <Field label="Confirm new password">
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={password.data.password_confirmation}
                                        onChange={e => password.setData('password_confirmation', e.target.value)}
                                        className={input(false)}
                                    />
                                </Field>
                            </div>

                            <p className="text-xs text-gray-500">At least 8 characters.</p>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={password.processing}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-800 text-white rounded-xl shadow-lg hover:bg-gray-900 transition-all text-sm font-semibold disabled:opacity-50"
                                >
                                    <KeyRound className="h-4 w-4" />
                                    {password.processing ? 'Changing…' : 'Change password'}
                                </button>
                            </div>
                        </form>
                    </Card>

                    {/* Only shown to roles that can actually lock records. */}
                    {profile.can_lock && (
                        <Card title={profile.has_lock_password ? 'Change lock password' : 'Set a lock password'}>
                            <form onSubmit={saveLockPassword} className="space-y-4">
                                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3">
                                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <p className="text-xs text-amber-900">
                                        Used only to confirm locking and unlocking records. It must be
                                        different from your login password — otherwise confirming a lock
                                        would prove nothing beyond being signed in.
                                        {profile.lock_password_set_at && (
                                            <span className="block mt-1 text-amber-700">
                                                Last set {formatDate(profile.lock_password_set_at, 'date-only')}.
                                            </span>
                                        )}
                                    </p>
                                </div>

                                <Field label="Your login password" error={lock.errors.current_password}>
                                    <input
                                        type="password"
                                        autoComplete="current-password"
                                        value={lock.data.current_password}
                                        onChange={e => { lock.setData('current_password', e.target.value); lock.clearErrors('current_password'); }}
                                        className={input(lock.errors.current_password)}
                                    />
                                </Field>

                                {profile.has_lock_password && (
                                    <Field label="Current lock password" error={lock.errors.current_lock_password}>
                                        <input
                                            type="password"
                                            autoComplete="off"
                                            value={lock.data.current_lock_password}
                                            onChange={e => { lock.setData('current_lock_password', e.target.value); lock.clearErrors('current_lock_password'); }}
                                            className={input(lock.errors.current_lock_password)}
                                        />
                                    </Field>
                                )}

                                <Field label="New lock password" error={lock.errors.lock_password}>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={lock.data.lock_password}
                                        onChange={e => { lock.setData('lock_password', e.target.value); lock.clearErrors('lock_password'); }}
                                        className={input(lock.errors.lock_password)}
                                    />
                                </Field>

                                <Field label="Confirm new lock password">
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={lock.data.lock_password_confirmation}
                                        onChange={e => lock.setData('lock_password_confirmation', e.target.value)}
                                        className={input(false)}
                                    />
                                </Field>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={lock.processing}
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-xl shadow-lg hover:bg-amber-700 transition-all text-sm font-semibold disabled:opacity-50"
                                    >
                                        <Lock className="h-4 w-4" />
                                        {lock.processing
                                            ? 'Saving…'
                                            : profile.has_lock_password ? 'Change lock password' : 'Set lock password'}
                                    </button>
                                </div>
                            </form>
                        </Card>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
