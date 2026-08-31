<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AuditLogController extends Controller
{
    /**
     * Columns that change on every write and say nothing about what a person
     * actually did. Showing "updated_at changed" in an audit trail is noise
     * that buries the one field that mattered.
     */
    private const NOISE = ['updated_at', 'created_at', 'remember_token', 'password'];

    /**
     * Tables whose records can be opened from here, so a log entry leads back
     * to the thing it describes rather than dead-ending at a bare id.
     */
    private const LINKS = [
        'farmers'         => '/admin/farmers/',
        'inventory_items' => '/admin/inventory/',
    ];

    public function index(Request $request)
    {
        $logs = AuditLog::with('user:id,name')
            ->when($request->user_id, fn ($q, $v) => $q->where('user_id', $v))
            ->when($request->table_name, fn ($q, $v) => $q->where('table_name', $v))
            ->when($request->action, fn ($q, $v) => $q->where('action', $v))
            ->when($request->date_from, fn ($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($request->date_to, fn ($q, $v) => $q->whereDate('created_at', '<=', $v))
            // A record id is the one thing a person has when chasing "who
            // touched farmer 4?", so it is searchable on its own.
            ->when($request->record_id, fn ($q, $v) => $q->where('record_id', $v))
            ->latest('created_at')
            ->latest('id')          // same-second entries keep a stable order
            ->paginate(25)
            ->withQueryString()
            ->through(fn ($log) => $this->present($log));

        return Inertia::render('Admin/AuditLogs/Index', [
            'logs'    => $logs,
            'users'   => User::orderBy('name')->get(['id', 'name']),
            // Real values only — a free-text box invites "farmer" when the
            // stored value is "farmers", which silently returns nothing.
            'actions' => AuditLog::distinct()->orderBy('action')->pluck('action'),
            'tables'  => AuditLog::distinct()->orderBy('table_name')->pluck('table_name'),
            'filters' => $request->only([
                'user_id', 'table_name', 'action', 'date_from', 'date_to', 'record_id',
            ]),
        ]);
    }

    /**
     * Reduces a log entry to what changed.
     *
     * A farmer update stores 57 columns before and 57 after; typically three
     * of them differ. Sending both copies to the browser and dumping them as
     * raw JSON — which is what this page used to do — hides the answer inside
     * 114 lines of unchanged data, so the comparison happens here instead.
     */
    private function present(AuditLog $log): array
    {
        $old = is_array($log->old_data) ? $log->old_data : [];
        $new = is_array($log->new_data) ? $log->new_data : [];

        $changes = [];
        foreach (array_diff(array_keys($old + $new), self::NOISE) as $field) {
            $before = $old[$field] ?? null;
            $after  = $new[$field] ?? null;

            // Loose comparison on purpose: a value read back from JSON may be
            // "1" where it went in as 1, and that is not a change anyone made.
            if ($before == $after) {
                continue;
            }

            $changes[] = [
                'field'  => $field,
                'before' => $this->readable($before),
                'after'  => $this->readable($after),
            ];
        }

        return [
            'id'         => $log->id,
            'action'     => $log->action,
            'table_name' => $log->table_name,
            'record_id'  => $log->record_id,
            'created_at' => $log->created_at,
            'user'       => $log->user?->name,
            'changes'    => $changes,
            // A create has no "before" and a delete no "after"; the page says
            // so rather than showing an empty list as though nothing happened.
            'kind'       => empty($old) ? 'created' : (empty($new) ? 'deleted' : 'changed'),
            'link'       => isset(self::LINKS[$log->table_name]) && $log->record_id
                ? self::LINKS[$log->table_name] . $log->record_id
                : null,
        ];
    }

    /** A single value as something a person can read in a table cell. */
    private function readable($value): string
    {
        if ($value === null || $value === '') {
            return '—';
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        $text = (string) $value;

        return mb_strlen($text) > 120 ? mb_substr($text, 0, 120) . '…' : $text;
    }
}
