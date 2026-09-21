<?php
/**
 * Quick database test script
 * Upload this to ~/public_html/ and access it via browser
 * URL: https://geo-farm.pitonmain.com/test_db.php
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "<h1>Database Test</h1>";
echo "<pre>";

try {
    // Test 1: Can we connect?
    echo "Test 1: Database Connection\n";
    echo "----------------------------\n";
    $pdo = DB::connection()->getPdo();
    echo "✅ Connected to database\n\n";
    
    // Test 2: Does the table exist?
    echo "Test 2: Table Exists\n";
    echo "--------------------\n";
    $exists = Schema::hasTable('assistance_program_items');
    echo $exists ? "✅ Table 'assistance_program_items' exists\n\n" : "❌ Table 'assistance_program_items' does NOT exist\n\n";
    
    // Test 3: Check columns
    echo "Test 3: Check Columns\n";
    echo "---------------------\n";
    
    $columns = [
        'id',
        'assistance_id',
        'inventory_item_id',
        'item_name',  // NEW
        'unit',       // NEW
        'quantity_per_farmer',
        'total_quantity',
    ];
    
    foreach ($columns as $col) {
        $has = Schema::hasColumn('assistance_program_items', $col);
        $icon = $has ? "✅" : "❌";
        $note = ($col === 'item_name' || $col === 'unit') ? " (NEW - from migration)" : "";
        echo "$icon Column '$col'$note\n";
    }
    echo "\n";
    
    // Test 4: Can we query the table?
    echo "Test 4: Query Test\n";
    echo "------------------\n";
    $count = DB::table('assistance_program_items')->count();
    echo "✅ Found $count rows in assistance_program_items\n\n";
    
    // Test 5: Check migration status
    echo "Test 5: Migration Status\n";
    echo "------------------------\n";
    $migrated = DB::table('migrations')
        ->where('migration', 'like', '%make_assistance_items_text_based%')
        ->exists();
    echo $migrated ? "✅ Migration 'make_assistance_items_text_based' HAS RUN\n" : "❌ Migration 'make_assistance_items_text_based' has NOT run yet\n";
    echo "\n";
    
    // Test 6: Try loading a model
    echo "Test 6: Model Test\n";
    echo "------------------\n";
    try {
        $item = App\Models\AssistanceProgramItem::first();
        if ($item) {
            echo "✅ Successfully loaded AssistanceProgramItem model\n";
            echo "   - ID: " . $item->id . "\n";
            echo "   - Assistance ID: " . $item->assistance_id . "\n";
            echo "   - Has item_name: " . (isset($item->item_name) ? "Yes ('" . ($item->item_name ?? 'NULL') . "')" : "No") . "\n";
            echo "   - Has unit: " . (isset($item->unit) ? "Yes ('" . ($item->unit ?? 'NULL') . "')" : "No") . "\n";
        } else {
            echo "⚠️ No AssistanceProgramItem records found (table is empty)\n";
        }
    } catch (\Exception $e) {
        echo "❌ Error loading model: " . $e->getMessage() . "\n";
    }
    echo "\n";
    
    echo "========================================\n";
    echo "ALL TESTS COMPLETE\n";
    echo "========================================\n";
    
} catch (\Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "\nStack trace:\n";
    echo $e->getTraceAsString();
}

echo "</pre>";

echo "<hr>";
echo "<p><strong>Next steps:</strong></p>";
echo "<ul>";
echo "<li>If you see ❌ for 'item_name' or 'unit' columns: Run <code>php artisan migrate --force</code></li>";
echo "<li>If migration hasn't run: Run <code>php artisan migrate --force</code></li>";
echo "<li>After fixing: Run <code>php artisan cache:clear</code></li>";
echo "<li>Then delete this test file for security</li>";
echo "</ul>";

echo "<p><em>⚠️ Delete this file after testing for security!</em></p>";
