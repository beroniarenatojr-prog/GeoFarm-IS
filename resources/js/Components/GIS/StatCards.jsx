import { Layers3, MapPinned, Ruler, Users } from 'lucide-react';

/**
 * The four headline figures, counted from whatever the filters left.
 *
 * Nothing here is stored or hard-coded: every number is derived from the
 * GeoJSON collection already in the browser. When a filter is on, each card
 * shows the filtered figure against the unfiltered one ("12 of 74") so it is
 * always clear whether you are looking at a slice or at everything.
 *
 * "Mapped area" is the DRAWN area, measured from the polygons themselves,
 * which is what the map actually shows. The office's recorded total_area_ha
 * can legitimately differ — it may come off a land title — so the label says
 * "drawn" rather than quietly presenting one as the other.
 */
export default function StatCards({ stats, totals, filtered }) {
  const cards = [
    {
      key: 'parcels',
      label: 'Total parcels',
      icon: MapPinned,
      value: stats.parcels.toLocaleString(),
      of: totals.parcels,
      current: stats.parcels,
    },
    {
      key: 'area',
      label: 'Mapped area',
      hint: 'Measured from the drawn boundaries, not the recorded figure',
      icon: Ruler,
      value: `${stats.hectares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`,
      of: totals.hectares,
      current: stats.hectares,
      suffix: 'ha',
    },
    {
      key: 'farmers',
      label: 'Farmers',
      hint: 'Distinct farmers with at least one mapped parcel',
      icon: Users,
      value: stats.farmers.toLocaleString(),
      of: totals.farmers,
      current: stats.farmers,
    },
    {
      key: 'barangays',
      label: 'Barangays',
      hint: 'Barangays represented by the mapped parcels',
      icon: Layers3,
      value: stats.barangays.toLocaleString(),
      of: totals.barangays,
      current: stats.barangays,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ key, label, hint, icon: Icon, value, of, current, suffix }) => (
        <div
          key={key}
          className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4"
          title={hint}
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </div>

          <div className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
            {value}
          </div>

          {/* Only shown while something is actually narrowing the map, so the
              unfiltered view stays uncluttered. */}
          {filtered && (
            <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
              of {typeof of === 'number' && suffix === 'ha'
                ? `${of.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
                : of?.toLocaleString?.() ?? of}
              {current === 0 && ' — nothing matches'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
