# 🚨 Fix 500 Error on Profile Page

## The Problem

You're getting a 500 error on `/admin/profile`. This could be caused by several things:

1. **Migration not run** - Database columns don't exist yet
2. **Cache issues** - Old files cached
3. **Missing files** - Not all files uploaded
4. **PHP errors** - Syntax or logic errors

## Quick Fix Steps

### Step 1: Check What's Uploaded

On production, verify these files exist:

```bash
ssh your-server
cd ~/public_html

# Check if migration exists
ls -la database/migrations/*make_assistance_items_text_based*

# Check if model was updated
grep "item_name" app/Models/AssistanceProgramItem.php

# Check if controller was updated  
grep "item_name" app/Http/Controllers/Admin/AssistanceController.php
```

### Step 2: Run Migration (If Not Done Already)

```bash
cd ~/public_html
php artisan migrate --force
```

### Step 3: Clear ALL Caches

```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan optimize:clear
```

### Step 4: Check Laravel Logs

```bash
tail -100 storage/logs/laravel.log
```

Look for the actual error message. It will show you exactly what's wrong.

### Step 5: Check PHP Error Log

```bash
tail -50 /path/to/php/error.log
# or
tail -50 ~/public_html/storage/logs/laravel.log
```

## Common Causes & Solutions

### Cause 1: Migration Not Run

**Symptom:** Error mentions "column not found: item_name"

**Solution:**
```bash
php artisan migrate --force
php artisan cache:clear
```

### Cause 2: Old Model File

**Symptom:** Error in AssistanceProgramItem accessors

**Solution:**
- Re-upload the UPDATED `app/Models/AssistanceProgramItem.php`
- Make sure it has the `array_key_exists` checks
- Clear cache: `php artisan cache:clear`

### Cause 3: Old Controller File

**Symptom:** Error in AssistanceController

**Solution:**
- Re-upload `app/Http/Controllers/Admin/AssistanceController.php`
- Clear cache

### Cause 4: Opcache/PHP Cache

**Symptom:** Changes not taking effect

**Solution:**
```bash
# If you have access to PHP CLI
php -r "opcache_reset();"

# Or restart PHP-FPM
sudo systemctl restart php-fpm
# or
sudo service php8.2-fpm restart
```

### Cause 5: Wrong Files Uploaded

**Symptom:** Different page errors

**Solution:**
- Make sure you uploaded the LATEST versions
- Check file modification times

## Verify Migration Ran

```bash
cd ~/public_html
php artisan migrate:status | grep "make_assistance_items_text_based"
```

Should show:
```
Ran  2026_09_21_000001_make_assistance_items_text_based
```

## Verify Database Changes

```bash
cd ~/public_html
php artisan tinker
```

Then run:
```php
Schema::hasColumn('assistance_program_items', 'item_name')
// Should return: true

Schema::hasColumn('assistance_program_items', 'unit')
// Should return: true
```

Type `exit` to quit tinker.

## Alternative: Check Database Directly

```sql
mysql -u u988863428_geofarm_is -p u988863428_geofarm

DESCRIBE assistance_program_items;
```

Should show columns:
- `id`
- `assistance_id`
- `inventory_item_id` (nullable)
- `item_name` (nullable) ← NEW
- `unit` (nullable) ← NEW
- `quantity_per_farmer`
- `total_quantity`
- `created_at`
- `updated_at`

## Still Getting 500 Error?

### Get the Actual Error

1. Enable debug mode temporarily (careful - shows sensitive info):
   ```bash
   # Edit .env
   nano ~/public_html/.env
   
   # Change:
   APP_DEBUG=false
   # To:
   APP_DEBUG=true
   
   # Save and refresh page
   ```

2. Look at the error message on screen

3. **IMPORTANT:** Turn debug back OFF:
   ```bash
   APP_DEBUG=false
   ```

### Send Me the Error

Run this and send me the output:
```bash
tail -50 ~/public_html/storage/logs/laravel.log
```

## Complete Upload Checklist

Make sure you uploaded ALL these files:

- [ ] `database/migrations/2026_09_21_000001_make_assistance_items_text_based.php`
- [ ] `app/Models/AssistanceProgramItem.php` (UPDATED version with array_key_exists)
- [ ] `app/Http/Controllers/Admin/AssistanceController.php` (UPDATED version)
- [ ] `public/build/` folder (extracted from build.zip)

Then ran:
- [ ] `php artisan migrate --force`
- [ ] `php artisan cache:clear`
- [ ] `php artisan config:clear`
- [ ] `php artisan view:clear`

## Quick Test

Try accessing a page that doesn't use AssistanceProgramItem:

- https://geo-farm.pitonmain.com/admin/dashboard
- https://geo-farm.pitonmain.com/admin/farmers

If these work, the problem is specific to assistance-related pages.
If these also show 500, it's a general PHP/Laravel error.

---

**Need Help?**

Send me:
1. Last 50 lines of `storage/logs/laravel.log`
2. Result of `php artisan migrate:status`
3. Which files you've uploaded so far

I'll help you diagnose the exact issue!
