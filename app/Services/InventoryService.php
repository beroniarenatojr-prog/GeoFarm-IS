<?php

namespace App\Services;

use App\Models\InventoryAdjustment;
use App\Models\InventoryDistribution;
use App\Models\InventoryItem;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Every change to held stock goes through here.
 *
 * Two rules the rest of the app relies on:
 *   1. The stock figure and its ledger row are written in ONE transaction, so
 *      they can never disagree.
 *   2. The row is locked while it is read and rewritten. Without that, two
 *      staff issuing the last bags at the same moment would both read the same
 *      opening balance and stock would go negative.
 */
class InventoryService
{
    /**
     * Record a stock adjustment and move the balance.
     *
     * @throws RuntimeException when the movement would take stock below zero
     */
    public function adjust(InventoryItem $item, array $data, ?int $userId): InventoryAdjustment
    {
        return DB::transaction(function () use ($item, $data, $userId) {
            $locked = InventoryItem::lockForUpdate()->findOrFail($item->id);

            $type = $data['adjustment_type'];
            $quantity = round((float) $data['quantity'], 2);

            $balance = InventoryAdjustment::isIncrease($type)
                ? (float) $locked->quantity + $quantity
                : (float) $locked->quantity - $quantity;

            if ($balance < 0) {
                throw new RuntimeException(sprintf(
                    'That would leave %s at %.2f %s. Only %.2f %s in stock.',
                    $locked->item_name, $balance, $locked->unit, $locked->quantity, $locked->unit
                ));
            }

            $locked->update(['quantity' => $balance]);

            $adjustment = $locked->adjustments()->create([
                'adjustment_type' => $type,
                'quantity'        => $quantity,
                'balance_after'   => $balance,
                'reason'          => $data['reason'] ?? null,
                'notes'           => $data['notes'] ?? null,
                'adjusted_on'     => $data['adjusted_on'] ?? now()->toDateString(),
                'performed_by'    => $userId,
            ]);

            AuditService::log('adjust', 'inventory_items', $locked->id, null, [
                'type'     => $type,
                'quantity' => $quantity,
                'balance'  => $balance,
            ]);

            return $adjustment;
        });
    }

    /**
     * Issue stock to a farmer. Deducts immediately: the goods have left the
     * store even if the farmer has not signed for them yet, and reserving them
     * is what stops the same bags being promised twice.
     *
     * @throws RuntimeException when there is not enough stock
     */
    public function distribute(InventoryItem $item, array $data, ?int $userId): InventoryDistribution
    {
        return DB::transaction(function () use ($item, $data, $userId) {
            $locked = InventoryItem::lockForUpdate()->findOrFail($item->id);
            $quantity = round((float) $data['quantity'], 2);

            if ($quantity > (float) $locked->quantity) {
                throw new RuntimeException(sprintf(
                    'Only %.2f %s of %s left; cannot issue %.2f.',
                    $locked->quantity, $locked->unit, $locked->item_name, $quantity
                ));
            }

            $locked->update(['quantity' => (float) $locked->quantity - $quantity]);

            $distribution = $locked->distributions()->create([
                'farmer_id'         => $data['farmer_id'],
                'assistance_id'     => $data['assistance_id'] ?? null,
                'quantity'          => $quantity,
                'distribution_date' => $data['distribution_date'] ?? now()->toDateString(),
                'status'            => $data['status'] ?? 'pending',
                'notes'             => $data['notes'] ?? null,
                'issued_by'         => $userId,
            ]);

            AuditService::log('distribute', 'inventory_items', $locked->id, null, [
                'farmer_id' => $data['farmer_id'],
                'quantity'  => $quantity,
                'balance'   => $locked->quantity,
            ]);

            return $distribution;
        });
    }

    /**
     * A forfeited hand-out never reached the farmer, so the goods go back on
     * the shelf. Any other status change only touches the record.
     */
    public function updateDistributionStatus(InventoryDistribution $distribution, string $status, ?int $userId): void
    {
        DB::transaction(function () use ($distribution, $status, $userId) {
            $previous = $distribution->status;

            if ($previous === $status) {
                return;
            }

            $returning = $status === 'forfeited' && $previous !== 'forfeited';
            $reissuing = $previous === 'forfeited' && $status !== 'forfeited';

            if ($returning || $reissuing) {
                $item = InventoryItem::lockForUpdate()->findOrFail($distribution->inventory_item_id);
                $quantity = (float) $distribution->quantity;

                if ($reissuing && $quantity > (float) $item->quantity) {
                    throw new RuntimeException(
                        'Not enough stock to re-issue this distribution; it has been used elsewhere.'
                    );
                }

                $item->update([
                    'quantity' => $returning
                        ? (float) $item->quantity + $quantity
                        : (float) $item->quantity - $quantity,
                ]);

                $item->adjustments()->create([
                    'adjustment_type' => $returning ? 'return' : 'reduce',
                    'quantity'        => $quantity,
                    'balance_after'   => $item->quantity,
                    'reason'          => $returning ? 'Distribution forfeited' : 'Forfeited distribution re-issued',
                    'adjusted_on'     => now()->toDateString(),
                    'performed_by'    => $userId,
                ]);
            }

            $distribution->update(['status' => $status]);

            AuditService::log('update', 'inventory_distributions', $distribution->id,
                ['status' => $previous], ['status' => $status]);
        });
    }
}
