<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssistanceType extends Model
{
    protected $fillable = [
        'category',
        'type_name',
        'description',
    ];

    public $timestamps = false;

    public function programs(): HasMany
    {
        return $this->hasMany(FinancialAssistance::class, 'assistance_type_id');
    }
}
