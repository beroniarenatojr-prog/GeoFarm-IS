# Farmer Self-Registration Guide

## Overview
Farmers registered in Tumauini, Isabela can now create their own accounts to access their farm information online.

## Features

### ✅ Farmer Registration
- Self-registration system for registered farmers
- RSBSA number validation
- Must be registered in Tumauini, Isabela
- Email verification
- Secure password creation

### ✅ Farmer Dashboard
- View personal information
- See all farm parcels
- Track livestock inventory
- View assistance programs received
- Monitor farm statistics

## How It Works

### For Farmers

#### Step 1: Go to Registration Page
1. Visit the website: `http://127.0.0.1:8000`
2. Click "Login" in the top right
3. Click "Create an account" at the bottom

#### Step 2: Enter Your Information
You need:
- **RSBSA Number** (must be already registered in the system)
- **Email Address** (must be unique)
- **Password** (minimum 8 characters)

#### Step 3: Validation
The system will check:
- ✅ Your RSBSA number exists in the database
- ✅ You are registered in Tumauini, Isabela
- ✅ Your RSBSA number doesn't already have an account
- ✅ Your email is not already used

#### Step 4: Access Your Dashboard
Once registered, you can:
- View your profile information
- See all your farm parcels
- Check livestock inventory
- View assistance programs you received
- Track your farm statistics

### For Administrators

#### Database Changes
A new column `user_id` has been added to the `farmers` table to link farmers with user accounts.

```php
Schema::table('farmers', function (Blueprint $table) {
    $table->foreignId('user_id')
        ->nullable()
        ->after('id')
        ->constrained('users')
        ->onDelete('set null');
});
```

#### New Role: Farmer
A new role has been created with limited permissions:
- View own inventory
- View own parcels
- View own seasonal records
- View own assistance
- View reports

#### Routes Added
```php
// Registration
GET  /register -> Registration form
POST /register -> Create farmer account

// Farmer Dashboard
GET /farmer/dashboard -> Farmer personal dashboard
```

## Security Features

### 1. **RSBSA Validation**
- Must exist in the database
- Must be from Tumauini, Isabela
- Cannot register twice with same RSBSA

### 2. **Location Validation**
```php
if (strtolower($farmer->city_municipality ?? '') !== 'tumauini') {
    return error('Only farmers from Tumauini, Isabela can register.');
}
```

### 3. **Duplicate Prevention**
- Checks if RSBSA already has a user account
- Prevents email duplication

### 4. **Role Assignment**
- Automatically assigned "Farmer" role
- Limited permissions
- Cannot access admin functions

## Database Structure

### farmers Table
```sql
id
user_id  (NEW - links to users table)
rsbsa_no (unique, used for registration)
first_name
last_name
...other fields
```

### Relationship
```php
// In Farmer model
public function user()
{
    return $this->belongsTo(User::class);
}

// In User model (add this)
public function farmer()
{
    return $this->hasOne(Farmer::class);
}
```

## Error Messages

### RSBSA Not Found
> "This RSBSA number is not registered in Tumauini. Please contact the Agriculture Office."

### Already Registered
> "This RSBSA number already has a registered account."

### Not from Tumauini
> "Only farmers from Tumauini, Isabela can register."

### Email Already Used
> "The email has already been taken."

## Testing the Feature

### 1. Check Existing Farmers
```bash
php artisan tinker
```
```php
// Find farmers without accounts
$farmers = Farmer::whereNull('user_id')
    ->where('city_municipality', 'Tumauini')
    ->get(['rsbsa_no', 'first_name', 'last_name', 'email']);
```

### 2. Test Registration
1. Visit: `http://127.0.0.1:8000/register`
2. Enter RSBSA number from a Tumauini farmer
3. Enter email and password
4. Submit form

### 3. Test Login
1. Visit: `http://127.0.0.1:8000/login`
2. Use the email and password you just created
3. Should redirect to `/farmer/dashboard`

## UI Components

### Login Page Update
Added link to registration:
```jsx
<p className="text-sm text-gray-600">
    Are you a registered farmer in Tumauini?{' '}
    <Link href="/register">Create an account</Link>
</p>
```

### Registration Page
- **Left Panel**: Information about registration requirements
- **Right Panel**: Registration form with:
  - RSBSA Number input
  - Email input
  - Password input (with show/hide)
  - Confirm Password input (with show/hide)
  - Submit button

### Farmer Dashboard
- **Header**: Name, RSBSA, logout button
- **Stats Cards**: Parcels, Livestock, Assistance, Status
- **Profile Section**: Personal information and contact details
- **Parcels Table**: List of all farm parcels
- **Assistance List**: Programs received with amounts

## Permissions

### Farmer Role Permissions
```php
'view inventory',
'view parcels',
'view seasonal',
'view assistance',
'view reports',
```

**Note**: Farmers can only VIEW their own data, not edit or delete.

## Future Enhancements

### Possible Features:
1. ✨ Edit own profile
2. ✨ Upload documents
3. ✨ Apply for assistance programs
4. ✨ Report farm issues
5. ✨ View GIS maps of own parcels
6. ✨ Download own reports
7. ✨ Notifications for new assistance programs
8. ✨ Mobile app access

## Troubleshooting

### Issue: "RSBSA not found"
**Solution**: Make sure the farmer is already in the database with:
- Valid RSBSA number
- city_municipality = "Tumauini" (case-insensitive)

### Issue: "Already registered"
**Solution**: Check if the farmer already has a user_id:
```php
Farmer::where('rsbsa_no', 'YOUR_RSBSA')->value('user_id');
```

### Issue: "Can't login after registration"
**Solution**: 
1. Check user was created: `User::where('email', 'YOUR_EMAIL')->first();`
2. Check role was assigned: `$user->roles()->first();`
3. Clear cache: `php artisan cache:clear`

## Summary

✅ **Created**: Farmer self-registration system
✅ **Added**: Registration page with validation
✅ **Added**: Farmer dashboard
✅ **Added**: "Farmer" role with limited permissions
✅ **Added**: `user_id` column to farmers table
✅ **Updated**: Login page with registration link
✅ **Secured**: Only Tumauini farmers can register
✅ **Prevented**: Duplicate registrations

---

**Version**: 1.0
**Date**: August 4, 2026
**Developer**: Kiro AI Assistant
