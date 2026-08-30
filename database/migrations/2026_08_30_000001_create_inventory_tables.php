<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Supply inventory: what the Agriculture Office itself holds and hands out —
 * seeds, fertiliser, pesticides, vaccines, tools, machinery.
 *
 * Distinct from the Farm Inventory screens, which aggregate what FARMERS own.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('item_name');
            $table->enum('category', [
                'seed', 'fertilizer', 'pesticide', 'vaccine', 'supply', 'tool', 'machinery', 'other',
            ])->index();
            $table->string('unit', 20);                      // bags, liters, kg, pieces, vials

            // Held stock. Never written directly by the UI — every change goes
            // through an adjustment or a distribution so the ledger stays true.
            $table->decimal('quantity', 12, 2)->default(0);
            $table->decimal('min_level', 12, 2)->default(0); // low-stock threshold

            $table->string('supplier')->nullable();
            $table->string('source', 100)->nullable();       // DA, LGU, Donation…
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->string('funding_source')->nullable();
            $table->date('expiry_date')->nullable()->index();
            $table->text('description')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // The list is filtered by category and sorted by name constantly.
            $table->index(['category', 'item_name']);
        });

        Schema::create('inventory_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->enum('adjustment_type', ['add', 'reduce', 'transfer', 'return']);
            $table->decimal('quantity', 12, 2);

            // What the stock was before and after, so the ledger can be audited
            // without replaying every row.
            $table->decimal('balance_after', 12, 2);

            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->date('adjusted_on');
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['inventory_item_id', 'adjusted_on'], 'inv_adj_item_date_idx');
        });

        Schema::create('inventory_distributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            // Ties a hand-out to an assistance programme when there is one.
            $table->foreignId('assistance_id')->nullable()
                ->constrained('financial_assistance')->nullOnDelete();

            $table->decimal('quantity', 12, 2);
            $table->date('distribution_date');
            $table->enum('status', ['pending', 'claimed', 'forfeited'])->default('pending')->index();
            $table->text('notes')->nullable();

            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // Named explicitly: the generated names exceed MySQL's 64-character
            // identifier limit for a table this long.
            $table->index(['inventory_item_id', 'distribution_date'], 'inv_dist_item_date_idx');
            $table->index(['farmer_id', 'distribution_date'], 'inv_dist_farmer_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_distributions');
        Schema::dropIfExists('inventory_adjustments');
        Schema::dropIfExists('inventory_items');
    }
};
