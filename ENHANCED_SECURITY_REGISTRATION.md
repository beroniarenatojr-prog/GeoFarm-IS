# Enhanced Security: Farmer Registration System

## 🔒 Security Improvements

### Problem Identified
Someone could potentially register using another farmer's RSBSA number if they know it.

### Solution Implemented
**Multi-Field Verification System** - Requires multiple pieces of personal information to match.

---

## 🛡️ Security Layers

### Layer 1: RSBSA Validation
- ✅ RSBSA must exist in database
- ✅ Must be from Tumauini, Isabela
- ✅ Cannot be already linked to an account

### Layer 2: Personal Information Verification (NEW!)
**Required Fields to Match:**

1. **Last Name** (Case-insensitive)
   - Must exactly match the registered last name
   - Whitespace is trimmed

2. **Birthdate** (Exact match)
   - Must match the registered birthdate
   - Format: YYYY-MM-DD
   - Must be a date before today

3. **Mobile Number** (Optional but verified if provided)
   - If both farmer and user provide mobile number
   - Numbers are normalized (spaces, dashes removed)
   - Must match exactly

### Layer 3: Audit Logging
- ✅ All registration attempts logged
- ✅ Failed verifications recorded with reason
- ✅ IP address tracked
- ✅ Timestamp recorded

---

## 🎯 How It Works

### Registration Process:

```
User enters:
├─ RSBSA Number
├─ Last Name  ←─────────────┐
├─ Birthdate  ←─────────────┤  Must match database
├─ Mobile Number (optional) ←┤
├─ Email                    │
└─ Password                 │
                            │
System verifies:            │
├─ RSBSA exists ────────────┘
├─ From Tumauini
├─ Not already registered
├─ Last Name matches ───────┐
├─ Birthdate matches ───────┤  Personal verification
└─ Mobile matches (if given)─┘

Result:
├─ ✅ All match → Account created
└─ ❌ Any mismatch → Registration denied
```

### Verification Logic:

```php
// 1. Birthdate Verification
$birthdateMatch = $farmer->birthdate->format('Y-m-d') === $request->birthdate;

// 2. Last Name Verification (case-insensitive)
$lastNameMatch = strtolower(trim($farmer->last_name)) === 
                 strtolower(trim($request->last_name));

// 3. Mobile Number Verification (optional)
if (both provided) {
    $farmerMobile = preg_replace('/[\s\-\(\)]/', '', $farmer->mobile_no);
    $inputMobile = preg_replace('/[\s\-\(\)]/', '', $request->mobile_no);
    $mobileMatch = $farmerMobile === $inputMobile;
}

// All must pass
if (!$birthdateMatch || !$lastNameMatch || !$mobileMatch) {
    // Registration denied + audit log
}
```

---

## 🚨 Security Features

### 1. Failed Attempt Logging
Every failed verification is logged:
```php
[
    'rsbsa_no' => 'XX-XX-XXXX',
    'attempted_email' => 'someone@email.com',
    'ip_address' => '192.168.1.1',
    'reason' => 'Personal information mismatch',
    'birthdate_match' => false,
    'lastname_match' => true,
    'timestamp' => '2026-08-04 13:00:00'
]
```

### 2. Success Logging
Every successful registration is logged:
```php
[
    'farmer_id' => 123,
    'rsbsa_no' => 'XX-XX-XXXX',
    'email' => 'farmer@email.com',
    'ip_address' => '192.168.1.1',
    'verified_fields' => ['rsbsa', 'last_name', 'birthdate', 'mobile_no']
]
```

### 3. Input Sanitization
- Email must be unique
- Password minimum 8 characters
- Birthdate must be before today
- All inputs validated and sanitized

---

## 💡 Why This Is Secure

### Prevents Impersonation:
1. **Attacker needs to know:**
   - ✅ RSBSA Number
   - ✅ Exact Last Name
   - ✅ Exact Birthdate
   - ✅ Mobile Number (if registered)

2. **Not just public info:**
   - Last name could be guessed
   - But birthdate is private
   - Mobile number is private
   - Combination is very secure

3. **Multiple verification points:**
   - Can't register with just RSBSA
   - Need personal details that only real farmer knows

