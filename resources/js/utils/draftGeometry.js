/**
 * Features for the boundary being traced on the GIS map.
 *
 * Kept out of MapIndex so the shape of what gets drawn can be reasoned about -
 * and tested - without a map, a canvas or a browser.
 *
 * Every coordinate is [longitude, latitude], GeoJSON order, which is also what
 * MapLibre expects. Leaflet's [lat, lng] order does not appear anywhere in this
 * project.
 */

/**
 * @param {Array<[number, number]>} points   corners already clicked
 * @param {[number, number]|null}   cursor   live pointer position, or null
 * @returns {{type: 'FeatureCollection', features: Array}}
 */
export function buildDraftFeatures(points, cursor = null) {
    const pts = Array.isArray(points) ? points : [];
    const features = [];

    if (pts.length >= 2) {
        // Closed once there are enough corners, so the shape being made is
        // obvious before it is committed.
        features.push({
            type: 'Feature',
            properties: { draft: 'shape' },
            geometry: pts.length >= 3
                ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] }
                : { type: 'LineString', coordinates: pts },
        });
    }

    // The rubber band: from the last corner to the pointer, and - once the
    // shape could close - on back to the first corner. Drawn dashed, because
    // it shows where an edge *would* land rather than one that exists.
    if (cursor && pts.length >= 1) {
        const trail = [pts[pts.length - 1], cursor];

        if (pts.length >= 2) {
            trail.push(pts[0]);
        }

        features.push({
            type: 'Feature',
            properties: { draft: 'cursor' },
            geometry: { type: 'LineString', coordinates: trail },
        });
    }

    pts.forEach((p, i) => features.push({
        type: 'Feature',
        properties: { draft: 'vertex', first: i === 0 },
        geometry: { type: 'Point', coordinates: p },
    }));

    return { type: 'FeatureCollection', features };
}
