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
}
