import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import TumauiniMapFallback from '@/Components/ui/TumauiniMapFallback';
import BoundaryImport from '@/Components/Parcels/BoundaryImport';
import QrScanner from '@/Components/ui/QrScanner';
import toast from 'react-hot-toast';
import * as maplibregl from 'maplibre-gl';
import { buildDraftFeatures } from '@/utils/draftGeometry';
import area from '@turf/area';
import bbox from '@turf/bbox';
import center from '@turf/center';
import {
  Eye, Layers, LocateFixed, MapPinned, PenLine, RefreshCcw, Trash2,
  Map as MapIcon, QrCode, Ruler, Spline, SlidersHorizontal, X,
} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  BASEMAPS,
  TUMAUINI_BOUNDS,
  TUMAUINI_BOUNDARY_COLLECTION,
  TUMAUINI_CENTER,
  getBasemapStyle,
} from '@/config/tumauiniMap';
import {
  EMPTY_FILTERS,
  applyFilters,
  buildOptions,
  computeStats,
  featureHectares,
  hasActiveFilters,
  sortFeatures,
} from '@/utils/gisFilters';
import StatCards from '@/Components/GIS/StatCards';
import GisSearch from '@/Components/GIS/GisSearch';
import FarmFilters from '@/Components/GIS/FarmFilters';
import ParcelTable from '@/Components/GIS/ParcelTable';
import SelectedParcelCard from '@/Components/GIS/SelectedParcelCard';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

/**
 * One colour per barangay, not per parcel.
 *
 * Tumauini has 46 active barangays, so this list holds 48 — enough for every
 * one of them with slack, because a barangay sharing a colour with another
 * would defeat the point of colouring by barangay at all.
 *
 * These were not picked by eye. They were selected by maximising the minimum
 * CIEDE2000 distance between every pair, over a candidate set restricted to
 * what stays readable on satellite imagery: L* 45-92 (nothing that vanishes
 * into canopy shadow or washes out against cloud), chroma >= 26 (nothing that
 * reads as road or bare soil), and at least dE 16 from sixteen sampled imagery
 * colours - canopy, paddy, stubble, soil, laterite, road, shadow, cloud, water.
 *
 * The result: worst pair dE 10.5, worst ADJACENT pair dE 12.9. For reference
 * dE 1 is the just-noticeable threshold and dE 5 reads as plainly different,
 * so every pair here is a clearly different colour rather than a near-match.
 * Adjacent indices are kept far apart deliberately, because alphabetically
 * neighbouring barangays are often geographically neighbouring too.
 *
 * Regenerating this list is a measurement, not a judgement call - see the
 * palette optimiser note in the project scratchpad if it ever needs redoing.
 */
const PARCEL_COLOURS = [
  '#a103fc', //  0 deep violet
  '#2cfc03', //  1 deep emerald
  '#fc8003', //  2 deep orange
  '#da3ffd', //  3 purple
  '#0ff09d', //  4 deep teal
  '#c87c19', //  5 deep orange
  '#b12fb1', //  6 deep magenta
  '#03fcf0', //  7 deep cyan
  '#d3980d', //  8 deep amber
  '#fc03c2', //  9 deep magenta
  '#3fabfd', // 10 azure
  '#fcd703', // 11 deep amber
  '#de0244', // 12 deep rose
  '#2f95b1', // 13 deep sky
  '#dff349', // 14 lime
  '#d31b0d', // 15 deep red
  '#9ad6fe', // 16 light azure
  '#a3bc24', // 17 deep lime
  '#c81982', // 18 deep pink
  '#03d3fc', // 19 deep sky
  '#fdc35d', // 20 orange
  '#f089ef', // 21 magenta
  '#24babc', // 22 deep cyan
  '#e3621c', // 23 deep vermilion
  '#f4c3e8', // 24 light magenta
  '#19c842', // 25 deep emerald
  '#b15b2f', // 26 deep vermilion
  '#1c7ce3', // 27 deep azure
  '#c3f4c9', // 28 light emerald
  '#fd3721', // 29 red
  '#6d66d6', // 30 indigo
  '#acdd7e', // 31 green
  '#febbb8', // 32 light red
  '#7e99dd', // 33 blue
  '#2fb18c', // 34 deep teal
  '#fec59a', // 35 light vermilion
  '#aa89f0', // 36 indigo
  '#7eddc0', // 37 teal
  '#d68d66', // 38 vermilion
  '#d1b8fe', // 39 light indigo
  '#9af4fe', // 40 light cyan
  '#e05e5c', // 41 red
  '#efe9a9', // 42 light yellow
  '#a9c0ef', // 43 light azure
  '#d66680', // 44 rose
  '#fe9ab6', // 45 light rose
  '#f78a82', // 46 red
  '#dd7eb4', // 47 pink
];

/** A parcel whose barangay was never recorded. Deliberately drab, so it reads
 *  as "not classified" rather than as one more barangay. */
const NO_BARANGAY_COLOUR = '#94a3b8';

/** Trim and normalise a barangay name so "  Ugad" and "Ugad" are one place. */
const barangayKey = (value) => String(value ?? '').trim();

/**
 * The colour for the nth barangay.
 *
 * Past the end of the curated list this keeps generating fresh colours instead
 * of wrapping around with `% length`. That matters because `barangay` is free
 * text: 46 official names can still arrive as more than 48 distinct values
 * through a spelling variant, a stray middle initial, or one of the 29 retired
 * barangay names. Wrapping would hand two different barangays the same colour
 * — silently, and precisely in the case where someone is trying to work out
 * why the map looks wrong.
 *
 * The golden angle (137.508°) is used because successive multiples of it never
 * land near each other on the hue circle, so the overflow colours are spread
 * out rather than clustered. They are genuinely distinct, though not held to
 * the measured dE separation of the curated 48 — if this path is ever reached,
 * the real fix is to tidy the barangay values, and the legend will show which.
 */
function paletteColour(index) {
  if (index < PARCEL_COLOURS.length) return PARCEL_COLOURS[index];

  const step = index - PARCEL_COLOURS.length + 1;
  const hue = (step * 137.508) % 360;

  // Comma syntax: valid CSS and accepted by MapLibre's style-spec colour
  // parser, so the same string works for the layer paint and the legend swatch.
  return `hsl(${hue.toFixed(1)}, 82%, ${step % 2 ? 58 : 74}%)`;
}

/**
 * Assigns one colour per barangay.
 *
 * Alphabetical order rather than a hash of the name: sorting is stable, so the
 * same data gives the same colours on every refresh, and the palette's own
 * ordering already guarantees that consecutive indices are far apart in
 * colour. Colouring by parcel id — which is what this did before — gave two
 * parcels in the same barangay two different colours, which is exactly
 * backwards for reading a municipal map.
 *
 * Distinct names never share a colour: each one takes its own palette index.
 */
function buildBarangayColours(features) {
  const names = [...new Set(
    (features ?? [])
      .map((feature) => barangayKey(feature.properties?.barangay))
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));

  const colours = new Map();
  names.forEach((name, index) => {
    // One colour per name, never reused — see paletteColour.
    colours.set(name, paletteColour(index));
  });

  return colours;
}

/**
 * A generous window around Tumauini. Anything outside it is a data error, not
 * a farm — the municipality sits near 121.8 E, 17.3 N.
 */
const PLAUSIBLE_EXTENT = { west: 121.0, south: 16.5, east: 123.0, north: 18.0 };

/** Every [lng, lat] pair in a geometry, however deeply its rings are nested. */
function eachPosition(coordinates, visit) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return;

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    visit(coordinates[0], coordinates[1]);
    return;
  }

  for (const child of coordinates) eachPosition(child, visit);
}

/**
 * Whether a feature can actually be drawn on this map.
 *
 * This is the fix for boundaries that were "loaded" but invisible. bbox() over
 * the whole collection is what decides the opening view, and a single feature
 * at [0, 0] — which is what an empty draw or a bad import leaves behind —
 * stretches that box about 13,000 km. fitBounds then gets clamped by
 * maxBounds and lands on empty ground, so every real parcel sits off-screen
 * and the map looks as though nothing was ever drawn.
 *
 * One bad row must not be able to hide the other seventy-three.
 */
function isRenderableFeature(feature) {
  const geometry = feature?.geometry;
  if (!geometry || !geometry.coordinates) return false;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return false;

  let count = 0;
  let plausible = true;

  eachPosition(geometry.coordinates, (lng, lat) => {
    count += 1;

    if (!Number.isFinite(lng) || !Number.isFinite(lat)
      || lng < PLAUSIBLE_EXTENT.west || lng > PLAUSIBLE_EXTENT.east
      || lat < PLAUSIBLE_EXTENT.south || lat > PLAUSIBLE_EXTENT.north) {
      plausible = false;
    }
  });

  // A polygon ring needs at least three distinct corners plus the closing
  // point; fewer than four positions cannot enclose any area.
  return plausible && count >= 4;
}

/**
 * Splits a collection into what can be drawn and what cannot.
 *
 * The unmappable ones are counted rather than silently discarded, so the page
 * can say "2 unmappable" instead of quietly disagreeing with the parcel list.
 */
function sanitiseParcels(collection) {
  const features = collection?.features ?? [];
  const kept = [];
  const dropped = [];

  for (const feature of features) {
    (isRenderableFeature(feature) ? kept : dropped).push(feature);
  }

  return {
    collection: { type: 'FeatureCollection', features: kept },
    dropped,
  };
}

/** Great-circle distance in kilometres. */
function kmBetween(lng1, lat1, lng2, lat2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Which way to look, in words rather than degrees. */
function compassBetween(lng1, lat1, lng2, lat2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const points = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

  return points[Math.round(((deg + 360) % 360) / 45) % 8];
}

/**
 * Give every feature its barangay's colour, so the map reads as a map of
 * places rather than a map of database rows.
 *
 * The colour is written onto the feature's own properties because the fill and
 * line layers paint from ['get', 'colour'] — and because the legend reads it
 * back from here, which is what keeps the two in step.
 */
function colouriseParcels(collection) {
  const features = collection.features ?? [];
  const colours = buildBarangayColours(features);

  return {
    ...collection,
    features: features.map((feature) => {
      const name = barangayKey(feature.properties?.barangay);

      return {
        ...feature,
        properties: {
          ...feature.properties,
          // Same barangay, same colour — for every parcel in it.
          colour: colours.get(name) ?? NO_BARANGAY_COLOUR,

          /*
           * The drawn area, measured once here.
           *
           * The statistics, the filters, the list and the parcel card all want
           * this number, and every one of them re-derives on each keystroke.
           * Measuring the polygon once at load costs a single pass; measuring
           * it inside the filter would re-run turf over every parcel on every
           * character typed into the search box.
           *
           * Rounded to two decimals so the same value is displayed, summed and
           * compared — an unrounded total that disagrees with the visible rows
           * by a hundredth is the kind of thing an office has to explain.
           */
          drawn_ha: Math.round((area(feature) / 10000) * 100) / 100,
        },
      };
    }),
  };
}

/**
 * What counts as clicking a parcel.
 *
 * The fill alone was not enough. A holding is about 150 m across — some 5 px
 * at the zoom this map opens at — so the polygon was a target almost nobody
 * could hit, while the 22 px pin sitting directly on top of it was not
 * clickable at all. The pins carry the same properties as their polygon, so
 * adding them here makes the visible marker the thing you actually press.
 */
const PARCEL_HIT_LAYERS = ['parcels-fill', 'parcel-pin-halo', 'parcel-pin-dot'];

/**
 * Below this, a parcel is too small to show a shape, so selecting one moves in
 * far enough for its outline to mean something. Matches the zoom at which the
 * pins hand over to the polygons.
 */
const PARCEL_READABLE_ZOOM = 15.5;

/** A filter no parcel can satisfy, so the highlight layer draws nothing. */
const NO_SELECTION = ['==', ['get', 'id'], -1];

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}


