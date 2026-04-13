<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('farmer_associations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->foreignId('association_id')->constrained('associations')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['farmer_id', 'association_id'], 'uniq_farmer_assoc');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_associations');
    }
};
