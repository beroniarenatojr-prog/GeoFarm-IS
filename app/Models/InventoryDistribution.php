<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A supply issued to a farmer, optionally under an assistance programme. */
class InventoryDistribution extends Model
{
    protected $fillable = [
        'inventory_item_id', 'farmer_id', 'assistance_id', 'quantity',
        'distribution_date', 'status', 'notes', 'issued_by',
    ];

    protected $casts = [
        'quantity'          => 'decimal:2',
        'distribution_date' => 'date',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(FinancialAssistance::class, 'assistance_id');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}
