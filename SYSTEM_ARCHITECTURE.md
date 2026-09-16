# GeoFarm-IS: Geographic Farm Information System - System Architecture

## Overview
GeoFarm-IS is a comprehensive web-based agricultural management system designed to digitize and streamline farm data collection, monitoring, and assistance distribution for agricultural offices.

## Architecture Pattern
**Monolithic MVC with SPA Frontend**
- Backend: Laravel 11 (PHP)
- Frontend: React 18 with Inertia.js
- Database: MySQL
- Server: Apache (XAMPP)

---

## System Components

### 1. Presentation Layer (Frontend)

#### Technology Stack
- **React 18** - Component-based UI library
- **Inertia.js** - Server-side routing with client-side SPA experience
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet/MapLibre** - GIS mapping visualization
- **Recharts** - Data visualization and analytics

#### Key Frontend Modules
```
resources/js/
├── Pages/
│   ├── Admin/
│   │   ├── Dashboard.jsx              # Admin dashboard with statistics
│   │   ├── Farmers/                   # Farmer management (CRUD)
│   │   ├── Parcels/                   # Farm parcel management
│   │   ├── GIS/MapIndex.jsx           # GIS mapping interface
│   │   ├── Assistance/                # Assistance distribution
│   │   ├── Reports/                   # Report generation
│   │   ├── Analytics/Predictive.jsx   # Predictive analytics
│   │   ├── AuditLogs/                 # Audit trail viewer
│   │   ├── Users/                     # User management
│   │   └── Lookups/                   # Lookup table management
│   ├── Farmer/
│   │   └── Dashboard.jsx              # Farmer portal
│   ├── Auth/
│   │   └── Login.jsx                  # Authentication
│   └── Landing.jsx                    # Public landing page
├── Layouts/
│   └── AdminLayout.jsx                # Admin layout wrapper
├── Components/
│   └── ui/ActionButtons.jsx           # Reusable UI components
└── app.jsx                            # Application entry point
```

---

### 2. Application Layer (Backend)

#### Technology Stack
- **Laravel 11** - PHP web application framework
- **Spatie Laravel Permission** - Role-based access control
- **Inertia.js Server Adapter** - SSR routing bridge

#### Controllers (Business Logic)
```
app/Http/Controllers/
├── Admin/
│   ├── DashboardController.php        # Dashboard statistics & KPIs
│   ├── FarmerController.php           # Farmer CRUD operations
│   ├── ParcelController.php           # Farm parcel management
│   ├── GISController.php              # GIS data endpoints
│   ├── AssistanceController.php       # Assistance distribution
│   ├── ReportController.php           # Report generation
│   ├── PredictiveAnalyticsController.php  # ML analytics
│   ├── AuditLogController.php         # Audit trail
│   ├── UserController.php             # User management
│   ├── LookupController.php           # Lookup tables
│   ├── CropSeasonController.php       # Seasonal tracking
│   ├── FarmAssetController.php        # Farm assets (livestock, machinery)
│   ├── InterventionController.php     # Agricultural interventions
│   └── InventoryController.php        # Inventory management
├── Auth/
│   ├── LoginController.php            # Authentication
│   ├── RegisterController.php         # User registration
│   └── FarmerRegistrationController.php  # Farmer self-registration
└── Farmer/
    ├── FarmAnalysisController.php     # Farmer analytics
    └── ClimateRiskAssessmentController.php  # Climate analysis
```

#### Middleware
```
app/Http/Middleware/
├── CheckPermission.php                # Permission-based authorization
├── HandleInertiaRequests.php          # Inertia data sharing
└── PreventBackHistory.php             # Cache control
```

#### Services
```
app/Services/
└── ForecastService.php                # Predictive analytics service
```

---

### 3. Data Layer

