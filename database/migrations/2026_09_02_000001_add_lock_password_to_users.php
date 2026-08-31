<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A second, personal password used only to confirm locking or unlocking a
 * record — deliberately NOT the login password.
 *
 * The point is that being signed in is not by itself authority to freeze or
 * release a programme's figures: a walk-up to an unattended desk should not be
 * enough. Because each administrator sets their own, the who in "locked by
 * Renato on 31 Aug" still means something.
 *
 * Stored as a hash, like any password. Never written to the audit trail.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('lock_password')->nullable()->after('password');
            $table->timestamp('lock_password_set_at')->nullable()->after('lock_password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['lock_password', 'lock_password_set_at']);
        });
    }
};
