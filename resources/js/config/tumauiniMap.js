export const TUMAUINI_CENTER = [121.8067, 17.2747];

/*
 * APPROXIMATE extent of Tumauini — not an official boundary.
 *
 * This was previously an 8.5 x 8.9 km box covering roughly 16% of a
 * municipality of about 467 km2, which meant staff could not pan to most of
 * their own territory: a parcel already recorded near 121.91 E sat 6.3 km
 * outside the area the map allowed. Widened so the whole municipality is
 * reachable.
 *
 * Replace with the real outline from PSA / NAMRIA or the Provincial Planning
 * Office when that file is available; nothing here is survey data.
 */
export const TUMAUINI_BOUNDS = [
  [121.68, 17.12],
  [122.25, 17.45],
];

/*
 * How far the map may be panned — which is not the same as where it opens.
 *
 * TUMAUINI_BOUNDS is the focus area: the map centres there, Recenter returns
 * there, and the dashed box is drawn from it. It was also used as maxBounds,
 * and that conflated two different things. A farmer may hold land in Cabagan
 * or Ilagan, and staff have to be able to pan there to draw or import that
 * parcel — but with the pan limit set to the municipality they could not,
 * which left the boundary uncreatable.
 *
 * Deriving the limit from the parcels already on the map does not solve it
 * either: you cannot reach a place to record the first parcel in it.
 *
 * So the limit is Cagayan Valley, the region Tumauini sits in. Wide enough to
 * reach any municipality a Tumauini farmer realistically holds land in, narrow
 * enough to keep the guard that stops somebody drifting onto empty ocean and
 * wondering where their data went. A parcel outside even this still widens the
 * limit to reach it — see allowedBounds in MapIndex.
 */
export const NAVIGABLE_BOUNDS = [
  [120.60, 15.70],
  [122.80, 18.80],
];

/*
 * The dashed rectangle on the map. Deliberately labelled "approximate extent"
 * rather than "municipal boundary": it is a bounding box, and presenting a box
 * as an administrative outline on a government system would be a lie staff
 * might act on.
 */
export const TUMAUINI_BOUNDARY_FEATURE = {
  type: 'Feature',
  properties: {
    name: 'Tumauini — approximate extent',
    north: 'Cabagan municipality',
    east: 'Divilacan municipality',
    south: 'Ilagan City',
    west: 'Cagayan River and Delfin Albano',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [121.68, 17.12],
      [122.25, 17.12],
      [122.25, 17.45],
      [121.68, 17.45],
      [121.68, 17.12],
    ]],
  },
};

export const TUMAUINI_BOUNDARY_COLLECTION = {
  type: 'FeatureCollection',
  features: [TUMAUINI_BOUNDARY_FEATURE],
};

export function getBasemapStyle() {
  const key = import.meta.env.VITE_MAPTILER_KEY;

  if (key) {
    return `https://api.maptiler.com/maps/dataviz/style.json?key=${key}`;
  }

  return {
    version: 8,
    sources: {
      /*
       * Aerial imagery, not a street map.
       *
       * This map exists to check that a parcel boundary sits on the right
       * land. A farmer recognises their own field — the tree line, the paddy
       * bunds, the track to the road — in a way no street map can show. Esri's
       * World Imagery is free, needs no key or account, and serves
       * Access-Control-Allow-Origin, which MapLibre requires because it
       * fetches raster tiles with fetch() rather than <img>.
       *
       * Note the {z}/{y}/{x} order: Esri puts row before column, unlike the
       * {z}/{x}/{y} of OSM-style schemes.
       */
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        /*
         * MapLibre asks for tile zoom (map zoom + 1) when tileSize is 256, so
         * a map allowed to reach 19 requests z20. Declaring the source's real
         * ceiling makes it scale the last good tiles up instead of requesting
         * a zoom the server answers with an error — which is what filled the
         * console with what looked like CORS failures.
         */
        maxzoom: 19,
        attribution:
          'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community',
      },

      /*
       * Two alternatives to the imagery, both from the SAME Esri service the
       * imagery already comes from — same terms, same attribution, no key, and
       * the same CORS headers MapLibre needs. Deliberately not OpenStreetMap's
       * own tiles: the OSMF Tile Usage Policy asks applications not to use
       * them this way, and a municipal system should not be the exception.
       *
       * Streets is for finding a place by road and sitio name; Topo carries
       * relief and waterways, which is what tells you whether a parcel sits on
       * a slope or beside a creek.
       */
      streets: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors',
      },

      terrain: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors',
      },
    },

    /*
     * All three basemaps are declared here, in the INITIAL style, and switched
     * with setLayoutProperty('visibility').
     *
     * The obvious alternative, map.setStyle(), tears down every source and
     * layer the page has added — the parcels, the pins, the boundary and the
     * drawing preview — and rebuilds them on a race this page has already lost
     * once. Declaring them up front costs nothing: a hidden raster layer
     * requests no tiles.
     *
     * They stay first in the array so every parcel layer, all of which are
     * appended later, draws above whichever basemap is showing.
     */
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'visible' },
      },
      {
        id: 'basemap-streets',
        type: 'raster',
        source: 'streets',
        layout: { visibility: 'none' },
      },
      {
        id: 'basemap-terrain',
        type: 'raster',
        source: 'terrain',
        layout: { visibility: 'none' },
      },
    ],
  };
}

/**
 * The basemaps the switcher may offer, and the layer each one turns on.
 *
 * Exported so the control cannot drift from the style: a basemap listed here
 * that has no layer in getBasemapStyle would be a dead button.
 */
export const BASEMAPS = [
  { id: 'satellite', label: 'Satellite', layer: 'basemap', hint: 'Aerial imagery — see the actual field' },
  { id: 'streets', label: 'Streets', layer: 'basemap-streets', hint: 'Roads and place names' },
  { id: 'terrain', label: 'Terrain', layer: 'basemap-terrain', hint: 'Relief, waterways and contours' },
];
