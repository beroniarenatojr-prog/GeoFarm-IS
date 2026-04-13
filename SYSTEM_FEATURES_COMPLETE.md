# GeoFarm-IS - Complete System Features & Functions

## System Overview
**GeoFarm-IS** (Geographic Farm Information System) is a comprehensive agricultural management system for LGU Agriculture Office in Tumauini, Isabela. Built with Laravel 12 + React (Inertia.js).

---

## 🔐 Authentication & User Management

### User Roles & Hierarchy
1. **Super Admin** (Highest Authority)
   - Full system access
   - Can create/edit/delete Admin users
   - Can create/edit/delete all other user types
   - Cannot be deleted if they're the last Super Admin

2. **Admin** (Second Level)
   - Full system access except Admin user management
   - Can create/edit/delete Staff and Viewer users
   - Cannot manage Admin or Super Admin users
   - Has access to all modules and features

3. **Staff/Employee** (Third Level)
   - Can view, create, and edit data
   - Cannot delete critical records
   - No user management access
   - No access to system settings or audit logs

4. **Viewer** (Lowest Level)
   - Read-only access to all data
   - Can view and export reports
   - Cannot create, edit, or delete anything
   - No user management access

### Authentication Features
- Secure login with email and password
- Remember me functionality
- Session management
- CSRF protection
- Password hashing with bcrypt
- Logout functionality

### Test Accounts
- Super Admin: `admin@geofarm.local` / (your password)
- Admin: `admin@geofarm.test` / `password`
- Staff: `staff@geofarm.test` / `password`
- Viewer: `viewer@geofarm.test` / `password`

---

## 📊 Dashboard

### Features
- Overview of key metrics
- Quick access to main modules
- Visual statistics and charts
- Recent activity summary

---

## 👨‍🌾 Farmer Registry Module

### Farmer Management
**Create/Edit Farmer Profile:**
- RSBSA Number (Registry System for Basic Sectors in Agriculture)
- Personal Information:
  - First Name, Last Name, Middle Name, Suffix
  - Birthdate, Sex, Civil Status
  - Mobile Number, Email
- Address Information:
  - Barangay, City/Municipality, Province
- Special Categories:
  - PWD (Person with Disability)
  - 4Ps Beneficiary
  - Indigenous People
- Organization/Cooperative/Association membership
- Highest Education Level
- Photo upload

**Farmer List Features:**
- Advanced search by name, RSBSA, or email
- Filter by barangay
- Sortable columns
- Bulk selection
- Bulk export to CSV
- Bulk delete (Admin/Super Admin only)
- Pagination
- Horizontal scroll for wide tables

**Farmer Detail View:**
- Complete profile information
- Associated farm parcels
- Farm inventory (crops, livestock, fishponds, tree crops)
- Seasonal tracking records
- Assistance received
- QR code generation
- Edit/Delete actions (permission-based)

### Permissions
- View farmers: All roles
- Create farmers: Admin, Staff
- Edit farmers: Admin, Staff
- Delete farmers: Super Admin, Admin only

---

## 🗺️ Farm Parcels Module

### Parcel Management
**Create/Edit Farm Parcel:**
- Parcel number
- Associated farmer
- Barangay location
- Total area (hectares)
- Farm type (Rice, Corn, Vegetable, etc.)
- Ownership type
- GeoJSON geometry for mapping

**Parcel List Features:**
- View all parcels
- Filter and search
- See associated farmer
- Map indicator (has geometry or not)
- Edit/Delete actions

**GIS Mapping:**
- View parcels on interactive map
- GeoJSON support for farm boundaries
- Visual representation of farm locations

### Permissions
- View parcels: All roles
- Create parcels: Admin, Staff
- Edit parcels: Admin, Staff
- Delete parcels: Super Admin, Admin only

---

## 🌾 Farm Inventory Module

### Agricultural Assets Management

#### 1. Crops (Seasonal)
- Crop type
- Area planted (hectares)
- Season (Wet/Dry)
- Year
- Planting and harvest dates
- Yield (kg)

