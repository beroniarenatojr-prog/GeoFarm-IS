# GeoFarm Information System - Database Schema Documentation

## Table 1. Users Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | name | VARCHAR(255) | Juan Dela Cruz
 | email | VARCHAR(255) | admin@geofarm.com
 | email_verified_at | TIMESTAMP | 2026-03-27 10:30:00
 | password | VARCHAR(255) | $2y$10$...
 | remember_token | VARCHAR(100) | NULL
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 1 shows the fields used to store user account information in the system. It contains authentication credentials, including name, email, and encrypted password. The table also includes email verification status, remember token for persistent login sessions, and timestamps to track account creation and updates, ensuring secure user authentication and access control.

## Table 2. Farmers Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | rsbsa_no | VARCHAR(50) | 01-02-03-123-456789
 | first_name | VARCHAR(50) | Juan
 | last_name | VARCHAR(50) | Dela Cruz
 | middle_name | VARCHAR(50) | Santos
 | suffix | VARCHAR(10) | Jr.
 | birthdate | DATE | 1980-05-15
 | birthplace | VARCHAR(100) | Ilagan, Isabela
 | sex | ENUM('Male', 'Female') | Male
 | civil_status | ENUM('Single', 'Married', 'Widowed', 'Separated') | Married
 | mobile_no | VARCHAR(20) | 09123456789
 | email | VARCHAR(100) | juan@example.com
 | religion | VARCHAR(50) | Roman Catholic
 | pwd | TINYINT(1) | 0
 | is_4ps | TINYINT(1) | 1
 | mother_maiden_name | VARCHAR(100) | Maria Santos
 | highest_education | VARCHAR(50) | High School Graduate
 | photo_path | VARCHAR(255) | farmers/photos/1.jpg
 | qr_code_path | VARCHAR(255) | farmers/qrcodes/1.png
 | barangay | VARCHAR(50) | San Vicente
 | city_municipality | VARCHAR(50) | Ilagan City
 | province | VARCHAR(50) | Isabela
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 2 shows the fields used to store farmer information in the system. It contains comprehensive personal details including RSBSA number, full name, demographic information, contact details, and address. The table also includes special indicators for PWD status and 4Ps beneficiary status, photo and QR code paths for identification, and timestamps to track record creation and updates, ensuring complete farmer profile management.

## Table 3. Farm Parcels Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | parcel_number | VARCHAR(20) | P-001
 | location_address | VARCHAR(255) | Sitio Maligaya
 | barangay | VARCHAR(50) | San Vicente
 | city_municipality | VARCHAR(50) | Ilagan City
 | province | VARCHAR(50) | Isabela
 | total_area_ha | DECIMAL(10,2) | 2.50
FK | farm_type_id | BIGINT UNSIGNED | 1
 | ownership_type | ENUM('Registered Owner', 'Lessee', 'Tenant', 'Other') | Registered Owner
 | land_owner_name | VARCHAR(100) | Juan Dela Cruz
 | within_ancestral | TINYINT(1) | 0
 | arb | TINYINT(1) | 1
 | geom | GEOMETRY | POLYGON(...)
 | geojson | JSON | {"type":"Polygon",...}
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 3 shows the fields used to store farm parcel information in the system. It contains land identification details including parcel number, location address, and total area in hectares. The table includes ownership information, farm type classification, and special land status indicators for ancestral domain and agrarian reform beneficiary. It also stores spatial data through geometry and GeoJSON fields for GIS mapping, with timestamps to track record creation and updates.

## Table 4. Farm Types Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | type_name | VARCHAR(50) | Irrigated
 | description | VARCHAR(255) | Land with irrigation system
 | created_at | TIMESTAMP | 2026-03-27 10:30:00

Table 4 shows the fields used to store farm type classifications in the system. It contains the type name and description for different categories of farmland such as irrigated, rainfed, upland, or lowland, providing standardized classification for agricultural land management.

## Table 5. Crops Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | crop_name | VARCHAR(50) | Rice
 | category | VARCHAR(50) | Cereal
 | optimal_temp_min | DECIMAL(5,2) | 20.00
 | optimal_temp_max | DECIMAL(5,2) | 30.00
 | optimal_rainfall_min | DECIMAL(8,2) | 1000.00
 | optimal_rainfall_max | DECIMAL(8,2) | 2000.00
 | soil_ph_min | DECIMAL(4,2) | 5.50
 | soil_ph_max | DECIMAL(4,2) | 7.00
 | created_at | TIMESTAMP | 2026-03-27 10:30:00

Table 5 shows the fields used to store crop information in the system. It contains crop identification including name and category, along with optimal growing conditions such as temperature range, rainfall requirements, and soil pH levels. This data supports crop recommendation and suitability analysis for precision agriculture.

## Table 6. Crop Seasons Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | parcel_id | BIGINT UNSIGNED | 1
 | season | ENUM('dry', 'wet') | wet
 | cropping_year | YEAR | 2026
