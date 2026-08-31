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
      osm: {
        type: 'raster',
        /*
         * One canonical host, not the old a/b/c subdomains.
         *
         * OSM retired the per-subdomain hostnames, and they no longer reliably
         * send Access-Control-Allow-Origin. That matters here because MapLibre
         * fetches raster tiles with fetch() — which enforces CORS — where
         * Leaflet used plain <img> tags and did not.
         */
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        /*
         * OSM's standard tiles stop at zoom 19. MapLibre asks for tile zoom
         * (map zoom + 1) when tileSize is 256, so a map allowed to reach 19
         * was requesting z20 tiles that do not exist; the 404 came back without
         * CORS headers, which is what filled the console.
         *
         * Declaring the source's real limit makes MapLibre scale z19 tiles up
         * instead of asking for a zoom nobody serves.
         */
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  };
}
