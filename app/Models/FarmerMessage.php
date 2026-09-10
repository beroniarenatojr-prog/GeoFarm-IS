<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message the office sent to one farmer.
 *
 * Kept so staff can read back what was actually said — what a farmer was told,
 * and in whose words. The audit log still records the same send separately and
 * without the text; that entry is the tamper-evident one and is not replaced
 * by this.
 */
class FarmerMessage extends Model
{
    protected $fillable = ['farmer_id', 'sent_by', 'sent_to', 'subject', 'body'];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    /**
     * The first line, for a list that shows what a message was about without
     * opening it. Long enough to be useful, short enough not to wrap.
     */
    public function getPreviewAttribute(): string
    {
        $flat = trim(preg_replace('/\s+/', ' ', $this->body ?? ''));

        return mb_strlen($flat) > 120 ? mb_substr($flat, 0, 119) . '…' : $flat;
    }
}
