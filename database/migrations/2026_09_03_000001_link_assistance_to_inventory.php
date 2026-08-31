<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ties material assistance programmes to warehouse stock.
 *
 * Two pieces were missing. The first is what a programme actually hands out —
 * "two bags of urea per farmer" had nowhere to live. The second is the link
 * from a recorded payout back to the stock movements it caused.
 *
 * Stock still leaves through InventoryService::distribute() and nowhere else,
 * so there remains exactly one place the warehouse balance changes, with its
 * row lock and its refusal to overdraw. A separate distribution_items table
 * would have been a second such place, free to drift from the first.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistance_program_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assistance_id')
                ->constrained('financial_assistance')->cascadeOnDelete();
            // Restricted, not cascaded: deleting a stocked item that a
            // programme promises should fail loudly, not silently empty it.
            $table->foreignId('inventory_item_id')
                ->constrained('inventory_items')->restrictOnDelete();

            $table->decimal('quantity_per_farmer', 12, 2);
            // What the programme has been allocated overall. Null = no ceiling
            // beyond whatever is in the warehouse.
            $table->decimal('total_quantity', 12, 2)->nullable();
            $table->timestamps();

            // One line per item per programme; quantities are edited, not stacked.
            $table->unique(['assistance_id', 'inventory_item_id'], 'asst_prog_item_unique');
        });

        Schema::table('inventory_distributions', function (Blueprint $table) {
            $table->foreignId('assistance_distribution_id')->nullable()->after('assistance_id')
                ->constrained('assistance_distributions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_distributions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assistance_distribution_id');
        });

        Schema::dropIfExists('assistance_program_items');
    }
};