#### 2. Tree Crops & Fishponds
**Tree Crops:**
- Crop type (Coconut, Mango, etc.)
- Quantity/Number of trees
- Area (hectares)

**Fishponds:**
- Species
- Area (hectares)

#### 3. Livestock Management

**Large Ruminants (Cattle, Carabao):**
- Animal type
- Male count
- Female count
- Total heads
- Large raiser indicator

**Small Ruminants (Goat, Sheep):**
- Animal type
- Male count
- Female count
- Total heads
- Large raiser indicator

**Swine:**
- Native Pigs
- Swine Hybrid (with variety)
- Male/Female counts
- Large raiser indicator

**Poultry:**
- Bird type (Chicken, Duck, etc.)
- Male/Female counts
- Total heads
- Large raiser indicator

### Inventory Features
- Add/Edit/Delete inventory items
- View by farmer
- Categorized tabs for easy navigation
- Export inventory data
- Permission-based action buttons

### Permissions
- View inventory: All roles
- Create inventory: Admin, Staff
- Edit inventory: Admin, Staff
- Delete inventory: Super Admin, Admin only

---

## 📅 Seasonal Tracking Module

### Crop Season Management
**Track Crop Seasons:**
- Associated farm parcel
- Season type (Wet/Dry)
- Cropping year
- Crop type
- Area planted (hectares)
- Planting date
- Harvest date
- Yield (kg)
- Inputs used (fertilizer, seeds, pesticides, etc.)

**Input Tracking:**
- Input type (fertilizer, seed, pesticide, herbicide, other)
- Input name
- Quantity
- Unit (kg, L, bag, pack, piece)
- Source

**Features:**
- Filter by year, season, parcel, crop
- Add/Edit/Delete season records
- Track multiple inputs per season
- Calculate total area planted
- Export seasonal data

### Permissions
- View seasonal: All roles
- Create seasonal: Admin, Staff
- Edit seasonal: Admin, Staff
- Delete seasonal: Super Admin, Admin only

---

## 🌱 Crop Yield Estimator (Predictive Analytics)

### Features
- Estimate potential crop yield
- Based on area, crop type, and conditions
- Predictive analytics for planning
- View-only access for all authenticated users

### Permissions
- View predictive: All roles

---

## 💰 Financial Assistance Module

### Assistance Program Management
**Create/Edit Programs:**
- Program name
- Assistance type (Seeds, Fertilizer, Equipment, Cash, etc.)
- Total budget
- Start and end dates
- Status (Planning, Active, Completed, Cancelled)
- Target barangays (or all)
- Description

**Distribution Management:**
- Record assistance distributions to farmers
- Track distribution date
- Record amount/quantity distributed
- Link to specific program
- Track beneficiaries

**Program Features:**
- View all programs
- Filter by status
- See distribution count
- Track budget utilization
- Export program data

**Distribution Features:**
- Record new distributions
- View distribution history
- Filter by program, farmer, or date
- Export distribution records

### Permissions
- View assistance: All roles
- Create assistance: Admin, Staff
- Edit assistance: Admin, Staff
- Delete assistance: Super Admin, Admin only

---

## 📈 Reports Module

### Available Reports

#### 1. Farmer Demographics Report
- Total farmers by barangay
- Age distribution
- Gender distribution
- Civil status breakdown
- Special categories (PWD, 4Ps, Indigenous)
- Education levels
- Export to PDF/Excel

#### 2. Crop Production Report
- Production by crop type
- Seasonal analysis (Wet/Dry)
- Area planted trends
- Yield analysis
- Year-over-year comparison
- Export to PDF/Excel

#### 3. Livestock Inventory Report
- Livestock by type
- Population counts
- Large raisers identification
- Distribution by barangay
- Export to PDF/Excel

#### 4. Assistance Summary Report
- Programs by type
- Budget allocation
- Distribution statistics
- Beneficiary count
- Program effectiveness
- Export to PDF/Excel

#### 5. Agricultural Assets Report
- Complete farm inventory
- Tree crops summary
- Fishpond statistics
- Livestock population
- Export to PDF/Excel

