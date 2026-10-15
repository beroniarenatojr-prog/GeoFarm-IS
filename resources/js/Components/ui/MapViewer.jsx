import { useEffect, useMemo, useRef, useState } from 'react';
// Sets MapLibre's worker URL before any map is constructed. Required in
// every module that creates one — see the file for why.
import '@/utils/maplibreWorker';
import * as maplibregl from 'maplibre-gl';
import TumauiniMapFallback from '@/Components/ui/TumauiniMapFallback';
import 'maplibre-gl/dist/maplibre-gl.css';
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

/**
 * @param showLocation  Add a "find me" control. Off by default, and deliberately
 *   opt-in: a map that asks for location the moment it mounts trains people to
 *   dismiss the permission dialog, and most screens here have no use for it.
 *   With it on, nothing is requested until the control is pressed — that press
 *   IS the consent, and the browser's own dialog follows it.
 */
export default function MapViewer({
  geojson,
  center = TUMAUINI_CENTER,
  zoom = 12,
  height = '400px',
  showLocation = false,
}) {
  // Why locating failed, in words a farmer can act on. MapLibre's own control
  // fails silently apart from a greyed-out button.
  const [locationError, setLocationError] = useState(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const featureCollection = useMemo(() => {
    if (!geojson) {
      return { type: 'FeatureCollection', features: [] };
    }

    return geojson.type === 'FeatureCollection'
      ? geojson
      : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: geojson }] };
  }, [geojson]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!supportsWebGL()) {
      setMapUnavailable(true);
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getBasemapStyle(),
      center,
      zoom,
      maxBounds: TUMAUINI_BOUNDS,
      minZoom: 11,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    if (showLocation) {
      const locate = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
      });

      map.addControl(locate, 'top-right');

      /*
       * Say what went wrong instead of leaving a dead button.
       *
       * All three cases are ordinary in the field: permission refused (code 1),
       * no GPS fix under tree cover or indoors (2), and a slow fix that times
       * out (3). The map itself keeps working in every one of them — the
       * parcels are drawn from the office's survey, not from where the phone
       * thinks it is.
       */
      locate.on('error', (event) => {
        const message = event?.code === 1
          ? 'Location permission was declined. Your parcels are still shown — only the "you are here" dot needs it.'
          : event?.code === 3
            ? 'Finding your location is taking too long. Try again under open sky.'
            : 'Your location is not available on this device right now.';

        setLocationError(message);
      });

      locate.on('geolocate', () => setLocationError(null));
    }

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);
    requestAnimationFrame(() => map.resize());

    map.on('error', (event) => {
      console.error('MapLibre error:', event?.error || event);
      if (String(event?.error?.message || '').toLowerCase().includes('webgl')) {
        setMapUnavailable(true);
      }
    });

    map.on('load', () => {
      map.addSource('tumauini-boundary', {
        type: 'geojson',
        data: TUMAUINI_BOUNDARY_COLLECTION,
      });

      // No tinted fill: the extent rectangle now covers about 2,250 km2, and a
      // wash across all of it reads as haze over the imagery rather than as a
      // boundary. The dashed outline marks it well enough.
      map.addLayer({
        id: 'tumauini-boundary-line',
        type: 'line',
        source: 'tumauini-boundary',
        paint: {
          'line-color': '#14532d',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });

      map.addSource('farm-parcels', {
        type: 'geojson',
        data: featureCollection,
      });

      map.addLayer({
        id: 'farm-parcels-fill',
        type: 'fill',
        source: 'farm-parcels',
        paint: {
          'fill-color': [
            'match',
            ['downcase', ['coalesce', ['get', 'farm_type'], ['get', 'type'], '']],
            'rice',
            '#22c55e',
            'corn',
            '#f59e0b',
            '#38bdf8',
          ],
          'fill-opacity': 0.42,
        },
      });

      map.addLayer({
        id: 'farm-parcels-line',
        type: 'line',
        source: 'farm-parcels',
        paint: {
          'line-color': '#064e3b',
          'line-width': 2,
        },
      });

      map.on('click', 'farm-parcels-fill', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;

        const props = feature.properties || {};
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(event.lngLat)
          .setHTML(`
            <div class="text-sm">
              <strong>${props.parcel_number || 'Farm parcel'}</strong>
              <div>Farmer: ${props.farmer_name || props.farmer || 'Unknown'}</div>
              <div>Barangay: ${props.barangay || 'Unspecified'}</div>
              <div>Area: ${props.area_ha || props.total_area_ha || 'N/A'} ha</div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'farm-parcels-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'farm-parcels-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource('farm-parcels');
      if (!source) return;

      source.setData(featureCollection);

      if (featureCollection.features.length) {
        const bounds = new maplibregl.LngLatBounds();
        featureCollection.features.forEach((feature) => {
          const rings = feature.geometry?.coordinates?.flat(feature.geometry.type === 'MultiPolygon' ? 2 : 1) || [];
          rings.forEach((coordinate) => bounds.extend(coordinate));
        });

        if (!bounds.isEmpty()) {
          /*
           * Close enough to recognise the place.
           *
           * maxZoom was 15. A holding here is 100-150 m across, which is about
           * 33 px at that zoom — a speck somewhere in a field, which tells a
           * farmer nothing about where their land is. At 17 the parcel fills a
           * good part of the frame and the tree lines, tracks and bunds around
           * it are visible, which is what makes it recognisable on the ground.
           *
           * maxZoom only bites when the boundary is small; several parcels
           * spread apart still fit as a group, because fitBounds zooms to the
           * box and the cap merely stops it going closer than 17.
           */
          map.fitBounds(bounds, { padding: 48, maxZoom: 17, duration: 700 });
        }
      } else {
        map.easeTo({ center, zoom, duration: 700 });
      }
    };

    if (map.isStyleLoaded()) {
      apply();
      return undefined;
    }

    /*
     * Style not up yet, so the source does not exist and a fitBounds now would
     * be thrown away. This used to `return` here and never try again — the map
     * then stayed at its constructor centre and zoom 12, showing the whole
     * municipality rather than the farm, which looks exactly like a map that
     * simply failed to find the parcel.
     *
     * `idle` is the event that cannot be missed: unlike `load` it fires after
     * every settle, so a listener attached late still gets the next one.
     */
    map.once('idle', apply);
    return () => map.off('idle', apply);
  }, [featureCollection, center, zoom]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      {mapUnavailable ? (
        <TumauiniMapFallback className="absolute inset-0" />
      ) : (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      )}

      {/* Over the map rather than below it, so it cannot change the height the
          caller asked for and push the page around. */}
      {locationError && (
        <div
          role="status"
          className="absolute inset-x-2 bottom-2 rounded-lg bg-gray-900/90 px-3 py-2 text-xs text-white backdrop-blur-sm"
        >
          {locationError}
        </div>
      )}
    </div>
  );
}
