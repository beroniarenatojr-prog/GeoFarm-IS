<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use Notifiable, HasRoles;

    protected $fillable = ['name', 'email', 'password', 'is_active', 'last_login', 'active_session_id', 'avatar_path'];

    /**
     * The profile picture's URL, or null for the initial-letter fallback.
     *
     * Appended so every screen that renders a user — the sidebar, the audit
     * log, the user list — gets it without each one remembering to ask. It is
     * one short string, not the image.
     */
    protected $appends = ['avatar_url'];

    public function getAvatarUrlAttribute(): ?string
    {
        return $this->avatar_path
            ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->avatar_path)
            : null;
    }

    // lock_password is intentionally absent from $fillable: it is only ever
    // written through setLockPassword(), never mass-assigned from a request.
    protected $hidden = ['password', 'lock_password'];

    protected $casts = [
        'password'             => 'hashed',
        'lock_password'        => 'hashed',
        'is_active'            => 'boolean',
        'last_login'           => 'datetime',
        'lock_password_set_at' => 'datetime',
    ];

    /**
     * The farmer record this login belongs to, for Farmer accounts.
     *
     * farmers.user_id is ON DELETE SET NULL, so removing the account unlinks
     * the farmer rather than deleting them — their registry entry, parcels and
     * assistance history all survive, but they lose portal access. User
     * Management shows that before anyone presses Delete.
     */
    public function farmer()
    {
        return $this->hasOne(Farmer::class);
    }

    /**
     * Where this account belongs when it arrives with nowhere particular to go.
     *
     * Used by the login redirect and by the installed app's start URL, which is
     * the reason it is a method rather than two copies of the same `if`. The
     * launcher icon opens the app cold with no intended URL, and sending every
     * installer to the public landing page — or sending an office account to
     * the farmer portal, which refuses them — is how an installed app comes to
     * feel broken on launch.
     */
    public function homeRoute(): string
    {
        return $this->hasRole('Farmer') ? 'farmer.dashboard' : 'admin.dashboard';
    }

    public function hasLockPassword(): bool
    {
        return filled($this->lock_password);
    }

    /**
     * Confirm a lock password. Separate from the login password on purpose —
     * being signed in is not by itself authority to freeze or release a
     * record's figures.
     */
    public function checkLockPassword(?string $plain): bool
    {
        return filled($plain)
            && $this->hasLockPassword()
            && Hash::check($plain, $this->lock_password);
    }

    /** Rejects reuse of the login password, which would defeat the point. */
    public function lockPasswordMatchesLogin(string $plain): bool
    {
        return Hash::check($plain, $this->password);
    }

    public function setLockPassword(string $plain): void
    {
        $this->forceFill([
            'lock_password'        => $plain,   // hashed by the cast
            'lock_password_set_at' => now(),
        ])->save();
    }
}