### Report Features
- Interactive filters
- Date range selection
- Barangay filtering
- Real-time data
- Multiple export formats
- Print-friendly layouts

### Permissions
- View reports: All roles
- Export reports: All roles

---

## 🔧 System Settings (Lookups)

### Lookup Tables Management
Manage reference data for the system:

#### 1. Crops
- Crop name
- Category (Cereal, Vegetable, Fruit, etc.)
- Crop recommendations
- Add/Edit/Delete

#### 2. Farm Types
- Type name (Rice, Corn, Vegetable, etc.)
- Description
- Add/Edit/Delete

#### 3. Livestock Types
- Type name (Cattle, Goat, Chicken, etc.)
- Category (Large Ruminant, Small Ruminant, Poultry, Swine)
- Add/Edit/Delete

#### 4. Associations
- Association/Cooperative name
- Add/Edit/Delete

### Features
- Quick add functionality
- Inline editing
- Delete with confirmation
- Used across the system for consistency

### Permissions
- Manage lookups: Super Admin, Admin only

---

## 👥 User Management Module

### User Administration
**Create/Edit Users:**
- Name
- Email
- Password (with confirmation)
- Role assignment
- Active/Inactive status
- Last login tracking

**User List Features:**
- View all users
- See role and status
- Color-coded role badges
- Last login information
- Edit/Delete actions (permission-based)

**Role-Based Restrictions:**
- Super Admin sees all roles in dropdown
- Admin only sees Staff and Viewer roles
- Admin cannot edit/delete other Admin users
- Protection against self-deletion
- Protection against deleting last Super Admin

### Permissions
- View users: Super Admin, Admin
- Create staff users: Super Admin, Admin
- Create admin users: Super Admin only
- Edit users: Super Admin, Admin (with restrictions)
- Delete staff users: Super Admin, Admin
- Delete admin users: Super Admin only

---

## 📋 Audit Logs Module

### System Activity Tracking
- Track all user actions
- Record create/update/delete operations
- User identification
- Timestamp tracking
- IP address logging
- View audit trail

### Features
- Filter by user
- Filter by action type
- Date range filtering
- Search functionality
- Export audit logs

### Permissions
- View audit logs: Super Admin, Admin only

---

## 🎨 UI/UX Features

