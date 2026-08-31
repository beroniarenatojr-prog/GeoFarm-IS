<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What a material assistance programme hands out, and how much of it each
 * beneficiary is entitled to.
 *
 * This is the programme's plan, not a stock movement — nothing here changes
 * the warehouse balance. Stock only moves when a distribution is recorded.
 */
class AssistanceProgramItem extends Model
{
    protected $fillable = [
        'assistance_id',
        'inventory_item_id',
        'quantity_per_farmer',
        'total_quantity',
    ];

    protected $casts = [
        'quantity_per_farmer' => 'decimal:2',
        'total_quantity'      => 'decimal:2',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(FinancialAssistance::class, 'assistance_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    /** How much of this item the programme has already issued. */
    public function issued(): float
    {
        return (float) InventoryDistribution::where('assistance_id', $this->assistance_id)
            ->where('inventory_item_id', $this->inventory_item_id)
            ->where('status', '!=', 'forfeited')
            ->sum('quantity');
    }

    /** Remaining against the programme's own allocation, if it set one. */
    public function remainingAllocation(): ?float
    {
        return $this->total_quantity === null
            ? null
            : round((float) $this->total_quantity - $this->issued(), 2);
    }
}
