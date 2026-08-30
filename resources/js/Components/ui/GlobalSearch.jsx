import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Search, Users, MapPin, Loader2, CornerDownLeft } from 'lucide-react';

/**
 * Header search. Finds a farmer or parcel from any page, so staff do not have
 * to navigate to the registry first just to look someone up.
 *
 * Queries are debounced and the server caps results, because this fires while
 * typing against a registry sized for 8,000+ farmers.
 */
export default function GlobalSearch() {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState({ farmers: [], parcels: [] });
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [cursor, setCursor] = useState(0);

    const boxRef = useRef(null);
    const inputRef = useRef(null);
    const abortRef = useRef(null);

    // Flatten for keyboard navigation.
    const items = [
        ...results.farmers.map(r => ({ ...r, kind: 'farmer' })),
        ...results.parcels.map(r => ({ ...r, kind: 'parcel' })),
    ];

    useEffect(() => {
        if (term.trim().length < 2) {
            setResults({ farmers: [], parcels: [] });
            setLoading(false);
            return;
        }

        setLoading(true);
        const timer = setTimeout(async () => {
            // Drop the previous request so out-of-order replies cannot
            // overwrite newer results.
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const res = await fetch(`/admin/search?q=${encodeURIComponent(term)}`, {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'same-origin',
                    signal: controller.signal,
                });
                if (res.ok) {
                    setResults(await res.json());
                    setCursor(0);
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    setResults({ farmers: [], parcels: [] });
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [term]);

    // Ctrl/Cmd+K from anywhere, Escape to dismiss.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
            if (e.key === 'Escape') {
                setOpen(false);
                inputRef.current?.blur();
            }
        };
        const onClick = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };

        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
        };
    }, []);

    const goTo = (item) => {
        setOpen(false);
        setTerm('');
        setResults({ farmers: [], parcels: [] });
        router.visit(item.url);
    };

    const onKeyDown = (e) => {
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => (c + 1) % items.length); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => (c - 1 + items.length) % items.length); }
        if (e.key === 'Enter') { e.preventDefault(); goTo(items[cursor]); }
    };

    const showPanel = open && term.trim().length >= 2;
    let index = -1;

    const Group = ({ label, icon: Icon, rows }) => rows.length === 0 ? null : (
        <div>
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
            {rows.map(r => {
                index += 1;
                const active = index === cursor;
                return (
                    <button
                        key={`${label}-${r.id}`}
                        onMouseEnter={() => setCursor(items.findIndex(i => i.url === r.url))}
                        onClick={() => goTo(r)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-green-50' : 'hover:bg-green-50/60'
                        }`}
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
                            <Icon className="h-4 w-4 text-[#006400]" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-900 truncate">{r.title}</span>
                            {r.subtitle && <span className="block text-xs text-gray-500 truncate">{r.subtitle}</span>}
                        </span>
                        {active && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div ref={boxRef} className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
                ref={inputRef}
                value={term}
                onChange={e => { setTerm(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder="Search farmers, parcels…"
                aria-label="Search farmers and parcels"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-14 text-sm outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-green-500"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:block">
                Ctrl K
            </kbd>

            {showPanel && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
                    {loading && items.length === 0 && (
                        <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                        </div>
                    )}

                    {!loading && items.length === 0 && (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-gray-600">No matches for “{term}”</p>
                            <p className="mt-1 text-xs text-gray-400">Try a surname, RSBSA number, or parcel number.</p>
                        </div>
                    )}

                    <Group label="Farmers" icon={Users} rows={results.farmers} />
                    <Group label="Parcels" icon={MapPin} rows={results.parcels} />
                </div>
            )}
        </div>
    );
}
