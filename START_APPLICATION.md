# Starting GeoFarm-IS Application

## 🚀 Quick Start

### Option 1: Use Automated Startup Script (Recommended)
**When opening project after days of inactivity:**

Double-click `startup.bat` or run in terminal:
```cmd
startup.bat
```

This will automatically:
1. Clear all caches
2. Rebuild JavaScript assets (fixes stale build issues)
3. Start both Laravel and Vite servers

Then visit: **http://127.0.0.1:8000**

### Option 2: Manual Start (Daily Development)
If you worked on the project recently (same day), simply run:
```cmd
npm run dev
```

This will start:
- Laravel development server (port 8000)
- Vite dev server for hot module replacement

Then visit: **http://127.0.0.1:8000**

## ⚠️ Important: Opening Project After Days

**Problem:** When you open the project after several days, JavaScript assets become stale and cause errors like:
- "Cannot read properties of undefined"
- Blank white screen
- Components not loading

**Why it happens:**
- Vite creates a build manifest that references specific asset files
- After days of inactivity, the cached manifest becomes out of sync
- Browser tries to load old assets that no longer match

**Solution:**
Always run `startup.bat` or manually rebuild:
```cmd
npm run build
```

Then start normally:
```cmd
npm run dev
```

Finally, hard refresh your browser:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

## First Time Setup

If this is your first time running the application:

### 1. Install Dependencies
```bash
composer install
npm install
```

### 2. Configure Environment
Make sure `.env` file exists and has correct database settings:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=geofarm_is
DB_USERNAME=root
DB_PASSWORD=
```

### 3. Generate Application Key
```bash
php artisan key:generate
```

### 4. Run Migrations (Already Done)
```bash
php artisan migrate
```

### 5. Seed Data (Optional)
```bash
php artisan db:seed --class=GeofarmSeeder
php artisan db:seed --class=RolePermissionSeeder
php artisan db:seed --class=CropRecommendationsSeeder
```

### 6. Create Storage Link
```bash
php artisan storage:link
```

## Accessing the Application

### Default Login
After seeding, you should have a default admin user. Check your `GeofarmSeeder.php` for credentials.

Typical defaults:
- **URL**: http://127.0.0.1:8000/login
- **Email**: admin@geofarm.local (check your seeder)
- **Password**: password (check your seeder)

## Testing New Features

### 1. View Farmer Profile with Agricultural Assets
1. Login to the application
2. Navigate to **Farmers** menu
3. Click on any farmer
4. You should see new tabs:
   - Tree Crops
   - Fishponds
   - Ruminants
   - Swine & Poultry

### 2. Use Crop Estimator
1. Click **Crop Estimator** in the menu
2. Select a crop and enter area
3. Click "Calculate Estimate"

### 3. Generate Agricultural Assets Report
1. Go to **Reports** menu
2. Click "Download PDF" on "Agricultural Assets" card

## Troubleshooting

### Error: "Cannot read properties of undefined" (JavaScript Error)
**Most Common Issue After Reopening Project**

**Solution**: Rebuild assets
```cmd
npm run build
```
Then hard refresh: `Ctrl + Shift + R`

Or use the startup script:
```cmd
startup.bat
```

### Error: "Vite manifest not found"
**Solution**: Make sure Vite is running (`npm run dev`)

If still failing:
```cmd
npm run build
npm run dev
```

### Error: "SQLSTATE[HY000] [1049] Unknown database"
**Solution**: Create the database first:
```bash
mysql -u root -p
CREATE DATABASE geofarm_is;
exit;
```
Then run migrations again.

### Error: "Class not found"
**Solution**: 
```bash
composer dump-autoload
php artisan cache:clear
```

### Error: "Mix manifest not found" or asset errors
**Solution**:
```cmd
npm run build
npm run dev
```

### Stale JavaScript / Components Not Loading
**Solution**:
```cmd
# Method 1: Use startup script
startup.bat

# Method 2: Manual rebuild
npm run build
# Then hard refresh browser: Ctrl + Shift + R
```

### Port 8000 already in use
**Solution**: Use a different port:
```bash
php artisan serve --port=8001
```

### Browser shows blank page
**Solution**:
1. Check browser console for errors (F12)
2. Make sure both Laravel and Vite are running
3. Clear browser cache
4. Try incognito mode

## Development Workflow

### Making Changes

#### Backend (PHP/Laravel)
1. Edit files in `app/`, `routes/`, `database/`
2. Changes are reflected immediately
3. If you add new classes, run: `composer dump-autoload`

#### Frontend (React/JavaScript)
1. Edit files in `resources/js/`
2. Vite will hot-reload automatically
3. Check browser console for errors

#### Database Changes
1. Create migration: `php artisan make:migration migration_name`
2. Run migration: `php artisan migrate`
3. Rollback if needed: `php artisan migrate:rollback`

### Building for Production
```bash
npm run build
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Useful Commands

### Quick Reference
```cmd
# Start development (daily use)
npm run dev

# Start after days off (clears cache + rebuilds)
startup.bat

# Clear all caches
php artisan optimize:clear

# Rebuild assets
npm run build

# View routes
php artisan route:list

# Check for errors
php artisan about

# Hard refresh browser
# Windows/Linux: Ctrl + Shift + R
# Mac: Cmd + Shift + R
```

### Advanced Commands
```cmd
# View logs (PowerShell)
Get-Content storage\logs\laravel.log -Wait

# Run tests
php artisan test
```

## Next Steps

1. ✅ Start the application
2. ✅ Login with admin credentials
3. ✅ Test adding agricultural assets to a farmer
4. ✅ Test the crop estimator
5. ✅ Generate a PDF report
6. ✅ Verify all features work as expected

## Support

If you encounter issues:
1. **First try:** Run `startup.bat` to clear caches and rebuild
2. **Check logs:** `storage/logs/laravel.log`
3. **Check browser console:** Press F12
4. **Refer to documentation:**
   - `TROUBLESHOOTING.md` - Comprehensive troubleshooting guide
   - `AGRICULTURAL_ASSETS_SETUP.md` - Feature documentation
   - `QUICK_REFERENCE.md` - Quick commands reference

### Common Issues Checklist
- [ ] Ran `npm run build` after days of inactivity?
- [ ] Hard refreshed browser with `Ctrl + Shift + R`?
- [ ] Both servers running? (Check terminal output)
- [ ] XAMPP services running? (Apache & MySQL)
- [ ] Checked browser console for errors? (F12)

---

**Ready to start?** 

- **After days off:** Run `startup.bat`
- **Daily development:** Run `npm run dev`

Then visit http://127.0.0.1:8000
