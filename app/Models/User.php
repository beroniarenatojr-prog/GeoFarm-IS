<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use Notifiable, HasRoles;

    protected $fillable = ['name', 'email', 'password', 'is_active', 'last_login'];

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
