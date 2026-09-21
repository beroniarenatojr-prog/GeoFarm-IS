# Deployment Instructions: Remove Inventory Dependency from Assistance

## Changes Made

The Assistance Distribution module has been updated to work **without** requiring the Farm Assets (Inventory) module. Items can now be entered as free text instead of being selected from inventory.

### Files Modified

1. **Database Migration** (new file)
   - `database/migrations/2026_09_21_000001_make_assistance_items_text_based.php`
   - Adds `item_name` and `unit` text columns to `assistance_program_items`
   - Makes `inventory_item_id` nullable

2. **Model**
   - `app/Models/AssistanceProgramItem.php`
   - Added `item_name` and `unit` to fillable fields
   - Added `display_name` and `display_unit` accessors

3. **Controller**
   - `app/Http/Controllers/Admin/AssistanceController.php`
   - Updated validation to accept text-based items (item_name, unit)
   - Made `inventory_item_id` optional in validation
   - Updated `syncProgramItems()` to handle both inventory-linked and text-based items
   - Updated distribution logic to skip inventory deduction for text-based items

4. **Frontend Component**
   - `resources/js/Components/Assistance/ProgramForm.jsx`
   - Replaced `SuggestSelect` dropdown with regular text inputs
   - Added `item_name` and `unit` fields
   - Removed "No stock items are on file yet" error message
   - Updated form to support free-text item entry

5. **Assets Built**
   - `public/build/` folder updated with new JavaScript/CSS

## Deployment Steps

### Step 1: Upload Files to Production

Upload the following files to your production server at `~/public_html/`:

```bash
# Upload modified files
app/Models/AssistanceProgramItem.php
app/Http/Controllers/Admin/AssistanceController.php
database/migrations/2026_09_21_000001_make_assistance_items_text_based.php

# Upload entire build folder
public/build/
```

### Step 2: Run Migration on Production

SSH into your production server and run:

```bash
cd ~/public_html
php artisan migrate --force
```

The migration will:
- Add `item_name` (varchar 100) column
- Add `unit` (varchar 20) column  
- Make `inventory_item_id` nullable
- Update foreign key constraint

### Step 3: Clear Caches

```bash
php artisan config:clear
php artisan cache:clear
php artisan view:clear
```

### Step 4: Test

1. Go to **Assistance Distribution > Create Program**
2. Click "+ Add item"
3. You should now see:
   - **Item Name** - Free text input (e.g., "Fertilizer", "Seeds")
   - **Unit** - Free text input (e.g., "kg", "bags", "pieces")
   - **Per farmer** - Quantity number
   - **Total allocated** - Optional limit

4. The form should **no longer show** the error "No stock items are on file yet. Add them under Farm Assets first."

5. Create a test program with text-based items and verify it saves correctly

6. Test distributing assistance to a farmer with the new text-based items

## What Changed for Users

### Before
- ❌ Required items to exist in Farm Assets/Inventory
- ❌ Showed error when no inventory items exist
- ❌ Could not type item names freely
- ❌ Blocked assistance distribution without inventory

### After
- ✅ Items can be typed freely as text
- ✅ No dependency on Farm Assets module
- ✅ Works with or without inventory tracking
- ✅ Can distribute assistance immediately

## Backwards Compatibility

- **Existing programs** with inventory-linked items will continue to work
- The system supports **both** methods:
  - Inventory-linked items (if inventory module is restored)
  - Free-text items (current need)
- No data loss - all existing assistance records remain intact

## Rollback Plan

If you need to rollback:

```bash
cd ~/public_html
php artisan migrate:rollback --step=1
```

Then restore the old files from backup.

## Notes

- Text-based items do **not** deduct from inventory stock
- Text-based items are recorded for documentation only
- If you restore the inventory module later, you can link items again
- The `inventory_item_id` field is preserved for future use

---

**Created:** September 21, 2026  
**Status:** Ready for deployment