FK | crop_id | BIGINT UNSIGNED | 1
 | area_planted_ha | DECIMAL(10,2) | 2.00
 | planting_date | DATE | 2026-06-01
 | harvest_date | DATE | 2026-10-15
 | yield_kg | DECIMAL(10,2) | 8000.00
 | inputs_used | JSON | {"fertilizer":"Urea",...}
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 6 shows the fields used to store seasonal crop production data in the system. It contains planting information including season type, cropping year, crop variety, and area planted. The table tracks the complete crop cycle from planting to harvest dates, records yield in kilograms, and stores agricultural inputs used in JSON format, enabling comprehensive crop production monitoring and analysis.

## Table 7. Livestock Types Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | type_name | VARCHAR(50) | Cattle
 | category | VARCHAR(50) | Large Ruminant
 | created_at | TIMESTAMP | 2026-03-27 10:30:00

Table 7 shows the fields used to store livestock type classifications in the system. It contains the type name and category for different kinds of livestock such as cattle, goats, pigs, and poultry, providing standardized classification for livestock management and inventory tracking.

## Table 8. Livestock Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
FK | livestock_type_id | BIGINT UNSIGNED | 1
 | breed | VARCHAR(50) | Brahman
 | count | INT | 5
 | purpose | ENUM('Dairy', 'Meat', 'Draft', 'Breeding', 'Pet') | Meat
 | health_status | ENUM('Healthy', 'Sick', 'Treated', 'Vaccinated') | Healthy
 | last_vaccination | DATE | 2026-03-01
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 8 shows the fields used to store livestock inventory information in the system. It contains livestock identification including type and breed, quantity count, and purpose of raising. The table tracks health management data including health status and vaccination records, with timestamps to monitor livestock population changes and health interventions.

## Table 9. Financial Assistance Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | program_name | VARCHAR(100) | Rice Seed Distribution 2026
FK | assistance_type_id | BIGINT UNSIGNED | 1
 | description | TEXT | Distribution of certified rice seeds
 | total_budget | DECIMAL(12,2) | 500000.00
 | start_date | DATE | 2026-04-01
 | end_date | DATE | 2026-04-30
FK | created_by | BIGINT UNSIGNED | 1
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 9 shows the fields used to store financial assistance program information in the system. It contains program identification including name, type, and description, along with budget allocation and implementation period. The table tracks the program creator and timestamps for audit purposes, enabling comprehensive assistance program management and monitoring.

## Table 10. Assistance Types Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | type_name | VARCHAR(100) | Seeds
 | distribution_type | ENUM('individual', 'barangay') | individual
 | unit | VARCHAR(50) | bags
 | description | TEXT | Certified rice seeds
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 10 shows the fields used to store assistance type classifications in the system. It contains the type name, distribution method (individual or barangay-level), unit of measurement, and description for different kinds of assistance such as seeds, fertilizer, cash, or equipment, providing standardized categorization for assistance program management.

## Table 11. Assistance Distributions Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | assistance_id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | distribution_date | DATE | 2026-04-15
 | quantity_given | DECIMAL(10,2) | 2.00
 | amount_given | DECIMAL(10,2) | 5000.00
 | status | ENUM('pending', 'claimed', 'forfeited') | claimed
 | notes | TEXT | Received in good condition
 | created_at | TIMESTAMP | 2026-03-27 10:30:00

Table 11 shows the fields used to store assistance distribution records in the system. It contains distribution details linking assistance programs to individual farmers, including distribution date, quantity or amount given, and claim status. The table includes notes for additional information and timestamps to track distribution activities, ensuring transparent and accountable assistance delivery.

## Table 12. Barangays Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | name | VARCHAR(100) | San Vicente
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 12 shows the fields used to store barangay information in the system. It contains the barangay name and timestamps for record tracking, providing a standardized list of barangays for location-based data management and barangay-level assistance distribution.

## Table 13. Assistance Barangays Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | assistance_id | BIGINT UNSIGNED | 1
FK | barangay_id | BIGINT UNSIGNED | 1
 | quantity_allocated | DECIMAL(10,2) | 100.00
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 13 shows the fields used to store barangay-level assistance allocation in the system. It links assistance programs to specific barangays with allocated quantities, enabling barangay-wide distribution management and equitable resource allocation across different communities.

## Table 14. Tree Crops Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | crop_type | VARCHAR(100) | Mango
 | variety | VARCHAR(100) | Carabao
 | number_of_trees | INT | 50
 | planting_year | YEAR | 2020
 | area_ha | DECIMAL(10,2) | 1.50
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 14 shows the fields used to store tree crop information in the system. It contains details about perennial crops including crop type, variety, number of trees, planting year, and area coverage. This table enables tracking of long-term agricultural investments and fruit tree inventory management.

## Table 15. Fishponds Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | species | VARCHAR(100) | Tilapia
 | area_ha | DECIMAL(10,2) | 0.50
 | stocking_density | INT | 5000
 | production_cycle | VARCHAR(50) | 4 months
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 15 shows the fields used to store fishpond information in the system. It contains aquaculture details including fish species, pond area, stocking density, and production cycle duration. This table supports fishery management and aquaculture production monitoring.

