import AdminLayout from '@/Layouts/AdminLayout';
import { router, Link } from '@inertiajs/react';
import { useState } from 'react';
import {
    Search, X, ChevronDown, ChevronRight, ChevronLeft, ExternalLink,
    ShieldCheck, FileClock,
} from 'lucide-react';
import { formatDateTime } from '@/utils/dateFormatter';

/**
 * Every action gets its own colour. The old page painted anything that was not
 * a create or an update red, so "distribute", "adjust" and "approve" all read
 * as destructive at a glance.
 */
const ACTION_TONE = {
    create:     'bg-emerald-100 text-emerald-800 ring-emerald-200',
    update:     'bg-blue-100 text-blue-800 ring-blue-200',
    delete:     'bg-red-100 text-red-700 ring-red-200',
    distribute: 'bg-violet-100 text-violet-800 ring-violet-200',
    adjust:     'bg-amber-100 text-amber-800 ring-amber-200',
    approve:    'bg-green-100 text-green-800 ring-green-200',
    reject:     'bg-rose-100 text-rose-700 ring-rose-200',
};
const toneFor = (a) => ACTION_TONE[a] ?? 'bg-gray-100 text-gray-700 ring-gray-200';

/** "farmers" → "Farmers", "assistance_distributions" → "Assistance distributions" */
const humanise = (s) => {
    const t = String(s ?? '').replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
};

