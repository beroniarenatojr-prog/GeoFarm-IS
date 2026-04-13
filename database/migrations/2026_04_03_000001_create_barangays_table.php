<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('barangays', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('municipality', 100)->default('Tumauini');
            $table->string('province', 100)->default('Isabela');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('name', 'idx_barangay_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barangays');
    }
};
