<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Remove the inventory dependency from assistance programs.
 *
 * The inventory module (Farm Assets) has been removed from the system, but
 * assistance programs still need to track what items are distributed. This
 * migration allows programs to use free-text item names instead of requiring
 * foreign key references to inventory_items.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assistance_program_items', function (Blueprint $table) {
            // Add item_name column for free-text item names
            $table->string('item_name', 100)->nullable()->after('assistance_id');
            
            // Add unit column (e.g., "kg", "bags", "pieces")
            $table->string('unit', 20)->nullable()->after('item_name');
            
            // Make inventory_item_id nullable and drop the foreign key constraint
            // This allows items to be either linked to inventory OR use text names
            $table->foreignId('inventory_item_id')->nullable()->change();
        });

        // Drop the foreign key constraint if it exists
        Schema::table('assistance_program_items', function (Blueprint $table) {
            $table->dropForeign(['inventory_item_id']);
        });
        
        // Recreate as nullable foreign key (won't restrict deletes anymore)
        Schema::table('assistance_program_items', function (Blueprint $table) {
            $table->foreign('inventory_item_id')
                ->references('id')
                ->on('inventory_items')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assistance_program_items', function (Blueprint $table) {
            // Drop the new columns
            $table->dropColumn(['item_name', 'unit']);
            
            // Restore the original foreign key constraint
            $table->dropForeign(['inventory_item_id']);
        });
        
        Schema::table('assistance_program_items', function (Blueprint $table) {
            $table->foreignId('inventory_item_id')->nullable(false)->change();
            $table->foreign('inventory_item_id')
                ->references('id')
                ->on('inventory_items')
                ->restrictOnDelete();
        });
    }
};
