# GeoFarm-IS 🌾
**Geographic Information System for Farm Management - Tumauini, Isabela**

A comprehensive farm management system integrating GIS mapping, crop monitoring, livestock tracking, and agricultural assistance distribution.

---

## 🚀 Quick Start

### First Time Setup
```cmd
composer install
npm install
php artisan key:generate
php artisan migrate
php artisan db:seed
```

### Opening Project After Days
```cmd
startup.bat
```
This handles cache clearing, asset rebuilding, and server startup automatically.

### Daily Development
```cmd
npm run dev
```

Then visit: **http://127.0.0.1:8000**

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| **[QUICK_START_GUIDE.md](QUICK_START_GUIDE.md)** | Essential commands and quick fixes |
| **[START_APPLICATION.md](START_APPLICATION.md)** | Detailed startup instructions |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Complete troubleshooting guide |
| **[AGRICULTURAL_ASSETS_SETUP.md](AGRICULTURAL_ASSETS_SETUP.md)** | Feature documentation |
| **[DATABASE_SCHEMA_DOCUMENTATION.md](DATABASE_SCHEMA_DOCUMENTATION.md)** | Database structure |

---

## ✨ Key Features

### For Administrators
- 📊 **Dashboard** - Real-time agricultural statistics
- 🗺️ **GIS Mapping** - Interactive farm parcel mapping with Leaflet
- 👨‍🌾 **Farmer Management** - Complete farmer profiles and records
- 🌾 **Crop Monitoring** - Seasonal crop tracking and estimations
- 🐄 **Livestock Tracking** - Monitor ruminants, swine, poultry
- 🎣 **Fishpond Management** - Aquaculture production tracking
- 🌳 **Tree Crops** - Permanent crop monitoring (coconut, fruit trees)
- 📦 **Assistance Distribution** - Track agricultural aid and inputs
- 📈 **Reports** - Generate PDF reports by barangay and category
- 🔍 **Audit Logs** - Complete activity tracking

### For Farmers
- 🔐 **Self-Registration** - Secure registration with RSBSA verification
- 👤 **Personal Dashboard** - View own profile and agricultural data
- 📱 **Assistance History** - Track received agricultural support

---

## 🛠️ Tech Stack

- **Backend:** Laravel 11, PHP 8.2
- **Frontend:** React 18, Inertia.js, TailwindCSS
- **Database:** MySQL
- **GIS:** Leaflet, Turf.js
- **Charts:** Recharts
- **Build:** Vite
- **Icons:** Lucide React

---

## 🔐 Security Features

- Role-based access control (Admin, Encoder, Viewer, Farmer)
- Permission-based authorization
- RSBSA verification for farmer registration
- Multi-field identity verification (Last name, Birthdate, Location)
- Complete audit logging
- CSRF protection
- Session management

---

## 📊 System Capabilities

- **Farmers:** Unlimited profiles with complete agricultural data
- **Farm Parcels:** GIS-mapped land parcels with coordinates
- **Crops:** Track multiple crops per season across parcels
- **Livestock:** Monitor multiple livestock types per farmer
- **Assistance:** Record and track distribution by barangay
- **Reports:** Generate comprehensive PDF reports
- **Export:** Excel export for data analysis

---

## 🌍 Location Context

- **Municipality:** Tumauini, Isabela, Philippines
- **Barangays:** 46 barangays covered
- **Target Users:** Municipal Agricultural Office staff and farmers

---

## 🤝 User Roles

| Role | Capabilities |
|------|--------------|
| **Admin** | Full system access, user management, all CRUD operations |
| **Encoder** | Create and edit farmers, parcels, livestock, assistance |
| **Viewer** | Read-only access to all data and reports |
| **Farmer** | View own profile, track assistance received |

---

## 📝 Common Issues

### JavaScript Errors After Days
```cmd
npm run build
```
Then hard refresh: `Ctrl + Shift + R`

### Vite Manifest Not Found
```cmd
npm run build
npm run dev
```

### Changes Not Showing
Hard refresh browser: `Ctrl + Shift + R`

**See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for complete guide**

---

## 📦 Project Structure

```
geofarm_is/
├── app/
│   ├── Http/Controllers/Admin/    # Admin controllers
│   ├── Models/                    # Eloquent models
│   ├── Services/                  # Business logic
│   └── Policies/                  # Authorization policies
├── database/
│   ├── migrations/                # Database schema
│   └── seeders/                   # Sample data
├── resources/
│   ├── js/
│   │   ├── Pages/                 # React pages
│   │   ├── Components/            # Reusable components
│   │   └── Layouts/               # Page layouts
│   └── views/                     # Blade templates
├── routes/
│   └── web.php                    # Application routes
├── public/                        # Public assets
└── storage/                       # File uploads & logs
```

---

## 🔄 Development Workflow

1. **Start work:** `npm run dev` (or `startup.bat` after days)
2. **Make changes:** Edit files, auto-reloads in browser
3. **Check logs:** Browser console (F12) and Laravel logs
4. **Hard refresh:** `Ctrl + Shift + R` if changes not showing
5. **Stop servers:** `Ctrl + C` in terminal

---

## 📞 Support

For issues and questions:
1. Check browser console (F12) for errors
2. Check `storage/logs/laravel.log` for backend errors
3. Refer to documentation files listed above
4. Ensure XAMPP (Apache & MySQL) is running

---

## 📅 Last Updated
**Date:** August 6, 2026  
**Version:** 1.0

---

**Developed for:** Municipal Agriculture Office, Tumauini, Isabela  
**Purpose:** Agricultural resource management and monitoring system
