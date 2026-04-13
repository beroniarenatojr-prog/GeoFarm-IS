<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Barangay extends Model
{
    protected $fillable = [
        'name',
        'municipality',
        'province',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function assistancePrograms(): BelongsToMany
    {
        return $this->belongsToMany(FinancialAssistance::class, 'assistance_barangays', 'barangay_id', 'assistance_id');
    }
}
