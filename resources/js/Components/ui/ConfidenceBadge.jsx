/**
 * Shows how much history a forecast is based on.
 *
 * Always render this next to a predicted number. A bare figure implies a
 * precision the underlying data usually does not support.
 */
export default function ConfidenceBadge({ level, dataPoints, className = '' }) {
    const styles = {
        none: 'bg-gray-100 text-gray-600 border-gray-300',
        low: 'bg-amber-100 text-amber-800 border-amber-300',
        moderate: 'bg-green-100 text-green-800 border-green-300',
        high: 'bg-green-100 text-green-800 border-green-300',
    };

    const labels = {
        none: 'No data',
        low: 'Low confidence',
        moderate: 'Moderate confidence',
        high: 'High confidence',
    };

    const tone = styles[level] ?? styles.none;

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${tone} ${className}`}
            title={
                dataPoints === undefined
                    ? undefined
                    : `Based on ${dataPoints} recorded harvest${dataPoints === 1 ? '' : 's'}`
            }
        >
            {labels[level] ?? labels.none}
            {dataPoints !== undefined && (
                <span className="font-normal opacity-80">· {dataPoints} record{dataPoints === 1 ? '' : 's'}</span>
            )}
        </span>
    );
}