function normalizeFeatureCollection(data) {
  if (!data?.type) return EMPTY_FEATURE_COLLECTION;

  if (data.type === 'FeatureCollection') return data;
  if (data.type === 'Feature') return { type: 'FeatureCollection', features: [data] };

  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: data }],
  };
}

function formatArea(squareMeters) {
  if (!Number.isFinite(squareMeters)) return '0 ha';
  return `${(squareMeters / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;
}

/** Escape values before they reach setHTML — names are user input. */
const esc = (v) => (v == null ? '' : String(v).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c]
)));

/** A heading plus its rows in the parcel panel. Rendered only when it has content. */
function PanelSection({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

/** One line: what it is on the left, how much of it on the right. */
function PanelRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-800">{label}</span>
      {value ? <span className="text-slate-500">{value}</span> : null}
    </div>
  );
}

export default function MapIndex({ parcels }) {
  const { can } = usePermissions();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const parcelsRef = useRef(parcels);
  const selectedParcelRef = useRef('');

  /*
   * Tracing is done with plain MapLibre handlers rather than MapboxDraw.
   *
   * MapboxDraw 1.5 is built against mapbox-gl 3.x; this project runs MapLibre
   * 6, a fork that has diverged, and its polygon tool never started here — the
   * control mounted and changeMode was accepted, but no vertices ever appeared.
   * Rather than keep guessing at a library that cannot be debugged from the
   * server side, the few dozen lines below do the job directly against APIs
   * MapLibre definitely has.
   *
   * Saved parcels are rendered by our own `parcels` source too, so MapboxDraw
   * now contributes nothing to this page but its (unused) control buttons.
   */
  const draftRef = useRef([]);        // vertices placed so far, [lng, lat]
  const drawingRef = useRef(false);
  const [drawing, setDrawing] = useState(false);

  /**
   * Live pointer position while tracing, so an edge can follow the cursor.
   * A ref rather than state: mousemove fires on every frame, and re-rendering
   * a 1000-line component that often would make tracing stutter.
   */
  const cursorRef = useRef(null);

  /** Ground area of the outline being traced, in square metres. */
  const [draftArea, setDraftArea] = useState(0);

  /** Which parcel currently carries feature-state `selected`, so it can be cleared. */
  const highlightedRef = useRef(null);

  const [parcelDetail, setParcelDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * Move the highlight. Passing null clears it.
   *
   * Retargets a filter on its own layer rather than touching the layers that
   * draw every parcel - a highlight that can fail should not be able to take
   * the boundaries down with it.
   */
  const highlightParcel = useCallback((parcelId) => {
    const map = mapRef.current;
    if (!map || !map.getLayer('parcels-selected')) return;

    highlightedRef.current = parcelId ?? null;

    map.setFilter(
      'parcels-selected',
      parcelId === null || parcelId === undefined
        ? NO_SELECTION
        : ['==', ['get', 'id'], Number(parcelId)],
    );
  }, []);

  /**
   * Everything about the clicked parcel, fetched on demand.
   *
   * The GeoJSON feed stays lightweight - it loads in full on every map open -
   * so crops, livestock and assistance are asked for only when a parcel is
   * actually opened.
   */
  const loadParcelDetail = useCallback((parcelId) => {
    if (parcelId === null || parcelId === undefined) {
      setParcelDetail(null);
      return;
    }

    setDetailLoading(true);
    setParcelDetail(null);

    fetch(`/admin/gis/parcels/${parcelId}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then(setParcelDetail)
      .catch(() => toast.error('Could not load that parcel’s details.'))
      .finally(() => setDetailLoading(false));
  }, []);
  const [selectedParcel, setSelectedParcel] = useState('');
  const [geoJsonData, setGeoJsonData] = useState(EMPTY_FEATURE_COLLECTION);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showParcels, setShowParcels] = useState(true);

  const canEdit = can('edit parcels');
  const canDelete = can('delete parcels');

  const mappedCount = geoJsonData.features.length;

  /**
   * How many boundaries are inside the current view. null until measured.
   *
   * A holding here is about 150 m across and they are scattered over some
   * 550 km2, so a view zoomed in far enough to show a boundary's shape usually
   * contains no boundary at all. Without this the map looks broken whenever it
   * is pointed at empty ground, which is most of the municipality.
   */
  const [inView, setInView] = useState(null);

  /**
   * What the map actually built, and what it refused to.
   *
   * Read off the live map rather than inferred from the code, because the code
   * has looked correct through several rounds of this not working. If a layer
   * is missing or a source is empty, this says so on the page instead of
   * leaving a blank map to be interpreted.
   */
  const [mapReport, setMapReport] = useState(null);
  const [layerError, setLayerError] = useState(null);

  /** What applyInitialView decided, in words. */
  const [viewNote, setViewNote] = useState(null);

  /** Live zoom, so the status line can be read against the pin hand-over. */
  const [zoomNow, setZoomNow] = useState(null);

  /**
   * What MapLibre itself holds and paints — as opposed to what React believes.
   *
   * Every counter on this page so far ("74 loaded", "53 in view", "6/6
   * layers", "fitted all 74") is computed in JavaScript from geoJsonRef and
   * map.getLayer(). All of them can read perfectly while the map draws
   * nothing, because none of them ask the map what it actually rendered. That
   * is exactly the state this page has been in.
   *
   *   held    - features inside the `parcels` source, from its own serialize()
   *   painted - features the fill/line layers actually put on screen
   *
   * held 0            -> the data never reached the source
   * held >0, painted 0 -> the data is there and the paint/style is wrong
   * both >0            -> it IS drawing, and something is covering it
   */

  /**
   * The last error MapLibre reported.
   *
   * The handler below has always logged these to the console and surfaced only
   * WebGL failures to the screen. An invalid paint expression or a rejected
   * tile is reported the same way and was therefore invisible to anyone
   * looking at the map instead of devtools.
   */
  const [mapError, setMapError] = useState(null);

  /**
   * Parcels the server says are mapped but whose geometry cannot be drawn.
   * Counted rather than hidden: a silent gap between this map and the parcel
   * list is what made the last few rounds of this so hard to pin down.
   */
  const [unmappable, setUnmappable] = useState(0);

  /** Closest boundary to the middle of the screen, when none is on it. */
  const [nearest, setNearest] = useState(null);

  // ── Search, filters and presentation state ────────────────────────────────
  // All of it display-only: none of these can reach the server or change a
  // parcel record. The map is narrowed by handing the source a smaller
  // collection, never by asking the backend for a different one.

  /** What is typed, and the settled value the filtering actually uses. */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [listSort, setListSort] = useState({ key: 'parcel', dir: 'asc' });

  /** Which basemap layer is visible. Satellite stays the default. */
  const [basemap, setBasemap] = useState('satellite');

  /** Pins are their own layer now, not a rider on the parcels toggle. */
  const [showPins, setShowPins] = useState(true);

  /** Measuring: 'distance' | 'area' | null. Never writes to parcel records. */
  const [measureMode, setMeasureMode] = useState(null);
  const [measurePoints, setMeasurePoints] = useState([]);

  /*
   * The click handler is registered once when the map is created, so it must
   * read the current mode and points through refs rather than closing over the
   * values they had at registration time.
   */
  const measureModeRef = useRef(null);
  const measurePointsRef = useRef([]);

  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);
  useEffect(() => { measurePointsRef.current = measurePoints; }, [measurePoints]);

  /*
   * Draw the ruler using the existing draft layers.
   *
   * No new source or layer: parcel-draft-line renders anything tagged
   * draft:'shape', parcel-draft-fill renders any Polygon and
   * parcel-draft-points any Point, so a measurement can borrow them by
   * emitting the same shapes. That keeps buildLayers — the code path this map
   * spent days failing to complete — completely untouched.
   *
   * Drawing and measuring are mutually exclusive for the same reason: they
   * share one source, so only one of them may own it at a time.
   */
  const paintMeasure = useCallback(() => {
    const source = mapRef.current?.getSource('parcel-draft');
    if (!source) return;

    const points = measurePointsRef.current;
    const mode = measureModeRef.current;
    const features = [];

    if (mode === 'area' && points.length >= 3) {
      features.push({
        type: 'Feature',
        properties: { draft: 'shape' },
        geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
      });
    } else if (points.length >= 2) {
      // Distance stays an open line however many points are added — closing it
      // would silently measure a perimeter instead of a route.
      features.push({
        type: 'Feature',
        properties: { draft: 'shape' },
        geometry: { type: 'LineString', coordinates: points },
      });
    }

    points.forEach((point, index) => features.push({
      type: 'Feature',
      properties: { draft: 'vertex', first: index === 0 },
      geometry: { type: 'Point', coordinates: point },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }, []);

  /** The ruler's reading. Pure arithmetic over the clicked points. */
  const measurement = useMemo(() => {
    if (!measureMode || measurePoints.length < 2) return null;

    if (measureMode === 'distance') {
      let km = 0;
      for (let i = 1; i < measurePoints.length; i += 1) {
        km += kmBetween(
          measurePoints[i - 1][0], measurePoints[i - 1][1],
          measurePoints[i][0], measurePoints[i][1],
        );
      }
      return { kind: 'distance', km, metres: km * 1000 };
    }

    if (measurePoints.length < 3) return null;

    // @turf/area is spherical, so this is real ground area rather than the
    // planar degree arithmetic that would understate it this far north.
    const squareMetres = area({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...measurePoints, measurePoints[0]]] },
    });

    return { kind: 'area', squareMetres, hectares: squareMetres / 10000 };
  }, [measureMode, measurePoints]);

  const clearMeasure = useCallback(() => {
    measurePointsRef.current = [];
    setMeasurePoints([]);
    mapRef.current?.getSource('parcel-draft')?.setData(EMPTY_FEATURE_COLLECTION);
  }, []);

  /** Where the data stands, for the status strip. Never faked. */
  const [dataStatus, setDataStatus] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState(null);

  /** Mobile: the controls live in a sheet so the map keeps the screen. */
  const [sheetOpen, setSheetOpen] = useState(false);

  /** Reading a farmer's ID card to jump to their land. */
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  /*
   * Debounce the search box.
   *
   * Filtering re-derives the visible collection and calls source.setData, so
   * running it on every keystroke would re-tile the whole layer while someone
   * types a farmer's name. 200 ms is below the threshold where typing feels
   * laggy and well above a fast typist's inter-key gap.
   */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(timer);
  }, [searchInput]);
  /*
   * The old totalMappedArea useMemo was removed here.
   *
   * It summed turf area over every feature on each change, and the card that
   * displayed it is now one of the summary cards above the map. Those read
   * `drawn_ha`, stamped once per feature at load, so the same total is now
   * obtained without re-measuring 74 polygons on every filter keystroke.
   */

  /*
   * ── The one derivation the whole page reads from ──────────────────────────
   *
   * geoJsonData always holds the FULL, already-coloured collection. Filtering
   * selects a subset of those same feature objects and never re-colours them,
   * which is what keeps a barangay's colour fixed: colours are assigned by
   * position in the sorted list of barangays PRESENT in the collection handed
   * to colouriseParcels, so colourising a filtered set would make whichever
   * barangay you filtered to barangay #0 and change its colour.
   */
  const visibleFeatures = useMemo(
    () => applyFilters(geoJsonData.features, filters, search),
    [geoJsonData, filters, search],
  );

  const visibleCollection = useMemo(
    () => ({ type: 'FeatureCollection', features: visibleFeatures }),
    [visibleFeatures],
  );

  /** Options come from everything loaded, so a dropdown never strands itself. */
  const filterOptions = useMemo(() => buildOptions(geoJsonData.features), [geoJsonData]);

  const filtersActive = useMemo(() => hasActiveFilters(filters, search), [filters, search]);

  const visibleStats = useMemo(() => computeStats(visibleFeatures), [visibleFeatures]);
  const totalStats = useMemo(() => computeStats(geoJsonData.features), [geoJsonData]);

  const sortedVisible = useMemo(
    () => sortFeatures(visibleFeatures, listSort.key, listSort.dir),
    [visibleFeatures, listSort],
  );

  /** Search results are the filtered set — the two narrow the same collection. */
  const searchResults = useMemo(
    () => (searchInput.trim() ? visibleFeatures : []),
    [searchInput, visibleFeatures],
  );

  /**
   * The target-parcel list, sorted and flagged with whether a boundary exists.
   *
   * `mapped` is derived from the drawn collection rather than from a column,
   * which keeps it true the moment a boundary is saved or deleted without a
   * page reload.
   */
  const targetOptions = useMemo(() => {
    const mapped = new Set(geoJsonData.features.map((f) => String(f.properties?.id)));

    return [...parcels]
      .map((parcel) => ({ ...parcel, mapped: mapped.has(String(parcel.id)) }))
      .sort((a, b) => String(a.parcel_number ?? `#${a.id}`)
        .localeCompare(String(b.parcel_number ?? `#${b.id}`), undefined, { numeric: true }));
  }, [parcels, geoJsonData]);


  const selectedParcelDetails = useMemo(
    () => parcels.find((parcel) => String(parcel.id) === String(selectedParcel)),
    [parcels, selectedParcel],
  );

  // ── Timing fix: when parcels arrive BEFORE the map finishes loading, the
  // setData effect silently returns (source not ready). This flag lets the
  // load handler paint the already-fetched collection on its own.
  const mapLoadedRef = useRef(false);

  useEffect(() => {
    parcelsRef.current = parcels;
  }, [parcels]);

  // The parcels source is created on map load, which may happen after the
  // boundaries have already been fetched. Keeping the latest set in a ref lets
  // the load handler paint whatever arrived first.
  const geoJsonRef = useRef(EMPTY_FEATURE_COLLECTION);
  // Only auto-fit once, so a later refresh does not yank the view away.
  const fittedRef = useRef(false);
  useEffect(() => {
    geoJsonRef.current = geoJsonData;
  }, [geoJsonData]);

  useEffect(() => {
    selectedParcelRef.current = selectedParcel;
  }, [selectedParcel]);

  /**
   * Decides where the map opens, once, for every path that loads parcels.
   *
   * There were four of these: the fetch, two branches of the map-load handler
   * and an effect. Three fitted ALL parcels and knew nothing about ?parcel=,
   * only the effect honoured it, and whichever ran first won the race. So
   * "View on map" from the parcel list usually landed on the whole
   * municipality — where a 150 m holding is about four pixels wide and looks
   * like nothing was drawn at all.
   *
   * Returns true once it has positioned the map, so callers stop trying.
   */
  const applyInitialView = useCallback((map, collection) => {
    if (fittedRef.current) return false;

    const features = collection?.features ?? [];
    if (!features.length) return false;

    fittedRef.current = true;

    const wanted = new URLSearchParams(window.location.search).get('parcel');
    const target = wanted
      && features.find((f) => String(f.properties?.id) === String(wanted));

    if (target) {
      // Asked for one parcel: go to it and select it, close enough that its
      // outline is the thing on screen rather than a speck.
      setSelectedParcel(String(wanted));
      setSelectedFeature(target.properties);
      highlightParcel(target.properties.id);
      loadParcelDetail(target.properties.id);
      map.fitBounds(bbox(target), { padding: 80, maxZoom: 17, duration: 900 });
      setViewNote(`parcel ${wanted}: found, fitted`);
      return true;
    }

    // Says so when the requested parcel is not in the layer at all — the
    // difference between "it did not render" and "it was never sent".
    setViewNote(wanted
      ? `parcel ${wanted}: NOT in layer — fitted all ${features.length}`
      : `fitted all ${features.length}`);

    map.fitBounds(bbox(collection), { padding: 80, maxZoom: 16, duration: 900 });
    return true;
  }, [highlightParcel, loadParcelDetail]);

  const loadParcels = useCallback(() => {
    setDataStatus('loading');

    fetch('/admin/gis/parcels-geojson')
      .then((res) => {
        // A 500 or a login redirect still resolves the promise; without this
        // the page would parse an HTML error document as JSON and report
        // "connected" while showing nothing.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Unmappable rows are removed BEFORE anything measures the collection:

        // bbox() decides the opening view, and one bad coordinate there hides

        // every good parcel.

        const { collection: drawable, dropped } = sanitiseParcels(normalizeFeatureCollection(data));

        setUnmappable(dropped.length);

        const colourised = colouriseParcels(drawable);
        setGeoJsonData(colourised);

        // If the map is already loaded, push the data directly.
        // The useEffect watching geoJsonData handles the normal path, but if
        // the map finished loading AFTER the fetch completed the source exists
        // and we can call setData immediately rather than waiting for a re-render.
        const map = mapRef.current;
        if (map && mapLoadedRef.current) {
          map.getSource('parcels')?.setData(colourised);
          map.getSource('parcel-pins')?.setData(buildPinCollection(colourised));
          applyInitialView(map, colourised);
        }

        // Real timestamp of a real successful response, not a render clock.
        setDataStatus('ok');
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error('Error loading parcels:', err);
        toast.error('Unable to load farm boundary layers');

        /*
         * Non-destructive: the status turns to offline and whatever was
         * already drawn stays on the map. A failed refresh must not blank a
         * working map — the previous data is stale, not wrong, and staff can
         * still read it while the connection is sorted out.
         */
        setDataStatus('error');
      });
  }, []);

  const saveGeometry = useCallback((parcelId, geometry) => {
    if (!parcelId) {
      toast.error('Select a parcel before saving a boundary');
      return;
    }

    setLoading(true);
    router.post(
      `/admin/gis/parcels/${parcelId}/geometry`,
      { geojson: JSON.stringify(geometry) },
      {
        preserveState: true,
        preserveScroll: true,
        onSuccess: () => {
          toast.success('Farm boundary saved');
          loadParcels();
        },
        onError: () => toast.error('Failed to save boundary'),
        onFinish: () => setLoading(false),
      },
    );
  }, [loadParcels]);

  useEffect(() => {
    loadParcels();
  }, [loadParcels]);

  // Escape abandons a half-traced outline, which is what every drawing tool
  // has trained people to expect.
  useEffect(() => {
    if (!drawing) return;

    const onKey = (event) => {
      if (event.key === 'Escape') {
        resetDraft();
        toast('Drawing cancelled.');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // resetDraft is stable; drawing is what starts and stops the listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing]);

  /** Push the in-progress outline into the map's draft source. */
  const paintDraft = useCallback(() => {
    const map = mapRef.current;
    const src = map?.getSource('parcel-draft');
    if (!src) return;

    // The rubber band is only meaningful mid-trace; once drawing stops the
    // cursor position is stale and would leave a line hanging off the shape.
    const cursor = drawingRef.current ? cursorRef.current : null;
    const pts = draftRef.current;

    src.setData(buildDraftFeatures(pts, cursor));

    /*
     * Area of the outline as it stands. @turf/area is spherical, so this is
     * real ground area rather than the planar degree arithmetic that would
     * read badly wrong at this latitude.
     *
     * Measured on the placed vertices only - not the cursor - so the number
     * settles when you stop clicking instead of flickering with the mouse.
     */
    setDraftArea(pts.length >= 3
      ? area({ type: 'Polygon', coordinates: [[...pts, pts[0]]] })
      : 0);
  }, []);

  /** Build centroid Point features for each mapped parcel, for the pin layer. */
  const buildPinCollection = (collection) => ({
    type: 'FeatureCollection',
    features: (collection.features ?? []).map((f) => {
      const [lng, lat] = center(f).geometry.coordinates;
      return {
        type: 'Feature',
        properties: { ...f.properties },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      };
    }),
  });

  const paintPins = useCallback((map, collection) => {
    map?.getSource('parcel-pins')?.setData(buildPinCollection(collection));
  }, []);

  /**
   * Counts the boundaries whose extent overlaps the visible map.
   *
   * A cheap bbox test against the 77 features rather than
   * queryRenderedFeatures, which would only see what is already painted — and
   * the question being asked here is precisely whether anything is.
   *
   * Declared HERE, above every effect that names it. It first went in further
   * down the component, which put it in the temporal dead zone of a dependency
   * array listing it — and dependency arrays are evaluated during render, so
   * the whole component threw "Cannot access before initialization" and the
   * map came up blank.
   */
  const measureInView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Zoom first: it has to be reported even when there is nothing to count,
    // because "no features" and "wrong zoom" are different problems.
    setZoomNow(Number(map.getZoom().toFixed(2)));


    const features = geoJsonRef.current?.features ?? [];
    if (!features.length) {
      setInView(0);
      return;
    }

    const b = map.getBounds();
    const west = b.getWest();
    const east = b.getEast();
    const south = b.getSouth();
    const north = b.getNorth();

    let count = 0;
    for (const feature of features) {
      const [fw, fs, fe, fn] = bbox(feature);
      if (fe >= west && fw <= east && fn >= south && fs <= north) count += 1;
    }

    setInView(count);

    // When nothing is on screen, work out where the closest one actually is.
    // "Somewhere else in the municipality" is not something anyone can act on;
    // "2.4 km north-east" is.
    if (count > 0) {
      setNearest(null);
      return;
    }

    const middle = map.getCenter();
    let best = null;

    for (const feature of features) {
      const [lng, lat] = center(feature).geometry.coordinates;
      const km = kmBetween(middle.lng, middle.lat, lng, lat);

      if (!best || km < best.km) {
        best = { km, lng, lat, id: feature.properties?.id };
      }
    }

    setNearest(best && {
      km: best.km,
      compass: compassBetween(middle.lng, middle.lat, best.lng, best.lat),
      id: best.id,
    });
  }, []);


  /** Bring every boundary back into view — the way out of empty ground. */
  const showAllParcels = useCallback(() => {
    const map = mapRef.current;
    const features = geoJsonRef.current?.features ?? [];
    if (!map || !features.length) return;

    map.fitBounds(bbox(geoJsonRef.current), { padding: 60, maxZoom: 14, duration: 800 });
  }, []);

  const resetDraft = useCallback(() => {
    draftRef.current = [];
    drawingRef.current = false;
    cursorRef.current = null;
    setDrawing(false);

    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = '';
      map.doubleClickZoom.enable();
    }
    paintDraft();
  }, [paintDraft]);

  /** Close the ring and hand it to the server. */
  const finishDraft = useCallback(() => {
    const pts = draftRef.current;

    if (pts.length < 3) {
      toast.error('A boundary needs at least three corners.');
      return;
    }

    const geometry = { type: 'Polygon', coordinates: [[...pts, pts[0]]] };
    const parcelId = selectedParcelRef.current;

    resetDraft();
    saveGeometry(parcelId, geometry);
  }, [resetDraft, saveGeometry]);

  /**
   * Show a freshly imported boundary before it is saved, so it can be judged
   * against the imagery. It is added to the draw layer rather than the parcel
   * source because it is not part of the stored set yet — a successful save
   * reloads the layers and it arrives properly.
   */
  const showImportedBoundary = useCallback(({ geometry, bounds }) => {
    const map = mapRef.current;
    if (!map) return;

    // Shown through the draft layers — the same ones a hand-traced outline
    // uses — so an imported shape reads as work in progress until it is saved.
    const ring = geometry.type === 'MultiPolygon'
      ? geometry.coordinates[0][0]
      : geometry.coordinates[0];

    // The stored ring repeats its first point to close; the draft holds the
    // corners only and closes them itself.
    draftRef.current = ring.slice(0, -1);
    paintDraft();

    map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 800 });

    // maxBounds keeps navigation inside Tumauini, so a parcel surveyed outside
    // the focus extent would be fitted to the edge and look wrong rather than
    // missing. Say so plainly instead of leaving the user to wonder.
    const [w, s, e, n] = bounds;
    const [[bw, bs], [be, bn]] = TUMAUINI_BOUNDS;

    if (w < bw || e > be || s < bs || n > bn) {
      toast.error('That boundary falls outside the Tumauini focus area — check the file is the right parcel.', {
        duration: 7000,
      });
    }
  }, [paintDraft]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!supportsWebGL()) {
      setMapUnavailable(true);
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getBasemapStyle(),
      center: TUMAUINI_CENTER,
      zoom: 12.35,
      pitch: 35,
      bearing: -8,
      maxBounds: TUMAUINI_BOUNDS,
      minZoom: 11,
      maxZoom: 19,
      attributionControl: false,
    });

    // Assigned straight away: anything that throws later must not leave the
    // rest of the page believing there is no map.
    mapRef.current = map;


    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);
    requestAnimationFrame(() => map.resize());

    map.on('error', (event) => {
      console.error('MapLibre error:', event?.error || event);

      const message = String(event?.error?.message ?? event?.error ?? event ?? '');

      if (message.toLowerCase().includes('webgl')) {
        setMapUnavailable(true);
      }

      /*
       * Only things a person can act on reach the screen.
       *
       * Two kinds are deliberately left in the console:
       *
       *  - tile fetch failures, which are transient and would crowd out a real
       *    style error;
       *  - "There is no tile manager with ID '<source>'", which MapLibre 6
       *    FIRES (it does not throw, so a try/catch around the caller does
       *    nothing) whenever a source is queried before its tile manager
       *    exists. It is internal lifecycle noise and says nothing about
       *    whether the map works — it was appearing over a map that was
       *    rendering its parcels perfectly well.
       */
      const ignorable = /\b(40[34]|Failed to fetch|NetworkError)\b/i.test(message)
        || /no tile manager with ID/i.test(message);

      if (!ignorable) {
        setMapError(message.slice(0, 200));
      }
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    /*
     * MapboxDraw is not used on this page and is not constructed.
     *
     * It was built here before map.on('load') was registered, and its
     * constructor validates the style array it is given. Any rejection threw
     * before the load handler existed, so no sources or layers were ever
     * added — while the map still drew imagery, because it had already been
     * created. That is why boundaries never appeared and the view never
     * fitted to them.
     *
     * Tracing is native (see beginDrawing) and parcels render from the
     * `parcels` source below.
     */

    // Recount after every pan and zoom, so the "nothing in view" notice tracks
    // where the map is actually pointed.
    map.on('moveend', measureInView);
    map.on('zoomend', measureInView);

    /*
     * Build the layers, whether or not the load event is still coming.
     *
     * This was `map.on('load', …)`, attached AFTER three addControl calls and
     * a ResizeObserver. MapLibre fires `load` exactly once and does not replay
     * it for listeners that arrive late — so when the style came from cache and
     * loaded inside that gap, the event was already gone. No layers were ever
     * built, no fitBounds ran, and the map sat at its constructor zoom with the
     * imagery showing and nothing on top of it. On a slower load the listener
     * won the race and everything worked.
     *
     * That is the intermittency: "sometimes I can see the boundaries".
     */
    const buildLayers = () => {
      /*
       * Everything in here runs inside try/catch on purpose.
       *
       * Twice in this project a single bad addLayer threw partway through this
       * handler, and because nothing caught it every layer queued AFTER the
       * throw was never created — while the basemap imagery carried on
       * rendering. The map looked fine and simply had no boundaries on it,
       * with nothing anywhere to say why. Whatever fails now gets named on
       * screen instead of disappearing.
       */
      try {
      mapLoadedRef.current = true;
      measureInView();

      map.addSource('tumauini-boundary', {
        type: 'geojson',
        data: TUMAUINI_BOUNDARY_COLLECTION,
      });

      map.addLayer({
        id: 'tumauini-boundary-line',
        type: 'line',
        source: 'tumauini-boundary',
        paint: {
          'line-color': '#14532d',
          'line-width': 2,
          'line-dasharray': [2, 1.5],
        },
      });

      /*
       * Saved parcels, rendered by us.
       */
      map.addSource('parcels', {
        type: 'geojson',
        // Paint whatever has arrived; the setData effect keeps it current.
        data: geoJsonRef.current,
      });

      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': ['coalesce', ['get', 'colour'], '#38bdf8'],
          // A parcel here is about 150 m across — roughly 5 px at the opening
          // zoom and 33 px by zoom 15. Zoomed out it needs to be solid enough
          // to register as a mark at all; zoomed in it must let the imagery
          // through so the land underneath can still be read.
          'fill-opacity': ['interpolate', ['linear'], ['zoom'],
            11, 0.65,  // Increased from 0.55 for better visibility
            14, 0.48,  // Increased from 0.38
            17, 0.3,   // Increased from 0.2
          ],
        },
      });

      map.addLayer({
        id: 'parcels-casing',
        type: 'line',
        source: 'parcels',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        // The dark backing that separates a boundary from whatever it crosses.
        // Held just under the coloured line at every zoom.
        paint: {
          'line-color': '#000000',  // Pure black instead of #0f172a for stronger contrast
          'line-opacity': 0.85,      // Increased from 0.55 for better visibility
          'line-width': ['interpolate', ['linear'], ['zoom'],
            11, 4.5,   // Increased from 3.5
            15, 7.5,   // Increased from 6
            19, 11,    // Increased from 9
          ],
        },
      });

      map.addLayer({
        id: 'parcels-line',
        type: 'line',
        source: 'parcels',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'colour'], '#ffffff'],  // White default for maximum contrast
          'line-width': ['interpolate', ['linear'], ['zoom'],
            11, 3,     // Increased from 2
            15, 5,     // Increased from 3.5
            19, 7.5,   // Increased from 5.5
          ],
        },
      });

      /**
       * The selected parcel, drawn over its own outline.
       *
       * A filter on the id property rather than feature-state: a filter is
       * plain expression support that every version has, where feature-state
       * on line-width is not something to bet the whole parcel layer on.
       * Starts matching nothing - NO_SELECTION - so it draws only once a
       * parcel has actually been chosen.
       */
      map.addLayer({
        id: 'parcels-selected',
        type: 'line',
        source: 'parcels',
        filter: NO_SELECTION,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffff00',  // Bright yellow instead of white for better selection visibility
          'line-width': 5,           // Increased from 3 for more obvious selection
          'line-dasharray': [1.5, 1.2],
          'line-opacity': 0.9,       // Added opacity for smoother appearance
        },
      });

      // ── Arrow / pin markers at each parcel centroid ──────────────────────
      // A separate source holds one Point per parcel at its centroid so we
      // can render the downward-pointing arrow the design shows. Using a
      // separate source (not the polygon source) means we can filter on
      // geometry-type without affecting the fill/line layers.
      map.addSource('parcel-pins', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      });

      /*
       * The pins stop at zoom 15, and that is the whole reason boundaries
       * looked missing.
       *
       * A parcel is about 150 m across: roughly 5 px at the opening zoom, but
       * 33 px by zoom 15. These layers are added AFTER the polygon layers, so
       * they draw on top — a 22 px halo covered a 5 px parcel four times over,
       * and every outline was hidden underneath its own marker.
       *
       * So they now hand over: below 15 the pin says WHERE a holding is, above
       * 15 it gets out of the way and the polygon shows its SHAPE.
       */
      const PIN_MAX_ZOOM = 15;

      // Outer circle (white halo)
      map.addLayer({
        id: 'parcel-pin-halo',
        type: 'circle',
        source: 'parcel-pins',
        maxzoom: PIN_MAX_ZOOM,
        paint: {
          'circle-radius': 11,
          'circle-color': '#ffffff',
          // Fades out over the last zoom level rather than vanishing between
          // one frame and the next.
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.92, 15, 0],
        },
      });

      // Coloured inner dot — same colour as the parcel border
      map.addLayer({
        id: 'parcel-pin-dot',
        type: 'circle',
        source: 'parcel-pins',
        maxzoom: PIN_MAX_ZOOM,
        paint: {
          'circle-radius': 8,
          'circle-color': ['coalesce', ['get', 'colour'], '#38bdf8'],
          'circle-opacity': 1,
        },
      });

      // Downward-pointing triangle "arrow" drawn with a rotated triangle
      // marker — MapLibre has no built-in arrow symbol without a font, so we
      // draw a filled circle with a caret using a second offset circle.
      // Arrow tail: a small rectangle below the dot
      map.addLayer({
        id: 'parcel-pin-tail',
        type: 'circle',
        source: 'parcel-pins',
        maxzoom: PIN_MAX_ZOOM,
        paint: {
          'circle-radius': 4,
          'circle-color': ['coalesce', ['get', 'colour'], '#38bdf8'],
          'circle-translate': [0, 14],   // shifted down in pixels
          'circle-opacity': 1,
        },
      });

      // Tip of the arrow
      map.addLayer({
        id: 'parcel-pin-tip',
        type: 'circle',
        source: 'parcel-pins',
        maxzoom: PIN_MAX_ZOOM,
        paint: {
          'circle-radius': 2.5,
          'circle-color': ['coalesce', ['get', 'colour'], '#38bdf8'],
          'circle-translate': [0, 22],
          'circle-opacity': 1,
        },
      });

      // The outline being traced, drawn by us rather than by MapboxDraw.
      map.addSource('parcel-draft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'parcel-draft-fill',
        type: 'fill',
        source: 'parcel-draft',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.25 },
      });

      /**
       * The edge that follows the cursor. Dashed and translucent so it reads
       * as "where the next side would go" rather than one already placed, and
       * added before the committed line so a placed edge draws over it.
       */
      map.addLayer({
        id: 'parcel-draft-cursor',
        type: 'line',
        source: 'parcel-draft',
        filter: ['==', ['get', 'draft'], 'cursor'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2],
        },
      });

      map.addLayer({
        id: 'parcel-draft-line',
        type: 'line',
        source: 'parcel-draft',
        // Matched on the property, not the geometry type: the rubber band is
        // also a LineString, and a geometry-type filter would draw it solid.
        filter: ['==', ['get', 'draft'], 'shape'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1d4ed8', 'line-width': 3 },
      });

      map.addLayer({
        id: 'parcel-draft-points',
        type: 'circle',
        source: 'parcel-draft',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['get', 'first'], 8, 5],
          'circle-color': ['case', ['get', 'first'], '#f59e0b', '#1d4ed8'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      // If parcels already arrived before the map finished loading, paint them now.
      if (geoJsonRef.current.features.length > 0) {
        map.getSource('parcels')?.setData(geoJsonRef.current);
        paintPins(map, geoJsonRef.current);
        applyInitialView(map, geoJsonRef.current);
      } else {
        // Fetch hasn't returned yet — kick it off now that sources exist.
        // loadParcels will call setData directly because mapLoadedRef is true.
        fetch('/admin/gis/parcels-geojson')
          .then((res) => res.json())
          .then((data) => {
            // Unmappable rows are removed BEFORE anything measures the collection:

            // bbox() decides the opening view, and one bad coordinate there hides

            // every good parcel.

            const { collection: drawable, dropped } = sanitiseParcels(normalizeFeatureCollection(data));

            setUnmappable(dropped.length);

            const colourised = colouriseParcels(drawable);
            map.getSource('parcels')?.setData(colourised);
            map.getSource('parcel-pins')?.setData(buildPinCollection(colourised));
            // Update state so the sidebar counters and parcel effects stay in sync.
            setGeoJsonData(colourised);
            applyInitialView(map, colourised);
          })
          .catch(console.error);
      }
      } catch (error) {
        // Name the failure on screen. A silent throw here is how this page has
        // twice ended up showing imagery and no boundaries.
        console.error('[GIS] map load failed:', error);
        setLayerError(String(error?.message ?? error));
      }

      // Whatever happened above, record what actually exists now. "The layer
      // is missing" and "the layer is there but empty" look identical on the
      // map and need opposite fixes.
      const sourceIds = ['parcels', 'parcel-pins', 'parcel-draft', 'tumauini-boundary'];
      const layerIds = [
        'parcels-fill', 'parcels-casing', 'parcels-line', 'parcels-selected',
        'parcel-pin-halo', 'parcel-draft-line',
      ];

      setMapReport({
        loadFired: true,
        sources: sourceIds.filter((id) => Boolean(map.getSource(id))),
        missingSources: sourceIds.filter((id) => !map.getSource(id)),
        layers: layerIds.filter((id) => Boolean(map.getLayer(id))),
        missingLayers: layerIds.filter((id) => !map.getLayer(id)),
        zoom: Number(map.getZoom().toFixed(2)),
      });

      // Measure again once this settles. The call at the top of buildLayers
      // ran before any of the above existed, so it could only ever report
      // nulls for the thing we are actually trying to see.
      map.once('idle', measureInView);
    };

    /*
     * Run it now if the style is already up, otherwise wait for the event.
     *
     * `isStyleLoaded()` is the question that matters — layers cannot be added
     * before the style exists, and `load` will never come again if it has
     * already been and gone. Guarded so it cannot run twice.
     */
    let layersBuilt = false;
    const buildOnce = () => {
      if (layersBuilt) return;
      layersBuilt = true;
      buildLayers();
    };

    /*
     * Try now, and subscribe to everything that could mean "ready".
     *
     * The previous attempt checked isStyleLoaded() and otherwise waited for
     * `load` or `styledata`. That still lost: both of those are one-shot for a
     * cached style, so if they had already fired before these lines ran AND
     * isStyleLoaded() was not yet true, nothing ever built the layers.
     *
     * `idle` is the one that cannot be missed. Unlike `load` it fires after
     * every settle — "no camera transitions, all requested tiles loaded, all
     * animations complete" — so a listener attached late still gets the next
     * one, within a moment of the map appearing. It also implies the style is
     * up, which is exactly the precondition for addSource.
     */
    if (map.isStyleLoaded()) buildOnce();

    map.on('load', buildOnce);
    map.on('idle', buildOnce);

    // The draw.create / draw.update / draw.delete handlers were removed with
    // MapboxDraw: nothing fires those events any more. Tracing saves through
    // finishDraft, and boundary deletion goes through deleteSelectedBoundary.

    map.on('click', (event) => {
      /*
       * Measuring takes the click before anything else.
       *
       * It is a read-only ruler: points are collected in component state, the
       * result is arithmetic over those points, and nothing is ever sent to
       * the server. No parcel record can be touched by measuring.
       *
       * Read through a ref because this handler is registered once, on map
       * creation, and would otherwise close over the mode as it was then.
       */
      if (measureModeRef.current) {
        const { lng, lat } = event.lngLat;
        measurePointsRef.current = [...measurePointsRef.current, [lng, lat]];
        setMeasurePoints(measurePointsRef.current);
        paintMeasure();
        return;
      }

      // While tracing, a click places a corner instead of inspecting a parcel.
      if (drawingRef.current) {
        const { lng, lat } = event.lngLat;
        const pts = draftRef.current;

        // Clicking the first corner closes the ring. The tolerance is in
        // screen pixels so it stays usable at any zoom.
        if (pts.length >= 3) {
          const first = map.project(pts[0]);
          const here = event.point;
          const gap = Math.hypot(first.x - here.x, first.y - here.y);

          if (gap < 12) {
            finishDraft();
            return;
          }
        }

        draftRef.current = [...pts, [lng, lat]];
        paintDraft();
        return;
      }

      // MapboxDraw renders each style twice, into a "cold" and a "hot" layer.
      // The static pair is included because a committed boundary can land
      // there, and a parcel you cannot click is a parcel you cannot inspect.
      const drawLayers = PARCEL_HIT_LAYERS.filter((layerId) => map.getLayer(layerId));

      if (!drawLayers.length) return;

      const rendered = map.queryRenderedFeatures(event.point, {
        layers: drawLayers,
      });

      const feature = rendered.find((item) => item.properties?.parcel_number || item.properties?.id);

      if (!feature) {
        // Clicking bare ground clears the panel rather than leaving the last
        // parcel selected, which reads as though it is still highlighted.
        setSelectedFeature(null);
        highlightParcel(null);
        setParcelDetail(null);
        popupRef.current?.remove();
        return;
      }

      const props = feature.properties || {};
      setSelectedFeature(props);
      highlightParcel(props.id);
      loadParcelDetail(props.id);

      /*
       * Move in close enough to actually see what was selected.
       *
       * Clicking a pin from the opening zoom used to select a parcel that was
       * still only a few pixels wide, so the panel filled in while the map
       * showed nothing new. Only zooms IN — someone already inspecting a
       * boundary up close should not be yanked back out.
       */
      if (map.getZoom() < PARCEL_READABLE_ZOOM) {
        map.easeTo({
          center: event.lngLat,
          zoom: PARCEL_READABLE_ZOOM,
          duration: 600,
        });
      }

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
        .setLngLat(event.lngLat)
        // Properties arrive from the database, so they are escaped before
        // going anywhere near setHTML — a farmer's name is user input.
        .setHTML(`
          <div class="text-sm">
            <strong>${esc(props.parcel_number) || 'Farm parcel'}</strong>
            <div>${props.farmer_name
              ? `Farmer: ${esc(props.farmer_name)}`
              : '<span style="color:#b45309">No farmer assigned</span>'}</div>
            <div>Barangay: ${esc(props.barangay) || 'Unspecified'}</div>
            <div>Area: ${props.area_ha ? `${esc(props.area_ha)} ha` : 'not recorded'}</div>
            ${props.commodity || props.farm_type ? `<div>Crop: ${esc(props.commodity || props.farm_type)}</div>` : ''}
            ${props.boundary_source ? `<div class="mt-1 text-xs text-slate-500">Boundary: ${
              props.boundary_source === 'drawn' ? 'drawn by hand' : `imported from ${esc(props.boundary_source)}`
            }</div>` : ''}
          </div>
        `)
        .addTo(map);
    });

    // A pointer over a parcel is the only cue that it can be inspected.
    map.on('mousemove', (event) => {
      // While a boundary is being traced the cursor belongs to the draw tool.
      // This guard used to read `map.getMode`, which does not exist — getMode
      // lives on the draw control — so it never fired, and every mouse move
      // reset the cursor back to the grab hand. That is why tracing showed no
      // crosshair and looked as though drawing had not started.
      if (drawingRef.current) {
        // Track the pointer so the next edge is visible before it is placed.
        cursorRef.current = [event.lngLat.lng, event.lngLat.lat];
        paintDraft();
        return;
      }

      const over = PARCEL_HIT_LAYERS.filter((id) => map.getLayer(id));
      if (!over.length) return;

      const hit = map.queryRenderedFeatures(event.point, { layers: over });
      map.getCanvas().style.cursor = hit.length ? 'pointer' : '';
    });

    // Pointer off the canvas: drop the rubber band rather than leaving it
    // frozen at the edge, pointing at nothing.
    map.on('mouseout', () => {
      if (!drawingRef.current || !cursorRef.current) return;

      cursorRef.current = null;
      paintDraft();
    });

    // Double-click also closes the ring, which is the habit most mapping tools
    // have trained. doubleClickZoom is disabled while tracing so it does not
    // zoom instead.
    map.on('dblclick', (event) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      finishDraft();
    });

    return () => {
      resizeObserver.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Saved parcels go into our own source now, not into the draw control.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const src = map.getSource('parcels');
    if (!src) return;

    /*
     * One decision about what belongs on the map, made here.
     *
     * The layer toggle and the filters both narrow the same thing, so they
     * resolve to a single collection rather than each writing the source on
     * their own — two writers on one source is how a toggle ends up undoing a
     * filter. setData is used rather than rebuilding layers: the sources and
     * layers are created once and only their contents change.
     */
    const data = showParcels ? visibleCollection : EMPTY_FEATURE_COLLECTION;
    src.setData(data);
    paintPins(map, showParcels && showPins ? visibleCollection : EMPTY_FEATURE_COLLECTION);
    measureInView();

    // Fitted from the FULL collection, so the opening view frames everything
    // the office has mapped rather than whatever filter happens to be set.
    applyInitialView(map, geoJsonData);
  }, [geoJsonData, visibleCollection, showParcels, showPins, paintPins, measureInView, applyInitialView]);

  /*
   * Basemap switching by visibility, never by setStyle.
   *
   * setStyle tears down every source and layer this page has added — the
   * parcels, the pins, the boundary, the drawing preview — and rebuilds them
   * on the same load race that left this map blank for days. All three rasters
   * are declared in the initial style instead, and a hidden one fetches no
   * tiles, so switching is just two visibility writes.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    for (const option of BASEMAPS) {
      if (!map.getLayer(option.layer)) continue;
      map.setLayoutProperty(
        option.layer,
        'visibility',
        option.id === basemap ? 'visible' : 'none',
      );
    }
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('tumauini-boundary-line')) return;

    const visibility = showBoundary ? 'visible' : 'none';
    map.setLayoutProperty('tumauini-boundary-line', 'visibility', visibility);
  }, [showBoundary]);

  const focusTumauini = () => {
    mapRef.current?.fitBounds(TUMAUINI_BOUNDS, {
      padding: 44,
      pitch: 35,
      bearing: -8,
      duration: 900,
    });
  };

  const focusSelectedParcel = (parcelId = selectedParcel) => {
    const feature = geoJsonData.features.find((item) => String(item.properties?.id) === String(parcelId));
    if (!feature) {
      toast.error('This parcel has no saved boundary yet');
      return;
    }

    const bounds = bbox(feature);
    mapRef.current?.fitBounds(bounds, { padding: 72, maxZoom: 17, duration: 900 });
    setSelectedFeature(feature.properties);
    highlightParcel(feature.properties.id);
    loadParcelDetail(feature.properties.id);
  };

  /**
   * One way to choose a parcel, shared by the search box, the parcel list and
   * the target selector, so all three leave the page in the same state: the
   * map flown to it, the outline highlighted, the detail card filled and the
   * target selector agreeing with what is selected.
   */
  const pickFeature = (feature) => {
    const id = feature?.properties?.id;
    if (id === null || id === undefined) return;

    setSelectedParcel(String(id));
    focusSelectedParcel(id);
  };

  /**
   * A scanned ID card, turned into that farmer's land on the map.
   *
   * The QR carries the farmer's own page URL, which the server resolves —
   * FarmerScanController owns that parsing because it sits beside the code
   * that writes the card, and because a scanner pointed at some other QR
   * should be refused by the server rather than by a regex in a bundle.
   *
   * Scanning changes nothing: it sets a filter and moves the camera. No parcel
   * or farmer record is written, and the card carries no credentials — the
   * staff member is already signed in, this only saves them the typing.
   */
  const handleScan = async (code) => {
    setScannerOpen(false);
    setScanBusy(true);

    try {
      const response = await fetch(
        `/admin/farmer-scan?code=${encodeURIComponent(code)}`,
        { headers: { Accept: 'application/json' } },
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        // The server's reason, not a generic one: "no longer on the register"
        // and "not verified yet" need different actions from the counter.
        toast.error(body.message || 'That card could not be read.');
        return;
      }

      const farmerId = String(body.id);
      const theirs = geoJsonData.features.filter(
        (feature) => String(feature.properties?.farmer_id) === farmerId,
      );

      if (theirs.length === 0) {
        // Say so rather than applying a filter that empties the map — an
        // unmapped farmer is a real answer, not a failed scan.
        toast.error(`${body.label ?? 'That farmer'} has no mapped parcel yet.`);
        return;
      }

      setSearchInput('');
      setFilters({ ...EMPTY_FILTERS, farmer: farmerId });

      if (theirs.length === 1) {
        pickFeature(theirs[0]);
      } else {
        mapRef.current?.fitBounds(
          bbox({ type: 'FeatureCollection', features: theirs }),
          { padding: 72, maxZoom: 16, duration: 900 },
        );
      }

      toast.success(
        `${body.label ?? 'Farmer'} — ${theirs.length} mapped parcel${theirs.length === 1 ? '' : 's'}`,
      );
    } catch {
      toast.error('Unable to look up that card. Check the connection and try again.');
    } finally {
      setScanBusy(false);
    }
  };

  /*
   * QrScanner restarts its camera whenever its onScan prop changes identity,
   * and handleScan is rebuilt on every render. The ref keeps the prop stable
   * while the handler it calls stays current — without it the viewfinder would
   * tear down and reopen on each keystroke typed into the search box.
   */
  const scanHandlerRef = useRef(handleScan);
  scanHandlerRef.current = handleScan;
  const onScanStable = useCallback((code) => scanHandlerRef.current(code), []);

  /** Clear the selection everywhere it is held. */
  const clearSelection = () => {
    setSelectedParcel('');
    setSelectedFeature(null);
    setParcelDetail(null);
    highlightParcel(null);
  };

  /**
   * Turn the ruler on or off.
   *
   * Measuring and drawing share the parcel-draft source, so starting one must
   * stop the other — otherwise a half-traced boundary and a half-measured line
   * would overwrite each other's geometry on the same layer.
   */
  const toggleMeasure = (mode) => {
    const next = measureMode === mode ? null : mode;

    if (next && drawing) cancelDrawing();

    clearMeasure();
    setMeasureMode(next);
  };

  const beginDrawing = () => {
    if (!canEdit) return;

    if (!selectedParcel) {
      toast.error('Select a parcel first');
      return;
    }

    const map = mapRef.current;
    if (!map) {
      toast.error('The map is still loading. Try again in a moment.');
      return;
    }

    // Start a fresh outline. doubleClickZoom is off while tracing so a
    // double-click closes the ring rather than zooming in.
    draftRef.current = [];
    drawingRef.current = true;
    setDrawing(true);
    map.getCanvas().style.cursor = 'crosshair';
    map.doubleClickZoom.disable();
    paintDraft();

    toast.success('Click each corner of the parcel. Click the first corner again, or double-click, to finish.');
  };

  const cancelDrawing = () => {
    resetDraft();
    toast('Drawing cancelled.');
  };
  const deleteSelectedBoundary = () => {
    if (!canDelete || !selectedParcel) return;

    const feature = geoJsonData.features.find((item) => String(item.properties?.id) === String(selectedParcel));
    if (!feature) {
      toast.error('No saved boundary found for this parcel');
      return;
    }

    /*
     * Confirm, and name what is about to go.
     *
     * This had no confirmation at all: one click on Delete permanently removed
     * a boundary that may have come from a surveyed shapefile, with nothing
     * between the click and the request. The prompt names the parcel and the
     * farmer so the parcel being destroyed is the one the user meant — a bare
     * "Are you sure?" on a map where selection is easy to lose is not a check.
     *
     * Only the boundary is removed. deleteGeometry nulls geojson_data on the
     * parcel row; the parcel and the farmer are untouched.
     */
    const p = feature.properties ?? {};
    const label = p.parcel_number || `Parcel #${p.id}`;
    const owner = p.farmer_name ? ` (${p.farmer_name})` : '';

    const confirmed = window.confirm(
      `Delete the boundary for ${label}${owner}?\n\n`
      + `Barangay: ${p.barangay || 'not recorded'}\n`
      + `Drawn area: ${featureHectares(feature).toFixed(2)} ha\n`
      + `Source: ${p.boundary_source || 'not recorded'}\n\n`
      + 'The mapped outline will be removed. The parcel record and the farmer '
      + 'are not deleted. This cannot be undone.',
    );

    if (!confirmed) return;

    router.delete(`/admin/gis/parcels/${selectedParcel}/geometry`, {
      preserveState: true,
      preserveScroll: true,
      onSuccess: () => {
        toast.success('Boundary deleted');
        setSelectedFeature(null);
        highlightParcel(null);
        setParcelDetail(null);
        loadParcels();
      },
      onError: () => toast.error('Failed to delete boundary'),
    });
  };

  const selectedCentroid = useMemo(() => {
    const feature = geoJsonData.features.find((item) => String(item.properties?.id) === String(selectedParcel));
    if (!feature) return null;

    const [lng, lat] = center(feature).geometry.coordinates;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }, [geoJsonData, selectedParcel]);

  return (
    <AdminLayout title="GIS Farm Mapping">
      <div className="space-y-4">

        {/*
            Status strip and search.

            The status is measured, never decorative: it reports the outcome of
            the last actual request to the GeoJSON endpoint and the time that
            response came back. A failed refresh says so and leaves the map as
            it was, because stale boundaries are still readable and blanking
            them would destroy the only copy on screen.
        */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
              <span
                aria-hidden="true"
                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  dataStatus === 'ok' ? 'bg-emerald-500'
                    : dataStatus === 'loading' ? 'animate-pulse bg-amber-400'
                      : 'bg-rose-500'
                }`}
              />
              <span className="text-xs">
                <span className="font-semibold uppercase tracking-wide text-slate-500">GIS data </span>
                <span className={
                  dataStatus === 'ok' ? 'text-emerald-700'
                    : dataStatus === 'loading' ? 'text-amber-700'
                      : 'text-rose-700'
                }>
                  {dataStatus === 'ok' ? 'Connected'
                    : dataStatus === 'loading' ? 'Loading…'
                      : 'Unable to load'}
                </span>
                {lastUpdated && dataStatus === 'ok' && (
                  <span className="ml-2 hidden text-slate-500 sm:inline">
                    Updated {lastUpdated.toLocaleString(undefined, {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={loadParcels}
              title="Fetch the latest boundaries without reloading the page"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${dataStatus === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh map data
            </button>
          </div>

          <div className="flex items-start gap-2 lg:w-[30rem]">
            <div className="min-w-0 flex-1">
              <GisSearch
                value={searchInput}
                onChange={setSearchInput}
                results={searchResults}
                onPick={pickFeature}
                loading={dataStatus === 'loading'}
              />
            </div>

            {/*
                Scan a farmer's ID card instead of typing their name.

                Same card and same endpoint the distribution counter already
                uses, so there is one definition of what a GeoFarm QR is. Shown
                only to staff who may view farmers, because that is what the
                scan resolves to and what the route requires.
            */}
            {can('view farmers') && (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                disabled={scanBusy}
                title="Scan a farmer's ID card to jump to their parcels"
                aria-label="Scan a farmer ID card"
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <QrCode className={`h-4 w-4 ${scanBusy ? 'animate-pulse' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">{scanBusy ? 'Looking up…' : 'Scan ID'}</span>
              </button>
            )}
          </div>
        </div>

        <QrScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={onScanStable}
        />

        {dataStatus === 'error' && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Unable to load GIS data. Please try again — any boundaries already
            on the map are still shown and are unchanged.
          </p>
        )}

        <StatCards stats={visibleStats} totals={totalStats} filtered={filtersActive} />

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/*
                Sized to the viewport rather than a fixed 680 px.

                At a fixed height the map ran past the bottom of the browser
                window on a laptop, which put its scale bar, attribution and
                anything anchored to its lower edge permanently off-screen —
                including the status line meant to explain a blank map. A tall
                map you have to scroll to see the bottom of is worse than a
                slightly shorter one that fits.
            */}
            <div className="relative h-[calc(100vh-13rem)] min-h-[420px] max-h-[820px] overflow-hidden rounded-lg border border-slate-200">
              {mapUnavailable ? (
                <TumauiniMapFallback className="absolute inset-0" />
              ) : (
                <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
              )}
              {loading && (
                <div className="absolute left-4 top-16 z-10 rounded-md bg-white/95 px-3 py-2 text-sm font-medium text-emerald-800 shadow">
                  Saving boundary...
                </div>
              )}

              {/*
                  Empty ground looks identical to a broken map.

                  Holdings average about 150 m across and are spread over some
                  550 km2, so a view close enough to read a boundary usually
                  contains none. Saying so — and offering the way back — is the
                  difference between "there is nothing here" and "this is
                  broken".
              */}
              {!mapUnavailable && !drawing && mappedCount > 0 && inView === 0 && (
                <div className="absolute inset-x-4 top-16 z-10 flex flex-wrap items-center gap-3 rounded-lg bg-slate-900/85 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-16">
                  <MapPinned className="h-4 w-4 flex-shrink-0 text-amber-300" />
                  <span>
                    {/* This used to read "mapped elsewhere in Tumauini", which
                        sounded like an accusation that you were not in
                        Tumauini. The map is always in Tumauini; the point is
                        that this WINDOW — a kilometre or two of ground — holds
                        none of them. So it now names a direction and a
                        distance, which is something you can act on. */}
                    Nothing mapped in this part of the map.
                    {nearest ? (
                      <span className="text-white/70">
                        {' '}Nearest boundary is{' '}
                        <span className="font-semibold text-white">
                          {nearest.km < 1
                            ? `${Math.round(nearest.km * 1000)} m`
                            : `${nearest.km.toFixed(1)} km`}
                        </span>
                        {' '}{nearest.compass}.
                      </span>
                    ) : (
                      <span className="text-white/70">
                        {' '}All {mappedCount} are in other parts of the municipality.
                      </span>
                    )}
                  </span>

                  <div className="ml-auto flex flex-shrink-0 gap-2">
                    {nearest?.id != null && (
                      <button
                        type="button"
                        onClick={() => focusSelectedParcel(nearest.id)}
                        className="whitespace-nowrap rounded-md border border-white/30 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        Go to nearest
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={showAllParcels}
                      className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      Show all {mappedCount}
                    </button>
                  </div>
                </div>
              )}

              {/*
                  Always on. The previous version showed a count only when
                  inView > 0 and a notice only when NOT drawing — so in the one
                  state that mattered (drawing, nothing in view) both were
                  hidden and the map said nothing at all. A status line that
                  disappears exactly when you need it is not instrumentation.
              */}
              {!mapUnavailable && (
                /* Anchored to the TOP. It sat at bottom-4 of a 680 px map,
                   which on a laptop is below the browser fold — so the one
                   thing built to explain a blank map was itself invisible. */
                <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-slate-900/85 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                  <span className={mappedCount === 0 ? 'text-rose-300' : ''}>
                    {mappedCount} loaded
                  </span>
                  <span className="text-white/40">·</span>
                  <span className={inView === 0 ? 'text-amber-300' : 'text-emerald-300'}>
                    {inView ?? '—'} in view
                  </span>
                  {zoomNow != null && (
                    <>
                      <span className="text-white/40">·</span>
                      {/* Past 15 the pins hand over to the polygons, so the
                          zoom says which of the two you should be seeing. */}
                      <span title={zoomNow < 15 ? 'pins shown' : 'outlines shown'}>
                        z{zoomNow}{zoomNow < 15 ? ' (pins)' : ' (outlines)'}
                      </span>
                    </>
                  )}
                  {/* Only when it is actually wrong. "6/6 layers" was for
                      diagnosing the blank map and means nothing to staff; a
                      layer that failed to build still has to be shouted. */}
                  {mapReport && mapReport.missingLayers.length > 0 && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="text-rose-300 font-semibold">
                        {mapReport.missingLayers.length} layer(s) failed
                      </span>
                    </>
                  )}
                  {!mapReport && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="text-rose-300 font-semibold">layers NOT built</span>
                    </>
                  )}
                  {unmappable > 0 && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="text-rose-300" title="Mapped in the parcel list, but their geometry cannot be drawn">
                        {unmappable} unmappable
                      </span>
                    </>
                  )}
                  {/* "fitted all 74" was scaffolding. What still matters is
                      the one case staff can act on: a ?parcel= link pointing
                      at a parcel that has no boundary on this map. */}
                  {viewNote?.includes('NOT in layer') && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="text-rose-300">{viewNote}</span>
                    </>
                  )}
                </div>
              )}

              {/*
                  MapLibre's own complaint, on the screen.

                  This has always gone to console.error and nowhere else, so a
                  rejected paint expression or a broken source looked identical
                  to "the map is fine but empty" to anyone not in devtools.
              */}
              {!mapUnavailable && mapError && (
                /* TOP, not bottom. The previous version of this sat at
                   bottom-4 of an 820 px map — off the bottom of a laptop
                   screen, which is exactly how the last blank-map notice
                   managed to go unread. */
                <div className="absolute inset-x-4 top-14 z-30 rounded-md border border-rose-400 bg-rose-950/95 px-3 py-2 text-xs text-rose-100 shadow-lg backdrop-blur-sm">
                  <span className="font-semibold">MapLibre error:</span> {mapError}
                </div>
              )}

              {/*
                  Why the boundaries are not on screen, in the map's own words.
                  Shown only when something is genuinely wrong — a layer failed
                  to build, or the layer exists and has nothing in it.
              */}
              {!mapUnavailable && mapReport
                && (layerError || mapReport.missingLayers.length > 0 || mappedCount === 0) && (
                <div className="absolute right-4 top-4 max-w-xs rounded-lg bg-slate-900/90 px-3 py-2.5 text-xs text-white shadow-lg backdrop-blur-sm">
                  <p className="font-semibold text-amber-300">Boundary layer report</p>

                  {layerError && (
                    <p className="mt-1.5 text-rose-200">
                      A layer failed to build: <span className="font-mono">{layerError}</span>
                    </p>
                  )}

                  <dl className="mt-1.5 space-y-0.5 text-white/80">
                    <div className="flex justify-between gap-3">
                      <dt>Layers built</dt>
                      <dd className="font-mono">{mapReport.layers.length} of {mapReport.layers.length + mapReport.missingLayers.length}</dd>
                    </div>
                    {mapReport.missingLayers.length > 0 && (
                      <div className="text-rose-200">
                        Missing: <span className="font-mono">{mapReport.missingLayers.join(', ')}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt>Boundaries loaded</dt>
                      <dd className="font-mono">{mappedCount}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>In this view</dt>
                      <dd className="font-mono">{inView ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            {/*
                Legend and parcel list, below the map on a wide screen and
                stacked under it on a narrow one. Both sit in the grid's first
                column so the map keeps its full width.
            */}
            <div className="space-y-4 xl:col-start-1">
              {/*
                  The barangay legend is deliberately not rendered.

                  Staff at the Municipal Agriculture Office already know the 46
                  barangays, so a 46-row colour key is a wall of names rather
                  than a reference. Parcels are still coloured by barangay, and
                  a parcel's barangay is on its card when clicked and in the
                  list below — which is where it is actually asked for.

                  Components/GIS/BarangayLegend.jsx is kept if this is ever
                  wanted back; nothing imports it, so it is not bundled.
              */}
              <ParcelTable
                features={sortedVisible}
                sort={listSort}
                onSort={(key) => setListSort((current) => ({
                  key,
                  // Same column toggles direction; a new column starts ascending.
                  dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc',
                }))}
                onPick={pickFeature}
                selectedId={selectedParcel}
                loading={dataStatus === 'loading' && geoJsonData.features.length === 0}
              />
            </div>

            {/* Always rendered: on a narrow screen the grid collapses to one
                column and this stacks under the map, which keeps every control
                reachable. The bottom sheet below is an additional shortcut to
                the two panels needed while actually looking at the map, not a
                replacement for this one. */}
            <aside className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-800">
                  <MapPinned className="h-4 w-4" />
                  Tumauini Focus
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Municipal farm intelligence map</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {/* Read from the config rather than typed out, so the two can
                      never disagree again — this previously still quoted the old
                      extent long after the bounds were widened. */}
                  Navigation is limited to an approximate extent of Tumauini, Isabela:{' '}
                  {TUMAUINI_BOUNDS[0][1].toFixed(2)}–{TUMAUINI_BOUNDS[1][1].toFixed(2)} N and{' '}
                  {TUMAUINI_BOUNDS[0][0].toFixed(2)}–{TUMAUINI_BOUNDS[1][0].toFixed(2)} E.
                  That box is a placeholder, not the surveyed municipal boundary.
                  Imagery is Esri World Imagery.
                </p>
              </div>

              {/* The totals moved to the cards above the map. What is left
                  here is the one reading those cards cannot give: the outline
                  being traced right now, which is not a saved parcel and must
                  not be counted as one. */}
              {drawing && (
                <div className="rounded-lg border border-blue-300 bg-blue-50 p-3">
                  <div className="text-xs font-medium uppercase text-slate-500">Drawing area</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {formatArea(draftArea)}
                  </div>
                  {draftArea === 0 && (
                    <div className="mt-1 text-xs text-slate-500">Place three corners</div>
                  )}
                </div>
              )}

              <FarmFilters
                filters={filters}
                options={filterOptions}
                onChange={setFilters}
                onClear={() => { setFilters(EMPTY_FILTERS); setSearchInput(''); }}
                active={filtersActive}
                resultCount={visibleFeatures.length}
              />

              <SelectedParcelCard
                properties={selectedFeature}
                detail={parcelDetail}
                loading={detailLoading}
                onZoom={() => focusSelectedParcel()}
                onClear={clearSelection}
                canViewFarmer={can('view farmers')}
                canEditParcel={can('edit parcels')}
              />

              <div className="rounded-lg border border-slate-200 p-4">
                <label className="text-sm font-medium text-slate-700">Target parcel</label>
                <select
                  value={selectedParcel}
                  onChange={(event) => {
                    const id = event.target.value;
                    setSelectedParcel(id);
                    setSelectedFeature(null);
                    highlightParcel(null);
                    setParcelDetail(null);

                    // Go there. Choosing a parcel and then having to press
                    // Locate was two steps for one intention — and with
                    // holdings this small, a selection you cannot see reads as
                    // though nothing happened.
                    if (id && geoJsonData.features.some((f) => String(f.properties?.id) === String(id))) {
                      focusSelectedParcel(id);
                    }
                  }}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Select a parcel</option>
                  {targetOptions.map((parcel) => (
                    <option key={parcel.id} value={parcel.id}>
                      {parcel.parcel_number || `Parcel #${parcel.id}`}
                      {' — '}
                      {[parcel.farmer?.first_name, parcel.farmer?.last_name].filter(Boolean).join(' ') || 'Unassigned'}
                      {' — '}
                      {parcel.barangay || 'No barangay'}
                      {/* Says which parcels still need tracing, so Draw is
                          aimed at one of them rather than found by trial. */}
                      {parcel.mapped ? '' : '  · no boundary yet'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {mappedCount} of {parcels.length} parcels have a boundary. Use
                  the search box above the map to find one by farmer or RSBSA.
                </p>

                {selectedParcelDetails && (
                  <div className="mt-3 text-sm text-slate-600">
                    <div className="font-medium text-slate-800">{selectedParcelDetails.barangay || 'Unspecified barangay'}</div>
                    <div>{selectedParcelDetails.total_area_ha || 'N/A'} ha recorded area</div>
                    {selectedCentroid && <div>Centroid: {selectedCentroid}</div>}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={drawing ? cancelDrawing : beginDrawing}
                    disabled={!canEdit}
                    className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                      drawing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-700 hover:bg-emerald-800'
                    }`}
                    title={drawing ? 'Cancel drawing (Esc)' : 'Draw boundary'}
                  >
                    <PenLine className="h-4 w-4" />
                    {drawing ? 'Cancel' : 'Draw'}
                  </button>
                  <button
                    type="button"
                    onClick={focusSelectedParcel}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title="Zoom to selected parcel"
                  >
                    <LocateFixed className="h-4 w-4" />
                    Locate
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedBoundary}
                    disabled={!canDelete}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Delete selected boundary"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={loadParcels}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title="Refresh layers"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>

                {/*
                    Measuring tools.

                    A ruler, not an editor: clicks are collected in component
                    state and the reading is arithmetic over those points.
                    Nothing here posts, and no parcel record can be changed by
                    measuring. They share the draft layers with Draw, so
                    starting one cancels the other.
                */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleMeasure('distance')}
                    title="Measure a distance — click points along the route"
                    aria-pressed={measureMode === 'distance'}
                    className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                      measureMode === 'distance'
                        ? 'border-sky-400 bg-sky-50 text-sky-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Spline className="h-4 w-4" aria-hidden="true" />
                    Distance
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMeasure('area')}
                    title="Measure an area — click at least three corners"
                    aria-pressed={measureMode === 'area'}
                    className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                      measureMode === 'area'
                        ? 'border-sky-400 bg-sky-50 text-sky-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Ruler className="h-4 w-4" aria-hidden="true" />
                    Area
                  </button>
                </div>

                {measureMode && (
                  <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm" role="status">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sky-900">
                        {measurement
                          ? measurement.kind === 'distance'
                            ? (measurement.metres < 1000
                                ? `${measurement.metres.toFixed(0)} m`
                                : `${measurement.km.toFixed(2)} km`)
                            : (measurement.hectares < 1
                                ? `${measurement.squareMetres.toFixed(0)} m²`
                                : `${measurement.hectares.toFixed(2)} ha`)
                          : measureMode === 'distance'
                            ? 'Click two or more points'
                            : 'Click three or more corners'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleMeasure(measureMode)}
                        className="rounded p-1 text-sky-700 hover:bg-sky-100"
                        title="Stop measuring"
                        aria-label="Stop measuring"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {measurePoints.length > 0 && (
                      <button
                        type="button"
                        onClick={clearMeasure}
                        className="mt-1 text-xs text-sky-700 underline hover:text-sky-900"
                      >
                        Clear the {measurePoints.length} point{measurePoints.length === 1 ? '' : 's'} placed
                      </button>
                    )}
                  </div>
                )}

                {selectedParcel && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title="Deselect the current parcel"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {/* Import needs a parcel to attach the boundary to, so it stays
                  out of the way until one is chosen. */}
              {canEdit && (
                selectedParcel ? (
                  <BoundaryImport
                    key={selectedParcel}
                    parcelId={selectedParcel}
                    onImported={showImportedBoundary}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Import a surveyed boundary</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Choose a target parcel above, then upload its Shapefile, KML or GeoJSON.
                    </p>
                  </div>
                )
              )}

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Layers className="h-4 w-4" />
                  Layers
                </div>
                <label className="flex items-center justify-between gap-3 py-2 text-sm text-slate-700">
                  Municipal focus boundary
                  <input type="checkbox" checked={showBoundary} onChange={(event) => setShowBoundary(event.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-3 py-2 text-sm text-slate-700">
                  Farm parcel boundaries
                  <input type="checkbox" checked={showParcels} onChange={(event) => setShowParcels(event.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-3 py-2 text-sm text-slate-700">
                  Farmer pins
                  <input
                    type="checkbox"
                    checked={showPins}
                    disabled={!showParcels}
                    onChange={(event) => setShowPins(event.target.checked)}
                  />
                </label>

                {/*
                    Layers the registry does not hold as geography.

                    Listed so the structure is visible and disabled because the
                    data is not spatial: risk is recorded per farmer, assistance
                    per distribution, assets and seasons per record — none of
                    them has an outline to draw. They are NOT rendered with
                    invented shapes; a placeholder that draws nothing is honest,
                    a placeholder that draws fake polygons is not.
                */}
                <fieldset className="mt-2 border-t border-slate-100 pt-2" disabled>
                  <legend className="sr-only">Layers not yet available</legend>
                  {['Flood / drought risk areas', 'Assistance coverage', 'Crop distribution zones'].map((label) => (
                    <label
                      key={label}
                      className="flex cursor-not-allowed items-center justify-between gap-3 py-1.5 text-sm text-slate-400"
                      title="No mapped geometry exists for this yet"
                    >
                      {label}
                      <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                        No map data
                      </span>
                    </label>
                  ))}
                </fieldset>

                {/*
                    Basemap. Switched by visibility, never by setStyle — see the
                    note in tumauiniMap.js. All three come from the same Esri
                    service already in use, so no new provider or key is added.
                */}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Basemap
                  </div>
                  <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Basemap">
                    {BASEMAPS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBasemap(option.id)}
                        aria-pressed={basemap === option.id}
                        title={option.hint}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                          basemap === option.id
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={focusTumauini}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" />
                  Recenter Tumauini
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Selected Feature</h3>
                {selectedFeature ? (
                  <>
                  <dl className="mt-3 space-y-2 text-sm text-slate-600">
                    <div>
                      <dt className="font-medium text-slate-800">Parcel</dt>
                      <dd>{selectedFeature.parcel_number || 'Not numbered'}</dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-800">Farmer</dt>
                      {selectedFeature.farmer_name ? (
                        <dd>
                          <a
                            href={`/admin/farmers/${selectedFeature.farmer_id}`}
                            className="text-emerald-700 hover:underline"
                          >
                            {selectedFeature.farmer_name}
                          </a>
                          {selectedFeature.rsbsa_no && (
                            <span className="block text-xs text-slate-500">
                              RSBSA {selectedFeature.rsbsa_no}
                            </span>
                          )}
                        </dd>
                      ) : (
                        // A parcel with no farmer is work for staff, not an
                        // error — say which it is and where to fix it.
                        <dd className="text-amber-700">
                          No farmer assigned
                          <a
                            href={`/admin/parcels/${selectedFeature.id}/edit`}
                            className="ml-1.5 text-emerald-700 hover:underline"
                          >
                            Assign one
                          </a>
                        </dd>
                      )}
                    </div>

                    <div>
                      <dt className="font-medium text-slate-800">Recorded area</dt>
                      <dd>
                        {selectedFeature.area_ha
                          ? `${Number(selectedFeature.area_ha).toLocaleString('en-PH')} ha`
                          : 'Not recorded'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-800">Barangay</dt>
                      <dd>{selectedFeature.barangay || 'Unspecified'}</dd>
                    </div>

                    {(selectedFeature.commodity || selectedFeature.farm_type) && (
                      <div>
                        <dt className="font-medium text-slate-800">Crop</dt>
                        <dd>{selectedFeature.commodity || selectedFeature.farm_type}</dd>
                      </div>
                    )}

                    {selectedFeature.boundary_source && (
                      <div>
                        <dt className="font-medium text-slate-800">Boundary</dt>
                        <dd className="text-xs text-slate-500">
                          {selectedFeature.boundary_source === 'drawn'
                            ? 'Drawn by hand on the map'
                            : `Imported from a ${selectedFeature.boundary_source} file`}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {/* Fetched when the parcel is clicked, so the map's initial
                      payload stays small. Every section is conditional: a
                      farmer with no fishpond gets no Fishpond heading, rather
                      than an empty one. */}
                  {detailLoading && (
                    <p className="mt-4 text-xs text-slate-500">Loading farm records…</p>
                  )}

                  {parcelDetail && (
                    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                      {parcelDetail.crop_seasons?.length > 0 && (
                        <PanelSection title="Crops">
                          {parcelDetail.crop_seasons.map((season, i) => (
                            <PanelRow
                              key={i}
                              label={season.crop || 'Unnamed crop'}
                              value={[
                                season.area_planted ? `${season.area_planted} ha` : null,
                                season.season,
                                season.year,
                              ].filter(Boolean).join(' · ')}
                            />
                          ))}
                        </PanelSection>
                      )}

                      {parcelDetail.livestock?.length > 0 && (
                        <PanelSection title="Livestock">
                          {parcelDetail.livestock.map((animal, i) => (
                            <PanelRow
                              key={i}
                              label={animal.type || animal.breed || 'Livestock'}
                              value={animal.count ? `${animal.count} head` : ''}
                            />
                          ))}
                        </PanelSection>
                      )}

                      {parcelDetail.tree_crops?.length > 0 && (
                        <PanelSection title="Tree Crops">
                          {parcelDetail.tree_crops.map((tree, i) => (
                            <PanelRow
                              key={i}
                              label={tree.crop || 'Tree crop'}
                              value={[
                                tree.quantity ? `${tree.quantity} trees` : null,
                                tree.area ? `${tree.area} ha` : null,
                              ].filter(Boolean).join(' · ')}
                            />
                          ))}
                        </PanelSection>
                      )}

                      {parcelDetail.fishponds?.length > 0 && (
                        <PanelSection title="Fishponds">
                          {parcelDetail.fishponds.map((pond, i) => (
                            <PanelRow
                              key={i}
                              label={pond.species || 'Fishpond'}
                              value={pond.area ? `${pond.area} ha` : ''}
                            />
                          ))}
                        </PanelSection>
                      )}

                      {parcelDetail.assistance?.length > 0 && (
                        <PanelSection title="Assistance">
                          {parcelDetail.assistance.map((given, i) => (
                            <PanelRow
                              key={i}
                              label={given.program || 'Assistance'}
                              value={[given.status, given.quantity].filter(Boolean).join(' · ')}
                            />
                          ))}
                        </PanelSection>
                      )}

                      {parcelDetail.associations?.length > 0 && (
                        <PanelSection title="Associations">
                          {parcelDetail.associations.map((name, i) => (
                            <PanelRow key={i} label={name} value="" />
                          ))}
                        </PanelSection>
                      )}
                    </div>
                  )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Click a mapped parcel or locate a selected parcel to inspect it.</p>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-medium text-slate-800">Boundary context</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span>North: Cabagan</span>
                  <span>East: Divilacan</span>
                  <span>South: Ilagan City</span>
                  <span>West: Cagayan River, Delfin Albano</span>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>

      {/*
          Mobile: filters and the selected parcel, reachable without scrolling.

          A shortcut, not a second home for these controls — the sidebar above
          still renders on every screen size and stacks under the map, so
          nothing is only reachable here. Hidden from xl up, where the sidebar
          is already beside the map.
      */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-emerald-800 xl:hidden"
        aria-label="Open filters and selected parcel"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters
        {filtersActive && (
          <span className="rounded-full bg-white/25 px-1.5 text-xs tabular-nums">
            {visibleFeatures.length}
          </span>
        )}
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true" aria-label="Map filters">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-2xl bg-slate-50 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Filters &amp; selection</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <GisSearch
                value={searchInput}
                onChange={setSearchInput}
                results={searchResults}
                onPick={(feature) => { pickFeature(feature); setSheetOpen(false); }}
                loading={dataStatus === 'loading'}
              />

              <FarmFilters
                filters={filters}
                options={filterOptions}
                onChange={setFilters}
                onClear={() => { setFilters(EMPTY_FILTERS); setSearchInput(''); }}
                active={filtersActive}
                resultCount={visibleFeatures.length}
              />

              <SelectedParcelCard
                properties={selectedFeature}
                detail={parcelDetail}
                loading={detailLoading}
                onZoom={() => { focusSelectedParcel(); setSheetOpen(false); }}
                onClear={clearSelection}
                canViewFarmer={can('view farmers')}
                canEditParcel={can('edit parcels')}
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
