<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One movement of stock that is not a hand-out to a farmer. */
class InventoryAdjustment extends Model
{
    public const TYPES = [
        'add'      => 'Stock added',
        'reduce'   => 'Stock reduced',
        'transfer' => 'Transferred out',
        'return'   => 'Returned by farmer',
    ];

    /** Reasons offered in the form, grouped by whether they raise or lower stock. */
    public const REASONS = [
        'add'      => ['New delivery', 'Donation received', 'Correction'],
        'reduce'   => ['Damaged', 'Expired', 'Lost', 'Correction'],
        'transfer' => ['Transferred to another office', 'Transferred to storage'],
        'return'   => ['Unused by farmer', 'Wrong item issued'],
    ];

    protected $fillable = [
        'inventory_item_id', 'adjustment_type', 'quantity', 'balance_after',
        'reason', 'notes', 'adjusted_on', 'performed_by',
    ];

    protected $casts = [
        'quantity'      => 'decimal:2',
        'balance_after' => 'decimal:2',
        'adjusted_on'   => 'date',
    ];

    /** Whether this type increases the held stock. */
    public static function isIncrease(string $type): bool
    {
        return in_array($type, ['add', 'return'], true);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
