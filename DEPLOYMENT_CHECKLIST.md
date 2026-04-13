# Agricultural Assets - Deployment Checklist

## Pre-Deployment

### 1. Code Review
- [x] All migrations created and tested
- [x] Models have proper relationships
- [x] Controllers have validation
- [x] Routes are registered
- [x] React components are error-free
- [x] No diagnostics errors

### 2. Database
- [x] Migrations run successfully
- [x] Foreign keys are set up
- [x] Indexes are created
- [x] Seeders work correctly

### 3. Testing
- [ ] Test adding tree crops
- [ ] Test adding fishponds
- [ ] Test adding livestock (all types)
- [ ] Test large raiser auto-calculation
- [ ] Test crop estimator with real data
- [ ] Test PDF report generation
- [ ] Test delete cascade (farmer deletion)
- [ ] Test form validation
- [ ] Test on different browsers

## Deployment Steps

### 1. Backup Current System
```bash
# Backup database
mysqldump -u root -p geofarm_is > backup_$(date +%Y%m%d).sql

# Backup files
tar -czf geofarm_backup_$(date +%Y%m%d).tar.gz /path/to/geofarm_is
```

### 2. Pull Latest Code
```bash
git pull origin main
# or copy files to production server
```

### 3. Install Dependencies
```bash
composer install --optimize-autoloader --no-dev
npm install
```

### 4. Run Migrations
```bash
php artisan migrate --force
```

### 5. Seed Data (Optional)
```bash
php artisan db:seed --class=CropRecommendationsSeeder
```

### 6. Build Frontend Assets
```bash
npm run build
```

### 7. Clear Caches
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

### 8. Optimize for Production
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 9. Set Permissions
```bash
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### 10. Restart Services
```bash
# Apache
sudo systemctl restart apache2

# Nginx + PHP-FPM
sudo systemctl restart nginx
sudo systemctl restart php8.2-fpm

# Queue workers (if using)
php artisan queue:restart
```

## Post-Deployment

### 1. Verify Installation
- [ ] Visit `/admin/farmers` - check if page loads
- [ ] Visit a farmer profile - check if new tabs appear
- [ ] Visit `/admin/crop-estimator` - check if page loads
- [ ] Visit `/admin/reports` - check if new report card appears
- [ ] Test adding a tree crop record
- [ ] Test generating PDF report

### 2. Check Logs
```bash
tail -f storage/logs/laravel.log
```

### 3. Monitor Performance
- [ ] Check page load times
- [ ] Check database query performance
- [ ] Monitor memory usage

### 4. User Acceptance Testing
- [ ] Train admin users on new features
- [ ] Have users test all CRUD operations
- [ ] Collect feedback

## Rollback Plan

If issues occur:

### 1. Rollback Database
```bash
# Restore from backup
mysql -u root -p geofarm_is < backup_YYYYMMDD.sql
```

### 2. Rollback Code
```bash
git revert HEAD
# or restore from backup
tar -xzf geofarm_backup_YYYYMMDD.tar.gz
```

### 3. Rebuild Assets
```bash
npm run build
php artisan cache:clear
```

## Environment Configuration

### Required .env Variables
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=geofarm_is
DB_USERNAME=your_user
DB_PASSWORD=your_password
```

### Optional Optimizations
```env
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

## Security Checklist

- [ ] APP_DEBUG=false in production
- [ ] Strong database passwords
- [ ] HTTPS enabled
- [ ] CSRF protection enabled
- [ ] File upload validation
- [ ] SQL injection prevention (using Eloquent)
- [ ] XSS protection (React auto-escapes)

## Performance Checklist

- [ ] Database indexes created
- [ ] Eager loading used in controllers
- [ ] Assets minified (npm run build)
- [ ] Opcache enabled
- [ ] Redis/Memcached configured (optional)
- [ ] CDN for static assets (optional)

## Monitoring Setup

### 1. Error Tracking
- Set up error logging
- Configure email notifications for errors
- Use tools like Sentry (optional)

### 2. Uptime Monitoring
- Set up uptime monitoring
- Configure alerts for downtime

### 3. Performance Monitoring
- Monitor database query times
- Track page load times
- Monitor server resources

## Documentation

- [ ] Update user manual
- [ ] Create training materials
- [ ] Document new features
- [ ] Update API documentation

## Support Plan

### Contact Information
- Developer: [Your Name/Team]
- Email: [support@example.com]
- Phone: [Support Number]

### Known Issues
- None currently

### FAQ
Q: How do I add a new asset type?
A: See QUICK_REFERENCE.md

Q: How do I customize the PDF report?
A: Edit resources/views/reports/agricultural-assets.blade.php

Q: How do I change the large raiser threshold?
A: Edit the model's booted() method (currently set to 20)

## Success Criteria

- [ ] All migrations run without errors
- [ ] All routes accessible
- [ ] All CRUD operations work
- [ ] PDF reports generate correctly
- [ ] No console errors in browser
- [ ] No PHP errors in logs
- [ ] Users can successfully add/edit/delete records
- [ ] Crop estimator returns results
- [ ] Large raiser status auto-calculates

## Timeline

- **Deployment Date**: [To be scheduled]
- **Testing Period**: 1-2 days
- **User Training**: 1 day
- **Go-Live**: [To be scheduled]

## Sign-Off

- [ ] Developer: _________________ Date: _______
- [ ] Project Manager: _________________ Date: _______
- [ ] Client: _________________ Date: _______

---

**Version**: 1.0.0
**Last Updated**: April 3, 2026
