<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Association extends Model
{
    public $timestamps = false;
    protected $fillable = ['association_name'];
}
