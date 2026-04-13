<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('assistance_barangays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assistance_id')->constrained('financial_assistance')->cascadeOnDelete();
            $table->foreignId('barangay_id')->constrained('barangays')->cascadeOnDelete();
            $table->timestamps();
            
            $table->unique(['assistance_id', 'barangay_id'], 'unique_assistance_barangay');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistance_barangays');
    }
};
