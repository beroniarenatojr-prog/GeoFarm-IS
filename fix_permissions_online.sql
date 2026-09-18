-- SQL Script to Grant Missing Permissions to Admin/Super Admin Users
-- Run this on your PRODUCTION database: u988863428_geofarm

-- Make sure these permissions exist
INSERT IGNORE INTO permissions (name, guard_name, created_at, updated_at) VALUES
('view predictive', 'web', NOW(), NOW()),
('view assistance', 'web', NOW(), NOW()),
('edit farmers', 'web', NOW(), NOW()),
('view audit logs', 'web', NOW(), NOW());

-- Grant permissions to Super Admin role
INSERT IGNORE INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
CROSS JOIN roles r
WHERE r.name = 'Super Admin'
AND p.name IN ('view predictive', 'view assistance', 'edit farmers', 'view audit logs');

-- Grant permissions to Admin role
INSERT IGNORE INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
CROSS JOIN roles r
WHERE r.name = 'Admin'
AND p.name IN ('view predictive', 'view assistance', 'edit farmers', 'view audit logs');

-- Grant permissions to Staff role (except audit logs)
INSERT IGNORE INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
CROSS JOIN roles r
WHERE r.name = 'Staff'
AND p.name IN ('view predictive', 'view assistance', 'edit farmers');

-- Verify permissions were added
SELECT r.name as role_name, p.name as permission_name
FROM roles r
JOIN role_has_permissions rhp ON r.id = rhp.role_id
JOIN permissions p ON p.id = rhp.permission_id
WHERE p.name IN ('view predictive', 'view assistance', 'edit farmers', 'view audit logs')
ORDER BY r.name, p.name;