## Table 16. Large Ruminants Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | animal_type | ENUM('cattle', 'carabao') | cattle
 | breed | VARCHAR(100) | Brahman
 | head_count | INT | 5
 | purpose | VARCHAR(100) | Meat production
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 16 shows the fields used to store large ruminant livestock information in the system. It contains details about cattle and carabao including animal type, breed, head count, and raising purpose. This table enables specialized tracking of large livestock for meat, dairy, or draft purposes.

## Table 17. Small Ruminants Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | animal_type | ENUM('goat', 'sheep') | goat
 | breed | VARCHAR(100) | Anglo-Nubian
 | head_count | INT | 10
 | purpose | VARCHAR(100) | Meat and milk
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 17 shows the fields used to store small ruminant livestock information in the system. It contains details about goats and sheep including animal type, breed, head count, and raising purpose. This table supports small livestock management and production monitoring.

## Table 18. Native Pigs Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | breed | VARCHAR(100) | Native Black
 | head_count | INT | 8
 | purpose | VARCHAR(100) | Meat production
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 18 shows the fields used to store native pig information in the system. It contains details about indigenous pig breeds including breed name, head count, and raising purpose. This table enables tracking of native pig populations for conservation and production purposes.

## Table 19. Swine Hybrid Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | breed | VARCHAR(100) | Duroc x Landrace
 | head_count | INT | 15
 | purpose | VARCHAR(100) | Commercial meat
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 19 shows the fields used to store hybrid swine information in the system. It contains details about commercial pig breeds including breed combination, head count, and raising purpose. This table supports commercial swine production monitoring and inventory management.

## Table 20. Poultry Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | farmer_id | BIGINT UNSIGNED | 1
 | poultry_type | ENUM('chicken', 'duck', 'quail', 'turkey', 'other') | chicken
 | breed | VARCHAR(100) | Rhode Island Red
 | head_count | INT | 100
 | purpose | VARCHAR(100) | Egg production
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 20 shows the fields used to store poultry information in the system. It contains details about various poultry types including chickens, ducks, quail, and turkeys, with breed information, head count, and raising purpose. This table enables comprehensive poultry inventory management for both egg and meat production.

## Table 21. Audit Logs Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
FK | user_id | BIGINT UNSIGNED | 1
 | action | VARCHAR(100) | UPDATE
 | table_name | VARCHAR(100) | farmers
 | record_id | BIGINT UNSIGNED | 5
 | old_data | JSON | {"name":"Old Name"}
 | new_data | JSON | {"name":"New Name"}
 | created_at | TIMESTAMP | 2026-03-27 10:30:00

Table 21 shows the fields used to store audit trail information in the system. It contains comprehensive logging of all data modifications including user who performed the action, action type, affected table and record, and before/after data values in JSON format. This table ensures data integrity, accountability, and provides a complete history of system changes for security and compliance purposes.

## Table 22. Roles Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | name | VARCHAR(255) | Super Admin
 | guard_name | VARCHAR(255) | web
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 22 shows the fields used to store user role definitions in the system. It contains role names such as Super Admin, Admin, Data Encoder, and Viewer, along with guard name for authentication context. This table is part of the role-based access control system that manages user permissions and access levels.

## Table 23. Permissions Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
PK | id | BIGINT UNSIGNED | 1
 | name | VARCHAR(255) | view farmers
 | guard_name | VARCHAR(255) | web
 | created_at | TIMESTAMP | 2026-03-27 10:30:00
 | updated_at | TIMESTAMP | 2026-03-27 10:30:00

Table 23 shows the fields used to store permission definitions in the system. It contains specific permission names for various system actions such as view, create, edit, and delete operations on different modules. This table enables granular access control by defining individual permissions that can be assigned to roles or users.

## Table 24. Model Has Roles Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
FK | role_id | BIGINT UNSIGNED | 1
 | model_type | VARCHAR(255) | App\Models\User
FK | model_id | BIGINT UNSIGNED | 1

Table 24 shows the fields used to assign roles to users in the system. It creates a many-to-many relationship between users and roles, allowing a user to have multiple roles. This pivot table enables flexible role assignment for access control management.

## Table 25. Model Has Permissions Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
FK | permission_id | BIGINT UNSIGNED | 1
 | model_type | VARCHAR(255) | App\Models\User
FK | model_id | BIGINT UNSIGNED | 1

Table 25 shows the fields used to assign direct permissions to users in the system. It creates a many-to-many relationship between users and permissions, allowing specific permissions to be granted to individual users beyond their role permissions. This table enables fine-grained access control customization.

## Table 26. Role Has Permissions Table

Key | Fields | Data Type | Example
----|--------|-----------|--------
FK | permission_id | BIGINT UNSIGNED | 1
FK | role_id | BIGINT UNSIGNED | 1

Table 26 shows the fields used to assign permissions to roles in the system. It creates a many-to-many relationship between roles and permissions, defining which permissions are included in each role. This pivot table is central to the role-based access control system, determining what actions users with specific roles can perform.


Note: PK = Primary Key, FK = Foreign Key
