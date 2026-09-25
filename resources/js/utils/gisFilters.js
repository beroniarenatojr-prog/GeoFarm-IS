/**
 * Search, filter and summary maths for the GIS map.
 *
 * Kept out of MapIndex.jsx and free of React and MapLibre on purpose: this is
 * the logic that decides which parcels a user sees and what the statistics
 * claim, so it needs to be testable on its own. Everything here is pure — it
 * reads GeoJSON features and returns new arrays, and never mutates a feature,
 * touches a source, or calls the server. Filtering is a display concern; no
 * function in this file can change a parcel record.
 */

/** Nothing selected. Also the shape "Clear filters" resets to. */
export const EMPTY_FILTERS = {
  barangay: '',
  // The parcel's own municipality, not the farmer's address. A Tumauini
  // farmer may hold land in Cabagan, and that parcel belongs to Cabagan here.
  municipality: '',
  commodity: '',
  farmType: '',
  farmer: '',
  // '' every parcel · 'mapped' those with an outline · 'unmapped' those
  // still waiting for one. The third state is the point of the filter: it is
  // the office's worklist of boundaries still to be drawn.
  boundary: '',
  minArea: '',
  maxArea: '',
};

/** The properties the search box looks through, in the order a result reads. */
const SEARCH_FIELDS = [
  'farmer_name',
  'parcel_number',
  'rsbsa_no',
  'barangay',
  'city_municipality',
  'province',
  'commodity',
  'farm_type',
];

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();

/** A number, or null when the value is blank or not a number. */
const num = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Does this parcel have a boundary on the map?
 *
 * Reads the server's `has_boundary` when it is there and falls back to the
 * geometry itself, so a feature built locally — a freshly drawn outline, say —
 * answers correctly without having to be round-tripped first.
 */
export const hasBoundary = (feature) => {
  const flag = feature?.properties?.has_boundary;
  if (flag !== undefined && flag !== null) return Boolean(flag);
  return Boolean(feature?.geometry);
};

/**
 * Area of one feature in hectares.
 *
 * Prefers `drawn_ha`, stamped once when the collection is loaded, so filtering
 * never re-runs turf over every polygon. Falls back to the office's recorded
 * figure only when the drawn one is missing, and to 0 when neither exists —
 * a parcel with no measurable outline must not make a total look larger.
 *
 * For a parcel with no boundary the recorded figure is all there is, which is
 * why the fallback matters more than it used to: those parcels are now in the
 * list, and showing them as 0 ha would be wrong in a different way. Callers
 * that specifically mean DRAWN area ask hasBoundary first — see computeStats.
 */
export const featureHectares = (feature) => {
  const drawn = num(feature?.properties?.drawn_ha);
  if (drawn !== null) return drawn;

  const recorded = num(feature?.properties?.area_ha);
  return recorded === null ? 0 : recorded;
};

/** Does this parcel match a free-text search? */
export function matchesQuery(feature, query) {
  const needle = lower(query);
  if (!needle) return true;

  const properties = feature?.properties ?? {};

  return SEARCH_FIELDS.some((field) => lower(properties[field]).includes(needle));
}

/**
 * Apply the filter panel and the search box together.
 *
 * Filters are AND-ed: choosing a barangay and a commodity means parcels that
 * are both, which is what "Filters must work together" asks for. A blank
 * filter is not a filter and is skipped, so an unset dropdown never excludes
 * a parcel whose value happens to be empty.
 */
export function applyFilters(features, filters = EMPTY_FILTERS, query = '') {
  const wanted = { ...EMPTY_FILTERS, ...(filters ?? {}) };

  const min = num(wanted.minArea);
  const max = num(wanted.maxArea);

  return (features ?? []).filter((feature) => {
    const p = feature?.properties ?? {};

    if (wanted.barangay && text(p.barangay) !== wanted.barangay) return false;
    if (wanted.municipality && text(p.city_municipality) !== wanted.municipality) return false;
    if (wanted.commodity && text(p.commodity) !== wanted.commodity) return false;
    if (wanted.farmType && text(p.farm_type) !== wanted.farmType) return false;
    if (wanted.farmer && String(p.farmer_id ?? '') !== String(wanted.farmer)) return false;

    if (wanted.boundary === 'mapped' && !hasBoundary(feature)) return false;
    if (wanted.boundary === 'unmapped' && hasBoundary(feature)) return false;

    if (min !== null || max !== null) {
      const ha = featureHectares(feature);
      if (min !== null && ha < min) return false;
      if (max !== null && ha > max) return false;
    }

    return matchesQuery(feature, query);
  });
}

/** True when anything at all is narrowing the map. */
export function hasActiveFilters(filters = EMPTY_FILTERS, query = '') {
  if (text(query)) return true;
  return Object.keys(EMPTY_FILTERS).some((key) => text(filters?.[key]) !== '');
}

/**
 * The numbers on the summary cards.
 *
 * Counted from whatever slice is passed in, so the same function serves both
 * "all parcels" and "what the filters left". Distinct counts ignore blanks: a
 * parcel with no barangay recorded is not a 47th barangay, and an unassigned
 * parcel is not an extra farmer.
 *
 * `hectares` is the DRAWN total and counts only parcels that have a boundary.
 * That distinction became load-bearing when undrawn parcels joined the
 * collection: featureHectares falls back to the office's recorded figure, so
 * summing every feature would quietly mix measured and recorded areas into one
 * number labelled "measured from the drawn boundaries". `recordedHectares`
 * carries the other total for anything that wants it.
 */
