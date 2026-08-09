# GeoFarm-IS Quick Start Guide

## 🎯 Opening Project After Days

**The Problem:**
When you open the project after several days, you'll face JavaScript errors because the asset build is stale.

**The Solution:**
```cmd
startup.bat
```
That's it! This single command will:
1. ✅ Clear all Laravel caches
2. ✅ Rebuild JavaScript assets
3. ✅ Start both Laravel & Vite servers

Then visit: **http://127.0.0.1:8000**

---

## ⚡ Daily Development Workflow

If you worked on the project today/yesterday:

```cmd
npm run dev
```

Then visit: **http://127.0.0.1:8000**

---

## 🔧 Common Commands

```cmd
# Start after days off
startup.bat

# Start normally
npm run dev

# Rebuild assets only
npm run build

# Clear caches
php artisan optimize:clear

# Hard refresh browser
Ctrl + Shift + R
```

---

## 🆘 Quick Fixes

### Blank Page / JavaScript Errors
```cmd
npm run build
```
Then: `Ctrl + Shift + R` (hard refresh)

### Changes Not Showing
```cmd
Ctrl + Shift + R
```

### "Vite manifest not found"
```cmd
npm run build
npm run dev
```

### Nothing Works
```cmd
startup.bat
```

---

## 📚 Documentation

- **`START_APPLICATION.md`** - Detailed startup instructions
- **`TROUBLESHOOTING.md`** - Complete troubleshooting guide
- **`AGRICULTURAL_ASSETS_SETUP.md`** - Feature documentation

---

## 🎓 Understanding the Issue

**Why does this happen?**

Vite generates a manifest file that maps your JavaScript modules to hashed filenames:
- `Dashboard-abc123.js`
- `Login-def456.js`

When you don't use the project for days:
1. The browser caches old manifest
2. Files may be cleaned/changed
3. Manifest and actual files become out of sync
4. Result: "Cannot read properties of undefined"

**Solution:** Rebuild the manifest with `npm run build`

---

## ✅ Best Practices

1. **Opening project after days:** Always use `startup.bat`
2. **Daily development:** Just `npm run dev`
3. **After pulling code:** Run `npm run build`
4. **Changes not showing:** Hard refresh `Ctrl + Shift + R`
5. **Keep XAMPP running:** Apache & MySQL must be active

---

**Last Updated:** August 6, 2026
