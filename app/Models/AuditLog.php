<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;
    protected $fillable = ['user_id','action','table_name','record_id','old_data','new_data'];
    protected $casts    = ['old_data' => 'array', 'new_data' => 'array'];

    public function user() { return $this->belongsTo(User::class); }
}
