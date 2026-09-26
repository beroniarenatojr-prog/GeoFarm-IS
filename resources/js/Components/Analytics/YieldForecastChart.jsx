import {
    Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

/**
 * Recorded production per year, with next year's forecast beside it.
 *
 * ONE BAR PER YEAR, NOT TWO SERIES. Actual and predicted never occupy the same
 * year, so plotting them as two overlapping series would leave a gap in each
 * and imply the missing one was zero. Each year has a single bar, coloured and
 * labelled by which kind of figure it is.
 *
 * The forecast bar is deliberately a different colour AND hatched via reduced
 * opacity, and the legend names it "Forecast" rather than letting it sit
 * silently alongside recorded history. A prediction that looks identical to a
 * measurement is the single most misleading thing this page could do.
 *
 * recharts, because it is already the project's chart library.
 */
const kg = (value) =>
    value === null || value === undefined
        ? '—'
        : new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(value);

/** Compact axis labels: 1.2M rather than 1,200,000. */
const compact = (value) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
    return String(value);
};

function ChartTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;

    const point = payload[0].payload;
    const isForecast = point.actual === null;

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <p className="text-sm font-semibold text-gray-900">{point.year}</p>
            <p className={`mt-0.5 text-xs font-medium ${isForecast ? 'text-amber-700' : 'text-green-700'}`}>
                {isForecast ? 'Forecast' : 'Recorded production'}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
                {kg(isForecast ? point.predicted : point.actual)}
                <span className="text-xs font-normal text-gray-500"> kg</span>
            </p>
            {isForecast && (
                <p className="mt-1 max-w-[16rem] text-[11px] leading-4 text-gray-500">
                    An estimate from recorded harvests, not a recorded figure.
                </p>
            )}
        </div>
    );
}

export default function YieldForecastChart({ series }) {
    if (!series?.length) {
        return (
            <div className="py-12 text-center">
                <BarChart3 className="mx-auto mb-3 h-12 w-12 text-gray-300" aria-hidden="true" />
                <p className="font-semibold text-gray-900">No production history yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                    Record harvested yields against crop seasons and this chart will show
                    production by year, with a forecast for the next one.
                </p>
            </div>
        );
    }

    // One value per year, whichever kind it is. See the note at the top.
    const data = series.map((point) => ({
        ...point,
        value: point.actual ?? point.predicted ?? 0,
        kind: point.actual === null ? 'forecast' : 'actual',
    }));

    const hasForecast = data.some((d) => d.kind === 'forecast');

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                    <span className="h-3 w-3 rounded-sm bg-green-600" aria-hidden="true" />
                    Recorded production
                </span>
                {hasForecast && (
                    <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <span className="h-3 w-3 rounded-sm bg-amber-400" aria-hidden="true" />
                        Forecast (estimate)
                    </span>
                )}
            </div>

            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis
                            dataKey="year"
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={compact}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            width={48}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
                            {data.map((point) => (
                                <Cell
                                    key={point.year}
                                    fill={point.kind === 'forecast' ? '#fbbf24' : '#16a34a'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {hasForecast && (
                <p className="mt-2 text-center text-xs text-gray-500">
                    The amber bar is an estimate for the next cropping, not recorded production.
                </p>
            )}
        </div>
    );
}