#### Database Models
```
app/Models/
├── User.php                           # System users
├── Farmer.php                         # Farmer profiles
├── FarmerChild.php                    # Farmer dependents
├── FarmParcel.php                     # Land parcels (with GeoJSON)
├── Crop.php                           # Crop types
├── CropSeason.php                     # Seasonal crop tracking
├── Livestock.php                      # Livestock base
├── LivestockType.php                  # Livestock categories
├── LargeRuminant.php                  # Cattle, carabao
├── SmallRuminant.php                  # Goats, sheep
├── Poultry.php                        # Chickens, ducks
├── NativePig.php                      # Native pigs
├── SwineHybrid.php                    # Hybrid pigs
├── Fishpond.php                       # Aquaculture
├── FarmMachinery.php                  # Equipment inventory
├── AssistanceType.php                 # Assistance categories
├── AssistanceProgramItem.php          # Program items
├── AssistanceDistribution.php         # Distribution records
├── AgriculturalIntervention.php       # Interventions
├── InventoryItem.php                  # Inventory items
├── InventoryDistribution.php          # Distribution tracking
├── AuditLog.php                       # System audit trail
├── Barangay.php                       # Geographic barangays
├── Association.php                    # Farmer associations
└── ClimateRiskAssessment.php          # Climate risk data
```

#### Database Schema (MySQL)
```
Key Tables:
├── users                              # System authentication
├── farmers                            # Farmer registry (RSBSA)
├── farm_parcels                       # Land parcels with GeoJSON
├── crops                              # Crop types
├── crop_seasons                       # Seasonal tracking
├── livestock                          # Livestock inventory
├── assistance_distributions           # Assistance records
├── agricultural_interventions         # Government interventions
├── inventory_items                    # Warehouse inventory
├── audit_logs                         # System activity logs
└── roles & permissions                # RBAC tables
```

---

### 4. User Roles & Access Control

#### Role Hierarchy
```
┌─────────────────────────────────────────┐
│          SUPER ADMIN                     │
│  - Full system access                    │
│  - User management                       │
│  - System configuration                  │
│  - Audit log viewing                     │
│  - Lookup table management               │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                      │
┌───────▼──────────┐  ┌────────▼──────────┐
│ AGRICULTURAL     │  │  DATA ENCODERS     │
│ OFFICERS         │  │  - Register farmers│
│ - Monitor crops  │  │  - Encode parcels  │
│ - Manage programs│  │  - Record seasons  │
│ - Generate reports│ │  - Manage livestock│
│ - Distribute aid │  │                    │
│ - View GIS maps  │  │                    │
└──────────────────┘  └────────────────────┘
                   │
            ┌──────▼──────┐
            │   FARMERS    │
            │ - View profile│
            │ - Request aid│
            │ - Check status│
            └──────────────┘
```

---

## Data Flow Architecture

### Request Flow (Inertia.js Pattern)
```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Browser    │───(A)──▶│   Laravel    │───(E)──▶│    MySQL     │
│   (React)    │◀──(A')──│  Controller  │◀──(E)───│   Database   │
└──────────────┘        └──────────────┘        └──────────────┘
      │                        │
      │                        │
      │     ┌──────────────────▼──────┐
      └─────│   Inertia Bridge        │
            │   (Server-Side Routing) │
            └─────────────────────────┘

(A)   User action triggers request
(A')  Server responds with Inertia response
(E)   Database operations
```

