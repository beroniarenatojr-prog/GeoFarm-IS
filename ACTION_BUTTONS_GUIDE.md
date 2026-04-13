# Action Buttons - Consistent UI Guide

## Overview
Created reusable action button components with icons for consistent UI across all tables in GeoFarm-IS.

## Components Created

**File**: `resources/js/Components/ui/ActionButtons.jsx`

### Available Components:

1. **ViewButton** - Blue eye icon
2. **EditButton** - Green pencil icon  
3. **DeleteButton** - Red trash icon
4. **ActionButtons** - Combined component with all three

## Usage Examples

### Individual Buttons

```jsx
import { ViewButton, EditButton, DeleteButton } from '@/Components/ui/ActionButtons';
import { router } from '@inertiajs/react';

// In your table
<td className="px-4 py-3">
    <div className="flex items-center gap-2">
        <ViewButton href={`/admin/farmers/${farmer.id}`} />
        <EditButton href={`/admin/farmers/${farmer.id}/edit`} />
        <DeleteButton 
            onConfirm={() => {
                router.delete(`/admin/farmers/${farmer.id}`, {
                    preserveState: true,
                    preserveScroll: true,
                });
            }}
        />
    </div>
</td>
```

### Combined Component

```jsx
import { ActionButtons } from '@/Components/ui/ActionButtons';
import { router } from '@inertiajs/react';

<td className="px-4 py-3">
    <ActionButtons
        viewHref={`/admin/farmers/${farmer.id}`}
        editHref={`/admin/farmers/${farmer.id}/edit`}
        onDelete={() => router.delete(`/admin/farmers/${farmer.id}`)}
    />
</td>
```

### Conditional Buttons

```jsx
// Hide specific buttons
<ActionButtons
    viewHref={`/admin/farmers/${farmer.id}`}
    editHref={`/admin/farmers/${farmer.id}/edit`}
    showDelete={false}  // Don't show delete button
/>
```

## Button Styles

Each button has:
- **Size**: 32x32px (w-8 h-8)
- **Shape**: Rounded (rounded-lg)
- **Background**: Light color on hover
- **Icon**: 16x16px (h-4 w-4)
- **Tooltip**: Title attribute on hover

### Colors:
- **View**: Blue (bg-blue-50 hover:bg-blue-100 text-blue-600)
- **Edit**: Green (bg-green-50 hover:bg-green-100 text-green-600)
- **Delete**: Red (bg-red-50 hover:bg-red-100 text-red-600)

## Tables to Update

Apply these action buttons to all tables in your system:

### ✅ Already Updated:
1. **Assistance/Index.jsx** - Agricultural Assistance Programs

### 🔄 To Update:
1. **Farmers/Index.jsx** - Farmers list
2. **Parcels/Index.jsx** - Farm parcels list
3. **Users/Index.jsx** - Users list
4. **Seasonal/Index.jsx** - Seasonal tracking
5. **Lookups/Index.jsx** - Lookup tables
6. **AuditLogs/Index.jsx** - Audit logs (View only)

## Quick Update Template

For any table, replace the Actions column with:

```jsx
// 1. Add import at top
import { ViewButton, EditButton, DeleteButton } from '@/Components/ui/ActionButtons';
import { router } from '@inertiajs/react';

// 2. Replace Actions column
<td className="px-4 py-3">
    <div className="flex items-center gap-2">
        <ViewButton href={`/admin/RESOURCE/${item.id}`} />
        <EditButton href={`/admin/RESOURCE/${item.id}/edit`} />
        <DeleteButton 
            onConfirm={() => {
                router.delete(`/admin/RESOURCE/${item.id}`, {
                    preserveState: true,
                    preserveScroll: true,
                });
            }}
        />
    </div>
</td>
```

## Benefits

✅ **Consistent UI** - Same look across all tables  
✅ **Better UX** - Icons are faster to recognize than text  
✅ **Accessible** - Tooltips on hover  
✅ **Responsive** - Works on mobile  
✅ **Maintainable** - Change once, updates everywhere  
✅ **Professional** - Modern icon-based interface  

## Icons Used

From `lucide-react`:
- **Eye** - View/Show details
- **Pencil** - Edit/Modify
- **Trash2** - Delete/Remove

## Customization

To change button appearance, edit `ActionButtons.jsx`:

```jsx
// Change button size
className="w-10 h-10"  // Larger buttons

// Change icon size
<Eye className="h-5 w-5" />  // Larger icons

// Change colors
className="bg-purple-50 hover:bg-purple-100 text-purple-600"
```

## Next Steps

1. Update remaining table components to use ActionButtons
2. Consider adding more action types (Download, Print, etc.)
3. Add keyboard shortcuts (optional)
4. Add loading states for delete operations

---

**Created**: April 3, 2026  
**Status**: ✅ Component Ready  
**Usage**: Import and use in any table
