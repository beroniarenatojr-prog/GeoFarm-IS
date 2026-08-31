<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

/**
 * The signed-in user's own account page.
 *
 * Every action here works on $request->user() rather than an id from the URL,
 * so one staff member can never reach another's account through this
 * controller. Managing other people's accounts is the Users screen's job and
 * is gated behind its own permissions.
 */
class ProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();

        return Inertia::render('Admin/Profile/Index', [
            'profile' => [
                'name'        => $user->name,
                'email'       => $user->email,
                'role'        => $user->roles->first()?->name,
                'is_active'   => (bool) $user->is_active,
                'last_login'  => $user->last_login?->toIso8601String(),
                'member_since' => $user->created_at?->toIso8601String(),
                'permissions' => $user->getAllPermissions()->pluck('name')->sort()->values(),
                // The lock password itself is never sent — only whether one exists.
                'has_lock_password'    => $user->hasLockPassword(),
                'lock_password_set_at' => $user->lock_password_set_at?->toIso8601String(),
                'can_lock'             => $user->can('lock assistance'),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name'  => 'required|string|max:100',
            'email' => ['required', 'email', 'max:100', Rule::unique('users')->ignore($user->id)],
        ]);

        $before = $user->only(['name', 'email']);
        $user->update($data);

        AuditService::log('update', 'users', $user->id, $before, $user->only(['name', 'email']));

        return back()->with('success', 'Profile updated.');
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            // Proves the person at the keyboard is the account holder, not
            // someone who walked up to an unlocked machine.
            'current_password' => ['required', 'current_password'],
            'password'         => ['required', 'confirmed', Password::min(8)],
        ]);

        $request->user()->update(['password' => $request->password]);

        // Never record the password itself, only that it changed.
        AuditService::log('update', 'users', $request->user()->id, null, ['password_changed' => true]);

        return back()->with('success', 'Password changed.');
    }

    /**
     * Set or change the lock password used to confirm locking and unlocking
     * records. Deliberately separate from the login password: if the two could
     * be the same, confirming a lock would prove nothing beyond being signed in.
     */
    public function updateLockPassword(Request $request)
    {
        $user = $request->user();

        $request->validate([
            // The login password proves identity; the current lock password
            // proves they are the one who set it. Require both to change it.
            'current_password'  => ['required', 'current_password'],
            'current_lock_password' => [$user->hasLockPassword() ? 'required' : 'nullable', 'string'],
            'lock_password'     => ['required', 'confirmed', 'string', 'min:6', 'max:72'],
        ], [], ['lock_password' => 'lock password']);

        if ($user->hasLockPassword() && !$user->checkLockPassword($request->current_lock_password)) {
            return back()->withErrors(['current_lock_password' => 'That lock password is not correct.']);
        }

        if ($user->lockPasswordMatchesLogin($request->lock_password)) {
            return back()->withErrors([
                'lock_password' => 'Your lock password must be different from your login password.',
            ]);
        }

        $user->setLockPassword($request->lock_password);

        AuditService::log('update', 'users', $user->id, null, ['lock_password_changed' => true]);

        return back()->with('success', 'Lock password updated.');
    }
}
