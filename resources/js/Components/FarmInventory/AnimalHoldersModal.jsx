import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Users } from 'lucide-react';
import ModalShell from '@/Components/ui/ModalShell';

/**
 * The farmers behind one line of the livestock summary.
 *
 * The panel answers "how many goats are there"; this answers "whose". Fetched
 * when the row is opened rather than shipped with the page, because the
 * summary is a handful of grouped rows and carrying every holder of every
 * species on each load would be most of the register.
 *
 * The footer totals are the server's, summed from the same records listed
 * above them — so the modal's total and the panel's row cannot disagree.
 */
const numberOf = (v) => Number(v ?? 0).toLocaleString('en-PH');

export default function AnimalHoldersModal({ row, onClose }) {
    const [state, setState] = useState({ loading: true, error: null, data: null });

    useEffect(() => {
        let cancelled = false;

        const params = new URLSearchParams();
        // native_pigs has no discriminator column, so it is asked for whole.
        if (row.key !== null && row.key !== undefined) params.set('key', row.key);

        fetch(`/admin/farm-inventory/animals/${row.source}?${params}`, {
            headers: { Accept: 'application/json' },
        })
            .then((res) => {
                if (!res.ok) throw new Error(String(res.status));
                return res.json();
            })
            .then((data) => { if (!cancelled) setState({ loading: false, error: null, data }); })
            .catch(() => {
                if (!cancelled) {
                    setState({ loading: false, error: 'Could not load the farmers for this animal.', data: null });
                }
            });

        return () => { cancelled = true; };
    }, [row]);

    const rows = state.data?.rows ?? [];
    const totals = state.data?.totals;

    return (
        <ModalShell
            open
            onClose={onClose}
            size="xl"
            title={`${row.type} — farmers`}
            footer={
                <button type="button" onClick={onClose}
                    className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Close
                </button>
            }
        >
            {state.loading && (
                <p className="py-10 text-center text-sm text-gray-500">Loading farmers…</p>
            )}

            {state.error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {state.error}
                </p>
            )}

            {!state.loading && !state.error && rows.length === 0 && (
                <div className="py-12 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-green-200" />
                    <p className="text-sm text-gray-500">No farmer holds this animal.</p>
                </div>
            )}

            {!state.loading && !state.error && rows.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead className="bg-green-50/60 text-left text-[11px] uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-3 py-2 font-semibold">Farmer</th>
                                <th className="px-3 py-2 font-semibold">Barangay</th>
                                <th className="px-3 py-2 text-right font-semibold">Male</th>
                                <th className="px-3 py-2 text-right font-semibold">Female</th>
                                <th className="px-3 py-2 text-right font-semibold">Total heads</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-green-50">
                            {rows.map((r) => (
                                <tr key={r.id} className="hover:bg-green-50/40">
                                    <td className="px-3 py-2">
                                        <Link href={`/admin/farmers/${r.farmer_id}`}
                                            className="font-medium text-gray-900 hover:text-[#006400] hover:underline">
                                            {r.farmer}
                                        </Link>
                                        {r.rsbsa_no && (
                                            <span className="block font-mono text-[11px] text-gray-400">{r.rsbsa_no}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{r.barangay || '—'}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{numberOf(r.male)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{numberOf(r.female)}</td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#006400]">
                                        {numberOf(r.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>

                        {/* The total the office actually reads off this screen. */}
                        {totals && (
                            <tfoot className="border-t-2 border-green-100 bg-green-50/40">
                                <tr>
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">
                                        Total
                                        <span className="ml-2 font-normal text-xs text-gray-500">
                                            {numberOf(totals.farmers)} farmer{totals.farmers === 1 ? '' : 's'}
                                        </span>
                                    </td>
                                    <td />
                                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                                        {numberOf(totals.male)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                                        {numberOf(totals.female)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#006400]">
                                        {numberOf(totals.total)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </ModalShell>
    );
}
