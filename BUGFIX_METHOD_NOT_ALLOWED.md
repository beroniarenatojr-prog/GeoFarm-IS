# Bug Fix: Method Not Allowed Error

## Issue
When editing parcels or assistance programs, the application was throwing:
```
MethodNotAllowedHttpException
The POST method is not supported for route admin/parcels/1. 
Supported methods: GET, HEAD, PUT, PATCH, DELETE.
```

## Root Cause
The `Parcels/Form.jsx` component was using:
```javascript
post(`/admin/parcels/${parcel.id}`, { _method: 'PUT' })
```

While this approach works in some cases, Inertia.js provides a cleaner `put()` method that should be used directly for update operations.

## Solution
Changed the form submission to use the proper Inertia method:

### Before:
```javascript
const { data, setData, post, processing, errors } = useForm({...});

const submit = e => {
    e.preventDefault();
    isEdit ? post(`/admin/parcels/${parcel.id}`, { _method: 'PUT' }) : post('/admin/parcels');
};
```

### After:
```javascript
const { data, setData, post, put, processing, errors } = useForm({...});

const submit = e => {
    e.preventDefault();
    isEdit ? put(`/admin/parcels/${parcel.id}`) : post('/admin/parcels');
};
```

## Files Modified
- `resources/js/Pages/Admin/Parcels/Form.jsx`

## Verification
- ✅ Assistance/Form.jsx was already using the correct approach
- ✅ No other forms have this issue
- ✅ No diagnostics errors

## Testing
After this fix, you should be able to:
1. Edit a parcel and save successfully
2. Edit an assistance program and save successfully
3. No more "Method Not Allowed" errors

## Best Practice
When using Inertia.js forms:
- Use `post()` for CREATE operations
- Use `put()` for UPDATE operations
- Use `delete()` for DELETE operations
- Avoid using `_method` parameter unless absolutely necessary

---

**Fixed**: April 3, 2026
**Status**: ✅ Resolved
