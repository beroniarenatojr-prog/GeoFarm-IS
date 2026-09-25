import { Layers3, MapPinned, PencilRuler, Ruler, Users } from 'lucide-react';

/**
 * The headline figures, counted from whatever the filters left.
 *
 * Nothing here is stored or hard-coded: every number is derived from the
 * GeoJSON collection already in the browser. When a filter is on, each card
 * shows the filtered figure against the unfiltered one ("12 of 74") so it is
 * always clear whether you are looking at a slice or at everything.
 *
 * "Mapped area" is the DRAWN area, measured from the polygons themselves,
 * which is what the map actually shows. The office's recorded total_area_ha
 * can legitimately differ — it may come off a land title — so the label says
 * "drawn" rather than quietly presenting one as the other. It counts only
 * parcels that HAVE a boundary, for the same reason.
 *
 * The fifth card appears only when something is waiting to be drawn, and
 * clicking it filters the map down to exactly those parcels.
 */
export default function StatCards({ stats, totals, filtered, onShowUnmapped }) {
  const cards = [
    {
      key: 'parcels',
      label: 'Total parcels',
      hint: 'Every parcel on record, drawn or not',
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
      hint: 'Distinct farmers with at least one parcel on record',
      icon: Users,
      value: stats.farmers.toLocaleString(),
      of: totals.farmers,
      current: stats.farmers,
    },
    {
      key: 'barangays',
      label: 'Barangays',
      hint: 'Barangays represented by the parcels on record',
      icon: Layers3,
      value: stats.barangays.toLocaleString(),
      of: totals.barangays,
      current: stats.barangays,
    },
  ];

  /*
   * Shown only when there is a backlog. A permanent "0 need a boundary" card
   * is a reproach on a screen where the right answer is usually zero; one that
   * appears when there is work to do is a prompt.
   */
  if (totals.unmapped > 0) {
    cards.push({
      key: 'unmapped',
      label: 'Needs a boundary',
      hint: 'Parcels on record with no outline drawn yet — click to list them',
      icon: PencilRuler,
      value: stats.unmapped.toLocaleString(),
      of: totals.unmapped,
      current: stats.unmapped,
      action: onShowUnmapped,
      accent: true,
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map(({ key, label, hint, icon: Icon, value, of, current, suffix, action, accent }) => {
        const Tag = action ? 'button' : 'div';

        return (
          <Tag
            key={key}
            {...(action ? { type: 'button', onClick: action } : {})}
            className={`rounded-lg border p-3 text-left sm:p-4 ${
              accent
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-white'
            } ${action ? 'cursor-pointer transition hover:border-amber-400 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500' : ''}`}
            title={hint}
          >
            <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide ${
              accent ? 'text-amber-800' : 'text-slate-500'
            }`}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </div>

            <div className={`mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl ${
              accent ? 'text-amber-900' : 'text-slate-900'
            }`}
            >
              {value}
            </div>

            {/* Only shown while something is actually narrowing the map, so the
                unfiltered view stays uncluttered. */}
            {filtered && (
              <div className={`mt-0.5 text-[11px] tabular-nums ${accent ? 'text-amber-700' : 'text-slate-500'}`}>
                of {typeof of === 'number' && suffix === 'ha'
                  ? `${of.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
                  : of?.toLocaleString?.() ?? of}
                {current === 0 && ' — nothing matches'}
              </div>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
