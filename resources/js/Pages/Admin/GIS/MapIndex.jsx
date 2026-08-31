import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import TumauiniMapFallback from '@/Components/ui/TumauiniMapFallback';
import BoundaryImport from '@/Components/Parcels/BoundaryImport';
import toast from 'react-hot-toast';
import * as maplibregl from 'maplibre-gl';
import area from '@turf/area';
import bbox from '@turf/bbox';
import center from '@turf/center';
import { Eye, Layers, LocateFixed, MapPinned, PenLine, RefreshCcw, Trash2 } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  TUMAUINI_BOUNDS,
  TUMAUINI_BOUNDARY_COLLECTION,
  TUMAUINI_CENTER,
  getBasemapStyle,
} from '@/config/tumauiniMap';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

/**
 * One colour per parcel, so neighbouring boundaries read as separate holdings
 * rather than one shape. Chosen to stay legible over aerial imagery, which is
 * mostly greens and tans — so the palette avoids both.
 */
const PARCEL_COLOURS = [
  '#38bdf8', // sky
  '#f87171', // red
  '#fbbf24', // amber
  '#ffffff', // white
  '#c084fc', // violet
  '#fb923c', // orange
  '#22d3ee', // cyan
  '#f472b6', // pink
];

/** Give every feature a stable colour, keyed on parcel id so it never shifts. */
function colouriseParcels(collection) {
  return {
    ...collection,
    features: (collection.features ?? []).map((feature, index) => {
      const id = Number(feature.properties?.id);
      const slot = Number.isFinite(id) ? id : index;

      return {
        ...feature,
        properties: {
          ...feature.properties,
          colour: PARCEL_COLOURS[slot % PARCEL_COLOURS.length],
        },
      };
    }),
  };
}

