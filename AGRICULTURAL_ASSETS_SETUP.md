# Agricultural Assets Feature - Setup Guide

## Overview
This feature adds comprehensive agricultural asset management to GeoFarm-IS, including:
- Tree Crops (Mango, Banana, Cacao, Pineapple)
- Fishponds (Tilapia, Hito)
- Large Ruminants (Cattle, Carabao)
- Small Ruminants (Goat, Sheep)
- Native Pigs
- Swine Hybrid (White, Brown)
- Poultry (Chicken, Ducks, Goose, Turkey)
- Crop Yield Estimator (planning tool)
- Agricultural Assets Reports (PDF export)

## Installation Steps

### 1. Run Migrations
```bash
php artisan migrate
```

This will create the following tables:
- `tree_crops`
- `fishponds`
- `large_ruminants`
- `small_ruminants`
- `native_pigs`
- `swine_hybrid`
- `poultry`

And add columns to `crops` table:
- `seeding_rate_kg_per_ha`
- `fertilizer_bags_per_ha`

### 2. Seed Crop Recommendations (Optional)
```bash
php artisan db:seed --class=CropRecommendationsSeeder
```

This will add default seeding and fertilizer rates for common crops (Rice, Corn, etc.)

### 3. Build Frontend Assets
```bash
npm run build
```

Or for development:
```bash
npm run dev
```

## Features

### 1. Farmer Profile - Agricultural Assets Tabs
Navigate to any farmer profile (`/admin/farmers/{id}`) to see new tabs:
- **Tree Crops**: Add/edit tree crop records
- **Fishponds**: Manage fishpond data
- **Ruminants**: Large and small ruminants with auto-calculation of "Large Raiser" status (>20 heads)
- **Swine & Poultry**: Native pigs, hybrid swine, and poultry records

Each tab includes:
- Add button to create new records
- Data table with edit/delete actions
- Automatic total calculation for livestock
- Large raiser badge when total > 20

### 2. Crop Yield Estimator
Access via menu: **Crop Estimator** (`/admin/crop-estimator`)

Features:
- Select farmer (optional) and crop
- Enter area in hectares
- Get estimates for:
  - Average yield per hectare (from historical data)
  - Total estimated yield
  - Recommended seeds (kg)
  - Recommended fertilizer (bags)
- View historical seasonal data
- Based on actual crop_seasons records

### 3. Reports
Access via menu: **Reports** (`/admin/reports`)

New report available:
- **Agricultural Assets Report** (PDF/JSON)
  - Tree crops summary by barangay
  - Fishponds by species and barangay
  - Livestock breakdown (male/female/total/large raisers)
  - Swine and poultry inventory

## Database Schema

### Tree Crops
- `crop_type`: Mango, Banana, Cacao, Pineapple
- `quantity`: Number of trees (for Mango/Banana/Cacao)
- `area_hectares`: Area in hectares (for Pineapple)

### Fishponds
- `species`: Tilapia, Hito
- `area_hectares`: Pond area

### Livestock (Large/Small Ruminants, Pigs, Poultry)
- `male_count`: Number of males
- `female_count`: Number of females
- `total_heads`: Auto-calculated (male + female)
- `is_large_raiser`: Auto-set when total > 20

## API Endpoints

### Agricultural Assets
- `POST /admin/tree-crops` - Create tree crop
- `PUT /admin/tree-crops/{id}` - Update tree crop
- `DELETE /admin/tree-crops/{id}` - Delete tree crop
- (Similar endpoints for fishponds, ruminants, pigs, poultry)

### Crop Estimator
- `GET /admin/crop-estimator` - Show estimator page
- `POST /admin/crop-estimator/estimate` - Calculate estimates

### Reports
- `GET /admin/reports/agricultural-assets?format=pdf` - Download PDF
- `GET /admin/reports/agricultural-assets` - Get JSON data

## Models & Relationships

All asset models have:
- `belongsTo(Farmer::class)` relationship
- Proper fillable fields
- Type casting for numeric fields

Farmer model has:
- `hasMany(TreeCrop::class)`
- `hasMany(Fishpond::class)`
- `hasMany(LargeRuminant::class)`
- `hasMany(SmallRuminant::class)`
- `hasMany(NativePig::class)`
- `hasMany(SwineHybrid::class)`
- `hasMany(Poultry::class)`

## Usage Tips

1. **Large Raiser Status**: Automatically calculated when saving livestock records. No manual input needed.

2. **Tree Crops**: For Pineapple, use `area_hectares`. For other tree crops, use `quantity` (number of trees).

3. **Crop Estimator**: Requires historical `crop_seasons` data to calculate averages. Add crop seasons first for accurate estimates.

4. **Seeding Rates**: Configure in Lookups > Crops or run the seeder to set defaults.

5. **Reports**: PDF reports are generated using DomPDF. Customize views in `resources/views/reports/`.

## Troubleshooting

### Migrations fail
- Check database connection in `.env`
- Ensure `farmers` table exists first
- Run `php artisan migrate:fresh` (WARNING: deletes all data)

### Frontend not updating
- Clear cache: `php artisan cache:clear`
- Rebuild assets: `npm run build`
- Check browser console for errors

### Crop Estimator shows 0
- Add crop_seasons records with yield data
- Ensure crops have seeding/fertilizer rates set

## Next Steps

1. Import existing Excel data using seeders or import scripts
2. Train staff on new features
3. Customize PDF report templates as needed
4. Add validation rules for specific business requirements
5. Consider adding Excel import/export for bulk data entry

## Support

For issues or questions, contact the development team or refer to Laravel/Inertia documentation.
