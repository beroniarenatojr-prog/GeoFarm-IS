<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssistanceDistribution extends Model
{
    protected $fillable = [
        'assistance_id',
        'farmer_id',
        'distribution_date',
        'quantity_given',
        'amount_given',
        'status',
        'notes',
    ];

    protected $casts = [
        'distribution_date' => 'date',
        'quantity_given' => 'decimal:2',
        'amount_given' => 'decimal:2',
    ];

    public $timestamps = false;

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            $model->created_at = now();
        });
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(FinancialAssistance::class, 'assistance_id');
    }

    public function assistance(): BelongsTo
    {
        return $this->belongsTo(FinancialAssistance::class, 'assistance_id');
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