/** Saved parcels are clicked on their own fill layer. */
const PARCEL_HIT_LAYERS = ['parcels-fill'];

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
  const totalMappedArea = useMemo(
    () => geoJsonData.features.reduce((sum, feature) => sum + area(feature), 0),
    [geoJsonData],
  );

  const selectedParcelDetails = useMemo(
    () => parcels.find((parcel) => String(parcel.id) === String(selectedParcel)),
    [parcels, selectedParcel],
  );

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

  const loadParcels = useCallback(() => {
    fetch('/admin/gis/parcels-geojson')
      .then((res) => res.json())
      .then((data) => setGeoJsonData(colouriseParcels(normalizeFeatureCollection(data))))
      .catch((err) => {
        console.error('Error loading parcels:', err);
        toast.error('Unable to load farm boundary layers');
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

    const pts = draftRef.current;
    const features = [];

    if (pts.length >= 2) {
      // Closed once there are enough points, so the shape being made is
      // obvious before it is committed.
      features.push({
        type: 'Feature',
        properties: {},
        geometry: pts.length >= 3
          ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] }
          : { type: 'LineString', coordinates: pts },
      });
    }

    pts.forEach((p, i) => features.push({
      type: 'Feature',
      properties: { first: i === 0 },
      geometry: { type: 'Point', coordinates: p },
    }));

    src.setData({ type: 'FeatureCollection', features });
  }, []);

  const resetDraft = useCallback(() => {
    draftRef.current = [];
    drawingRef.current = false;
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
      if (String(event?.error?.message || '').toLowerCase().includes('webgl')) {
        setMapUnavailable(true);
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

    map.on('load', () => {
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
       *
       * These used to be pushed into MapboxDraw as editable features, which
       * gave no control over how they looked and made them selectable by a
       * tool that is no longer used for drawing. A plain GeoJSON source with a
       * heavy outline reads far better over aerial imagery — the boundary is
       * the point, so the line carries the weight and the fill stays light
       * enough to see the field through it.
       */
      map.addSource('parcels', {
        type: 'geojson',
        // Whatever has already been fetched; the effect keeps it current after.
        data: geoJsonRef.current,
      });

      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': ['coalesce', ['get', 'colour'], '#38bdf8'],
          'fill-opacity': 0.18,
        },
      });

      map.addLayer({
        id: 'parcels-casing',
        type: 'line',
        source: 'parcels',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        // A dark casing under every colour keeps the edge readable over both
        // pale stubble and dark tree cover.
        paint: { 'line-color': '#0f172a', 'line-width': 6, 'line-opacity': 0.6 },
      });

      map.addLayer({
        id: 'parcels-line',
        type: 'line',
        source: 'parcels',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'colour'], '#38bdf8'],
          'line-width': 3,
        },
      });

      /*
       * No text labels here.
       *
       * A symbol layer with text-field needs a `glyphs` endpoint in the style,
       * and this basemap is raster-only — it has none. Adding one anyway threw
       * inside this load handler, and everything after it (the whole
       * parcel-draft source and its layers) never ran, which is why tracing
       * showed nothing on screen.
       *
       * Parcel numbers can come back once there is a font source to serve them.
       */
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

      map.addLayer({
        id: 'parcel-draft-line',
        type: 'line',
        source: 'parcel-draft',
        filter: ['!=', ['geometry-type'], 'Point'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1d4ed8', 'line-width': 3 },
      });

      map.addLayer({
        id: 'parcel-draft-points',
        type: 'circle',
        source: 'parcel-draft',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          // The first corner is bigger: clicking it is how the ring closes.
          'circle-radius': ['case', ['get', 'first'], 8, 5],
          'circle-color': ['case', ['get', 'first'], '#f59e0b', '#1d4ed8'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      /*
       * MapboxDraw is deliberately NOT attached to this map.
       *
       * Every one of its ~17 style layers uses the legacy filter syntax that
       * MapLibre 6 removed, so addControl() throws part-way through adding
       * them and leaves the style in a half-built state. It also no longer has
       * a job here: tracing is native, and saved parcels render from our own
       * `parcels` source. `draw.add(geoJsonData)` used to run on this line and
       * threw for the same reason.
       */
    });

    // The draw.create / draw.update / draw.delete handlers were removed with
    // MapboxDraw: nothing fires those events any more. Tracing saves through
    // finishDraft, and boundary deletion goes through deleteSelectedBoundary.

    map.on('click', (event) => {
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
        popupRef.current?.remove();
        return;
      }

      const props = feature.properties || {};
      setSelectedFeature(props);
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
      if (drawingRef.current) return;

      const over = PARCEL_HIT_LAYERS.filter((id) => map.getLayer(id));
      if (!over.length) return;

      const hit = map.queryRenderedFeatures(event.point, { layers: over });
      map.getCanvas().style.cursor = hit.length ? 'pointer' : '';
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
    const src = map?.getSource('parcels');

    /* eslint-disable no-console */
    if (!src) {
      // Not necessarily wrong — the map may not have finished loading, in which
      // case the load handler paints from geoJsonRef instead. Worth saying so,
      // because a silent return here looks identical to a broken layer.
      console.warn('[GIS] parcels source not ready; the load handler will paint',
        geoJsonData.features.length, 'feature(s)');
      return;
    }

    src.setData(showParcels ? geoJsonData : EMPTY_FEATURE_COLLECTION);

    console.log('[GIS] painted', geoJsonData.features.length, 'parcel(s).',
      'layers present:', ['parcels-fill', 'parcels-casing', 'parcels-line']
        .filter((id) => map.getLayer(id)).join(', ') || 'NONE');
    /* eslint-enable no-console */

    if (fittedRef.current || !geoJsonData.features.length) return;
    fittedRef.current = true;

    // Arriving from a parcel's "View on map" link: go to that one and select
    // it, so the sidebar shows its details straight away.
    const wanted = new URLSearchParams(window.location.search).get('parcel');
    const target = wanted
      && geoJsonData.features.find((f) => String(f.properties?.id) === String(wanted));

    if (target) {
      setSelectedParcel(String(wanted));
      setSelectedFeature(target.properties);
      map.fitBounds(bbox(target), { padding: 80, maxZoom: 17, duration: 900 });
      return;
    }

    // Otherwise show them all. Boundaries that render correctly but sit
    // off-screen look exactly like boundaries that do not render at all.
    map.fitBounds(bbox(geoJsonData), { padding: 80, maxZoom: 16, duration: 900 });
  }, [geoJsonData, showParcels]);

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

  const focusSelectedParcel = () => {
    const feature = geoJsonData.features.find((item) => String(item.properties?.id) === String(selectedParcel));
    if (!feature) {
      toast.error('This parcel has no saved boundary yet');
      return;
    }

    const bounds = bbox(feature);
    mapRef.current?.fitBounds(bounds, { padding: 72, maxZoom: 17, duration: 900 });
    setSelectedFeature(feature.properties);
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

    router.delete(`/admin/gis/parcels/${selectedParcel}/geometry`, {
      preserveState: true,
      preserveScroll: true,
      onSuccess: () => {
        toast.success('Boundary deleted');
        setSelectedFeature(null);
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
      <div className="space-y-5">
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-h-[680px] overflow-hidden rounded-lg border border-slate-200 relative">
              {mapUnavailable ? (
                <TumauiniMapFallback className="absolute inset-0" />
              ) : (
                <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
              )}
              {loading && (
                <div className="absolute left-4 top-4 rounded-md bg-white/95 px-3 py-2 text-sm font-medium text-emerald-800 shadow">
                  Saving boundary...
                </div>
              )}
            </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-medium uppercase text-slate-500">Mapped Parcels</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{mappedCount}</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-medium uppercase text-slate-500">Drawn Area</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{formatArea(totalMappedArea)}</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <label className="text-sm font-medium text-slate-700">Target parcel</label>
                <select
                  value={selectedParcel}
                  onChange={(event) => {
                    setSelectedParcel(event.target.value);
                    setSelectedFeature(null);
                  }}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Select a parcel</option>
                  {parcels.map((parcel) => (
                    <option key={parcel.id} value={parcel.id}>
                      {parcel.parcel_number || `Parcel #${parcel.id}`} - {parcel.farmer?.first_name} {parcel.farmer?.last_name} ({parcel.barangay || 'No barangay'})
                    </option>
                  ))}
                </select>

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
    </AdminLayout>
  );
}
