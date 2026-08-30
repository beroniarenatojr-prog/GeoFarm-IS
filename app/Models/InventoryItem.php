<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A supply the Agriculture Office holds and distributes.
 *
 * `quantity` is never set directly from a form: it moves only through
 * InventoryService, which writes a matching adjustment or distribution row in
 * the same transaction. That keeps the stock figure and the ledger in step.
 */
class InventoryItem extends Model
{
    public const CATEGORIES = [
        'seed'       => 'Seeds',
        'fertilizer' => 'Fertilizer',
        'pesticide'  => 'Pesticide',
        'vaccine'    => 'Vaccines & Medicines',
        'supply'     => 'Farm Supplies',
        'tool'       => 'Equipment',
        'machinery'  => 'Machinery',
        'other'      => 'Other',
    ];

    public const UNITS = ['bags', 'kg', 'liters', 'pieces', 'vials', 'sacks', 'boxes', 'units'];

    /** Flagged as expiring this many days ahead. */
    public const EXPIRY_WARNING_DAYS = 60;

    protected $fillable = [
        'item_name', 'category', 'unit', 'quantity', 'min_level',
        'supplier', 'source', 'unit_cost', 'funding_source',
        'expiry_date', 'description', 'created_by',
    ];

    protected $casts = [
        'quantity'    => 'decimal:2',
        'min_level'   => 'decimal:2',
        'unit_cost'   => 'decimal:2',
        'expiry_date' => 'date',
    ];

    protected $appends = ['status', 'total_value', 'category_label'];

    // ------------------------------------------------------------ relations

    public function adjustments(): HasMany
    {
        return $this->hasMany(InventoryAdjustment::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(InventoryDistribution::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ----------------------------------------------------------- attributes

    /**
     * Out of stock beats low stock: an item at zero is not "low", it is gone,
     * and the two need different action from staff.
     */
    public function getStatusAttribute(): string
    {
        if ((float) $this->quantity <= 0) {
            return 'out_of_stock';
        }

        if ((float) $this->quantity <= (float) $this->min_level) {
            return 'low_stock';
        }

        return 'available';
    }

    public function getTotalValueAttribute(): ?float
    {
        return $this->unit_cost === null
            ? null
            : round((float) $this->quantity * (float) $this->unit_cost, 2);
    }

    public function getCategoryLabelAttribute(): string
    {
        return self::CATEGORIES[$this->category] ?? ucfirst((string) $this->category);
    }

    public function isExpiringSoon(): bool
    {
        return $this->expiry_date !== null
            && $this->expiry_date->isFuture()
            && $this->expiry_date->diffInDays(now()) <= self::EXPIRY_WARNING_DAYS;
    }

    public function hasExpired(): bool
    {
        return $this->expiry_date !== null && $this->expiry_date->isPast();
    }

    // --------------------------------------------------------------- scopes

    public function scopeOutOfStock($query)
    {
        return $query->where('quantity', '<=', 0);
    }

    /** Low but not empty — empty items are reported separately. */
    public function scopeLowStock($query)
    {
        return $query->whereColumn('quantity', '<=', 'min_level')
            ->where('quantity', '>', 0);
    }

    public function scopeNeedsAttention($query)
    {
        return $query->where(fn ($q) => $q
            ->whereColumn('quantity', '<=', 'min_level')
            ->orWhereNotNull('expiry_date')->whereDate('expiry_date', '<=', now()->addDays(self::EXPIRY_WARNING_DAYS)));
    }
}