### Module Interactions
```
┌─────────────────────────────────────────────────────────┐
│                    GeoFarm-IS Core                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   Farmer     │  │     GIS      │  │  Seasonal   │  │
│  │   Registry   │──│   Mapping    │──│  Tracking   │  │
│  │   Module     │  │   Module     │  │   Module    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                  │                  │         │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼──────┐  │
│  │  Livestock   │  │  Assistance  │  │  Predictive │  │
│  │  Inventory   │  │  Management  │  │  Analytics  │  │
│  │   Module     │  │   Module     │  │   Module    │  │
│  └──────────────┘  └──────────────┘  └─────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │   Reports    │  │     User     │                   │
│  │   Module     │  │  Management  │                   │
│  └──────────────┘  └──────────────┘                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│              Cross-Cutting Concerns                     │
│  - Audit Logging                                        │
│  - Authentication & Authorization                       │
│  - Data Validation                                      │
│  - Error Handling                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Key Features by Module

### 1. Farmer Registry Module
- RSBSA-compliant farmer registration
- Personal information management
- Provincial address tracking
- QR code generation for farmer identification
- Email notifications
- Farmer verification workflow

### 2. GIS Mapping Module
- Interactive map visualization (Leaflet/MapLibre)
- Farm parcel plotting with GeoJSON
- Spatial data management
- Multi-polygon support
- Area calculation
- Location-based queries

### 3. Seasonal Tracking Module
- Crop season management
- Planting/harvesting date tracking
- Crop variety recording
- Yield estimation
- Historical season analysis

### 4. Livestock Inventory Module
- Multi-species tracking (ruminants, swine, poultry, aquaculture)
- Herd size monitoring
- Breed management
- Health status tracking
- Production records

### 5. Assistance Management Module
- Program definition
- Distribution tracking
- Beneficiary selection
- Item inventory management
- Distribution history
- Status monitoring

### 6. Predictive Analytics Module
- Forecast service integration
- Crop yield prediction
- Resource optimization
- Trend analysis
- Data-driven insights

### 7. Reports Module
- Farmer reports
- Assistance distribution reports
- Crop production reports
- Livestock inventory reports
- Custom report generation
- PDF export capability

### 8. User Management Module
- Role-based access control (RBAC)
- User CRUD operations
- Permission management
- Activity tracking

### 9. Audit Log Module
- Comprehensive activity logging
- User action tracking
- Data change history
- Security monitoring
- Compliance reporting

---

## Security Architecture

### Authentication
- Session-based authentication
- Password hashing (bcrypt)
- CSRF protection
- Login throttling

### Authorization
- Role-based access control (Spatie Permissions)
- Permission checks at controller level
- Middleware-based route protection
- Resource policy enforcement

### Data Protection
- SQL injection prevention (Eloquent ORM)
- XSS protection (React auto-escaping)
- Input validation
- Sanitization

### Audit Trail
- All CRUD operations logged
- User attribution
- Timestamp tracking
- IP address logging

---

## Technology Stack Summary

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Laravel | 11.x |
| Language | PHP | 8.2+ |
| Database | MySQL | 8.0+ |
| Server | Apache | 2.4+ |
| ORM | Eloquent | Built-in |

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 18.x |
| Bridge | Inertia.js | 1.x |
| Styling | Tailwind CSS | 3.x |
| Mapping | Leaflet/MapLibre | Latest |
| Charts | Recharts | Latest |
| Build Tool | Vite | 5.x |

### Additional Tools
- **Spatie Laravel Permission** - RBAC
- **Laravel Sanctum** - API authentication (if needed)
- **QR Code Generator** - Farmer identification
- **PDF Generator** - Report exports

---

## Deployment Architecture

### Development Environment (Current)
```
┌────────────────────────────────────┐
│     Windows Development Machine    │
├────────────────────────────────────┤
│  XAMPP Stack:                      │
│  - Apache 2.4                      │
│  - MySQL 8.0                       │
│  - PHP 8.2                         │
│                                    │
│  Node.js:                          │
│  - NPM/Yarn                        │
│  - Vite Dev Server                 │
│                                    │
│  Location:                         │
│  c:\xampp\htdocs\geofarm_is\       │
└────────────────────────────────────┘
```

### Production Deployment (Recommended)
```
┌─────────────────────────────────────────┐
│         Web Server (Linux)              │
├─────────────────────────────────────────┤
│  Nginx/Apache                           │
│  PHP-FPM 8.2+                           │
│  SSL/TLS Certificate                    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Application Server                 │
├─────────────────────────────────────────┤
│  Laravel Application                    │
│  Compiled React Assets (Vite)           │
│  Environment Variables (.env.production)│
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Database Server (MySQL)            │
├─────────────────────────────────────────┤
│  MySQL 8.0+                             │
│  Regular Backups                        │
│  Replication (optional)                 │
└─────────────────────────────────────────┘
```

---

## File Structure Overview

```
geofarm_is/
├── app/
│   ├── Console/Commands/          # CLI commands
│   ├── Http/
│   │   ├── Controllers/           # Request handlers
│   │   └── Middleware/            # Request filtering
│   ├── Models/                    # Database models
│   └── Services/                  # Business logic services
├── bootstrap/
│   └── app.php                    # Application bootstrap
├── config/                        # Configuration files
├── database/
│   ├── migrations/                # Database schema
│   └── seeders/                   # Test data
├── public/                        # Public assets
├── resources/
│   ├── js/                        # React application
│   └── views/                     # Blade templates
├── routes/
│   └── web.php                    # Route definitions
├── storage/                       # File storage
├── tests/                         # Test suites
├── .env                           # Environment configuration
├── .env.production                # Production environment
├── package.json                   # Node dependencies
├── composer.json                  # PHP dependencies
└── vite.config.js                 # Frontend build configuration
```

---

## API Endpoints (Internal - Inertia)

While Inertia.js doesn't expose traditional REST APIs, the following routes are available:

### Authentication
- `GET /login` - Login page
- `POST /login` - Authenticate user
- `POST /logout` - End session

### Admin Routes (Requires Authentication)
- `GET /admin/dashboard` - Dashboard
- `GET /admin/farmers` - Farmer list
- `GET /admin/farmers/{id}` - Farmer details
- `POST /admin/farmers` - Create farmer
- `PUT /admin/farmers/{id}` - Update farmer
- `DELETE /admin/farmers/{id}` - Delete farmer
- `GET /admin/parcels` - Parcel list
- `GET /admin/gis` - GIS map viewer
- `GET /admin/assistance` - Assistance programs
- `GET /admin/reports` - Report generation
- `GET /admin/analytics` - Predictive analytics
- `GET /admin/audit-logs` - Audit trail
- `GET /admin/users` - User management
- `GET /admin/lookups` - Lookup tables

### Farmer Routes
- `GET /farmer/dashboard` - Farmer portal

---

## Performance Considerations

### Database Optimization
- Indexed columns on frequently queried fields
- Relationship eager loading to prevent N+1 queries
- Query result caching for lookup tables
- Pagination for large datasets

### Frontend Optimization
- Code splitting with Vite
- Lazy loading of routes
- React component memoization
- Optimized asset delivery

### Caching Strategy
- Application cache for configuration
- Query result cache for static data
- Browser cache for assets
- Session cache for user data

---

## Future Enhancements

### Planned Features
1. **Mobile Application** - React Native companion app
2. **REST API** - External integration endpoints
3. **Real-time Notifications** - WebSocket implementation
4. **Advanced Analytics** - Machine learning models
5. **Weather Integration** - External weather API
6. **SMS Notifications** - Farmer alerts
7. **Offline Capability** - PWA features
8. **Multi-language Support** - i18n implementation
9. **Export Capabilities** - CSV, Excel exports
10. **Document Management** - File uploads and storage

### Scalability Considerations
- Microservices architecture for high-load modules
- Database sharding for large datasets
- CDN integration for static assets
- Load balancing for multiple instances
- Queue system for background jobs (Laravel Horizon/Redis)

---

## Maintenance & Support

### Logging
- Application logs: `storage/logs/laravel.log`
- Error tracking
- Performance monitoring

### Backup Strategy
- Daily database backups
- File storage backups
- Configuration backups
- Version control (Git)

### Monitoring
- Server health monitoring
- Application performance monitoring
- Database query performance
- User activity tracking

---

## Documentation References

- **Laravel Documentation**: https://laravel.com/docs
- **React Documentation**: https://react.dev
- **Inertia.js Documentation**: https://inertiajs.com
- **Tailwind CSS Documentation**: https://tailwindcss.com
- **Leaflet Documentation**: https://leafletjs.com

---

**Document Version**: 1.0  
**Last Updated**: September 14, 2026  
**System Version**: GeoFarm-IS v1.0  
**Author**: Development Team
