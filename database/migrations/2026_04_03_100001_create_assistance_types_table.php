<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistance_types', function (Blueprint $table) {
            $table->id();
            $table->string('category', 100);
            $table->string('type_name', 100)->unique();
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistance_types');
    }
};
