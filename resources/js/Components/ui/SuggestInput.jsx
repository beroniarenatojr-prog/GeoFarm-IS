import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * A text box that suggests from a known list while still accepting anything.
 *
 * Barangay, municipality and province are typed hundreds of times a day into
 * the registry, and the office spells them inconsistently — "Caligayan",
 * "Caligayan.", "caligayan" — which then splits one barangay into three in
 * every filter and report. Offering the real names as you type is what keeps
 * them spelled one way.
 *
 * Deliberately NOT a <select>. The list is a strong hint, not a rule: a new
 * sitio, a farmer from the next municipality, or a barangay the seed data
 * never had must all still be enterable. Whatever is typed is what gets saved
 * unless a suggestion is actually chosen.
 *
 * Interaction follows FarmerPicker, the project's other type-ahead: arrows
 * move, Enter takes the highlighted row, Escape closes, blur closes.
 */
export default function SuggestInput({
    value = '',
    onChange,
    /**
     * Fired only when a suggestion is actually picked, never while typing.
     * Lets a filter apply itself the instant a real barangay is chosen while
     * still letting free text wait for the Search button.
     */
    onSelect,
    options = [],
    /** Applied to typed text and to a chosen suggestion, e.g. titleCaseName. */
    transform,
    placeholder = '',
    disabled = false,
    id,
    name,
    className = '',
    /** More than this many matches and the list stops being worth scanning. */
    limit = 8,
    required = false,
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const boxRef = useRef(null);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const listId = `${inputId}-suggestions`;

    const matches = useMemo(() => {
        const term = String(value ?? '').trim().toLowerCase();

        const pool = options
            .map(option => (typeof option === 'string' ? option : option?.name))
            .filter(Boolean);

        // An empty box offers the start of the list rather than nothing.
        //
        // Partly so staff can browse when they cannot spell what they are
        // after, and partly so a missing list is visible: when nothing at all
        // appears on focus, the options never arrived — previously that looked
        // identical to "you typed something with no match".
        if (term === '') return pool.slice(0, limit);

        // What someone typing "cali" wants first is "Caligayan", not
        // "Barangay Cali-something" — so names that start with the term are
        // ranked above names that merely contain it.
        const starts = [];
        const contains = [];

        for (const option of pool) {
            const haystack = option.toLowerCase();
            if (haystack === term) continue;              // already typed in full
            if (haystack.startsWith(term)) starts.push(option);
            else if (haystack.includes(term)) contains.push(option);
        }

        return [...starts, ...contains].slice(0, limit);
    }, [value, options, limit]);

    // A fresh set of matches invalidates whichever row was highlighted.
    useEffect(() => setActive(0), [value]);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = e => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    const emit = text => onChange?.(transform ? transform(text) : text);

    const choose = option => {
        const picked = transform ? transform(option) : option;
        onChange?.(picked);
        onSelect?.(picked);
        setOpen(false);
    };

    const onKeyDown = e => {
        if (!open || matches.length === 0) {
            // Arrow down on a filled box re-opens the list without retyping.
            if (e.key === 'ArrowDown' && matches.length > 0) setOpen(true);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(i => (i + 1) % matches.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(i => (i - 1 + matches.length) % matches.length);
        } else if (e.key === 'Enter') {
            // Only swallow Enter when a suggestion is genuinely highlighted,
            // so it still submits the form for anyone typing a new name.
            e.preventDefault();
            choose(matches[active]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        } else if (e.key === 'Tab') {
            setOpen(false);
        }
    };

    const showList = open && matches.length > 0;

    // Typed something the list does not hold. Worth saying out loud: the value
    // is still accepted, and staff should know that rather than assume the box
    // is broken or that they must pick one of the offered names.
    const showNoMatch = open
        && matches.length === 0
        && options.length > 0
        && String(value ?? '').trim() !== '';

    return (
        <div ref={boxRef} className="relative">
            <input
                id={inputId}
                name={name}
                type="text"
                value={value ?? ''}
                onChange={e => { emit(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                // The browser's own history dropdown would cover this one.
                autoComplete="off"
                role="combobox"
                aria-expanded={showList}
                aria-controls={showList ? listId : undefined}
                aria-autocomplete="list"
                aria-activedescendant={showList ? `${listId}-${active}` : undefined}
                className={className}
            />

            {showList && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-green-100 bg-white py-1 shadow-xl"
                >
                    {matches.map((option, index) => (
                        <li
                            key={option}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            // mousedown, not click: blur fires first on click
                            // and would close the list before it registered.
                            onMouseDown={e => { e.preventDefault(); choose(option); }}
                            onMouseEnter={() => setActive(index)}
                            className={`cursor-pointer px-4 py-2 text-sm ${
                                index === active ? 'bg-green-50 text-[#006400]' : 'text-gray-700'
                            }`}
                        >
                            <Highlighted text={option} term={value} />
                        </li>
                    ))}
                </ul>
            )}

            {showNoMatch && (
                <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-xs text-gray-500 shadow-xl">
                    Not on the list — it will be saved exactly as typed.
                </div>
            )}
        </div>
    );
}

/** Bolds the part of the suggestion the user has already typed. */
function Highlighted({ text, term }) {
    const needle = String(term ?? '').trim().toLowerCase();
    const at = needle === '' ? -1 : text.toLowerCase().indexOf(needle);

    if (at === -1) return text;

    return (
        <>
            {text.slice(0, at)}
            <strong className="font-semibold">{text.slice(at, at + needle.length)}</strong>
            {text.slice(at + needle.length)}
        </>
    );
}
