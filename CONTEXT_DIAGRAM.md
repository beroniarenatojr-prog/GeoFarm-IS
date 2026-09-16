# GeoFarm-IS: Context Diagram Documentation

## Overview
This document describes the external entities (actors) that interact with the GeoFarm-IS system and the data flows between them. The context diagram represents the system boundary and shows how different stakeholders interact with the application.

---

## System Boundary

**System Name:** GeoFarm-IS (Geographic Farm Information System)  
**System Type:** Web-Based Agricultural Information Management System  
**Primary Purpose:** Digitize farm data collection, monitoring, and assistance distribution for agricultural offices

---

## External Entities (Actors)

### 1. Agriculture Office Staff (Staff Role)
**Role:** Front-line data entry personnel and agricultural officers  
**Department:** Municipal/Provincial Agriculture Office  
**Access Level:** Staff Role (read, create, edit permissions)

#### Interactions with System

**Inputs to System:**
- **Login** - Authentication credentials to access the system
- **Farmer Registration Data** - Personal information, RSBSA details, contact information
- **Farm Parcel Details** - Land area, coordinates, GeoJSON polygon data, ownership details
- **Crop Production Records** - Crop type, planting/harvest dates, area planted, expected yield
- **Livestock Inventory** - Animal type, quantity, breed, health status
- **Assistance Distribution** - Record of assistance given to farmers, distribution dates, items
- **Supply Distribution** - Distribute seeds, fertilizer, and other supplies to farmers

**Outputs from System:**
- **System Response and Task Confirmation** - Success/error messages for data entry operations
- **Generated Reports** - Farmer lists, inventory summaries, distribution records
- **QR Code Generated IDs** - Unique farmer identification codes for field use

**Use Cases:**
- Register new farmers in the system
- Encode farm parcel boundaries using GIS tools
- Record seasonal crop production data
- Maintain livestock inventory records
- Document assistance distribution to farmers
- Distribute supplies from office inventory
- Generate standard reports for office use

**System Permissions:**
- View, create, and edit farmers, parcels, inventory, supplies, seasonal data, and assistance
- View reports, maps, and predictive analytics
- Export reports
- Distribute supplies
- **Cannot:** Delete records, manage users, or access audit logs

---

### 2. Farmers
**Role:** Agricultural producers and beneficiaries  
**Access Level:** Farmer Portal (Limited Read-Only Access)

#### Interactions with System

**Inputs to System:**
- **Login** - Access farmer portal using credentials
- **Profile Updates** - Update contact information, family details, farm changes (if enabled)
- **Assistance Requests** - Submit requests for agricultural assistance programs (if enabled)

**Outputs from System:**
- **QR-Coded ID Card** - Digital identification for farmer verification
- **Assistance Notifications** - Alerts about approved assistance and distribution schedules
- **Risk Alerts (Palupi Warnings)** - Climate risk assessments, weather warnings, pest alerts
- **Personal Farm Data** - View own farm parcels, crop records, livestock inventory

**Use Cases:**
- View personal farmer profile and farm details
- Check assistance application status
- Receive notifications about programs and distributions
- View farm analysis and recommendations

**System Permissions:**
- View own inventory, parcels, seasonal data, assistance records, and reports
- **Cannot:** Create, edit, or delete any data
- **Cannot:** View other farmers' data

---

### 3. Municipal Agriculturist (Admin Role)
**Role:** Municipal-level agriculture office head  
**Department:** Municipal Agriculture Office  
**Access Level:** Admin Role (Full operational access)

#### Interactions with System

**Inputs to System:**
- **Login** - Administrative access to municipal data
- **GIS Map Queries** - Search and filter farm parcels by location, crop, area
- **Risk Dashboard Filters** - Climate risk analysis parameters and criteria
- **Report Generation Requests** - Custom report parameters and date ranges
- **User Management** - Create and manage Staff and Farmer accounts
- **Assistance Program Management** - Create, edit, and delete assistance programs
- **Supply Inventory Management** - Manage office supplies and distributions

**Outputs from System:**
- **Interactive GIS Maps** - Visual representation of all farms in the municipality
- **Predictive Risk Summaries** - Climate risk assessments, crop vulnerability analysis
- **Downloadable Reports** - PDF/Excel reports for municipal records
- **Agricultural Statistics** - Aggregated data on crops, livestock, and assistance

