# Bug Fix: Delete Function 404 Error

## Issue
After deleting records (seasonal entries, agricultural assets, etc.), the application was showing a 404 "NOT FOUND" error instead of staying on the current page.

## Root Cause
The Inertia.js `router.delete()` calls were not preserving the page state and scroll position. When a delete operation completed, Inertia was trying to reload the page but the URL parameters or state were causing navigation issues, resulting in 404 errors.

## Solution
Added `preserveState` and `preserveScroll` options to all `router.delete()` calls throughout the application.

### Before:
```javascript
router.delete(`/admin/tree-crops/${row.id}`, {
    onSuccess: () => toast.success('Deleted successfully')
});
```

### After:
```javascript
router.delete(`/admin/tree-crops/${row.id}`, {
    preserveState: true,
    preserveScroll: true,
    onSuccess: () => toast.success('Deleted successfully')
});
```

## Files Modified

1. **resources/js/Pages/Admin/Seasonal/Index.jsx**
   - Fixed seasonal entry delete with error handling

2. **resources/js/Pages/Admin/Farmers/Show.jsx**
   - Fixed tree crops delete
   - Fixed fishponds delete
   - Fixed large ruminants delete
   - Fixed small ruminants delete
   - Fixed native pigs delete
   - Fixed swine hybrid delete
   - Fixed poultry delete

3. **resources/js/Pages/Admin/Lookups/Index.jsx**
   - Fixed lookup items delete

## What These Options Do

### `preserveState: true`
- Keeps the current component state intact after the request
- Prevents full page reload
- Maintains filters, search terms, and other UI state

### `preserveScroll: true`
- Maintains the current scroll position
- Prevents jumping to top of page after delete
- Better user experience

## Testing Checklist

After this fix, verify:
- [x] Deleting a seasonal entry stays on the same page
- [x] Deleting tree crops from farmer profile works
- [x] Deleting fishponds from farmer profile works
- [x] Deleting livestock records works
- [x] Deleting lookup items works
- [x] No 404 errors after delete
- [x] Success toast messages appear
- [x] Page doesn't scroll to top
- [x] Filters and state are preserved

## Best Practices for Inertia Delete Operations

Always include these options when using `router.delete()`:

```javascript
router.delete(url, {
    preserveState: true,      // Keep component state
    preserveScroll: true,     // Keep scroll position
    onSuccess: () => {        // Success callback
        // Show success message
        // Close modals
        // Update local state
    },
    onError: (errors) => {    // Error callback (optional)
        // Handle errors
        // Show error message
    }
});
```

## Additional Improvements

Added error handling to the seasonal delete function:

```javascript
onError: (errors) => {
    console.error('Delete failed:', errors);
    alert('Failed to delete season entry');
}
```

This provides better feedback if a delete operation fails.

---

**Fixed**: April 3, 2026
**Status**: ✅ Resolved
**Impact**: All delete operations across the application
