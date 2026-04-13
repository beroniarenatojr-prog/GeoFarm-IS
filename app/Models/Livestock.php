<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Livestock extends Model
{
    protected $table = 'livestock';
    protected $fillable = [
        'farmer_id','livestock_type_id','breed','count','purpose','health_status','last_vaccination',
    ];

    protected $casts = ['last_vaccination' => 'date'];

    public function farmer()        { return $this->belongsTo(Farmer::class); }
    public function livestockType() { return $this->belongsTo(LivestockType::class); }
}
