# 🚀 Quick Deployment Checklist

## Files to Upload to Production

### 1️⃣ PHP Files (via FTP/cPanel File Manager)

Upload these to `~/public_html/`:

- [ ] `app/Models/AssistanceProgramItem.php`
- [ ] `app/Http/Controllers/Admin/AssistanceController.php`
- [ ] `database/migrations/2026_09_21_000001_make_assistance_items_text_based.php`

### 2️⃣ Build Assets

Upload to `~/public_html/public/`:

- [ ] Extract `build.zip` to `public/build/` folder
  
  **OR** manually upload:
  - [ ] `public/build/assets/app-DdTiyMSF.js`
  - [ ] `public/build/assets/app-DAgC4U03.css`
  - [ ] `public/build/manifest.json`

## Commands to Run (via SSH)

```bash
# Navigate to project
cd ~/public_html

# Run migration
php artisan migrate --force

# Clear all caches
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# Verify migration ran
php artisan migrate:status
```

## Testing Steps

1. [ ] Login to admin panel: https://geo-farm.pitonmain.com
2. [ ] Go to **Assistance Distribution**
3. [ ] Click **Create Program** or **Edit** existing program
4. [ ] Click **+ Add item**
5. [ ] Verify you see:
   - ✅ "Item Name" text input (typeable)
   - ✅ "Unit" text input (typeable)  
   - ✅ "Per farmer" number input
   - ✅ "Total allocated" number input
6. [ ] Type a test item: "Test Fertilizer", unit: "bags", per farmer: "2"
7. [ ] Save program
8. [ ] Verify program saves successfully
9. [ ] Try distributing to a farmer
10. [ ] Verify distribution works without inventory errors

## Expected Results

### ✅ Success Indicators
- Form shows text inputs for item name and unit
- No error message about "Farm Assets"
- Can type any item name freely
- Program saves successfully
- Distribution works without inventory requirement

### ❌ If You See Errors
- "No stock items are on file yet" → Frontend not updated (check build upload)
- Database errors → Migration not run (check SSH commands)
- "Column not found: item_name" → Migration not run
- 500 error → Check Laravel logs: `storage/logs/laravel.log`

## Quick Troubleshooting

**Problem:** Form still shows inventory dropdown  
**Solution:** Build assets not uploaded. Re-upload `public/build/` folder and hard refresh (Ctrl+F5)

**Problem:** Database column errors  
**Solution:** Migration not run. SSH and run `php artisan migrate --force`

**Problem:** Changes not appearing  
**Solution:** Clear caches: `php artisan config:clear && php artisan cache:clear && php artisan view:clear`

---

**Time Estimate:** 10-15 minutes  
**Difficulty:** Easy  
**Risk Level:** Low (backwards compatible, no data loss)
