# GeoFarm-IS Deployment Checklist

## Issue: Map polygons not visible after drawing boundaries

### Root Cause
Production server is running OLD JavaScript with weak polygon styling (thin lines, low opacity). The enhanced styling exists in local code but hasn't been deployed yet.

---

## 🚀 Quick Fix (Deploy Enhanced Assets)

### Step 1: Upload Build Folder
Upload the **entire** `public/build/` folder from local to production:

**Local path:** `c:\xampp\htdocs\geofarm_is\public\build\`  
**Server path:** `/home/u988863428/public_html/public/build/`

**Via FTP/SFTP:**
- Connect to: `geo-farm.pitonmain.com`
- Navigate to: `/home/u988863428/public_html/public/`
- **DELETE** the old `build` folder on server
- **UPLOAD** the new `build` folder from local

**Via cPanel File Manager:**
1. Login to cPanel
2. Go to File Manager
3. Navigate to `public_html/public/`
4. Delete the old `build` folder
5. Upload the new `build` folder (as ZIP, then extract)

---

### Step 2: Clear Laravel Cache (SSH)
```bash
ssh u988863428@geo-farm.pitonmain.com
cd public_html
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan config:cache
```

---

### Step 3: Clear Browser Cache
After deployment:
1. Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac) to hard refresh
2. Or clear browser cache completely
3. Reload: https://geo-farm.pitonmain.com/admin/gis/map

---

## 🔍 What Changed (Polygon Visibility Enhancements)

### Before (OLD - Currently on Production)
- Fill opacity: 0.55 (zoom 11) - Too transparent
- Casing: #0f172a at 0.55 opacity, 3.5px width - Too thin, weak contrast
- Lines: sky blue, 2px width - Too thin
- Selection: white, 3px - Hard to see

### After (NEW - In Local Build)
- Fill opacity: **0.65** (zoom 11) - More visible ✅
- Casing: **#000000 (pure black) at 0.85 opacity, 4.5px width** - Strong contrast ✅
- Lines: **white/colored, 3-7.5px width** - Thicker, more visible ✅
- Selection: **bright yellow (#ffff00), 5px** - Highly visible ✅

---

## 📋 File Changes Summary

### Modified Files (Already Built):
1. `resources/js/Pages/Admin/GIS/MapIndex.jsx` - Enhanced polygon styling
2. `resources/js/Layouts/AdminLayout.jsx` - Fixed missing menu items
3. `.env` - Properly formatted (each variable on separate line)

### Assets to Deploy:
- `public/build/manifest.json`
- `public/build/assets/*.js`
- `public/build/assets/*.css`

**Total build folder size:** ~3-5 MB

---

## ⚠️ Production .env File Issue

Your production `.env` file must be **properly formatted**. Each variable should be on a **separate line**.

### ❌ WRONG (All on one line):
```
APP_NAME=GeoFarm-ISAPP_ENV=localAPP_KEY=base64:...
```

### ✅ CORRECT (Each variable on separate line):
```
APP_NAME=GeoFarm-IS
APP_ENV=production
APP_KEY=base64:3KuPxYIdMbZiBTqog0mfmFEoZNx9OQm9UGOH7qsbrlc=
APP_DEBUG=false
APP_URL=https://geo-farm.pitonmain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=u988863428_geofarm
DB_USERNAME=u988863428_geofarm_is
DB_PASSWORD=GeoFarm-IS123
```

**Fix this on production server** via SSH or cPanel File Manager.

---

## 🧪 Testing After Deployment

1. **Login** to https://geo-farm.pitonmain.com/admin
2. **Check sidebar** - All menu items should appear:
   - ✅ Notifications group (Send Email, Notifications with badge)
   - ✅ Farm Analysis
   - ✅ Interventions
   - ✅ Forecast & Advisory
   - ✅ Audit Logs

3. **Go to GIS Map** - https://geo-farm.pitonmain.com/admin/gis/map
4. **Check existing boundaries:**
   - Should see **thick colored polygon lines**
   - Should see **black casings** around polygons
   - Should see **colored pins** for parcel centroids
   - Zoom in/out - lines should be clearly visible at all zoom levels

5. **Test drawing:**
   - Select a parcel from dropdown
   - Click "Draw" button
   - Draw a polygon (click corners, double-click to finish)
   - Should see **thick blue draft lines** while drawing
   - Click "Save" - should reload and show **colored boundary**

---

## 🐛 Still Not Working? Troubleshooting

### If polygons still not visible after deployment:

1. **Check browser console** (F12) for JavaScript errors
2. **Verify build folder uploaded correctly:**
   ```bash
   ssh u988863428@geo-farm.pitonmain.com
   cd public_html/public/build
   ls -lah
   # Should see manifest.json and assets/ folder
   ```

3. **Check database has GeoJSON data:**
   ```bash
   ssh u988863428@geo-farm.pitonmain.com
   cd public_html
   php artisan tinker
   # In tinker:
   \App\Models\FarmParcel::whereNotNull('geojson_data')->count()
   # Should return number > 0 (you have 74)
   ```

4. **Check /admin/gis/parcels-geojson endpoint:**
   - Visit: https://geo-farm.pitonmain.com/admin/gis/parcels-geojson
   - Should return JSON with features array
   - Each feature should have geometry coordinates

5. **Check MapLibre CSS loaded:**
   - View page source
   - Look for `maplibre-gl.css` in the build assets
   - Should be imported in the compiled CSS

---

## 📞 Need More Help?

If issues persist after deployment:
1. Send screenshot of browser console (F12 → Console tab)
2. Send screenshot of Network tab showing failed requests
3. Check Laravel logs: `storage/logs/laravel.log`

---

## ✅ Success Criteria

After deployment, you should:
- ✅ See all 74 mapped parcels as colored polygons on the map
- ✅ See thick, visible boundary lines at all zoom levels
- ✅ Be able to draw new boundaries with clear blue draft lines
- ✅ See yellow highlight when selecting a parcel
- ✅ See all sidebar menu items (Notifications, Farm Analysis, etc.)

---

**Last updated:** 2026-09-18  
**Version:** 1.0
