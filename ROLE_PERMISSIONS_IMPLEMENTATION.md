# Role-Based Permissions Implementation

## Overview
This document describes the implementation of role-based access control (RBAC) for GeoFarm-IS using Spatie Laravel Permission.

## Roles

### Admin
- Full access to all features
- Can manage users and system settings
- Can perform all CRUD operations

### Staff (Employee)
- Can view, create, and edit most data
- Cannot delete critical records
- Cannot manage users or system settings
- Cannot access audit logs

### Viewer
- Read-only access to all data
- Can view and export reports
- Cannot create, edit, or delete any records
- Cannot access user management or system settings

## Permissions

### Farmers Module
- `view farmers` - View farmer records
- `create farmers` - Add new farmers
- `edit farmers` - Edit farmer information
- `delete farmers` - Delete farmer records

### Farm Parcels Module
- `view parcels` - View parcel records
- `create parcels` - Add new parcels
- `edit parcels` - Edit parcel information
- `delete parcels` - Delete parcel records

### Farm Inventory Module (Crops, Tree Crops, Fishponds, Livestock)
- `view inventory` - View inventory records
- `create inventory` - Add new inventory items
- `edit inventory` - Edit inventory information
- `delete inventory` - Delete inventory records

### Seasonal Tracking Module
- `view seasonal` - View seasonal records
- `create seasonal` - Add new seasonal entries
- `edit seasonal` - Edit seasonal information
- `delete seasonal` - Delete seasonal records

### Financial Assistance Module
- `view assistance` - View assistance programs
- `create assistance` - Create new programs
- `edit assistance` - Edit programs and distributions
- `delete assistance` - Delete programs

### Reports Module
- `view reports` - Access reports page
- `export reports` - Generate and export reports

### GIS Mapping
- `view maps` - View GIS maps and parcel boundaries

### Predictive Analytics
- `view predictive` - Access crop yield estimator

### User Management
- `manage users` - Full access to user management

### System Settings
- `manage lookups` - Manage lookup tables (crops, farm types, etc.)

### Audit Logs
- `view audit logs` - View system audit logs

## Backend Implementation

### 1. Database Seeder
Run the seeder to create roles and permissions:
```bash
php artisan db:seed --class=RolePermissionSeeder
```

### 2. Middleware
Routes are protected using the `permission` middleware:
```php
Route::get('farmers', [FarmerController::class, 'index'])
    ->middleware('permission:view farmers');
```

### 3. Shared Data
Permissions are shared with the frontend via `HandleInertiaRequests`:
```php
'permissions' => $request->user()->getAllPermissions()->pluck('name')->toArray()
```

## Frontend Implementation

### 1. Permission Hook
Use the `usePermissions` hook in React components:
```javascript
import { usePermissions } from '@/hooks/usePermissions';

const { can } = usePermissions();

if (can('create farmers')) {
    // Show create button
}
```

### 2. Navigation Menu
The AdminLayout automatically filters menu items based on permissions.

### 3. Action Buttons
Use the ActionButtons components with permission props:
```javascript
<EditButton href={`/admin/farmers/${id}/edit`} permission="edit farmers" />
<DeleteButton onConfirm={handleDelete} permission="delete farmers" />
```

### 4. Conditional Rendering
Wrap UI elements with permission checks:
```javascript
{can('create farmers') && (
    <Link href="/admin/farmers/create">Add Farmer</Link>
)}
```

## Testing

### Create Test Users
```php
// Create Staff user
$staff = User::create([
    'name' => 'Staff User',
    'email' => 'staff@example.com',
    'password' => bcrypt('password'),
]);
$staff->assignRole('Staff');

// Create Viewer user
$viewer = User::create([
    'name' => 'Viewer User',
    'email' => 'viewer@example.com',
    'password' => bcrypt('password'),
]);
$viewer->assignRole('Viewer');
```

### Test Scenarios

#### Staff User Tests
1. Login as Staff user
2. Verify can view farmers list
3. Verify can create new farmer
4. Verify can edit farmer
5. Verify delete button is hidden
6. Verify cannot access Users menu
7. Verify cannot access Lookups menu
8. Verify cannot access Audit Logs menu

#### Viewer User Tests
1. Login as Viewer user
2. Verify can view all data pages
3. Verify all Add/Edit/Delete buttons are hidden
4. Verify can view and export reports
5. Verify cannot access Users menu
6. Verify cannot access Lookups menu
7. Verify cannot access Audit Logs menu

## Files Modified

### Backend
- `database/seeders/RolePermissionSeeder.php` - Permissions and role definitions
- `app/Http/Middleware/HandleInertiaRequests.php` - Share permissions with frontend
- `app/Http/Middleware/CheckPermission.php` - Permission middleware (created)
- `routes/web.php` - Added permission middleware to routes

### Frontend
- `resources/js/hooks/usePermissions.js` - Permission checking hook (created)
- `resources/js/Layouts/AdminLayout.jsx` - Filter navigation by permissions
- `resources/js/Components/ui/ActionButtons.jsx` - Added permission props
- `resources/js/Pages/Admin/Farmers/Index.jsx` - Added permission checks
- `resources/js/Pages/Admin/Farmers/Show.jsx` - Added permission checks
- `resources/js/Pages/Admin/Assistance/Index.jsx` - Added permission checks
- `resources/js/Pages/Admin/Parcels/Index.jsx` - Added permission checks
- `resources/js/Pages/Admin/Seasonal/Index.jsx` - Added permission checks

## Next Steps

1. Run the seeder: `php artisan db:seed --class=RolePermissionSeeder`
2. Create test users for Staff and Viewer roles
3. Test each role's access and restrictions
4. Update remaining pages (Reports, Lookups, Users, etc.) with permission checks
5. Add permission checks to form pages (Create/Edit forms)
6. Consider making forms read-only for Viewer role instead of redirecting
