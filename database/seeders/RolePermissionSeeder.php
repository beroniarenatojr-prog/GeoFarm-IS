<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use App\Models\User;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Define all permissions
        $permissions = [
            // Farmers
            'view farmers', 'create farmers', 'edit farmers', 'delete farmers',
            
            // Farm Parcels
            'view parcels', 'create parcels', 'edit parcels', 'delete parcels',
            
            // Farm Inventory (crops, tree crops, fishponds, livestock)
            'view inventory', 'create inventory', 'edit inventory', 'delete inventory',
            
            // Seasonal Tracking
            'view seasonal', 'create seasonal', 'edit seasonal', 'delete seasonal',
            
            // Financial Assistance
            'view assistance', 'create assistance', 'edit assistance', 'delete assistance',
            
            // Reports
            'view reports', 'export reports',
            
            // GIS Mapping
            'view maps',
            
            // Predictive Analytics
            'view predictive',
            
            // User Management - Granular permissions
            'view users',
            'create staff users',      // Admin can create Staff/Viewer
            'create admin users',      // Only Super Admin can create Admin
            'edit users',
            'delete staff users',      // Admin can delete Staff/Viewer
            'delete admin users',      // Only Super Admin can delete Admin
            
            // System Settings / Lookups
            'manage lookups',
            
            // Audit Logs
            'view audit logs',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        // Super Admin Role - Full access including Admin management
        $superAdmin = Role::firstOrCreate(['name' => 'Super Admin']);
        $superAdmin->syncPermissions($permissions);

        // Admin Role - Full access EXCEPT Admin user management
        $admin = Role::firstOrCreate(['name' => 'Admin']);
        $adminPermissions = array_filter($permissions, function($perm) {
            return !in_array($perm, ['create admin users', 'delete admin users']);
        });
        $admin->syncPermissions($adminPermissions);

        // Staff/Employee Role - Can view, create, edit but NOT delete critical records
        $staff = Role::firstOrCreate(['name' => 'Staff']);
        $staff->syncPermissions([
            'view farmers', 'create farmers', 'edit farmers',
            'view parcels', 'create parcels', 'edit parcels',
            'view inventory', 'create inventory', 'edit inventory',
            'view seasonal', 'create seasonal', 'edit seasonal',
            'view assistance', 'create assistance', 'edit assistance',
            'view reports', 'export reports',
            'view maps',
            'view predictive',
        ]);

        // Viewer Role - Read-only access
        $viewer = Role::firstOrCreate(['name' => 'Viewer']);
        $viewer->syncPermissions([
            'view farmers',
            'view parcels',
            'view inventory',
            'view seasonal',
            'view assistance',
            'view reports', 'export reports',
            'view maps',
            'view predictive',
        ]);

        // Assign Super Admin role to first user
        $firstUser = User::first();
        if ($firstUser) {
            // Remove any existing roles
            $firstUser->syncRoles([]);
            // Assign Super Admin
            $firstUser->assignRole('Super Admin');
            $this->command->info("First user assigned Super Admin role: {$firstUser->email}");
        }
    }
}