**Use Cases:**
- Monitor all farming activities in the municipality
- View GIS-based farm distribution maps
- Generate reports for municipal planning
- Assess climate risks for local agriculture
- Track assistance program effectiveness
- Analyze crop production trends
- Manage Staff and Farmer user accounts
- Lock/unlock critical assistance records
- Manage lookup tables

**System Permissions:**
- Full access: view, create, edit, and delete all operational data
- Create and delete Staff user accounts
- Manage supplies, inventory, assistance, parcels, farmers
- Lock assistance records
- Export reports
- Manage lookup tables
- View audit logs
- **Cannot:** Create or delete other Admin or Super Admin accounts

---

### 4. System Administrator (Super Admin Role)
**Role:** System administrator and technical support  
**Department:** IT Department / Agriculture Office  
**Access Level:** Super Admin Role (Full System Access)

#### Interactions with System

**Inputs to System:**
- **Login** - Full administrative access
- **User Account Management** - Create, update, delete all user accounts (including Admin accounts)
- **Role Assignments** - Assign roles and permissions to users
- **System Configuration** - Configure system settings, lookup tables, parameters
- **Account Confirmation** - Approve or reject new account requests

**Outputs from System:**
- **Audit Logs** - Complete system activity logs and user actions
- **System Activity Reports** - Performance metrics, usage statistics, error logs

**Use Cases:**
- Manage all user accounts and permissions (including Admin accounts)
- Configure system-wide settings
- Monitor system security and activity
- Review audit logs for compliance
- Manage lookup tables (crops, livestock types, assistance types)
- Troubleshoot system issues
- Perform system maintenance
- Create Admin-level accounts

**System Permissions:**
- **Full unrestricted access** to all system features
- Create and delete Admin accounts
- All permissions that Admin role has, plus:
  - Create admin users
  - Delete admin users

---

## Data Flow Summary

### Data Flow Table

| From Entity | To System | Data Flow | Flow Type |
|-------------|-----------|-----------|-----------|
| Agriculture Office Staff | GeoFarm-IS | Farmer registration, parcel data, crop records, livestock inventory, assistance distribution, supply distribution | Input |
| Farmers | GeoFarm-IS | Login, profile views, assistance requests | Input |
| Municipal Agriculturist | GeoFarm-IS | Login, GIS queries, report requests, dashboard filters, user management, assistance programs, supply management | Input |
| System Administrator | GeoFarm-IS | User management (all roles), system configuration, role assignments | Input |
| GeoFarm-IS | Agriculture Office Staff | Task confirmations, reports, QR codes | Output |
| GeoFarm-IS | Farmers | QR-coded ID, assistance notifications, risk alerts, farm data | Output |
| GeoFarm-IS | Municipal Agriculturist | Interactive GIS maps, predictive summaries, downloadable reports, statistics | Output |
| GeoFarm-IS | System Administrator | Audit logs, system activity reports | Output |

---

## Context Diagram (Text Representation)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                    EXTERNAL ENTITIES & DATA FLOWS                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│ Agriculture Office   │
│  Staff (Staff Role)  │
└──────────┬───────────┘
           │
           │ IN:  Login, Farmer Registration, Farm Parcels,
           │      Crop Production, Livestock, Assistance Distribution,
           │      Supply Distribution
           │
           │ OUT: Task Confirmations, Reports, QR Codes
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                     GeoFarm-IS System                            │
│         (Geographic Farm Information System)                     │
│                                                                  │
│  Core Modules:                                                   │
│  • Farmer Registry          • GIS Mapping                        │
│  • Seasonal Tracking        • Livestock Inventory                │
│  • Assistance Management    • Predictive Analytics               │
│  • Reports                  • User Management                    │
│  • Audit Logging            • Supply Inventory                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
           ▲                    ▲                    ▲
           │                    │                    │
           │                    │                    │
┌──────────┴─────────┐  ┌──────┴──────────┐  ┌─────┴──────────┐
│     Farmers        │  │   Municipal     │  │ System         │
│   (Farmer Role)    │  │  Agriculturist  │  │ Administrator  │
│                    │  │  (Admin Role)   │  │ (Super Admin)  │
└────────────────────┘  └─────────────────┘  └────────────────┘

IN:  Login                 IN:  Login             IN:  Login
     Profile Views              GIS Queries             User Management
     Assistance Requests        Risk Filters            (All Roles)
                               Report Requests          System Config
                               User Management          Role Assignments
                               (Staff/Farmers)
                               Assistance Programs
                               Supply Management

