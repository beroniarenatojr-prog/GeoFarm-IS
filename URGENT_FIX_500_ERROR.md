# 🚨 URGENT: Fix 500 Error on Production

## The Problem

You uploaded the new PHP files BEFORE running the migration. The code is trying to access database columns (`item_name`, `unit`) that don't exist yet.

## The Solution (2 Options)

### Option A: Rollback and Redo (Safest)

1. **Restore old files from backup** (the ones you downloaded before uploading)
   - Restore: `app/Models/AssistanceProgramItem.php`
   - Restore: `app/Http/Controllers/Admin/AssistanceController.php`

2. **Run the migration first**
   ```bash
   ssh your-server
   cd ~/public_html
   php artisan migrate --force
   php artisan cache:clear
   php artisan config:clear
   ```

3. **Upload the NEW files again**
   - Upload: `app/Models/AssistanceProgramItem.php`
   - Upload: `app/Http/Controllers/Admin/AssistanceController.php`

4. **Clear caches**
   ```bash
   php artisan config:clear
   php artisan cache:clear
   php artisan view:clear
   ```

### Option B: Quick Fix (Upload Fixed Model)

I've updated the `AssistanceProgramItem.php` model to handle missing columns gracefully. Upload these files NOW:

1. **Upload these 2 files immediately**:
   - `app/Models/AssistanceProgramItem.php` (UPDATED - safe version)
   - `database/migrations/2026_09_21_000001_make_assistance_items_text_based.php`

2. **SSH and run migration**:
   ```bash
   ssh your-server
   cd ~/public_html
   php artisan config:clear
   php artisan cache:clear
   php artisan migrate --force
   ```

3. **Test the page** - Should work now!

## What Was Fixed

The model accessors now check if columns exist before trying to access them:

```php
// Before (causes error if column doesn't exist)
return $this->item_name ?? $this->item?->item_name;

// After (safe - checks if column exists first)
if (array_key_exists('item_name', $this->attributes)) {
    return $this->attributes['item_name'];
}
return $this->item?->item_name;
```

## Correct Deployment Order (For Future Reference)

✅ **CORRECT ORDER:**
1. Upload migration file
2. Run `php artisan migrate --force`
3. Upload PHP model/controller files
4. Upload build assets
5. Clear caches

❌ **WRONG ORDER (what caused the 500 error):**
1. Upload PHP files FIRST ← Model tries to access non-existent columns
2. Run migration AFTER ← Too late, already causing errors

## Quick Commands

```bash
# Connect to server
ssh user@geo-farm.pitonmain.com

# Navigate to project
cd ~/public_html

# Run migration (creates the columns)
php artisan migrate --force

# Clear all caches
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear

# Check migration status
php artisan migrate:status

# View recent errors (if needed)
tail -50 storage/logs/laravel.log
```

## How to Check If Migration Ran

```bash
# SSH to server
cd ~/public_html

# Check if migration ran
php artisan migrate:status | grep "make_assistance_items_text_based"

# Should show:
# Ran  2026_09_21_000001_make_assistance_items_text_based
```

## Verification

After fixing:

1. Visit: https://geo-farm.pitonmain.com/admin/assistance
2. Should load without 500 error
3. Should see list of assistance programs
4. Click "Create Program" → Should see item name/unit text inputs

## Still Getting 500 Error?

If you still get 500 after Option B:

1. Check Laravel log:
   ```bash
   tail -100 storage/logs/laravel.log
   ```

2. Verify migration ran:
   ```bash
   php artisan migrate:status
   ```

3. Check database directly:
   ```sql
   DESCRIBE assistance_program_items;
   ```
   Should show `item_name` and `unit` columns

4. Contact me with the error from `laravel.log`

---

**Status:** URGENT - Production Down  
**Priority:** P0 - Critical  
**ETA to Fix:** 5-10 minutes with Option B
