<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tree_crops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->enum('crop_type', ['Mango', 'Banana', 'Cacao', 'Pineapple']);
            $table->integer('quantity')->nullable()->comment('Number of trees for Mango/Banana/Cacao');
            $table->decimal('area_hectares', 8, 2)->nullable()->comment('For Pineapple');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('farmer_id');
            $table->index('crop_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tree_crops');
    }
};
