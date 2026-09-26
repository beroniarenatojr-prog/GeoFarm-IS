<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One administrative login attempt waiting on its emailed code.
 *
 * The questions asked of this row at verification time are all answered here
 * rather than in the controller, so "is this code still usable" has exactly
 * one definition. otp_hash is deliberately hidden: this model must never be
 * serialised into an Inertia prop or a JSON response with the hash attached.
 */
class LoginOtpVerification extends Model
{
    protected $fillable = [
        'user_id',
        'otp_hash',
        'expires_at',
        'attempts',
        'last_sent_at',
        'verified_at',
    ];

    protected $hidden = ['otp_hash'];

    protected $casts = [
        'expires_at'   => 'datetime',
        'last_sent_at' => 'datetime',
        'verified_at'  => 'datetime',
        'attempts'     => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at === null || $this->expires_at->isPast();
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    /** Burned by too many wrong guesses. */
    public function isLocked(): bool
    {
        return $this->attempts >= (int) config('geofarm.admin_otp.max_attempts', 5);
    }

    /** Guesses left before this code is burned. Never negative. */
    public function attemptsRemaining(): int
    {
        $max = (int) config('geofarm.admin_otp.max_attempts', 5);

        return max(0, $max - $this->attempts);
    }

    /** Seconds until this code expires, from now. Zero once it has. */
    public function secondsRemaining(): int
    {
        if ($this->isExpired()) {
            return 0;
        }

        // Explicit int cast: Carbon 3 returns a float here, and an implicit
        // lossy float-to-int return is deprecated in PHP 8.1+.
        return (int) max(0, now()->diffInSeconds($this->expires_at, false));
    }

    /**
     * Seconds the user must wait before another code may be sent.
     *
     * Zero means "may resend now", which is also the answer when nothing has
     * been sent yet.
     */
    public function resendCooldownRemaining(): int
    {
        if ($this->last_sent_at === null) {
            return 0;
        }

        $cooldown = (int) config('geofarm.admin_otp.resend_cooldown_seconds', 60);
        $ready = $this->last_sent_at->copy()->addSeconds($cooldown);

        return (int) max(0, now()->diffInSeconds($ready, false));
    }

    /** Can this row still accept a guess at all? */
    public function isUsable(): bool
    {
        return ! $this->isVerified() && ! $this->isExpired() && ! $this->isLocked();
    }
}
