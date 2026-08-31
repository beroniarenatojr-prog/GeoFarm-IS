<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssistanceDistribution extends Model
{
    protected $fillable = [
        'assistance_id',
        'farmer_id',
        'distribution_date',
        'quantity_given',
        'amount_given',
        'status',
        'is_customized',
        'customization_reason',
        'notes',
    ];

    protected $casts = [
        'distribution_date' => 'date',
        'quantity_given' => 'decimal:2',
        'amount_given' => 'decimal:2',
        'is_customized' => 'boolean',
    ];

    public $timestamps = false;

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            $model->created_at = now();
        });

        // Record when a distribution is updated — e.g. marking pending → claimed.
        static::updating(function ($model) {
            $model->updated_at = now();
        });
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(FinancialAssistance::class, 'assistance_id');
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    /**
     * The goods issued as part of this payout. Empty for cash-only assistance.
     * These rows are the actual stock movements — deleting this payout takes
     * them with it, which is why returning the stock has to happen first.
     */
    public function itemIssues(): HasMany
    {
        return $this->hasMany(InventoryDistribution::class, 'assistance_distribution_id');
    }
}