export function computeStats(features) {
  const list = features ?? [];

  const farmers = new Set();
  const barangays = new Set();
  const municipalities = new Set();
  const commodities = new Set();
  const farmTypes = new Set();
  let hectares = 0;
  let recorded = 0;
  let mapped = 0;

  for (const feature of list) {
    const p = feature?.properties ?? {};

    if (hasBoundary(feature)) {
      mapped += 1;
      hectares += featureHectares(feature);
    }

    const own = num(p.area_ha);
    if (own !== null) recorded += own;

    if (p.farmer_id !== null && p.farmer_id !== undefined && p.farmer_id !== '') {
      farmers.add(String(p.farmer_id));
    }
    if (text(p.barangay)) barangays.add(text(p.barangay));
    if (text(p.city_municipality)) municipalities.add(text(p.city_municipality));
    if (text(p.commodity)) commodities.add(text(p.commodity));
    if (text(p.farm_type)) farmTypes.add(text(p.farm_type));
  }

  return {
    parcels: list.length,
    mapped,
    unmapped: list.length - mapped,
    // Rounded for display only; the running totals above stay full precision.
    hectares: Math.round(hectares * 100) / 100,
    recordedHectares: Math.round(recorded * 100) / 100,
    farmers: farmers.size,
    barangays: barangays.size,
    municipalities: municipalities.size,
    commodities: commodities.size,
    farmTypes: farmTypes.size,
  };
}

/**
 * Dropdown choices, built from the data rather than hard-coded.
 *
 * Always derived from the FULL collection, never the filtered one: a dropdown
 * that drops its other options the moment you pick one is a dead end, because
 * there is then no way to switch to a different barangay without clearing.
 *
 * Farmers are keyed by id, so somebody with three parcels appears once. Where
 * two DIFFERENT farmers share a name — which happens, and is exactly when a
 * picker is most dangerous — each is suffixed with their RSBSA number so the
 * two entries can be told apart. Names that are unique are left alone.
 */
export function buildOptions(features) {
  const barangays = new Set();
  const municipalities = new Set();
  const commodities = new Set();
  const farmTypes = new Set();
  const farmers = new Map();

  for (const feature of features ?? []) {
    const p = feature?.properties ?? {};

    if (text(p.barangay)) barangays.add(text(p.barangay));
    if (text(p.city_municipality)) municipalities.add(text(p.city_municipality));
    if (text(p.commodity)) commodities.add(text(p.commodity));
    if (text(p.farm_type)) farmTypes.add(text(p.farm_type));

    if (p.farmer_id && text(p.farmer_name) && !farmers.has(String(p.farmer_id))) {
      farmers.set(String(p.farmer_id), {
        name: text(p.farmer_name),
        rsbsa: text(p.rsbsa_no),
      });
    }
  }

  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b));

  // How many distinct farmer ids answer to each name.
  const nameCounts = new Map();
  for (const { name } of farmers.values()) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return {
    barangays: sorted(barangays),
    municipalities: sorted(municipalities),
    farmTypes: sorted(farmTypes),
    farmers: [...farmers.entries()]
      .map(([id, { name, rsbsa }]) => ({
        id,
        name: nameCounts.get(name) > 1 && rsbsa ? `${name} — ${rsbsa}` : name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * The barangay legend: name, the colour the map actually painted, parcel count.
 *
 * The colour is read back off the features rather than recomputed from the
 * palette, which is what stops the legend from ever disagreeing with the map.
 * Counts come from the visible slice so the legend tracks the filters, while
 * the colour comes from the feature itself and therefore never shifts when a
 * filter changes which barangays are present.
 */
export function buildLegend(features, fallbackColour = '#94a3b8') {
  const seen = new Map();

  for (const feature of features ?? []) {
    const p = feature?.properties ?? {};
    const name = text(p.barangay);
    const label = name || 'No barangay recorded';

    if (!seen.has(label)) {
      seen.set(label, {
        label,
        name,
        colour: p.colour ?? fallbackColour,
        count: 0,
      });
    }

    seen.get(label).count += 1;
  }

  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Sort the parcel list. Stable, and blanks always sort last. */
export function sortFeatures(features, key, direction = 'asc') {
  const sign = direction === 'desc' ? -1 : 1;

  const value = (feature) => {
    const p = feature?.properties ?? {};

    switch (key) {
      case 'area': return featureHectares(feature);
      case 'farmer': return lower(p.farmer_name);
      case 'barangay': return lower(p.barangay);
      case 'municipality': return lower(p.city_municipality);
      case 'commodity': return lower(p.commodity);
      case 'parcel':
      default: return lower(p.parcel_number);
    }
  };

  return [...(features ?? [])].sort((a, b) => {
    const av = value(a);
    const bv = value(b);

    // Blanks last regardless of direction — an unnumbered parcel at the top of
    // every sort is noise, not information.
    const aBlank = av === '' || av === null || av === undefined;
    const bBlank = bv === '' || bv === null || bv === undefined;
    if (aBlank !== bBlank) return aBlank ? 1 : -1;

    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}

/**
 * Thematic palettes for the non-barangay colouring modes.
 *
 * Risk is an ordered scale, so it gets an ordered ramp rather than arbitrary
 * hues — and "not assessed" is grey, deliberately outside the ramp, because
 * never having been assessed is not the same as being low risk.
 */
export const RISK_COLOURS = {
  low: '#22c55e',
  medium: '#facc15',
  high: '#f97316',
  critical: '#dc2626',
};

export const RISK_UNASSESSED = '#94a3b8';

export const ASSISTANCE_COLOURS = {
  received: '#0ea5e9',
  none: '#94a3b8',
};
