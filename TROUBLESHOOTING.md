# Troubleshooting Guide - GeoFarm-IS

## 🔥 Common Issues After Opening Project

### 1. JavaScript Errors / Blank Page

**Symptoms:**
- Console shows: "Cannot read properties of undefined"
- White blank screen
- React components not loading

**Root Cause:**
- Stale JavaScript build
- Vite manifest out of sync

**Solution:**
```cmd
npm run build
```
Then hard refresh: `Ctrl + Shift + R`

---

### 2. Assets Not Loading (404 Errors)

**Symptoms:**
- CSS not loading
- Images broken
- Console shows 404 for assets

**Solution:**
```cmd
php artisan optimize:clear
npm run build
npm run dev
```

---

### 3. Opening Project After Days

**Problem:**
Project doesn't work after being closed for several days

**Solution:**
Always run this sequence:
```cmd
php artisan optimize:clear
npm run build
npm run dev
```

Or just double-click: `startup.bat`

---

### 4. Changes Not Reflecting

**Frontend changes not showing:**
```cmd
# Hard refresh browser
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

**Backend changes not showing:**
```cmd
php artisan cache:clear
php artisan view:clear
```

---

### 5. Vite Manifest Not Found

**Error Message:**
"Vite manifest not found"

**Solution:**
```cmd
npm run build
```

---

### 6. Port Already in Use

**Error:** Port 8000 is already in use

**Solution:**
```cmd
# Kill the process on port 8000
netstat -ano | findstr :8000
taskkill /PID [PID_NUMBER] /F

# Or use a different port
php artisan serve --port=8001
```

---

### 7. Node Modules Issues

**Symptoms:**
- Strange JavaScript errors
- Modules not found

**Solution:**
```cmd
# Delete and reinstall
rmdir /s /q node_modules
del package-lock.json
npm install
npm run build
```

---

### 8. Database Connection Errors

**Check:**
1. XAMPP MySQL is running
2. Database exists: `geofarm_is`
3. `.env` has correct credentials:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=geofarm_is
DB_USERNAME=root
DB_PASSWORD=
```

**Solution:**
```cmd
# Test connection
php artisan migrate:status

# If database doesn't exist
# Open phpMyAdmin and create: geofarm_is
# Then run
php artisan migrate
```

---

### 9. Session Expired / 419 Errors

**Solution:**
```cmd
php artisan cache:clear
php artisan config:clear
```
Then refresh page

---

### 10. Composer Issues

**Symptoms:**
- Class not found errors
- Autoload issues

**Solution:**
```cmd
composer dump-autoload
php artisan optimize:clear
```

---

## 🛠️ Daily Workflow

### Starting Work:
```cmd
# If it's been days since last work
npm run build

# Start servers
npm run dev
```

### During Development:
- Make changes
- Browser auto-refreshes (frontend)
- Refresh manually if needed

### Ending Work:
- Press `Ctrl + C` to stop servers
- Close terminal

---

## 📋 Complete Reset (Nuclear Option)

If nothing else works:

```cmd
# 1. Clear everything
php artisan optimize:clear
rmdir /s /q node_modules
del package-lock.json

# 2. Reinstall
npm install
composer dump-autoload

# 3. Rebuild
npm run build

# 4. Start fresh
npm run dev
```

---

## 🔍 Debugging Tips

### Check if servers are running:
```cmd
# Laravel should respond at
http://127.0.0.1:8000

# Check terminal output for Vite
# Should show: "Local: http://localhost:5173"
```

### View Laravel logs:
```cmd
# Real-time logs
tail -f storage/logs/laravel.log

# Or on Windows
Get-Content storage\logs\laravel.log -Wait
```

### Browser DevTools:
1. Press `F12`
2. Check Console tab for JavaScript errors
3. Check Network tab for failed requests
4. Check Sources tab to see if files are loading

---

## 💡 Prevention Tips

1. **Always rebuild after days off:**
   ```cmd
   npm run build
   ```

2. **Keep node_modules fresh:**
   Run `npm install` periodically

3. **Clear caches regularly:**
   ```cmd
   php artisan optimize:clear
   ```

4. **Hard refresh browser:**
   Use `Ctrl + Shift + R` instead of just `F5`

5. **Use the startup script:**
   Double-click `startup.bat` instead of manual commands

---

## 📞 Still Having Issues?

If problems persist:

1. Check `storage/logs/laravel.log` for errors
2. Check browser console (F12) for JavaScript errors
3. Verify all services are running:
   - XAMPP Apache
   - XAMPP MySQL
   - `npm run dev` (Laravel + Vite)

4. Try the complete reset procedure above

---

**Last Updated:** August 4, 2026
**Version:** 1.0