/** How long ago, for scanning; the exact stamp stays underneath it. */
function ago(iso) {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return '';
    const secs = Math.round((Date.now() - then) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.round(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
}

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
const label = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1';

/** Initial-only avatar; the registry has no user photos. */
function Who({ name }) {
    const who = name || 'System';
    return (
        <span className="flex items-center gap-2 min-w-0">
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                name ? 'bg-[#006400] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
                {who.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-sm text-gray-800">{who}</span>
        </span>
    );
}

/**
 * What actually changed, field by field.
 *
 * The comparison happens server-side, so this only ever receives the fields
 * that differ — not the fifty-odd columns that stayed the same.
 */
function Changes({ log }) {
    if (log.kind === 'created') {
        return <p className="text-xs text-gray-500">Record created. No earlier version to compare against.</p>;
    }
    if (log.kind === 'deleted') {
        return <p className="text-xs text-gray-500">Record deleted. Its values at the time are kept in the log.</p>;
    }
    if (!log.changes.length) {
        return <p className="text-xs text-gray-500">No field values differ — only timestamps were touched.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                        <th className="py-1 pr-4 font-semibold">Field</th>
                        <th className="py-1 pr-4 font-semibold">Before</th>
                        <th className="py-1 font-semibold">After</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {log.changes.map(c => (
                        <tr key={c.field} className="align-top">
                            <td className="py-1.5 pr-4 font-mono text-gray-600 whitespace-nowrap">{c.field}</td>
                            <td className="py-1.5 pr-4 text-red-700 line-through decoration-red-300 break-all">{c.before}</td>
                            <td className="py-1.5 font-semibold text-emerald-800 break-all">{c.after}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AuditLogsIndex({ logs, users, actions, tables, filters }) {
    const [f, setF] = useState(filters ?? {});
    const [open, setOpen] = useState(null);   // id of the expanded entry

    const set = (key, value) => setF(prev => ({ ...prev, [key]: value }));

    const apply = () => {
        // Blank boxes should not become ?action=&table_name= in the URL.
        const query = Object.fromEntries(
            Object.entries(f).filter(([, v]) => v !== '' && v !== null && v !== undefined),
        );
        router.get('/admin/audit-logs', query, { preserveState: true, preserveScroll: true });
    };

    const clear = () => {
        setF({});
        router.get('/admin/audit-logs', {}, { preserveState: true });
    };

    const activeCount = Object.values(filters ?? {}).filter(Boolean).length;
    const from = logs.total === 0 ? 0 : (logs.current_page - 1) * logs.per_page + 1;
    const to = Math.min(logs.total, logs.current_page * logs.per_page);

    return (
        <AdminLayout title="Audit Logs">
            {/* What this page is for — an auditor arriving cold needs to know
                the trail is complete before they trust what it shows. */}
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#006400]">
                    <ShieldCheck className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-gray-900">Who changed what, and when</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Every create, edit, deletion and hand-out recorded by the office.
                        Entries are written automatically and cannot be edited from here.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-5 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <div>
                        <label className={label}>User</label>
                        <select className={field} value={f.user_id ?? ''} onChange={e => set('user_id', e.target.value)}>
                            <option value="">Everyone</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className={label}>Action</label>
                        {/* A dropdown of what is actually in the log: the old free-text
                            box returned nothing for a near miss like "delete". */}
                        <select className={field} value={f.action ?? ''} onChange={e => set('action', e.target.value)}>
                            <option value="">Any action</option>
                            {actions.map(a => <option key={a} value={a}>{humanise(a)}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className={label}>Record type</label>
                        <select className={field} value={f.table_name ?? ''} onChange={e => set('table_name', e.target.value)}>
                            <option value="">Anything</option>
                            {tables.map(t => <option key={t} value={t}>{humanise(t)}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className={label}>Record ID</label>
                        <input className={field} type="number" min="1" placeholder="e.g. 4"
                            value={f.record_id ?? ''} onChange={e => set('record_id', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()} />
                    </div>

                    <div>
                        <label className={label}>From</label>
                        <input className={field} type="date" value={f.date_from ?? ''}
                            onChange={e => set('date_from', e.target.value)} />
                    </div>

                    <div>
                        <label className={label}>To</label>
                        <input className={field} type="date" value={f.date_to ?? ''}
                            onChange={e => set('date_to', e.target.value)} />
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={apply}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#006400] px-5 py-2 text-sm font-semibold text-white hover:bg-[#228B22]">
                        <Search className="h-4 w-4" /> Apply
                    </button>
                    {activeCount > 0 && (
                        <button onClick={clear}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                            <X className="h-4 w-4" /> Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
                        </button>
                    )}
                    <span className="ml-auto text-sm text-gray-500">
                        {logs.total === 0
                            ? 'No entries'
                            : <>Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
                               <span className="font-semibold text-gray-700">{logs.total}</span> entries</>}
                    </span>
                </div>
            </div>

            {/* Entries */}
            <div className="rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
                {logs.data.length === 0 ? (
                    <div className="py-20 text-center">
                        <FileClock className="mx-auto mb-3 h-10 w-10 text-green-200" />
                        <p className="text-sm font-medium text-gray-600">Nothing matches those filters</p>
                        <p className="mt-1 text-xs text-gray-400">Widen the dates, or clear the filters to see the whole trail.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-green-50">
                        {logs.data.map(log => {
                            const expanded = open === log.id;
                            const count = log.changes.length;

                            return (
                                <li key={log.id}>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(expanded ? null : log.id)}
                                        aria-expanded={expanded}
                                        className={`w-full text-left px-4 sm:px-5 py-3 transition-colors ${
                                            expanded ? 'bg-green-50/60' : 'hover:bg-green-50/40'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="mt-0.5 flex-shrink-0 text-gray-400">
                                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                {/* Line 1: who did what to which record */}
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <Who name={log.user} />
                                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${toneFor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                    <span className="text-sm text-gray-700">
                                                        {humanise(log.table_name)}
                                                        {log.record_id && <span className="text-gray-400"> #{log.record_id}</span>}
                                                    </span>
                                                    {log.link && (
                                                        // Stops the row toggling when the link is clicked.
                                                        <Link href={log.link} onClick={e => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#006400] hover:underline">
                                                            Open <ExternalLink className="h-3 w-3" />
                                                        </Link>
                                                    )}
                                                </div>

                                                {/* Line 2: when, and how much changed */}
                                                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                                                    <span title={formatDateTime(log.created_at)}>{ago(log.created_at)}</span>
                                                    <span>·</span>
                                                    <span>{formatDateTime(log.created_at)}</span>
                                                    {log.kind === 'changed' && (
                                                        <>
                                                            <span>·</span>
                                                            <span className={count ? 'font-medium text-gray-500' : ''}>
                                                                {count === 0 ? 'no field values changed'
                                                                    : `${count} field${count === 1 ? '' : 's'} changed`}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {expanded && (
                                        <div className="border-t border-green-100 bg-white px-4 sm:px-5 py-4 pl-11">
                                            <Changes log={log} />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {logs.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-100 bg-gray-50/60 px-4 sm:px-5 py-3">
                        <span className="text-xs text-gray-500">
                            Page {logs.current_page} of {logs.last_page}
                        </span>
                        <div className="flex items-center gap-1">
                            {/* Laravel's own link list, so first/last and the
                                page numbers stay consistent with the query. */}
                            {logs.links.map((link, i) => {
                                const isPrev = i === 0;
                                const isNext = i === logs.links.length - 1;
                                const body = isPrev
                                    ? <><ChevronLeft className="h-4 w-4" /> Prev</>
                                    : isNext ? <>Next <ChevronRight className="h-4 w-4" /></>
                                    : <span dangerouslySetInnerHTML={{ __html: link.label }} />;

                                if (!link.url) {
                                    return (
                                        <span key={i}
                                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-300 cursor-not-allowed">
                                            {body}
                                        </span>
                                    );
                                }

                                return (
                                    <Link key={i} href={link.url} preserveState preserveScroll
                                        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-sm transition-colors ${
                                            link.active
                                                ? 'border-[#006400] bg-[#006400] font-semibold text-white'
                                                : 'border-gray-200 hover:bg-gray-100'
                                        }`}>
                                        {body}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
