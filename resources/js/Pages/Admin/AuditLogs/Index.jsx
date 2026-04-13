import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { useState } from 'react';

export default function AuditLogsIndex({ logs, users, filters }) {
    const [f, setF] = useState(filters);

    const apply = () => router.get('/admin/audit-logs', f, { preserveState: true });

    return (
        <AdminLayout title="Audit Logs">
            <div className="flex flex-wrap gap-3 mb-5">
                <select value={f.user_id ?? ''} onChange={e => setF({ ...f, user_id: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="">All Users</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input placeholder="Table name" value={f.table_name ?? ''} onChange={e => setF({ ...f, table_name: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm w-36 focus:ring-2 focus:ring-green-500 outline-none" />
                <input placeholder="Action" value={f.action ?? ''} onChange={e => setF({ ...f, action: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm w-28 focus:ring-2 focus:ring-green-500 outline-none" />
                <input type="date" value={f.date_from ?? ''} onChange={e => setF({ ...f, date_from: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                <input type="date" value={f.date_to ?? ''} onChange={e => setF({ ...f, date_to: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                <button onClick={apply}
                    className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                    Filter
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">When</th>
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Table</th>
                            <th className="px-4 py-3">Record ID</th>
                            <th className="px-4 py-3">Changes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.data.map(log => (
                            <tr key={log.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-400 text-xs">{log.created_at}</td>
                                <td className="px-4 py-3">{log.user?.name ?? 'System'}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                        ${log.action === 'create' ? 'bg-green-100 text-green-700' :
                                          log.action === 'update' ? 'bg-blue-100 text-blue-700' :
                                          'bg-red-100 text-red-700'}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">{log.table_name}</td>
                                <td className="px-4 py-3">{log.record_id}</td>
                                <td className="px-4 py-3">
                                    <details className="text-xs">
                                        <summary className="cursor-pointer text-blue-500">View</summary>
                                        <pre className="mt-1 bg-gray-50 p-2 rounded text-xs overflow-auto max-w-xs">
                                            {JSON.stringify({ old: log.old_data, new: log.new_data }, null, 2)}
                                        </pre>
                                    </details>
                                </td>
                            </tr>
                        ))}
                        {logs.data.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No logs found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
