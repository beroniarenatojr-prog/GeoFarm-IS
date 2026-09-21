<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add session tracking to prevent concurrent logins.
 * 
 * When a user logs in, their current session ID is stored. If they try to
 * login from another device/browser, the old session is invalidated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Store the current active session ID for this user
            $table->string('active_session_id', 255)->nullable()->after('last_login');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('active_session_id');
        });
    }
};
