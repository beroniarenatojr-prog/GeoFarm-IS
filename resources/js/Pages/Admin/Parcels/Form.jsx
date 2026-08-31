import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useForm } from '@inertiajs/react';
import TumauiniMapFallback from '@/Components/ui/TumauiniMapFallback';
import FarmerPicker from '@/Components/ui/FarmerPicker';
import * as maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import bbox from '@turf/bbox';
import { LocateFixed, PenLine, RotateCcw, Trash2 } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {
  TUMAUINI_BOUNDS,
  TUMAUINI_BOUNDARY_COLLECTION,
  TUMAUINI_CENTER,
  getBasemapStyle,
} from '@/config/tumauiniMap';

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function patchDrawClasses() {
  if (!MapboxDraw?.constants?.classes) return;

  MapboxDraw.constants.classes.CANVAS = 'maplibregl-canvas';
  MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
  MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
  MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';
  MapboxDraw.constants.classes.ATTRIBUTION = 'maplibregl-ctrl-attrib';
}

function parseGeometry(value) {
  if (!value) return null;

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

/**
 * Used two ways: as the full page at /admin/parcels/create|edit, and inside a
 * modal on the parcel list. Passing onClose switches it to the embedded form —
 * no page chrome, and Cancel closes the dialog instead of navigating away.
 *
 * The map is the reason this component is shared rather than duplicated: it
 * carries a MapLibre instance, a draw control and a ResizeObserver, and a
 * second copy of that would be a second thing to keep correct.
 */
export default function ParcelForm({ parcel, farmTypes, geojson, onClose = null }) {
  const isEdit = Boolean(parcel);
  const embedded = Boolean(onClose);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const drawRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const { data, setData, post, put, processing, errors } = useForm({
    farmer_id: parcel?.farmer_id ?? '',
    parcel_number: parcel?.parcel_number ?? '',
    location_address: parcel?.location_address ?? '',
    barangay: parcel?.barangay ?? '',
    city_municipality: parcel?.city_municipality ?? 'Tumauini',
    province: parcel?.province ?? 'Isabela',
    total_area_ha: parcel?.total_area_ha ?? '',
    farm_type_id: parcel?.farm_type_id ?? '',
    ownership_type: parcel?.ownership_type ?? '',
    land_owner_name: parcel?.land_owner_name ?? '',
    within_ancestral: parcel?.within_ancestral ?? false,
    arb: parcel?.arb ?? false,
    geojson: geojson ?? '',
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!supportsWebGL()) {
      setMapUnavailable(true);
      return;
    }

    patchDrawClasses();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getBasemapStyle(),
      center: TUMAUINI_CENTER,
      zoom: 12.4,
      maxBounds: TUMAUINI_BOUNDS,
      minZoom: 11,
      maxZoom: 19,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

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

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'simple_select',
    });

    const syncGeometry = () => {
      const feature = draw.getAll().features.find((item) => item.geometry?.type.includes('Polygon'));
      setData('geojson', feature ? JSON.stringify(feature.geometry) : '');
    };

    map.on('load', () => {
      map.addSource('tumauini-boundary', {
        type: 'geojson',
        data: TUMAUINI_BOUNDARY_COLLECTION,
      });

      map.addLayer({
        id: 'tumauini-boundary-fill',
        type: 'fill',
        source: 'tumauini-boundary',
        paint: {
          'fill-color': '#16a34a',
          'fill-opacity': 0.07,
        },
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

      map.addControl(draw, 'top-left');
      drawRef.current = draw;

      const geometry = parseGeometry(geojson);
      if (geometry) {
        const feature = {
          type: 'Feature',
          properties: {},
          geometry,
        };
        draw.add(feature);
        map.fitBounds(bbox(feature), { padding: 60, maxZoom: 17, duration: 0 });
      }

      setMapReady(true);
    });

    map.on('draw.create', (event) => {
      const feature = event.features?.[0];
      const existing = draw.getAll().features.filter((item) => item.id !== feature?.id);
      existing.forEach((item) => draw.delete(item.id));
      syncGeometry();
    });
    map.on('draw.update', syncGeometry);
    map.on('draw.delete', syncGeometry);

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  const beginDrawing = () => {
    if (mapUnavailable) return;
    drawRef.current?.changeMode('draw_polygon');
  };

  const clearGeometry = () => {
    if (mapUnavailable) return;
    drawRef.current?.deleteAll();
    setData('geojson', '');
  };

  const focusTumauini = () => {
    if (mapUnavailable) return;
    mapRef.current?.fitBounds(TUMAUINI_BOUNDS, { padding: 48, maxZoom: 13, duration: 700 });
  };

  const submit = (event) => {
    event.preventDefault();

    // In the modal the list behind stays put and simply refreshes; as a page
    // the controller's redirect does the navigating.
    const options = embedded
      ? { preserveScroll: true, onSuccess: onClose }
      : {};

    isEdit
      ? put(`/admin/parcels/${parcel.id}`, options)
      : post('/admin/parcels', options);
  };

  const body = (
      <form onSubmit={submit} className={embedded ? 'space-y-5' : 'max-w-5xl space-y-6'}>
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-2">
          {/* A type-ahead rather than a dropdown: the registry is heading for
              8,000+ farmers, and a select of that size is unusable — and would
              have to be shipped to the parcel list just to open this modal. */}
          <FarmerPicker
            label="Farmer"
            required
            value={data.farmer_id}
            onChange={(id) => setData('farmer_id', id)}
            error={errors.farmer_id}
            initial={parcel?.farmer ? {
              id: parcel.farmer.id,
              label: [parcel.farmer.last_name, parcel.farmer.first_name].filter(Boolean).join(', '),
              meta: parcel.farmer.rsbsa_no ? `RSBSA ${parcel.farmer.rsbsa_no}` : '',
            } : null}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Farm Type</label>
            <select
              value={data.farm_type_id}
              onChange={(event) => setData('farm_type_id', event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Select type</option>
              {farmTypes.map((type) => <option key={type.id} value={type.id}>{type.type_name}</option>)}
            </select>
          </div>

          {[
            ['Parcel Number', 'parcel_number'],
            ['Total Area (ha)', 'total_area_ha', 'number'],
            ['Barangay', 'barangay'],
            ['City/Municipality', 'city_municipality'],
            ['Province', 'province'],
            ['Land Owner Name', 'land_owner_name'],
          ].map(([label, key, type = 'text']) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
              <input
                type={type}
                value={data[key]}
                onChange={(event) => setData(key, event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          ))}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Ownership Type</label>
            <select
              value={data.ownership_type}
              onChange={(event) => setData('ownership_type', event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Select</option>
              {['Registered Owner', 'Lessee', 'Tenant', 'Other'].map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={data.within_ancestral}
                onChange={(event) => setData('within_ancestral', event.target.checked)}
              />
              Within Ancestral Domain
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={data.arb}
                onChange={(event) => setData('arb', event.target.checked)}
              />
              ARB
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Parcel Boundary</h3>
              <p className="text-sm text-slate-500">Draw one farm polygon inside the Tumauini focus boundary.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={beginDrawing}
                disabled={!mapReady}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <PenLine className="h-4 w-4" />
                Draw
              </button>
              <button
                type="button"
                onClick={clearGeometry}
                disabled={!mapReady}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
              <button
                type="button"
                onClick={focusTumauini}
                disabled={!mapReady}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <LocateFixed className="h-4 w-4" />
                Focus
              </button>
            </div>
          </div>

          <div className="relative h-96 overflow-hidden rounded-lg border border-slate-200">
            {mapUnavailable ? (
              <TumauiniMapFallback className="absolute inset-0" />
            ) : (
              <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <RotateCcw className="h-4 w-4 text-slate-400" />
            <span className={data.geojson ? 'text-emerald-700' : 'text-slate-500'}>
              {data.geojson ? 'Geometry captured and ready to save.' : 'No boundary captured yet.'}
            </span>
          </div>
        </div>

        {/* Pinned to the bottom of the modal body so Save stays reachable
            without scrolling past the map. */}
        <div className={
          embedded
            ? 'sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3'
            : 'flex gap-3'
        }>
          {embedded ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : (
            <a href="/admin/parcels" className="order-2 rounded-md border border-slate-300 px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </a>
          )}
          <button
            type="submit"
            disabled={processing}
            className="order-1 rounded-md bg-emerald-700 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {processing ? 'Saving...' : isEdit ? 'Update Parcel' : 'Add Parcel'}
          </button>
        </div>
      </form>
  );

  if (embedded) {
    return body;
  }

  return (
    <AdminLayout title={isEdit ? 'Edit Parcel' : 'Add Farm Parcel'}>
      {body}
    </AdminLayout>
  );
}
