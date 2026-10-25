<?php

namespace App\Services;

use App\Models\AuditLog;

class AuditService
{
    /**
     * @param int|null $recordId  Null for an event that is not about one row —
     *   a password reset requested for an address that may not exist, say. The
     *   column has always been nullable; the signature simply did not say so,
     *   which made such an event impossible to record.
     */
    public static function log(string $action, string $table, ?int $recordId, ?array $old, ?array $new): void
    {
        AuditLog::create([
            'user_id'    => auth()->id(),
            'action'     => $action,
            'table_name' => $table,
            'record_id'  => $recordId,
            'old_data'   => $old,
            'new_data'   => $new,
        ]);
    }
}
