<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LivestockType extends Model
{
    public $timestamps = false;
    protected $fillable = ['type_name', 'category'];
}
