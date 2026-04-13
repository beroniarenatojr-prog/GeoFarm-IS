<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('financial_assistance', function (Blueprint $table) {
            $table->id();
            $table->string('program_name', 100);
            $table->enum('assistance_type', ['cash', 'fertilizer', 'seed', 'vaccine', 'fingerling', 'other']);
            $table->text('description')->nullable();
            $table->decimal('total_budget', 12, 2)->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_assistance');
    }
};