OUT: QR-Coded ID          OUT: Interactive Maps   OUT: Audit Logs
     Assistance               Predictive            System Activity
     Notifications            Summaries             Reports
     Risk Alerts              Reports
     Farm Data                Statistics
```

---

## System Role Hierarchy

```
┌─────────────────────────────────────────┐
│          SUPER ADMIN                     │
│  - Full system access                    │
│  - Create/delete ALL user types          │
│  - System configuration                  │
│  - Audit log viewing                     │
│  - Lookup table management               │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                      │
┌───────▼──────────┐  ┌────────▼──────────┐
│      ADMIN       │  │      STAFF         │
│ Municipal        │  │  Agriculture       │
│ Agriculturist    │  │  Office Staff      │
│                  │  │                    │
│ - All operations │  │  - Register farmers│
│ - Delete records │  │  - Encode parcels  │
│ - Create/delete  │  │  - Record data     │
│   Staff/Farmers  │  │  - Distribute aid  │
│ - Lock assistance│  │  - View reports    │
│ - Manage lookups │  │  - View maps       │
│ - View audit logs│  │                    │
│                  │  │  - Cannot: Delete  │
│ - Cannot: Create/│  │    critical records│
│   delete Admins  │  │                    │
└──────────────────┘  └────────────────────┘
                   │
            ┌──────▼──────┐
            │   FARMERS    │
            │ - View own   │
            │   profile    │
            │ - View own   │
            │   farm data  │
            │ - Request aid│
            │ - Read-only  │
            └──────────────┘
