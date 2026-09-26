<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per administrative login attempt awaiting its emailed code.
 *
 * Additive only: nothing existing is altered or dropped, and down() removes
 * just this table. No column is added to `users`.
 *
 * The code itself is never stored — only a bcrypt hash of it, so a copy of
 * this table does not let anyone complete a login. Every column here exists to
 * answer one question at verification time: is this the right code, is it
 * still valid, has it been guessed at too often, and has it already been used.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_otp_verifications', function (Blueprint $table) {
            $table->id();

            /*
             * Cascade on delete: an OTP is meaningless without its user, and
             * leaving orphans behind would let a deleted administrator's
             * pending verification linger in the table.
             */
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            // A bcrypt hash of the six digits. Never the digits themselves.
            $table->string('otp_hash');

            $table->timestamp('expires_at');

            // Wrong guesses so far against THIS code. Reset when a new code is
            // issued for the same attempt.
            $table->unsignedTinyInteger('attempts')->default(0);

            // Drives the resend cooldown.
            $table->timestamp('last_sent_at')->nullable();

            /*
             * Set once, when the code is accepted. A row with this filled in
             * can never be used again, which is what stops a verified code
             * being replayed from another browser.
             */
            $table->timestamp('verified_at')->nullable();

            $table->timestamps();

            /*
             * Finding a user's live attempts, and sweeping expired rows, are
             * the only two ways this table is ever read other than by primary
             * key.
             */
            $table->index(['user_id', 'verified_at'], 'idx_login_otp_user');
            $table->index('expires_at', 'idx_login_otp_expires');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_otp_verifications');
    }
};