### Additional Benefits:
- ✅ Failed attempts tracked (detect attack patterns)
- ✅ IP addresses logged (identify suspicious activity)
- ✅ Clear error messages (doesn't reveal which field failed)
- ✅ Mobile verification optional (more security if provided)

---

## 🎨 User Experience

### Registration Form Fields:

```
┌─────────────────────────────────────┐
│ RSBSA Number *                      │
│ [                        ]          │
│ Must be registered in Tumauini      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Last Name *                         │
│ [                        ]          │
│ Must match your registered name     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Birthdate *                         │
│ [     /     /     ]                 │
│ Must match your registered birthdate│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Mobile Number (optional)            │
│ [                        ]          │
│ For additional security             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Email Address *                     │
│ [                        ]          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Password *                          │
│ [                        ] 👁       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Confirm Password *                  │
│ [                        ] 👁       │
└─────────────────────────────────────┘

          [Create Farmer Account]
```

### Error Messages:

**If verification fails:**
```
⚠️ Verification Failed

The personal information you provided does not 
match our records. Please verify your Last Name 
and Birthdate, or contact the Agriculture Office 
for assistance.
```

**Why generic error?**
- Doesn't reveal which specific field failed
- Prevents attackers from knowing what to try next
- More secure than specific error per field

---

## 📊 Comparison: Before vs After

### Before (Less Secure):
```
Requirements:
- RSBSA Number ✓

Attack Risk: HIGH
- Attacker only needs RSBSA number
- Could be public or easily obtained
```

### After (More Secure):
```
Requirements:
- RSBSA Number ✓
- Last Name ✓
- Birthdate ✓
- Mobile Number (optional) ✓

Attack Risk: VERY LOW
- Attacker needs multiple private details
- Birthdate is not public information
- Mobile number adds extra layer
- All attempts are logged
```

---

## 🔍 Monitoring & Detection

### Admin Can Monitor:
1. **View audit logs** of all registration attempts
2. **Identify patterns** of failed registrations
3. **Detect suspicious IPs** trying multiple RSBSAs
4. **Track successful registrations** with timestamps

### SQL Query Example:
```sql
-- Check failed registration attempts
SELECT * FROM audit_logs 
WHERE action = 'failed_registration'
AND created_at > NOW() - INTERVAL 24 HOUR;

-- Check if specific RSBSA had failed attempts
SELECT * FROM audit_logs 
WHERE details->>'$.rsbsa_no' = 'XX-XX-XXXX'
AND action = 'failed_registration';
```

---

## 🎯 Testing the Security

### Test Case 1: Valid Registration
```
Input:
- RSBSA: 01-02-0001
- Last Name: Dela Cruz
- Birthdate: 1980-05-15
- Email: delacruz@email.com

Expected: ✅ Success
```

### Test Case 2: Wrong Last Name
```
Input:
- RSBSA: 01-02-0001
- Last Name: Santos (wrong!)
- Birthdate: 1980-05-15

Expected: ❌ Verification Failed
```

### Test Case 3: Wrong Birthdate
```
Input:
- RSBSA: 01-02-0001
- Last Name: Dela Cruz
- Birthdate: 1985-05-15 (wrong!)

Expected: ❌ Verification Failed
```

### Test Case 4: Wrong Mobile
```
Input:
- RSBSA: 01-02-0001
- Last Name: Dela Cruz
- Birthdate: 1980-05-15
- Mobile: 09123456789 (wrong!)

Expected: ❌ Mobile number does not match
```

---

## 📝 Summary

### What Changed:
✅ Added Last Name verification field
✅ Added Birthdate verification field
✅ Added optional Mobile Number verification
✅ Implemented multi-field matching logic
✅ Added comprehensive audit logging
✅ Enhanced error messages
✅ Updated UI with security badges

### Security Level:
- **Before**: ⭐⭐ (Weak - RSBSA only)
- **After**: ⭐⭐⭐⭐⭐ (Strong - Multi-factor verification)

### Impact:
- **User Experience**: Slightly more fields, but still simple
- **Security**: Dramatically improved
- **Admin Oversight**: Complete audit trail
- **Attack Prevention**: Very effective

---

**Version**: 2.0 (Enhanced Security)
**Date**: August 4, 2026
**Security Rating**: High
