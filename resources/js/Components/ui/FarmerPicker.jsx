import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Type-ahead farmer selector.
 *
 * Replaces the raw "Farmer ID" number box: nobody knows a farmer by their
 * database id, and with 8,000+ records a dropdown is not an option either.
 * Search matches name, RSBSA number, reference code, barangay, mobile and
 * email, so staff can type whatever they happen to have in front of them.
 */
export default function FarmerPicker({
    value,
    onChange,
    error,
    label = 'Farmer',
    required = false,
    includeUnverified = false,
    // Pre-selected farmer for edit forms: {id, label, meta}. Without it an
    // edit screen would open showing an empty search box for a record that
    // already has a farmer.
    initial = null,
    placeholder = 'Search name, RSBSA no., barangay, mobile…',
}) {
    const [term, setTerm] = useState('');
    const [matches, setMatches] = useState([]);
    const [chosen, setChosen] = useState(initial);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const boxRef = useRef(null);
    const abortRef = useRef(null);

    // Clearing the value from outside (a form reset after save) must clear the
    // chip too, or the box would keep showing a farmer who is no longer set.
    useEffect(() => {
        if (!value) setChosen(null);
    }, [value]);

    useEffect(() => {
        if (term.trim().length < 2) {
            setMatches([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const timer = setTimeout(async () => {
            // Cancel the previous lookup so a slow early response cannot
            // overwrite the results for what was typed later.
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const url = `/admin/farmer-options?q=${encodeURIComponent(term)}`
                    + (includeUnverified ? '&include_unverified=1' : '');
                const res = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                    signal: controller.signal,
                });
                if (res.ok) {
                    setMatches(await res.json());
                    setActive(0);
                    setOpen(true);
                }
            } catch {
                /* aborted or offline — keep whatever is on screen */
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [term, includeUnverified]);

    // Clicking away closes the suggestions.
    useEffect(() => {
        const onDown = e => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const pick = match => {
        setChosen(match);
        onChange(match.id);
        setTerm('');
        setMatches([]);
        setOpen(false);
    };

    const clear = () => {
        setChosen(null);
        onChange('');
        setTerm('');
    };

    const onKeyDown = e => {
        if (!open || matches.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(i => (i + 1) % matches.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(i => (i - 1 + matches.length) % matches.length);
        } else if (e.key === 'Enter') {
            // Enter picks a suggestion rather than submitting the form.
            e.preventDefault();
            pick(matches[active]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    if (chosen) {
        return (
            <div>
                {label && <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gray-900">{chosen.label}</span>
                        {chosen.meta && <span className="block truncate text-xs text-gray-500">{chosen.meta}</span>}
                    </span>
                    <button type="button" onClick={clear} aria-label="Choose a different farmer"
                        className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div ref={boxRef} className="relative">
            {label && (
                <label className="mb-1 block text-xs font-medium text-gray-600">
                    {label}{required && <span className="text-red-500"> *</span>}
                </label>
            )}

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => matches.length && setOpen(true)}
                    placeholder={placeholder}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    className={`w-full rounded-lg border py-2 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-green-500 ${
                        error ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
            </div>

            {open && matches.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {matches.map((m, i) => (
                        <button
                            key={m.id}
                            type="button"
                            onMouseEnter={() => setActive(i)}
                            onClick={() => pick(m)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                                i === active ? 'bg-green-50' : 'hover:bg-green-50'
                            }`}
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-gray-900">{m.label}</span>
                                {m.meta && <span className="block truncate text-xs text-gray-500">{m.meta}</span>}
                            </span>
                            {m.verified && (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" aria-label="Verified" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {open && !loading && term.trim().length >= 2 && matches.length === 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-center text-xs text-gray-500 shadow-lg">
                    No farmer matches “{term}”.
                </div>
            )}

            {term.trim().length > 0 && term.trim().length < 2 && (
                <p className="mt-1 text-[11px] text-gray-400">Keep typing — at least two characters.</p>
            )}

            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
}
