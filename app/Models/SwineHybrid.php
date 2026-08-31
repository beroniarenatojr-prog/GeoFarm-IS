<?php

namespace App\Models;

use App\Models\Concerns\TracksHerdSize;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwineHybrid extends Model
{
    use TracksHerdSize;

    protected $table = 'swine_hybrid';

    protected $fillable = [
        'farmer_id',
        'variety',
        'male_count',
        'female_count',
        'purpose',
        'health_status',
        'last_vaccination',
        'notes',
    ];

    protected $casts = [
        'male_count'       => 'integer',
        'female_count'     => 'integer',
        'total_heads'      => 'integer',
        'is_large_raiser'  => 'boolean',
        'last_vaccination' => 'date:Y-m-d',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
