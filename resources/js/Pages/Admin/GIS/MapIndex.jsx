import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';
import * as maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import area from '@turf/area';
import bbox from '@turf/bbox';
import center from '@turf/center';
import { Eye, Layers, LocateFixed, MapPinned, PenLine, RefreshCcw, Trash2 } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {
  TUMAUINI_BOUNDS,
  TUMAUINI_BOUNDARY_COLLECTION,
  TUMAUINI_CENTER,
  getBasemapStyle,
} from '@/config/tumauiniMap';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

function patchDrawClasses() {
  if (!MapboxDraw?.constants?.classes) return;

  MapboxDraw.constants.classes.CANVAS = 'maplibregl-canvas';
  MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
  MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
  MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';
  MapboxDraw.constants.classes.ATTRIBUTION = 'maplibregl-ctrl-attrib';
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

export default function MapIndex({ parcels }) {
  const { can } = usePermissions();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const popupRef = useRef(null);
  const parcelsRef = useRef(parcels);
  const selectedParcelRef = useRef('');
  const [selectedParcel, setSelectedParcel] = useState('');
  const [geoJsonData, setGeoJsonData] = useState(EMPTY_FEATURE_COLLECTION);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    selectedParcelRef.current = selectedParcel;
  }, [selectedParcel]);

  const loadParcels = useCallback(() => {
    fetch('/admin/gis/parcels-geojson')
      .then((res) => res.json())
      .then((data) => setGeoJsonData(normalizeFeatureCollection(data)))
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

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    patchDrawClasses();

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

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: canEdit
        ? {
            polygon: true,
            trash: canDelete,
          }
        : {},
      defaultMode: 'simple_select',
      styles: [
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
          paint: { 'fill-color': '#10b981', 'fill-opacity': 0.34 },
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.28 },
        },
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
          paint: { 'line-color': '#047857', 'line-width': 2 },
        },
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: { 'line-color': '#1d4ed8', 'line-width': 3 },
        },
        {
          id: 'gl-draw-polygon-and-line-vertex',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#ffffff',
            'circle-stroke-color': '#1d4ed8',
            'circle-stroke-width': 2,
          },
        },
      ],
    });

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
          'fill-opacity': 0.08,
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
      draw.add(geoJsonData);
    });

    map.on('draw.create', (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const activeParcelId = selectedParcelRef.current;
      if (!activeParcelId) {
        draw.delete(feature.id);
        toast.error('Select a parcel before drawing');
        return;
      }

      const parcel = parcelsRef.current.find((item) => String(item.id) === String(activeParcelId));
      feature.properties = {
        id: activeParcelId,
        parcel_number: parcel?.parcel_number || `Parcel #${activeParcelId}`,
        farmer_name: parcel?.farmer ? `${parcel.farmer.first_name} ${parcel.farmer.last_name}` : 'Unknown',
        barangay: parcel?.barangay || 'Unspecified',
        area_ha: parcel?.total_area_ha || null,
      };

      saveGeometry(activeParcelId, feature.geometry);
    });

    map.on('draw.update', (event) => {
      event.features?.forEach((feature) => {
        const parcelId = feature.properties?.id;
        if (parcelId) saveGeometry(parcelId, feature.geometry);
      });
    });

    map.on('draw.delete', (event) => {
      event.features?.forEach((feature) => {
        const parcelId = feature.properties?.id;
        if (!parcelId) return;

        router.delete(`/admin/gis/parcels/${parcelId}/geometry`, {
          preserveState: true,
          preserveScroll: true,
          onSuccess: () => {
            toast.success('Boundary deleted');
            loadParcels();
          },
          onError: () => toast.error('Failed to delete boundary'),
        });
      });
    });

    map.on('click', (event) => {
      const drawLayers = [
          'gl-draw-polygon-fill-inactive.cold',
          'gl-draw-polygon-fill-active.cold',
          'gl-draw-polygon-fill-inactive.hot',
          'gl-draw-polygon-fill-active.hot',
        ].filter((layerId) => map.getLayer(layerId));

      if (!drawLayers.length) return;

      const rendered = map.queryRenderedFeatures(event.point, {
        layers: drawLayers,
      });

      const feature = rendered.find((item) => item.properties?.parcel_number || item.properties?.id);
      if (!feature) return;

      const props = feature.properties || {};
      setSelectedFeature(props);
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
        .setLngLat(event.lngLat)
        .setHTML(`
          <div class="text-sm">
            <strong>${props.parcel_number || 'Farm parcel'}</strong>
            <div>Farmer: ${props.farmer_name || 'Unknown'}</div>
            <div>Barangay: ${props.barangay || 'Unspecified'}</div>
            <div>Recorded area: ${props.area_ha || 'N/A'} ha</div>
          </div>
        `)
        .addTo(map);
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;

    draw.deleteAll();
    if (showParcels) draw.add(geoJsonData);
  }, [geoJsonData, showParcels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('tumauini-boundary-fill')) return;

    const visibility = showBoundary ? 'visible' : 'none';
    map.setLayoutProperty('tumauini-boundary-fill', 'visibility', visibility);
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

    drawRef.current?.changeMode('draw_polygon');
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
              <div ref={mapContainerRef} className="absolute inset-0" />
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
                  Navigation is constrained to Tumauini, Isabela using the local focus extent 17.2340-17.3140 N and
                  121.7699-121.8499 E. Basemap uses MapTiler when configured, with local development fallback tiles.
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
                    onClick={beginDrawing}
                    disabled={!canEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Draw boundary"
                  >
                    <PenLine className="h-4 w-4" />
                    Draw
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
                    <div><dt className="font-medium text-slate-800">Parcel</dt><dd>{selectedFeature.parcel_number || 'N/A'}</dd></div>
                    <div><dt className="font-medium text-slate-800">Farmer</dt><dd>{selectedFeature.farmer_name || 'Unknown'}</dd></div>
                    <div><dt className="font-medium text-slate-800">Barangay</dt><dd>{selectedFeature.barangay || 'Unspecified'}</dd></div>
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
