import { ChevronDown, FilterX, SlidersHorizontal } from 'lucide-react';

/**
 * One filter per column of the registry table.
 *
 * Collapsed by default, and deliberately separate from the search box above.
 * The search spans several columns at once and is what most people reach for;
 * these are for when the office knows exactly what it is after — every
 * Agri-Youth in one barangay, the 4Ps households, everyone born before 1960.
 *
 * Ten controls open at all times would push the table itself off the screen,
 * so the panel stays shut until asked for. The count on the toggle is what
 * stops a filter being left on and forgotten, which is how a registry of
 * 8,000 farmers ends up looking like a registry of three.
 *
 * Nothing is filtered here. Every change goes back to the server, so a result
 * always reflects the whole registry rather than the page in front of you.
 */
function Text({ label, value, onChange, onEnter, placeholder, type = 'text' }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
                placeholder={placeholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
        </label>
    );
}

function Choice({ label, value, onChange, options, placeholder }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            >
                <option value="">{placeholder}</option>
                {options.map(({ value: v, label: l }) => (
                    <option key={v} value={v}>{l}</option>
                ))}
            </select>
        </label>
    );
}

/* Yes/No reads better than a tick here: a checkbox cannot say "show me the
   ones who are NOT 4Ps", which is a question the office does ask. */
const YES_NO = [
    { value: '1', label: 'Yes' },
    { value: '0', label: 'No' },
];

export default function ColumnFilters({
    open, onToggle, values, onChange, onApply, onClear, categories = [], activeCount = 0,
}) {
    const set = (key) => (value) => onChange({ ...values, [key]: value });

    return (
        <div className="mt-3 border-t border-green-100 pt-3">
            <div className="flex items-center justify-between gap-2">
                {/*
                    Looks like a button, because it is one.

                    Styled as plain green text it read as a label, and the
                    office typed "Agri" into the search box instead and was told
                    there were no farmers. A border and a chevron say it opens.
                */}
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        open || activeCount > 0
                            ? 'border-green-300 bg-green-50 text-green-800'
                            : 'border-gray-300 text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-800'
                    }`}
                >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    Filter by column
                    {activeCount > 0 && (
                        <span className="rounded-full bg-green-700 px-2 py-0.5 text-[11px] font-bold text-white">
                            {activeCount}
                        </span>
                    )}
                    <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
                        aria-hidden="true"
                    />
                </button>

                {activeCount > 0 && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                        Clear filters
                    </button>
                )}
            </div>

            {open && (
                <>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        <Text
                            label="RSBSA No."
                            value={values.rsbsa_no}
                            onChange={set('rsbsa_no')}
                            onEnter={onApply}
                            placeholder="Any part of the number"
                        />
                        <Text
                            label="Name"
                            value={values.name}
                            onChange={set('name')}
                            onEnter={onApply}
                            placeholder="First, middle or last"
                        />
                        <Text
                            label="Contact"
                            value={values.contact}
                            onChange={set('contact')}
                            onEnter={onApply}
                            placeholder="Mobile number"
                        />
                        <Choice
                            label="Category"
                            value={values.category}
                            onChange={set('category')}
                            placeholder="All categories"
                            options={categories.map((c) => ({ value: c, label: c }))}
                        />
                        <Choice
                            label="Sex"
                            value={values.sex}
                            onChange={set('sex')}
                            placeholder="All"
                            options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
                        />

                        {/* A range, not a date. Nobody searches for farmers born
                            on one particular day; "of retirement age" and
                            "qualifies as Agri-Youth" are both ranges. */}
                        <Text
                            label="Born from"
                            type="date"
                            value={values.born_from}
                            onChange={set('born_from')}
                            onEnter={onApply}
                        />
                        <Text
                            label="Born to"
                            type="date"
                            value={values.born_to}
                            onChange={set('born_to')}
                            onEnter={onApply}
                        />

                        <Choice label="4Ps" value={values.is_4ps} onChange={set('is_4ps')} placeholder="All" options={YES_NO} />
                        <Choice label="IP" value={values.is_indigenous} onChange={set('is_indigenous')} placeholder="All" options={YES_NO} />
                        <Choice label="PWD" value={values.pwd} onChange={set('pwd')} placeholder="All" options={YES_NO} />
                    </div>

                    {/*
                        An Apply button, unlike the dropdowns elsewhere in the
                        app which filter on change. Ten fields filtered live
                        would send a request per keystroke across three text
                        boxes; here the office fills in what it wants and asks
                        once. Enter in any text field does the same.
                    */}
                    <div className="mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={onApply}
                            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                        >
                            Apply filters
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
