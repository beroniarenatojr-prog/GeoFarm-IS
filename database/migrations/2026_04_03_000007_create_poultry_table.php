<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poultry', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->enum('bird_type', ['Chicken', 'Ducks', 'Goose', 'Turkey']);
            $table->integer('male_count')->default(0);
            $table->integer('female_count')->default(0);
            $table->integer('total_heads')->storedAs('male_count + female_count');
            $table->boolean('is_large_raiser')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('farmer_id');
            $table->index('bird_type');
            $table->index('is_large_raiser');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('poultry');
    }
};
