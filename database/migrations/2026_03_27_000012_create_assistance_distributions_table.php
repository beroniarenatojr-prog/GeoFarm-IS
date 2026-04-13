<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('assistance_distributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assistance_id')->constrained('financial_assistance')->cascadeOnDelete();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->date('distribution_date');
            $table->decimal('quantity_given', 10, 2)->nullable();
            $table->decimal('amount_given', 10, 2)->nullable();
            $table->enum('status', ['pending', 'claimed', 'forfeited'])->default('pending');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('farmer_id', 'idx_dist_farmer');
            $table->index('assistance_id', 'idx_dist_assist');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistance_distributions');
    }
};
