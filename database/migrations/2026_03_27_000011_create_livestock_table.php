<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('livestock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->foreignId('livestock_type_id')->constrained('livestock_types')->restrictOnDelete();
            $table->string('breed', 50)->nullable();
            $table->integer('count')->default(0);
            $table->enum('purpose', ['Dairy', 'Meat', 'Draft', 'Breeding', 'Pet'])->nullable();
            $table->enum('health_status', ['Healthy', 'Sick', 'Treated', 'Vaccinated'])->nullable();
            $table->date('last_vaccination')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('farmer_id', 'idx_livestock_farmer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('livestock');
    }
};
