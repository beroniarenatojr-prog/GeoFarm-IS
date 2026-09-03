<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $currentUser = auth()->user();

        // Get available roles based on current user's permissions
        $availableRoles = $this->getAvailableRoles($currentUser);

        $users = User::query()
            ->with('roles:id,name')
            // Whether the account is attached to a farmer record decides what
            // deleting it actually costs, so the list has to know.
            ->withExists(['farmer as has_farmer'])
            ->when($request->search, fn ($q, $s) => $q->where(
                fn ($w) => $w->where('name', 'like', "%$s%")->orWhere('email', 'like', "%$s%")
            ))
            ->when($request->role, fn ($q, $r) => $q->whereHas('roles', fn ($x) => $x->where('name', $r)))
            ->when($request->status, fn ($q, $v) => $q->where('is_active', $v === 'active'))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Users/Index', [
            'users' => $users,
            'roles' => $availableRoles,
            'canCreateAdmin' => $currentUser->can('create admin users'),
            'canDeleteAdmin' => $currentUser->can('delete admin users'),
            'canCreate'      => $currentUser->can('create staff users') || $currentUser->can('create admin users'),
            'currentUserId'  => $currentUser->id,
            'filters'        => $request->only(['search', 'role', 'status']),
            // Counts describe the whole registry, not the filtered page — they
            // are there to answer "how many staff do we have", which a filter
            // would otherwise keep changing the answer to.
            'stats' => [
                'total'    => User::count(),
                'active'   => User::where('is_active', true)->count(),
                'inactive' => User::where('is_active', false)->count(),
                'byRole'   => Role::withCount('users')->orderBy('name')->get()
                    ->map(fn ($r) => ['name' => $r->name, 'count' => $r->users_count]),
            ],
        ]);
    }

    public function create()
    {
        $currentUser = auth()->user();
        $availableRoles = $this->getAvailableRoles($currentUser);
        
        return Inertia::render('Admin/Users/Form', [
            'roles' => $availableRoles
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users',
            'password' => 'required|min:8|confirmed',
            'role'     => 'required|exists:roles,name',
        ]);

        // Check if user is trying to create an Admin
        if ($data['role'] === 'Admin' || $data['role'] === 'Super Admin') {
            if (!auth()->user()->can('create admin users')) {
                abort(403, 'You do not have permission to create Admin users.');
            }
        }

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
        ]);
        $user->assignRole($data['role']);

        return redirect()->route('admin.users.index')->with('success', 'User created.');
    }

    public function edit(User $user)
    {
        $currentUser = auth()->user();
        
        // Check if trying to edit an Admin user
        if ($user->hasRole(['Admin', 'Super Admin'])) {
            if (!$currentUser->can('create admin users')) {
                abort(403, 'You do not have permission to edit Admin users.');
            }
        }
        
        $availableRoles = $this->getAvailableRoles($currentUser);
        
        return Inertia::render('Admin/Users/Form', [
            'user'  => $user->load('roles'),
            'roles' => $availableRoles,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'email'     => "required|email|unique:users,email,{$user->id}",
            'role'      => 'required|exists:roles,name',
            'is_active' => 'boolean',
            'password'  => 'nullable|min:8|confirmed',
        ]);

        // Check if user is trying to assign Admin role
        if ($data['role'] === 'Admin' || $data['role'] === 'Super Admin') {
            if (!auth()->user()->can('create admin users')) {
                abort(403, 'You do not have permission to assign Admin role.');
            }
        }

        // Check if trying to edit an Admin user
        if ($user->hasRole(['Admin', 'Super Admin'])) {
            if (!auth()->user()->can('create admin users')) {
                abort(403, 'You do not have permission to edit Admin users.');
            }
        }

        $user->update([
            'name'      => $data['name'],
            'email'     => $data['email'],
            'is_active' => $data['is_active'] ?? true,
        ] + ($data['password'] ? ['password' => Hash::make($data['password'])] : []));

        $user->syncRoles([$data['role']]);

        return redirect()->route('admin.users.index')->with('success', 'User updated.');
    }

    public function destroy(User $user)
    {
        // Check if trying to delete an Admin user
        if ($user->hasRole(['Admin', 'Super Admin'])) {
            if (!auth()->user()->can('delete admin users')) {
                abort(403, 'You do not have permission to delete Admin users.');
            }
        }
        
        // Prevent deleting yourself
        if ($user->id === auth()->id()) {
            return redirect()->route('admin.users.index')->with('error', 'You cannot delete your own account.');
        }
        
        // Prevent deleting the last Super Admin
        if ($user->hasRole('Super Admin')) {
            $superAdminCount = User::role('Super Admin')->count();
            if ($superAdminCount <= 1) {
                return redirect()->route('admin.users.index')->with('error', 'Cannot delete the last Super Admin.');
            }
        }

        $user->delete();
        return redirect()->route('admin.users.index')->with('success', 'User deleted.');
    }
    
    /**
     * Get available roles based on current user's permissions
     */
    private function getAvailableRoles($user)
    {
        if ($user->can('create admin users')) {
            // Super Admin can see all roles
            return Role::all();
        } else {
            // Regular Admin can only see Staff and Viewer roles
            return Role::whereIn('name', ['Staff', 'Viewer'])->get();
        }
    }
}