```

---

## System Interfaces

### 1. User Interface (Web Browser)
- **Technology:** React 18 with Inertia.js
- **Access Method:** HTTPS via web browser
- **Supported Browsers:** Chrome, Firefox, Edge, Safari (modern versions)
- **Responsive Design:** Desktop and tablet support
- **Authentication:** Session-based authentication

### 2. Database Interface
- **Database:** MySQL 8.0+
- **Connection:** PDO via Laravel Eloquent ORM
- **Security:** Encrypted connection, parameterized queries
- **Backup:** Automated daily backups

### 3. GIS Interface
- **Mapping Library:** Leaflet / MapLibre GL
- **Data Format:** GeoJSON for spatial data
- **Coordinate System:** WGS84 (EPSG:4326)
- **Features:** Interactive maps, polygon drawing, spatial queries

### 4. Report Generation Interface
- **Format:** PDF (via Laravel PDF generator)
- **Additional Formats:** HTML view, print-friendly
- **Templates:** Blade templates for consistency

### 5. Notification Interface (Future)
- **Email:** SMTP configuration
- **SMS:** Third-party SMS gateway integration (planned)
- **In-app:** Real-time notifications (planned)

---

## External System Dependencies

### Current Dependencies
1. **Web Server:** Apache 2.4 (XAMPP)
2. **Database Server:** MySQL 8.0
3. **PHP Runtime:** PHP 8.2+
4. **Node.js:** For asset compilation (Vite)

### Planned Integrations
1. **Weather API:** For climate data and forecasts
2. **SMS Gateway:** For farmer notifications
3. **Email Service:** For automated email notifications
4. **GIS Data Sources:** Government mapping services
5. **RSBSA National Database:** Farmer registry synchronization

---

## Security Boundaries

### Authentication Boundary
- All external entities must authenticate before accessing the system
- Session-based authentication with CSRF protection
- Password hashing using bcrypt
- Login attempt throttling

### Authorization Boundary
- Role-based access control (RBAC) using Spatie Laravel Permission
- Permission checks at controller level
- Data filtering based on user role and jurisdiction
- Audit logging for all sensitive operations

### Data Boundary
- Input validation on all user-submitted data
- SQL injection prevention via ORM
- XSS protection through React auto-escaping
- File upload validation and sanitization

---

## Data Flow Scenarios

### Scenario 1: Farmer Registration (Staff)
```
1. Staff member logs into the system
2. Staff navigates to Farmer Registration form
3. Staff enters farmer details (name, address, contact, RSBSA)
4. System validates input data
5. System stores farmer record in database
6. System generates QR-coded ID for the farmer
7. System confirms successful registration to Staff
8. Farmer receives notification (if email/SMS configured)
```

### Scenario 2: GIS Map Viewing (Admin)
```
1. Municipal Agriculturist (Admin) logs into the system
2. Admin navigates to GIS Map module
3. Admin applies filters (location, crop type, date range)
4. System queries database for farm parcels matching filters
5. System retrieves GeoJSON data for selected parcels
6. System renders interactive map with parcel boundaries
7. Admin views and interacts with the map
8. Admin exports map or generates report
```

### Scenario 3: Assistance Distribution (Staff)
```
1. Staff member logs into the system
2. Staff navigates to Assistance Distribution module
3. Staff selects assistance program and beneficiaries
4. Staff records distribution details (items, quantities, date)
5. System updates inventory and farmer records
6. System generates distribution receipt/report
7. System sends notification to beneficiary farmers
8. System logs the transaction in audit trail
```

### Scenario 4: User Management (Super Admin)
```
1. Super Admin logs into the system
2. Super Admin navigates to User Management module
3. Super Admin creates a new Admin account
4. Super Admin assigns Admin role and permissions
5. System validates and stores user account
6. System sends account credentials to new admin
7. System logs the action in audit trail
8. Super Admin confirms successful account creation
```

### Scenario 5: Farmer Portal Access
```
1. Farmer logs into the farmer portal
2. System authenticates and loads farmer dashboard
3. Farmer views personal farm data (parcels, crops, livestock)
4. Farmer checks assistance application status
5. Farmer receives notification about approved assistance
6. System logs the access in audit trail
```

---

## Non-Functional Requirements (Context Level)

### Performance
- System should support concurrent access by 50+ users
- Page load time should be under 3 seconds
- GIS map rendering should complete within 5 seconds for 1000 parcels

### Availability
- System uptime target: 99% during business hours (8 AM - 5 PM)
- Planned maintenance windows outside business hours

### Scalability
- System should handle up to 10,000 registered farmers
- Database should support 100,000+ parcel records
- Report generation should handle municipality-wide queries

### Security
- All communications via HTTPS
- User passwords must meet complexity requirements
- Session timeout after 30 minutes of inactivity
- Audit logging for all data modifications

### Usability
- Interface should be intuitive for users with basic computer literacy
- System should provide helpful error messages
- Mobile-responsive design for field use

---

## Important Notes

### External Stakeholders (Not System Users)
While the original diagram showed "Mayor and Municipal Council" as an external entity, **they are NOT direct users of the system**. Instead:

- The Municipal Agriculturist (Admin role) generates reports for them
- Reports can be exported as PDF and shared with local government officials
- They receive information through printed/downloaded reports, not through direct system access
- They may request specific reports through the Municipal Agriculturist

### Why Only 4 Roles?
The system was designed with practical use in mind:
1. **Super Admin** - Technical administrator who sets up and maintains the system
2. **Admin** - Municipal Agriculturist who manages operations and staff
3. **Staff** - Day-to-day data encoders and agricultural officers
4. **Farmer** - Beneficiaries who can view their own data

A "Viewer" role existed previously but was retired because it was never used in practice.

---

## Glossary

| Term | Definition |
|------|------------|
| **RSBSA** | Registry System for Basic Sectors in Agriculture - National farmer registry |
| **GeoJSON** | Geographic JSON format for encoding geographic data structures |
| **QR Code** | Quick Response code used for farmer identification |
| **Palupi** | Filipino term for warnings/alerts (climate/pest warnings) |
| **Staff** | System role for data entry personnel and agricultural officers |
| **Admin** | System role for municipal agriculturist (full operational access) |
| **Super Admin** | System role for technical administrator (full system access) |
| **Farmer** | System role for agricultural producers (limited portal access) |
| **Farm Parcel** | A defined plot of agricultural land |
| **Assistance Distribution** | Government programs providing aid to farmers |
| **Audit Log** | Record of system activities for compliance and security |
| **RBAC** | Role-Based Access Control - Permission management system |
| **Spatie Permission** | Laravel package for managing roles and permissions |

---

**Document Version:** 2.0  
**Last Updated:** September 14, 2026  
**Related Documents:** SYSTEM_ARCHITECTURE.md  
**Author:** Development Team  
**Changelog:**
- v2.0: Removed "Mayor and Municipal Council" as external entity; clarified actual system roles (Super Admin, Admin, Staff, Farmer)
- v1.0: Initial documentation
