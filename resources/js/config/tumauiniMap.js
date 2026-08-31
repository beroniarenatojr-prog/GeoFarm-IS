export const TUMAUINI_CENTER = [121.8067, 17.2747];

export const TUMAUINI_BOUNDS = [
  [121.7699, 17.234],
  [121.8499, 17.314],
];

export const TUMAUINI_BOUNDARY_FEATURE = {
  type: 'Feature',
  properties: {
    name: 'Tumauini Municipal Focus Area',
    north: 'Cabagan municipality',
    east: 'Divilacan municipality',
    south: 'Ilagan City',
    west: 'Cagayan River and Delfin Albano',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [121.7699, 17.234],
      [121.8499, 17.234],
      [121.8499, 17.314],
      [121.7699, 17.314],
      [121.7699, 17.234],
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
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'satellite',
      },
    ],
  };
}
