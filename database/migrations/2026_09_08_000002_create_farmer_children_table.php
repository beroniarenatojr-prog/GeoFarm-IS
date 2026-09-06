<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The farmer's sons and daughters, one row each.
 *
 * A table rather than a count or a JSON blob because the office records them
 * by name: a household with four children is four rows, and a name can be
 * corrected without rewriting the rest.
 *
 * birthdate is nullable on purpose. Registration often happens without the
 * birth certificate to hand, and refusing the row would lose the name too.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farmer_children', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->string('name', 150);
            $table->enum('sex', ['Male', 'Female'])->nullable();
            $table->date('birthdate')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('farmer_id', 'idx_children_farmer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_children');
    }
};
