<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A profile picture for staff accounts.
 *
 * The path only — the file itself lives on the public disk, the same place
 * farmer photos and QR codes already go. Storing the bytes in the row would
 * bloat every query that touches a user, and the audit log joins users on
 * nearly every page.
 *
 * Nullable, and stays that way: a photo is optional, and the initial-letter
 * avatar remains the fallback for anyone who never sets one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path', 255)->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });
    }
};
