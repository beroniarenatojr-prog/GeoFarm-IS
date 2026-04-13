<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->string('organization_name', 100)->nullable()->after('is_4ps');
            $table->boolean('is_indigenous')->default(false)->after('pwd');
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->dropColumn(['organization_name', 'is_indigenous']);
        });
    }
};
