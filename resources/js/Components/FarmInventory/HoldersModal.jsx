import { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import ModalShell from '@/Components/ui/ModalShell';

/**
 * Which farmers are behind one row of an inventory panel.
 *
 * Every panel on the page groups records — "Goat — 29 farmers — 338 heads",
 * "Coconut — 14 farmers — 3.38 ha" — and each answered how many without ever
 * saying who. This answers who, for whichever row was clicked.
 *
 * Deliberately generic. The columns are not written here: the endpoint sends
 * them with the rows, because goats have male/female counts, fishponds have
 * hectares and machinery has a brand and a status. Hard-coding that shape in
 * the front end would duplicate the database's structure somewhere it would
 * quietly fall out of step the first time a column moved.
 */
const num = (v, dp = 0) => Number(v ?? 0).toLocaleString('en-PH', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
});

/** A missing figure reads as absent, never as zero. */
const cell = (value, column) => {
    if (value === null || value === undefined || value === '') {
        return <span className="text-gray-300">—</span>;
    }

    return typeof value === 'number' ? num(value, column.dp ?? 0) : String(value);
};

export default function HoldersModal({ source, label, query = {}, onClose }) {
    const [state, setState] = useState({ loading: true, error: null, data: null });

    useEffect(() => {
        let cancelled = false;

        const params = new URLSearchParams(
            Object.entries(query).filter(([, v]) => v !== null && v !== undefined && v !== '')
        );

        setState({ loading: true, error: null, data: null });

        fetch(`/admin/farm-inventory/holders/${source}?${params}`, {
            headers: { Accept: 'application/json' },
        })
            .then(res => {
                if (!res.ok) throw new Error(String(res.status));
                return res.json();
            })
            .then(data => { if (!cancelled) setState({ loading: false, error: null, data }); })
            .catch(() => {
                if (!cancelled) {
                    setState({ loading: false, error: 'Could not load the farmers for this row.', data: null });
                }
            });

        return () => { cancelled = true; };
        // Serialised so an object rebuilt on each render does not refetch.
    }, [source, JSON.stringify(query)]);

    const { loading, error, data } = state;
    const columns = data?.columns ?? [];
    const rows = data?.rows ?? [];
    const totals = data?.totals ?? {};

    return (
        <ModalShell open onClose={onClose} title={label ? `${label} — by farmer` : 'By farmer'}>
            {loading && (
                <p className="py-10 text-center text-sm text-gray-500">Loading farmers…</p>
            )}

            {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                    {error}
                </p>
            )}

            {!loading && !error && rows.length === 0 && (
                <div className="py-10 text-center">
                    <Users className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">No farmers hold records for this row.</p>
                </div>
            )}

            {!loading && !error && rows.length > 0 && (
                <>
                    <p className="mb-3 text-xs text-gray-500">
                        <strong className="text-gray-700">{num(totals.farmers)}</strong>
                        {' '}farmer{totals.farmers === 1 ? '' : 's'}
                        {totals.records !== totals.farmers && (
                            <> · {num(totals.records)} record{totals.records === 1 ? '' : 's'}</>
                        )}
                    </p>

                    <div className="max-h-[60vh] overflow-auto rounded-xl border border-green-100">
                        <table className="w-full min-w-[520px] text-sm">
                            <thead className="sticky top-0 bg-green-50/80 backdrop-blur">
                                <tr>
                                    <th scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#006400]">
                                        Farmer
                                    </th>
                                    {columns.map(c => (
                                        <th
                                            key={c.key}
                                            scope="col"
                                            className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#006400] ${
                                                c.align === 'right' ? 'text-right' : 'text-left'
                                            }`}
                                        >
                                            {c.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-green-50">
                                {rows.map(row => (
                                    <tr key={row.id} className="hover:bg-green-50/40">
                                        <td className="px-3 py-2">
                                            <span className="font-medium text-gray-900">{row.farmer}</span>
                                            <span className="block text-[11px] text-gray-500">
                                                {[row.barangay, row.rsbsa_no].filter(Boolean).join(' · ') || '—'}
                                            </span>
                                        </td>
                                        {columns.map(c => (
                                            <td
                                                key={c.key}
                                                className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${
                                                    c.strong ? 'font-semibold text-gray-900' : 'text-gray-700'
                                                }`}
                                            >
                                                {cell(row[c.key], c)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>

                            {/*
                                The total the office asked for. Summed on the
                                server from these same rows, so it cannot drift
                                from the figures above it or from the panel row
                                that was clicked.
                            */}
                            <tfoot className="sticky bottom-0 border-t-2 border-green-100 bg-white">
                                <tr>
                                    <td className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#006400]">
                                        Total
                                    </td>
                                    {columns.map(c => (
                                        <td
                                            key={c.key}
                                            className={`px-3 py-2 font-bold text-gray-900 ${
                                                c.align === 'right' ? 'text-right tabular-nums' : ''
                                            }`}
                                        >
                                            {totals[c.key] === undefined
                                                ? <span className="text-gray-300">—</span>
                                                : num(totals[c.key], c.dp ?? 0)}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            <div className="mt-4 flex justify-end">
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    <X className="h-4 w-4" /> Close
                </button>
            </div>
        </ModalShell>
    );
}
