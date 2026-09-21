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
        'item_name',
        'unit',
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

    /**
     * Get the display name for this item.
     * Prioritizes the free-text item_name, falls back to inventory item if linked.
     * Safe to call even if migration hasn't run yet.
     */
    public function getDisplayNameAttribute(): string
    {
        // Check if item_name column exists in attributes (migration has run)
        if (array_key_exists('item_name', $this->attributes) && $this->attributes['item_name']) {
            return $this->attributes['item_name'];
        }
        
        return $this->item?->item_name ?? 'Unknown item';
    }

    /**
     * Get the display unit for this item.
     * Prioritizes the free-text unit, falls back to inventory item if linked.
     * Safe to call even if migration hasn't run yet.
     */
    public function getDisplayUnitAttribute(): ?string
    {
        // Check if unit column exists in attributes (migration has run)
        if (array_key_exists('unit', $this->attributes) && $this->attributes['unit']) {
            return $this->attributes['unit'];
        }
        
        return $this->item?->unit;
    }
}
