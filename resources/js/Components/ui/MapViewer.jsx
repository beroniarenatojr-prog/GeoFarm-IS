import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function MapViewer({ geojson, center = TUMAUINI_CENTER, zoom = 12, height = '400px' }) {
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
    if (!map?.isStyleLoaded()) return;

    const source = map.getSource('farm-parcels');
    source?.setData(featureCollection);

    if (featureCollection.features.length) {
      const bounds = new maplibregl.LngLatBounds();
      featureCollection.features.forEach((feature) => {
        const rings = feature.geometry?.coordinates?.flat(feature.geometry.type === 'MultiPolygon' ? 2 : 1) || [];
        rings.forEach((coordinate) => bounds.extend(coordinate));
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 700 });
      }
    } else {
      map.easeTo({ center, zoom, duration: 700 });
    }
  }, [featureCollection, center, zoom]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      {mapUnavailable ? (
        <TumauiniMapFallback className="absolute inset-0" />
      ) : (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      )}
    </div>
  );
}
