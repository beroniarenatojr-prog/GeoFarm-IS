import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';

/**
 * Choose several from a known list by typing.
 *
 * The sibling of SuggestSelect for fields that hold many ids rather than one.
 * Tumauini has 46 barangays, and a grid of 46 checkboxes means hunting for the
 * one you want; typing three letters finds it.
 *
 * What is chosen stays visible as chips, because a search box that filters the
 * list would otherwise hide the very rows that are already ticked — staff had
 * no way to see the whole selection at once.
 */
export default function MultiSuggestSelect({
    /** The chosen ids. */
    value = [],
    /** Called with the full new array of ids. */
    onChange,
    /** [{ id, label }] */
    options = [],
    placeholder = 'Type to search…',
    id,
    className = '',
    /** Wording for the checkbox that takes everything. */
    allLabel = 'Select all',
    emptyHint = null,
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const boxRef = useRef(null);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const listId = `${inputId}-suggestions`;

    const chosen = useMemo(
        () => options.filter(o => value.includes(o.id)),
        [options, value],
    );

    /*
     * Already-chosen rows stay out of the suggestions.
     *
     * Offering one that is ticked invites a click that appears to do nothing.
     * They are reachable as chips instead, which is also where they get removed.
     */
    const matches = useMemo(() => {
        const term = query.trim().toLowerCase();
        const remaining = options.filter(o => !value.includes(o.id));

        if (term === '') return remaining;

        return remaining.filter(o => `${o.label}`.toLowerCase().includes(term));
    }, [query, options, value]);

    useEffect(() => setActive(0), [query]);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = e => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    const add = option => {
        onChange?.([...value, option.id]);
        // The box stays open and the text stays put, so several barangays in
        // the same search ("San …") can be taken one after another.
        setActive(0);
    };

    const remove = id => onChange?.(value.filter(v => v !== id));

    // Derived, never stored: removing one barangay unticks this on its own.
    const allSelected = options.length > 0 && value.length === options.length;

    const toggleAll = () => onChange?.(allSelected ? [] : options.map(o => o.id));

    const onKeyDown = e => {
        if (e.key === 'ArrowDown' && !open) {
            setOpen(true);
            return;
        }

        if (e.key === 'Escape') {
            setOpen(false);
            return;
        }

        // Backspace on an empty box takes the last chip, the way tag inputs do.
        if (e.key === 'Backspace' && query === '' && value.length > 0) {
            remove(value[value.length - 1]);
            return;
        }

        if (!open || matches.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(i => (i + 1) % matches.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(i => (i - 1 + matches.length) % matches.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            add(matches[active]);
        } else if (e.key === 'Tab') {
            setOpen(false);
        }
    };

    return (
        <div ref={boxRef} className="relative">
            <div className="mb-2 flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={options.length === 0}
                        className="h-3.5 w-3.5 rounded text-green-700 focus:ring-green-500"
                    />
                    {allLabel}
                </label>
                <span className="text-xs text-gray-400">
                    {value.length === 0
                        ? 'None chosen'
                        : `${value.length} of ${options.length} chosen`}
                </span>
            </div>

            {chosen.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                    {chosen.map(option => (
                        <span key={option.id}
                            className="inline-flex items-center gap-1 rounded-full bg-green-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-green-800">
                            {option.label}
                            <button type="button" onClick={() => remove(option.id)}
                                aria-label={`Remove ${option.label}`}
                                className="rounded-full p-0.5 hover:bg-green-200">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <input
                id={inputId}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-autocomplete="list"
                aria-activedescendant={open && matches.length ? `${listId}-${active}` : undefined}
                className={className}
            />

            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-multiselectable="true"
                    className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-green-100 bg-white py-1 shadow-xl"
                >
                    {matches.length === 0 ? (
                        <li className="px-4 py-2 text-xs text-gray-500">
                            {options.length === 0
                                ? 'Nothing to choose from yet.'
                                : value.length === options.length
                                    ? 'Every one is already chosen.'
                                    : 'Nothing matches that.'}
                        </li>
                    ) : matches.map((option, index) => (
                        <li
                            key={option.id}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={false}
                            // mousedown, not click: blur fires first on click
                            // and would close the list before it registered.
                            onMouseDown={e => { e.preventDefault(); add(option); }}
                            onMouseEnter={() => setActive(index)}
                            className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm text-gray-700 ${
                                index === active ? 'bg-green-50' : ''
                            }`}
                        >
                            <Highlighted text={option.label} term={query} />
                            {index === active && <Check className="h-3.5 w-3.5 text-[#006400]" />}
                        </li>
                    ))}
                </ul>
            )}

            {options.length === 0 && emptyHint && (
                <p className="mt-1 text-xs text-amber-700">{emptyHint}</p>
            )}
        </div>
    );
}

/** Bolds the part of the suggestion already typed. */
function Highlighted({ text, term }) {
    const needle = String(term ?? '').trim().toLowerCase();
    const body = String(text ?? '');
    const at = needle === '' ? -1 : body.toLowerCase().indexOf(needle);

    if (at === -1) return body;

    return (
        <span>
            {body.slice(0, at)}
            <strong className="font-semibold">{body.slice(at, at + needle.length)}</strong>
            {body.slice(at + needle.length)}
        </span>
    );
}
