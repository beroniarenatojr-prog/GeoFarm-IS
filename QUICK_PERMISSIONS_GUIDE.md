# Quick Permissions Reference Guide

## 🔐 Test Accounts

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Admin | (your admin) | (your password) | Full Access |
| Staff | staff@geofarm.test | password | View, Create, Edit |
| Viewer | viewer@geofarm.test | password | View Only |

## 📋 Permission Quick Reference

### Farmers Module
- `view farmers` - View farmer list and details
- `create farmers` - Add new farmers
- `edit farmers` - Edit farmer information
- `delete farmers` - Delete farmers (Admin only)

### Parcels Module
- `view parcels` - View parcel list
- `create parcels` - Add new parcels
- `edit parcels` - Edit parcel information
- `delete parcels` - Delete parcels (Admin only)

### Inventory Module
- `view inventory` - View crops, livestock, etc.
- `create inventory` - Add inventory items
- `edit inventory` - Edit inventory items
- `delete inventory` - Delete inventory (Admin only)

### Seasonal Tracking
- `view seasonal` - View seasonal records
- `create seasonal` - Add season entries
- `edit seasonal` - Edit season entries
- `delete seasonal` - Delete seasons (Admin only)

### Assistance Module
- `view assistance` - View programs
- `create assistance` - Create programs
- `edit assistance` - Edit programs/distributions
- `delete assistance` - Delete programs (Admin only)

### Reports & Analytics
- `view reports` - Access reports page
- `export reports` - Generate/export reports
- `view maps` - View GIS maps
- `view predictive` - Access crop estimator

### Admin Functions
- `manage users` - User management (Admin only)
- `manage lookups` - System settings (Admin only)
- `view audit logs` - Audit logs (Admin only)

## 💻 Code Examples

### Check Permission in React
```javascript
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
    const { can } = usePermissions();
    
    if (can('create farmers')) {
        // Show create button
    }
}
```

### Use Action Buttons
```javascript
import { EditButton, DeleteButton } from '@/Components/ui/ActionButtons';

<EditButton href="/admin/farmers/1/edit" permission="edit farmers" />
<DeleteButton onConfirm={handleDelete} permission="delete farmers" />
```

### Check in Controller
```php
if (!auth()->user()->can('delete farmers')) {
    abort(403, 'Unauthorized');
}
```

### Protect Route
```php
Route::delete('farmers/{farmer}', [FarmerController::class, 'destroy'])
    ->middleware('permission:delete farmers');
```

## 🧪 Quick Test

1. Login as Staff: `staff@geofarm.test` / `password`
2. Go to Farmers page
3. ✅ Should see "Add New Farmer" button
4. ✅ Should see "Edit" buttons
5. ❌ Should NOT see "Delete" buttons
6. ❌ Should NOT see "Users" in menu

## 🔧 Troubleshooting

### Permissions not working?
```bash
php artisan permission:cache-reset
php artisan optimize:clear
```

### Check user permissions
```bash
php artisan tinker
>>> User::where('email', 'staff@geofarm.test')->first()->getAllPermissions()->pluck('name')
```

### Re-run seeders
```bash
php artisan db:seed --class=RolePermissionSeeder
php artisan db:seed --class=TestUsersSeeder
```

## 📚 Documentation

- Full docs: `ROLE_PERMISSIONS_IMPLEMENTATION.md`
- Testing guide: `TESTING_ROLES.md`
- Implementation summary: `IMPLEMENTATION_COMPLETE.md`
