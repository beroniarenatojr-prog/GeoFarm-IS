<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use Notifiable, HasRoles;

    protected $fillable = ['name', 'email', 'password', 'is_active', 'last_login'];
    protected $hidden   = ['password'];
    protected $casts    = ['password' => 'hashed', 'is_active' => 'boolean', 'last_login' => 'datetime'];
}
