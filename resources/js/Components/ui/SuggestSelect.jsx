import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * A type-ahead for a field that stores an id rather than what was typed.
 *
 * The sibling of SuggestInput, and the difference is the whole point of it:
 * SuggestInput saves whatever you type, because a barangay it has never heard
 * of is still a real barangay. A farmer's parcel or a crop is a foreign key —
 * text matching nothing cannot be saved, so this keeps the id and treats the
 * box as a way of finding it.
 *
 * A dropdown was the obvious thing and the wrong one. With a few thousand
 * parcels, choosing one means scrolling a list nobody can scan; typing three
 * letters of the farmer's name is how staff actually think about it.
 *
 * Interaction matches SuggestInput and FarmerPicker: arrows move, Enter takes
 * the highlighted row, Escape closes, clicking away closes.
 */
export default function SuggestSelect({
    /** The chosen id, or '' / null for nothing chosen. */
    value = '',
    /** Called with the id, or '' when the box is cleared. */
    onChange,
    /** [{ id, label, group?, meta? }] — group is a heading, meta a right-hand note. */
    options = [],
    placeholder = '',
    disabled = false,
    id,
    className = '',
    limit = 10,
    /** Shown under the box when there is nothing at all to choose from. */
    emptyHint = null,
}) {
    const chosen = useMemo(
        () => options.find(option => String(option.id) === String(value)) ?? null,
        [options, value],
    );

    const textFor = option => (option ? [option.group, option.label].filter(Boolean).join(' — ') : '');

    const [query, setQuery] = useState(() => textFor(chosen));
    const [typing, setTyping] = useState(false);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const boxRef = useRef(null);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const listId = `${inputId}-suggestions`;

    // Keep the box in step when the id is set from outside — a form reset, or
    // the Add button pre-filling the parcel the page is filtered to.
    useEffect(() => {
        if (!typing) setQuery(textFor(chosen));
    }, [chosen, typing]);

    const matches = useMemo(() => {
        const term = query.trim().toLowerCase();

        // Not typing yet: offer the start of the list so the field can be
        // browsed, and so an empty list is visibly empty rather than looking
        // like a box that does nothing.
        if (!typing || term === '') return options.slice(0, limit);

        /*
         * Search the group as well as the label.
         *
         * The farmer's name lives in the group, so without this, typing "Juan"
         * would match nothing at all — which is precisely how staff look a
         * parcel up.
         */
        const starts = [];
        const contains = [];

        for (const option of options) {
            const haystack = `${option.group ?? ''} ${option.label ?? ''}`.toLowerCase();

            if (haystack.trimStart().startsWith(term)) starts.push(option);
            else if (haystack.includes(term)) contains.push(option);
        }

        return [...starts, ...contains].slice(0, limit);
    }, [query, typing, options, limit]);

    useEffect(() => setActive(0), [query]);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = e => {
            if (boxRef.current && !boxRef.current.contains(e.target)) close();
        };

        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    });

    /**
     * Leaving the box always shows the truth.
     *
     * Half-typed text with no selection behind it would read as a choice that
     * had been made, so the box goes back to whatever the id actually is.
     */
    function close() {
        setOpen(false);
        setTyping(false);
        setQuery(textFor(chosen));
    }

    const choose = option => {
        onChange?.(String(option.id));
        setQuery(textFor(option));
        setTyping(false);
        setOpen(false);
    };

    const onKeyDown = e => {
        if (e.key === 'ArrowDown' && !open) {
            setOpen(true);
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
            choose(matches[active]);
        } else if (e.key === 'Escape') {
            close();
        } else if (e.key === 'Tab') {
            close();
        }
    };

    const showList = open && matches.length > 0;
    const showNoMatch = open && matches.length === 0 && options.length > 0;

    return (
        <div ref={boxRef} className="relative">
            <div className="relative">
                <input
                    id={inputId}
                    type="text"
                    value={query}
                    onChange={e => {
                        setQuery(e.target.value);
                        setTyping(true);
                        setOpen(true);
                        // Typing past a chosen row un-chooses it, so the id can
                        // never disagree with what the box says.
                        if (value) onChange?.('');
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showList}
                    aria-controls={showList ? listId : undefined}
                    aria-autocomplete="list"
                    aria-activedescendant={showList ? `${listId}-${active}` : undefined}
                    className={className}
                />

                {value && !disabled && (
                    <button
                        type="button"
                        onClick={() => { onChange?.(''); setQuery(''); setTyping(true); setOpen(true); }}
                        aria-label="Clear selection"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-gray-400 hover:text-gray-600"
                    >
                        &times;
                    </button>
                )}
            </div>

            {showList && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-green-100 bg-white py-1 shadow-xl"
                >
                    {matches.map((option, index) => (
                        <li
                            key={option.id}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            // mousedown, not click: blur fires first on click and
                            // would close the list before it registered.
                            onMouseDown={e => { e.preventDefault(); choose(option); }}
                            onMouseEnter={() => setActive(index)}
                            className={`cursor-pointer px-4 py-2 text-sm ${
                                index === active ? 'bg-green-50' : ''
                            }`}
                        >
                            {option.group && (
                                <span className="block text-xs font-semibold text-[#006400]">
                                    <Highlighted text={option.group} term={typing ? query : ''} />
                                </span>
                            )}
                            <span className="block text-gray-700">
                                <Highlighted text={option.label} term={typing ? query : ''} />
                            </span>
                            {option.meta && (
                                <span className="block text-xs text-gray-400">{option.meta}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {showNoMatch && (
                <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-100 bg-white px-4 py-2 text-xs text-gray-500 shadow-xl">
                    Nothing matches that. Only records already on file can be chosen here.
                </div>
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
        <>
            {body.slice(0, at)}
            <strong className="font-semibold">{body.slice(at, at + needle.length)}</strong>
            {body.slice(at + needle.length)}
        </>
    );
}
