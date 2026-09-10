import AdminLayout from '@/Layouts/AdminLayout';
import { router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Mail, Search, Send, User, AtSign, ShieldCheck, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/Components/ui/Card';
import { formatDate } from '@/utils/dateFormatter';

/**
 * Staff writing to one farmer.
 *
 * The per-farmer modal on the profile page is the main way in; this screen is
 * for the case where staff know who they need to write to but not where that
 * farmer sits in the register. Both post to the same endpoint.
 *
 * The address is shown, never typed. The chosen farmer goes in the URL and the
 * server resolves the address from that record, so nothing the browser sends
 * can change where the mail lands.
 */
export default function SendEmail({ farmers = [], filters = {}, messages = { data: [], links: [], last_page: 1, current_page: 1 } }) {
    const [expanded, setExpanded] = useState(null);
    const [search, setSearch] = useState(filters.search ?? '');

    // farmer_id steers the picker only. It is never posted: the chosen farmer
    // goes in the URL, and the server resolves the address from that record.
    const [farmerId, setFarmerId] = useState('');

    const { data, setData, post, processing, errors, reset } = useForm({
        subject: '',
        message: '',
    });

    const selected = useMemo(
        () => farmers.find(f => String(f.id) === String(farmerId)) ?? null,
        [farmers, farmerId],
    );

    const runSearch = () => {
        router.get('/admin/farmer-email', { search }, { preserveState: true, replace: true });
    };

    const submit = (e) => {
        e.preventDefault();

        if (!selected) {
            toast.error('Choose a farmer to write to first');
            return;
        }

        post(`/admin/farmers/${selected.id}/send-email`, {
            preserveScroll: true,
            // The picker keeps its selection so staff can send a follow-up to
            // the same farmer without hunting for them again.
            onSuccess: () => reset('subject', 'message'),
            onError: () => toast.error('The message was not sent'),
        });
    };

    const remaining = 10000 - data.message.length;

    return (
        <AdminLayout title="Send Email to Farmer">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ------------------------------------------------ recipient */}
                <Card title="Choose a farmer" className="lg:col-span-1">
                    <div className="relative mb-4">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runSearch()}
                            placeholder="Search name, RSBSA no. or email..."
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>

                    {farmers.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6 text-center">
                            No farmer with an email address on record matches that search.
                        </p>
                    ) : (
                        <div className="max-h-[28rem] overflow-y-auto -mx-2 px-2 space-y-2">
                            {farmers.map(farmer => {
                                const active = String(farmer.id) === String(farmerId);

                                return (
                                    <button
                                        type="button"
                                        key={farmer.id}
                                        onClick={() => setFarmerId(String(farmer.id))}
                                        className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                                            active
                                                ? 'bg-green-50 border-green-500 ring-2 ring-green-500/30'
                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className="block font-medium text-sm text-gray-900">
                                            {farmer.name}
                                        </span>
                                        <span className="block text-xs text-gray-500 truncate">
                                            {farmer.email}
                                        </span>
                                        {(farmer.rsbsa_no || farmer.barangay) && (
                                            <span className="block text-xs text-gray-400 mt-0.5">
                                                {[farmer.rsbsa_no, farmer.barangay].filter(Boolean).join(' • ')}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                </Card>

                {/* -------------------------------------------------- message */}
                <Card title="Compose message" className="lg:col-span-2">
                    <form onSubmit={submit} className="space-y-5">

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                To
                            </label>
                            {selected ? (
                                <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                                    <User className="h-4 w-4 text-green-700 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm text-gray-900">{selected.name}</p>
                                        <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-0.5 break-all">
                                            <AtSign className="h-3.5 w-3.5 shrink-0" />
                                            {selected.email}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-4 py-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500">
                                    Choose a farmer from the list to see where this message will go.
                                </div>
                            )}
                            <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                The address comes from the farmer&apos;s registration record and cannot be typed here.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="subject" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                Subject
                            </label>
                            <input
                                id="subject"
                                value={data.subject}
                                onChange={e => setData('subject', e.target.value)}
                                maxLength={200}
                                placeholder="e.g. Seed distribution schedule for San Pedro"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-sm"
                            />
                            {errors.subject && <p className="mt-1.5 text-sm text-red-600">{errors.subject}</p>}
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                Message
                            </label>
                            <textarea
                                id="message"
                                value={data.message}
                                onChange={e => setData('message', e.target.value)}
                                rows={10}
                                maxLength={10000}
                                placeholder={'Write the message as you would say it.\n\nLeave a blank line between points — each paragraph is kept in the email.'}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-sm leading-relaxed"
                            />
                            <div className="mt-1.5 flex items-center justify-between gap-4">
                                {errors.message
                                    ? <p className="text-sm text-red-600">{errors.message}</p>
                                    : <p className="text-xs text-gray-400">Signed off automatically as the Municipal Agriculture Office.</p>}
                                <span className={`text-xs shrink-0 ${remaining < 250 ? 'text-amber-600' : 'text-gray-400'}`}>
                                    {remaining} characters left
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="submit"
                                disabled={processing || !selected}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                            >
                                {processing
                                    ? <><Mail className="h-4 w-4 animate-pulse" /> Sending...</>
                                    : <><Send className="h-4 w-4" /> Send email</>}
                            </button>
                        </div>
                    </form>
                </Card>

                {/* Sent messages — the record of what the office actually said.
                    Full width beneath the form, since it grows and the form
                    above it does not. */}
                <div className="lg:col-span-3">
                    <Card title="Sent messages">
                        {messages.data.length === 0 ? (
                            <p className="py-8 text-center text-sm text-gray-500">
                                Nothing sent yet. Messages you send appear here so you can read
                                back what a farmer was told.
                            </p>
                        ) : (
                            <>
                                <ul className="divide-y divide-green-50">
                                    {messages.data.map(message => {
                                        const open = expanded === message.id;

                                        return (
                                            <li key={message.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpanded(open ? null : message.id)}
                                                    aria-expanded={open}
                                                    className="flex w-full items-start gap-3 px-1 py-3 text-left hover:bg-green-50/40"
                                                >
                                                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#006400]" />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                                                            <span className="font-semibold text-gray-900">{message.farmer}</span>
                                                            <span className="text-xs text-gray-400">
                                                                {formatDate(message.sent_at)}
                                                            </span>
                                                        </span>
                                                        <span className="mt-0.5 block truncate text-sm text-gray-800">
                                                            {message.subject}
                                                        </span>
                                                        {!open && (
                                                            <span className="mt-0.5 block truncate text-xs text-gray-500">
                                                                {message.preview}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                                                </button>

                                                {open && (
                                                    <div className="mb-3 ml-7 rounded-xl border border-green-100 bg-green-50/40 p-4">
                                                        <p className="mb-2 text-xs text-gray-500">
                                                            Sent by {message.sent_by} to{' '}
                                                            <span className="break-all">{message.sent_to}</span>
                                                        </p>
                                                        {/* whitespace-pre-line: the message was
                                                            written with line breaks and arrived
                                                            with them, so it is read with them. */}
                                                        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
                                                            {message.body}
                                                        </p>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>

                                {messages.last_page > 1 && (
                                    <div className="mt-4 flex items-center justify-between border-t border-green-50 pt-3">
                                        <p className="text-xs text-gray-500">
                                            Page {messages.current_page} of {messages.last_page}
                                        </p>
                                        <div className="flex gap-2">
                                            {messages.links.map((link, i) => (
                                                <button
                                                    key={i}
                                                    disabled={!link.url}
                                                    onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                                    className={`rounded-lg px-2.5 py-1 text-xs ${
                                                        link.active
                                                            ? 'bg-[#006400] text-white'
                                                            : link.url ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'
                                                    }`}
                                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
