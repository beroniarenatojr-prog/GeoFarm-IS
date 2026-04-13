<?php

use App\Http\Controllers\Admin\AssistanceController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\CropEstimatorController;
use App\Http\Controllers\Admin\CropSeasonController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FarmInventoryController;
use App\Http\Controllers\Admin\FarmerController;
use App\Http\Controllers\Admin\FishpondController;
use App\Http\Controllers\Admin\GISController;
use App\Http\Controllers\Admin\LargeRuminantController;
use App\Http\Controllers\Admin\LookupController;
use App\Http\Controllers\Admin\NativePigController;
use App\Http\Controllers\Admin\ParcelController;
use App\Http\Controllers\Admin\PoultryController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\SmallRuminantController;
use App\Http\Controllers\Admin\SwineHybridController;
use App\Http\Controllers\Admin\TreeCropController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\LoginController;
use Illuminate\Support\Facades\Route;

// Auth
Route::get('/login', [LoginController::class, 'show'])->name('login');
Route::post('/login', [LoginController::class, 'store']);
Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

// Admin routes
Route::middleware(['auth'])->prefix('admin')->name('admin.')->group(function () {

    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

    // Farmers
    Route::get('farmers', [FarmerController::class, 'index'])->middleware('permission:view farmers')->name('farmers.index');
    Route::get('farmers/create', [FarmerController::class, 'create'])->middleware('permission:create farmers')->name('farmers.create');
    Route::post('farmers', [FarmerController::class, 'store'])->middleware('permission:create farmers')->name('farmers.store');
    Route::get('farmers/{farmer}', [FarmerController::class, 'show'])->middleware('permission:view farmers')->name('farmers.show');
    Route::get('farmers/{farmer}/edit', [FarmerController::class, 'edit'])->middleware('permission:edit farmers')->name('farmers.edit');
    Route::put('farmers/{farmer}', [FarmerController::class, 'update'])->middleware('permission:edit farmers')->name('farmers.update');
    Route::delete('farmers/{farmer}', [FarmerController::class, 'destroy'])->middleware('permission:delete farmers')->name('farmers.destroy');

    // Users (Admin and Super Admin only)
    Route::middleware('permission:view users')->resource('users', UserController::class);

    // Financial Assistance
    Route::get('assistance', [AssistanceController::class, 'index'])->middleware('permission:view assistance')->name('assistance.index');
    Route::get('assistance/create', [AssistanceController::class, 'create'])->middleware('permission:create assistance')->name('assistance.create');
    Route::post('assistance', [AssistanceController::class, 'store'])->middleware('permission:create assistance')->name('assistance.store');
    Route::get('assistance/{assistance}', [AssistanceController::class, 'show'])->middleware('permission:view assistance')->name('assistance.show');
    Route::get('assistance/{assistance}/edit', [AssistanceController::class, 'edit'])->middleware('permission:edit assistance')->name('assistance.edit');
    Route::put('assistance/{assistance}', [AssistanceController::class, 'update'])->middleware('permission:edit assistance')->name('assistance.update');
    Route::delete('assistance/{assistance}', [AssistanceController::class, 'destroy'])->middleware('permission:delete assistance')->name('assistance.destroy');
    Route::post('assistance/{assistance}/distribute', [AssistanceController::class, 'distribute'])
        ->middleware('permission:edit assistance')
        ->name('assistance.distribute');

    // Farm Parcels
    Route::get('parcels', [ParcelController::class, 'index'])->middleware('permission:view parcels')->name('parcels.index');
    Route::get('parcels/create', [ParcelController::class, 'create'])->middleware('permission:create parcels')->name('parcels.create');
    Route::post('parcels', [ParcelController::class, 'store'])->middleware('permission:create parcels')->name('parcels.store');
    Route::get('parcels/{parcel}', [ParcelController::class, 'show'])->middleware('permission:view parcels')->name('parcels.show');
    Route::get('parcels/{parcel}/edit', [ParcelController::class, 'edit'])->middleware('permission:edit parcels')->name('parcels.edit');
    Route::put('parcels/{parcel}', [ParcelController::class, 'update'])->middleware('permission:edit parcels')->name('parcels.update');
    Route::delete('parcels/{parcel}', [ParcelController::class, 'destroy'])->middleware('permission:delete parcels')->name('parcels.destroy');
    Route::get('parcels-geojson', [ParcelController::class, 'geojson'])->middleware('permission:view maps')->name('parcels.geojson');

    // Lookup Tables
    Route::get('lookups', [LookupController::class, 'index'])->middleware('permission:manage lookups')->name('lookups.index');
    Route::post('lookups/crops', [LookupController::class, 'storeCrop'])->middleware('permission:manage lookups')->name('lookups.crops.store');
    Route::put('lookups/crops/{crop}', [LookupController::class, 'updateCrop'])->middleware('permission:manage lookups')->name('lookups.crops.update');
    Route::delete('lookups/crops/{crop}', [LookupController::class, 'destroyCrop'])->middleware('permission:manage lookups')->name('lookups.crops.destroy');
    Route::post('lookups/farm-types', [LookupController::class, 'storeFarmType'])->middleware('permission:manage lookups')->name('lookups.farmtypes.store');
    Route::put('lookups/farm-types/{farmType}', [LookupController::class, 'updateFarmType'])->middleware('permission:manage lookups')->name('lookups.farmtypes.update');
    Route::delete('lookups/farm-types/{farmType}', [LookupController::class, 'destroyFarmType'])->middleware('permission:manage lookups')->name('lookups.farmtypes.destroy');
    Route::post('lookups/livestock-types', [LookupController::class, 'storeLivestockType'])->middleware('permission:manage lookups')->name('lookups.livestocktypes.store');
    Route::put('lookups/livestock-types/{livestockType}', [LookupController::class, 'updateLivestockType'])->middleware('permission:manage lookups')->name('lookups.livestocktypes.update');
    Route::delete('lookups/livestock-types/{livestockType}', [LookupController::class, 'destroyLivestockType'])->middleware('permission:manage lookups')->name('lookups.livestocktypes.destroy');
    Route::post('lookups/associations', [LookupController::class, 'storeAssociation'])->middleware('permission:manage lookups')->name('lookups.associations.store');
    Route::put('lookups/associations/{association}', [LookupController::class, 'updateAssociation'])->middleware('permission:manage lookups')->name('lookups.associations.update');
    Route::delete('lookups/associations/{association}', [LookupController::class, 'destroyAssociation'])->middleware('permission:manage lookups')->name('lookups.associations.destroy');

    // Reports
    Route::get('reports', [ReportController::class, 'index'])->middleware('permission:view reports')->name('reports.index');
    Route::get('reports/farmer-demographics', [ReportController::class, 'farmerDemographics'])->middleware('permission:export reports')->name('reports.demographics');
    Route::get('reports/crop-production', [ReportController::class, 'cropProduction'])->middleware('permission:export reports')->name('reports.crops');
    Route::get('reports/livestock', [ReportController::class, 'livestockInventory'])->middleware('permission:export reports')->name('reports.livestock');
    Route::get('reports/assistance', [ReportController::class, 'assistanceSummary'])->middleware('permission:export reports')->name('reports.assistance');
    Route::get('reports/agricultural-assets', [ReportController::class, 'agriculturalAssets'])->middleware('permission:export reports')->name('reports.agricultural-assets');

    // Seasonal Tracking
    Route::get('seasonal', [CropSeasonController::class, 'index'])->middleware('permission:view seasonal')->name('seasonal.index');
    Route::post('seasonal', [CropSeasonController::class, 'store'])->middleware('permission:create seasonal')->name('seasonal.store');
    Route::put('seasonal/{season}', [CropSeasonController::class, 'update'])->middleware('permission:edit seasonal')->name('seasonal.update');
    Route::delete('seasonal/{season}', [CropSeasonController::class, 'destroy'])->middleware('permission:delete seasonal')->name('seasonal.destroy');

    // Audit Logs (Admin only)
    Route::middleware('permission:view audit logs')->get('audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');

    // Agricultural Assets (Inventory)
    Route::post('tree-crops', [TreeCropController::class, 'store'])->middleware('permission:create inventory')->name('tree-crops.store');
    Route::put('tree-crops/{treeCrop}', [TreeCropController::class, 'update'])->middleware('permission:edit inventory')->name('tree-crops.update');
    Route::delete('tree-crops/{treeCrop}', [TreeCropController::class, 'destroy'])->middleware('permission:delete inventory')->name('tree-crops.destroy');

    Route::post('fishponds', [FishpondController::class, 'store'])->middleware('permission:create inventory')->name('fishponds.store');
    Route::put('fishponds/{fishpond}', [FishpondController::class, 'update'])->middleware('permission:edit inventory')->name('fishponds.update');
    Route::delete('fishponds/{fishpond}', [FishpondController::class, 'destroy'])->middleware('permission:delete inventory')->name('fishponds.destroy');

    Route::post('large-ruminants', [LargeRuminantController::class, 'store'])->middleware('permission:create inventory')->name('large-ruminants.store');
    Route::put('large-ruminants/{largeRuminant}', [LargeRuminantController::class, 'update'])->middleware('permission:edit inventory')->name('large-ruminants.update');
    Route::delete('large-ruminants/{largeRuminant}', [LargeRuminantController::class, 'destroy'])->middleware('permission:delete inventory')->name('large-ruminants.destroy');

    Route::post('small-ruminants', [SmallRuminantController::class, 'store'])->middleware('permission:create inventory')->name('small-ruminants.store');
    Route::put('small-ruminants/{smallRuminant}', [SmallRuminantController::class, 'update'])->middleware('permission:edit inventory')->name('small-ruminants.update');
    Route::delete('small-ruminants/{smallRuminant}', [SmallRuminantController::class, 'destroy'])->middleware('permission:delete inventory')->name('small-ruminants.destroy');

    Route::post('native-pigs', [NativePigController::class, 'store'])->middleware('permission:create inventory')->name('native-pigs.store');
    Route::put('native-pigs/{nativePig}', [NativePigController::class, 'update'])->middleware('permission:edit inventory')->name('native-pigs.update');
    Route::delete('native-pigs/{nativePig}', [NativePigController::class, 'destroy'])->middleware('permission:delete inventory')->name('native-pigs.destroy');

    Route::post('swine-hybrid', [SwineHybridController::class, 'store'])->middleware('permission:create inventory')->name('swine-hybrid.store');
    Route::put('swine-hybrid/{swineHybrid}', [SwineHybridController::class, 'update'])->middleware('permission:edit inventory')->name('swine-hybrid.update');
    Route::delete('swine-hybrid/{swineHybrid}', [SwineHybridController::class, 'destroy'])->middleware('permission:delete inventory')->name('swine-hybrid.destroy');

    Route::post('poultry', [PoultryController::class, 'store'])->middleware('permission:create inventory')->name('poultry.store');
    Route::put('poultry/{poultry}', [PoultryController::class, 'update'])->middleware('permission:edit inventory')->name('poultry.update');
    Route::delete('poultry/{poultry}', [PoultryController::class, 'destroy'])->middleware('permission:delete inventory')->name('poultry.destroy');

    // Crop Yield Estimator (Predictive Analytics)
    Route::get('crop-estimator', [CropEstimatorController::class, 'index'])->middleware('permission:view predictive')->name('crop-estimator.index');
    Route::post('crop-estimator/estimate', [CropEstimatorController::class, 'estimate'])->middleware('permission:view predictive')->name('crop-estimator.estimate');

    // Farm Inventory
    Route::get('farm-inventory', [FarmInventoryController::class, 'index'])->middleware('permission:view inventory')->name('farm-inventory.index');
    Route::get('farm-inventory/{farmer}/export', [FarmInventoryController::class, 'export'])->middleware('permission:export reports')->name('farm-inventory.export');

    // GIS Mapping
    Route::get('gis/map', [GISController::class, 'index'])->middleware('permission:view maps')->name('gis.map');
    Route::get('gis/parcels-geojson', [GISController::class, 'getParcelsGeoJSON'])->middleware('permission:view maps')->name('gis.parcels-geojson');
    Route::post('gis/parcels/{id}/geometry', [GISController::class, 'saveGeometry'])->middleware('permission:edit parcels')->name('gis.save-geometry');
    Route::delete('gis/parcels/{id}/geometry', [GISController::class, 'deleteGeometry'])->middleware('permission:delete parcels')->name('gis.delete-geometry');
});

Route::get('/', fn() => redirect()->route('login'));
