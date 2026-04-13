# Agricultural Assets - Quick Reference

## Common Tasks

### Add a New Asset Record
```javascript
// In React component
const { data, setData, post } = useForm({
  farmer_id: farmerId,
  // ... other fields
});

post('/admin/tree-crops', {
  onSuccess: () => toast.success('Added successfully')
});
```

### Query Assets in Controller
```php
// Get all tree crops for a farmer
$crops = TreeCrop::where('farmer_id', $farmerId)->get();

// With farmer relationship
$crops = TreeCrop::with('farmer')->get();

// Count large raisers
$largeRaisers = LargeRuminant::where('is_large_raiser', true)->count();
```

### Update Farmer Model
```php
// In Farmer model, relationships are already added:
$farmer->treeCrops;
$farmer->fishponds;
$farmer->largeRuminants;
// etc.
```

## Database Queries

### Get Total Livestock by Barangay
```sql
SELECT f.barangay, 
       SUM(lr.male_count + lr.female_count) as total
FROM large_ruminants lr
JOIN farmers f ON lr.farmer_id = f.id
GROUP BY f.barangay;
```

### Find Large Raisers
```sql
SELECT f.*, lr.total_heads
FROM farmers f
JOIN large_ruminants lr ON f.id = lr.farmer_id
WHERE lr.is_large_raiser = 1;
```

### Tree Crop Summary
```sql
SELECT crop_type, 
       SUM(quantity) as total_trees,
       SUM(area_hectares) as total_area
FROM tree_crops
GROUP BY crop_type;
```

## API Endpoints

### Tree Crops
```
POST   /admin/tree-crops
PUT    /admin/tree-crops/{id}
DELETE /admin/tree-crops/{id}
```

### Fishponds
```
POST   /admin/fishponds
PUT    /admin/fishponds/{id}
DELETE /admin/fishponds/{id}
```

### Large Ruminants
```
POST   /admin/large-ruminants
PUT    /admin/large-ruminants/{id}
DELETE /admin/large-ruminants/{id}
```

### Small Ruminants
```
POST   /admin/small-ruminants
PUT    /admin/small-ruminants/{id}
DELETE /admin/small-ruminants/{id}
```

### Native Pigs
```
POST   /admin/native-pigs
PUT    /admin/native-pigs/{id}
DELETE /admin/native-pigs/{id}
```

### Swine Hybrid
```
POST   /admin/swine-hybrid
PUT    /admin/swine-hybrid/{id}
DELETE /admin/swine-hybrid/{id}
```

### Poultry
```
POST   /admin/poultry
PUT    /admin/poultry/{id}
DELETE /admin/poultry/{id}
```

### Crop Estimator
```
GET  /admin/crop-estimator
POST /admin/crop-estimator/estimate
```

### Reports
```
GET /admin/reports/agricultural-assets?format=pdf
GET /admin/reports/agricultural-assets (JSON)
```

## Form Validation Rules

### Tree Crops
```php
'farmer_id' => 'required|exists:farmers,id',
'crop_type' => 'required|in:Mango,Banana,Cacao,Pineapple',
'quantity' => 'nullable|integer|min:0',
'area_hectares' => 'nullable|numeric|min:0',
```

### Fishponds
```php
'farmer_id' => 'required|exists:farmers,id',
'species' => 'required|in:Tilapia,Hito',
'area_hectares' => 'required|numeric|min:0',
```

### Livestock (All Types)
```php
'farmer_id' => 'required|exists:farmers,id',
'animal_type' => 'required|in:Cattle,Carabao', // or Goat,Sheep
'male_count' => 'required|integer|min:0',
'female_count' => 'required|integer|min:0',
```

## React Component Usage

### TreeCropForm
```jsx
<TreeCropForm
  farmerId={farmer.id}
  crop={existingCrop} // or null for new
  onClose={() => setModal(false)}
/>
```

### FishpondForm
```jsx
<FishpondForm
  farmerId={farmer.id}
  fishpond={existingFishpond} // or null
  onClose={() => setModal(false)}
/>
```

### LivestockForm
```jsx
<LivestockForm
  farmerId={farmer.id}
  record={existingRecord} // or null
  type="large" // or "small", "native", "swine", "poultry"
  endpoint="/admin/large-ruminants"
  onClose={() => setModal(false)}
/>
```

## Enum Values

### Tree Crops
- Mango
- Banana
- Cacao
- Pineapple

### Fishponds
- Tilapia
- Hito

### Large Ruminants
- Cattle
- Carabao

### Small Ruminants
- Goat
- Sheep

### Swine Hybrid
- White
- Brown

### Poultry
- Chicken
- Ducks
- Goose
- Turkey

## Model Events

### Auto-Calculations (on save)
```php
// In LargeRuminant, SmallRuminant, NativePig, SwineHybrid, Poultry
protected static function booted(): void
{
    static::saving(function ($model) {
        $total = $model->male_count + $model->female_count;
        $model->is_large_raiser = $total > 20;
    });
}
```

## Useful Artisan Commands

```bash
# Run migrations
php artisan migrate

# Seed crop recommendations
php artisan db:seed --class=CropRecommendationsSeeder

# Clear cache
php artisan cache:clear

# Generate IDE helper (if installed)
php artisan ide-helper:models

# Check routes
php artisan route:list --name=admin
```

## Debugging Tips

### Check if asset exists
```php
$exists = TreeCrop::where('farmer_id', $id)->exists();
```

### Get validation errors
```javascript
// In React
const { errors } = useForm();
console.log(errors);
```

### Test API endpoint
```bash
curl -X POST http://localhost/admin/tree-crops \
  -H "Content-Type: application/json" \
  -d '{"farmer_id":1,"crop_type":"Mango","quantity":50}'
```

## Performance Tips

1. **Eager Load Relationships**
   ```php
   $farmer->load(['treeCrops', 'fishponds', 'largeRuminants']);
   ```

2. **Use Indexes**
   - Already added on farmer_id, animal_type, species

3. **Paginate Large Results**
   ```php
   TreeCrop::paginate(20);
   ```

4. **Cache Reports**
   ```php
   Cache::remember('agri-assets', 3600, function() {
       return /* query */;
   });
   ```

## Common Errors & Solutions

### "Column not found"
- Run migrations: `php artisan migrate`

### "Class not found"
- Run: `composer dump-autoload`

### "Undefined property"
- Check model relationships
- Ensure eager loading in controller

### "CSRF token mismatch"
- Check Inertia setup
- Verify CSRF middleware

### Frontend not updating
- Build assets: `npm run build`
- Clear browser cache

## File Locations

```
Models:              app/Models/
Controllers:         app/Http/Controllers/Admin/
Migrations:          database/migrations/
Seeders:             database/seeders/
React Components:    resources/js/Components/AgriAssets/
React Pages:         resources/js/Pages/Admin/
Routes:              routes/web.php
Views (PDF):         resources/views/reports/
```

## Testing Checklist

- [ ] Can add tree crop
- [ ] Can edit tree crop
- [ ] Can delete tree crop
- [ ] Large raiser auto-calculates
- [ ] Crop estimator shows results
- [ ] PDF report generates
- [ ] All tabs visible on farmer profile
- [ ] Forms validate correctly
- [ ] Deleting farmer cascades to assets

---

**Last Updated**: April 3, 2026