### Design Elements
- **Theme:** Agricultural/Nature-inspired
  - Deep Forest Green sidebar (#006400)
  - Digital Parchment background (#FAF8F3)
  - Topographic map patterns
  - Soft Olive Green accents (#8B9D83)

### Navigation
- Collapsible sidebar (hover to expand)
- Icon-based navigation when collapsed
- Full labels when expanded
- Permission-based menu filtering
- Breadcrumb navigation
- Back button functionality

### Components
- Responsive data tables with sorting
- Advanced search and filtering
- Modal dialogs
- Toast notifications
- Loading states
- Error handling
- Form validation
- File upload support
- Date pickers
- Dropdown selects
- Checkboxes and toggles
- Action buttons with permissions
- Badge indicators
- Card layouts
- Tabs for organized content

### Responsive Design
- Mobile-friendly layouts
- Horizontal scrolling for wide tables
- Adaptive sidebar
- Touch-friendly controls
- Optimized for various screen sizes

---

## 🔒 Security Features

### Authentication & Authorization
- Role-based access control (RBAC)
- Permission-based UI rendering
- Backend permission enforcement
- CSRF token protection
- Session management
- Password hashing
- Secure logout

### Data Protection
- Input validation
- SQL injection prevention
- XSS protection
- CORS configuration
- Secure file uploads
- Environment variable protection

### Audit & Compliance
- Activity logging
- User action tracking
- Change history
- Compliance reporting

---

## 📦 Technical Stack

### Backend
- **Framework:** Laravel 12
- **PHP:** 8.2.12
- **Database:** MySQL/MariaDB
- **Authentication:** Laravel Breeze
- **Permissions:** Spatie Laravel Permission
- **API:** RESTful with Inertia.js

### Frontend
- **Framework:** React 18
- **Routing:** Inertia.js
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Tables:** TanStack Table (React Table)
- **Forms:** Inertia Form Helper
- **Notifications:** React Hot Toast
- **Build Tool:** Vite

### Database Structure
- Users & Roles
- Farmers
- Farm Parcels (with GeoJSON)
- Crops & Crop Seasons
- Livestock (multiple types)
- Tree Crops & Fishponds
- Financial Assistance Programs
- Assistance Distributions
- Associations
- Audit Logs
- Lookup Tables

---

## 📱 Key Functionalities Summary

### Data Management
✅ Complete CRUD operations for all modules
✅ Advanced search and filtering
✅ Bulk operations (select, export, delete)
✅ Data validation and error handling
✅ File upload support (photos, documents)

### Reporting & Analytics
✅ Multiple report types
✅ Export to CSV/PDF/Excel
✅ Real-time data visualization
✅ Predictive analytics
✅ Custom date ranges and filters

### User Experience
✅ Intuitive navigation
✅ Responsive design
✅ Fast page loads with Inertia.js
✅ Toast notifications
✅ Loading states
✅ Error messages
✅ Confirmation dialogs

### Administration
✅ User management with hierarchy
✅ Role-based permissions
✅ System settings management
✅ Audit trail
✅ Activity monitoring

### GIS & Mapping
✅ Farm parcel mapping
✅ GeoJSON support
✅ Interactive maps
✅ Spatial data visualization

---

## 🚀 Recent Implementations

### Role-Based Permissions System
- Implemented Super Admin role
- Granular permissions for user management
- Permission-based UI rendering
- Backend permission enforcement
- Viewer role with read-only access

### UI Improvements
- Horizontal scrolling for wide tables
- Permission-based action buttons
- Conditional rendering throughout
- Improved form handling (PUT method fix)
- Enhanced navigation menu

### Bug Fixes
- CSRF token implementation
- Form method corrections (POST to PUT)
- Permission cache clearing
- Session management
- Route protection

---

## 📚 Documentation Files

- `START_APPLICATION.md` - How to start the application
- `ROLE_PERMISSIONS_IMPLEMENTATION.md` - Permission system details
- `TESTING_ROLES.md` - Role testing guide
- `SUPER_ADMIN_IMPLEMENTATION.md` - Super Admin feature details
- `VIEWER_ROLE_COMPLETE.md` - Viewer role implementation
- `CSRF_FIX_COMPLETE.md` - CSRF token fix documentation
- `QUICK_PERMISSIONS_GUIDE.md` - Quick reference for permissions
- `IMPLEMENTATION_COMPLETE.md` - Overall implementation summary

---

## 🎯 System Capabilities

### What the System Can Do:
1. ✅ Manage farmer profiles and demographics
2. ✅ Track farm parcels with GIS mapping
3. ✅ Monitor agricultural inventory (crops, livestock, fishponds)
4. ✅ Track seasonal crop production
5. ✅ Manage financial assistance programs
6. ✅ Record assistance distributions
7. ✅ Generate comprehensive reports
8. ✅ Predict crop yields
9. ✅ Manage users with role hierarchy
10. ✅ Track system activities via audit logs
11. ✅ Maintain lookup tables for consistency
12. ✅ Export data in multiple formats
13. ✅ Provide role-based access control
14. ✅ Ensure data security and integrity

### Target Users:
- LGU Agriculture Office Staff
- Municipal Agriculturist
- Agricultural Technicians
- Data Encoders
- Report Generators
- System Administrators

---

## 📞 Support & Maintenance

### For Issues:
1. Check documentation files
2. Review error logs
3. Clear caches: `php artisan cache:clear`
4. Reset permissions: `php artisan permission:cache-reset`
5. Check database connections
6. Verify environment variables

### Regular Maintenance:
- Database backups
- Log rotation
- Permission cache clearing
- Session cleanup
- Security updates

---

**System Version:** 1.0
**Last Updated:** April 12, 2026
**Developed for:** LGU Agriculture Office, Tumauini, Isabela
**Technology:** Laravel 12 + React (Inertia.js)
