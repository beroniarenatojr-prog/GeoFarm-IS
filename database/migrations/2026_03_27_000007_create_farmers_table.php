<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('farmers', function (Blueprint $table) {
            $table->id();
            $table->string('rsbsa_no', 50)->unique()->nullable();
            $table->string('first_name', 50);
            $table->string('last_name', 50);
            $table->string('middle_name', 50)->nullable();
            $table->string('suffix', 10)->nullable();
            $table->date('birthdate')->nullable();
            $table->string('birthplace', 100)->nullable();
            $table->enum('sex', ['Male', 'Female'])->nullable();
            $table->enum('civil_status', ['Single', 'Married', 'Widowed', 'Separated'])->nullable();
            $table->string('mobile_no', 20)->nullable();
            $table->string('email', 100)->nullable();
            $table->string('religion', 50)->nullable();
            $table->boolean('pwd')->default(false);
            $table->boolean('is_4ps')->default(false);
            $table->string('mother_maiden_name', 100)->nullable();
            $table->string('highest_education', 50)->nullable();
            $table->string('photo_path', 255)->nullable();
            $table->string('qr_code_path', 255)->nullable();
            $table->string('barangay', 50)->nullable();
            $table->string('city_municipality', 50)->nullable();
            $table->string('province', 50)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('barangay', 'idx_farmers_barangay');
            $table->index('rsbsa_no', 'idx_farmers_rsbsa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmers');
    }
};
