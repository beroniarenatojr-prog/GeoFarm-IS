# Starting GeoFarm-IS Application

## Quick Start

### Option 1: Start All Services (Recommended)
Open a terminal and run:
```bash
npm run dev
```

This will start:
- Laravel development server (port 8000)
- Vite dev server for hot module replacement
- Queue workers
- Log viewer

Then visit: **http://127.0.0.1:8000**

### Option 2: Manual Start (Separate Terminals)

#### Terminal 1: Laravel Server
```bash
php artisan serve
```

#### Terminal 2: Vite (Frontend)
```bash
npm run dev
```

Then visit: **http://127.0.0.1:8000**

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

### Error: "Vite manifest not found"
**Solution**: Make sure Vite is running (`npm run dev`)

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
```bash
npm run build
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

```bash
# Clear all caches
php artisan optimize:clear

# View routes
php artisan route:list

# View logs
tail -f storage/logs/laravel.log

# Run tests
php artisan test

# Check for errors
php artisan about
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
1. Check `storage/logs/laravel.log`
2. Check browser console (F12)
3. Refer to documentation files:
   - `AGRICULTURAL_ASSETS_SETUP.md`
   - `QUICK_REFERENCE.md`
   - `DEPLOYMENT_CHECKLIST.md`

---

**Ready to start?** Run `npm run dev` and visit http://127.0.0.1:8000
