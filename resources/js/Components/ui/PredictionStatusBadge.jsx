import { ArrowDown, ArrowUp, HelpCircle, Minus } from 'lucide-react';

/**
 * How a prediction compares to the parcel's own historical average.
 *
 * NEVER COLOUR ALONE. Each status carries an icon and a word as well as a
 * tint, because roughly one man in twelve cannot reliably separate the red
 * from the green — and on a screen where those two mean "needs attention" and
 * "doing well", that is not a cosmetic problem.
 *
 * "Insufficient data" is deliberately grey and outside the scale. Not having
 * enough history is not a middling result; it is the absence of one, and
 * showing it as neutral-amber would invite it to be read as "average".
 */
const STATUSES = {
    above_average: {
        label: 'Above average',
        full: 'Predicted above this parcel’s historical average',
        icon: ArrowUp,
        tone: 'bg-green-50 text-green-800 border-green-300',
    },
    in_line: {
        label: 'Near average',
        full: 'Predicted within 5% of the historical average',
        icon: Minus,
        tone: 'bg-slate-50 text-slate-700 border-slate-300',
    },
    below_average: {
        label: 'Below average',
        full: 'Predicted below this parcel’s historical average — worth reviewing',
        icon: ArrowDown,
        tone: 'bg-amber-50 text-amber-800 border-amber-300',
    },
    insufficient_data: {
        label: 'Insufficient data',
        full: 'Not enough recorded harvests to predict from',
        icon: HelpCircle,
        tone: 'bg-gray-100 text-gray-600 border-gray-300',
    },
};

export default function PredictionStatusBadge({ status, className = '' }) {
    const meta = STATUSES[status] ?? STATUSES.insufficient_data;
    const Icon = meta.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone} ${className}`}
            title={meta.full}
        >
            <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {meta.label}
        </span>
    );
}

export { STATUSES as PREDICTION_STATUSES };
