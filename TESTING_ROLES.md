# Testing Role-Based Permissions

## Test Users Created

Three user accounts are now available for testing:

### 1. Admin User
- Email: (your existing admin user)
- Password: (your existing password)
- Role: Admin
- Access: Full access to all features

### 2. Staff User
- Email: `staff@geofarm.test`
- Password: `password`
- Role: Staff
- Access: Can view, create, and edit (but not delete)

### 3. Viewer User
- Email: `viewer@geofarm.test`
- Password: `password`
- Role: Viewer
- Access: Read-only access

## Testing Checklist

### Test as Staff User

Login as `staff@geofarm.test` / `password`

Navigation Menu:
- ✅ Should see: Dashboard, Farmers, Parcels, Seasonal Tracking, Crop Estimator, Farm Inventory, Assistance, Reports
- ❌ Should NOT see: Lookups, Users, Audit Logs

Farmers Module:
- ✅ Can view farmers list
- ✅ Can see "Add New Farmer" button
- ✅ Can create new farmer
- ✅ Can see "Edit" button on farmer records
- ✅ Can edit farmer information
- ❌ Should NOT see "Delete" button

Parcels Module:
- ✅ Can view parcels list
- ✅ Can add new parcel
- ✅ Can edit parcel
- ❌ Should NOT see "Delete" button

Seasonal Tracking:
- ✅ Can view seasonal records
- ✅ Can add new season entry
- ✅ Can edit season entry
- ❌ Should NOT see "Delete" button

Assistance Module:
- ✅ Can view assistance programs
- ✅ Can create new program
- ✅ Can edit program
- ❌ Should NOT see "Delete" button

Reports:
- ✅ Can view reports
- ✅ Can export reports

### Test as Viewer User

Login as `viewer@geofarm.test` / `password`

Navigation Menu:
- ✅ Should see: Dashboard, Farmers, Parcels, Seasonal Tracking, Crop Estimator, Farm Inventory, Assistance, Reports
- ❌ Should NOT see: Lookups, Users, Audit Logs

All Modules:
- ✅ Can view all data
- ❌ Should NOT see any "Add" buttons
- ❌ Should NOT see any "Edit" buttons
- ❌ Should NOT see any "Delete" buttons

Reports:
- ✅ Can view reports
- ✅ Can export reports

## Expected Behavior

### Staff Role Restrictions
1. Delete buttons are hidden throughout the application
2. Cannot access /admin/users (will get 403 error)
3. Cannot access /admin/lookups (will get 403 error)
4. Cannot access /admin/audit-logs (will get 403 error)
5. If they try to delete via API, will get 403 error

### Viewer Role Restrictions
1. All Add/Edit/Delete buttons are hidden
2. Cannot access /admin/users (will get 403 error)
3. Cannot access /admin/lookups (will get 403 error)
4. Cannot access /admin/audit-logs (will get 403 error)
5. If they try to create/edit/delete via API, will get 403 error
6. Can still view and export reports

## API Testing

You can also test the API restrictions using tools like Postman:

### Test Delete Restriction (Staff)
```
DELETE /admin/farmers/1
Authorization: Bearer <staff_token>
Expected: 403 Forbidden
```

### Test Create Restriction (Viewer)
```
POST /admin/farmers
Authorization: Bearer <viewer_token>
Expected: 403 Forbidden
```

## Troubleshooting

If permissions are not working:

1. Clear permission cache:
```bash
php artisan permission:cache-reset
```

2. Verify user has role:
```bash
php artisan tinker
>>> User::where('email', 'staff@geofarm.test')->first()->roles
```

3. Verify role has permissions:
```bash
php artisan tinker
>>> Role::where('name', 'Staff')->first()->permissions->pluck('name')
```

4. Check browser console for JavaScript errors

5. Verify permissions are being shared:
   - Open browser DevTools
   - Check Network tab
   - Look at Inertia response
   - Verify `auth.permissions` array is present
