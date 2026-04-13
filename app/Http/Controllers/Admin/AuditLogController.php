<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $logs = AuditLog::with('user')
            ->when($request->user_id, fn($q, $v) => $q->where('user_id', $v))
            ->when($request->table_name, fn($q, $v) => $q->where('table_name', $v))
            ->when($request->action, fn($q, $v) => $q->where('action', $v))
            ->when($request->date_from, fn($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($request->date_to, fn($q, $v) => $q->whereDate('created_at', '<=', $v))
            ->latest('created_at')
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('Admin/AuditLogs/Index', [
            'logs'    => $logs,
            'users'   => User::select('id', 'name')->get(),
            'filters' => $request->only(['user_id', 'table_name', 'action', 'date_from', 'date_to']),
        ]);
    }
}
