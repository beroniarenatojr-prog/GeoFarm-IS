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
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
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
