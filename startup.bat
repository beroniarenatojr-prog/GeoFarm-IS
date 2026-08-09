@echo off
echo ========================================
echo GeoFarm-IS Startup Script
echo ========================================
echo.

echo [1/4] Clearing caches...
php artisan optimize:clear
echo.

echo [2/4] Rebuilding assets...
npm run build
echo.

echo [3/4] Starting servers...
echo.
echo Starting Laravel + Vite...
echo Visit: http://127.0.0.1:8000
echo.
echo Press Ctrl+C to stop servers
echo.

npm run dev
