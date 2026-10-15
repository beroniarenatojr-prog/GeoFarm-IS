/*
 * MapLibre's worker URL, set once for the whole application.
 *
 * Imported for its side effect by every module that constructs a map. It lives
 * in its own module rather than in the entry point because importing
 * maplibre-gl there pulled the entire ~1 MB map engine into the initial bundle
 * — downloaded by every farmer opening a dashboard and by anyone sitting on the
 * login page, neither of whom has a map on screen.
 *
 * The configuration itself is UNCHANGED: same `?worker&url` specifier, same
 * setWorkerUrl call. Only the moment it runs has moved, and it still runs
 * before any map exists, because an ES module's imports are evaluated before
 * the body of the module that imports them.
 *
 * Every module that calls `new maplibregl.Map(...)` must import this file.
 * There are three, and they all do:
 *
 *   resources/js/Components/ui/MapViewer.jsx     (the farmer portal + viewers)
 *   resources/js/Pages/Admin/GIS/MapIndex.jsx    (the GIS editor)
 *   resources/js/Pages/Admin/Parcels/Form.jsx    (parcel boundary drawing)
 *
 * The original note on WHY this is needed at all follows, because the failure
 * it describes is invisible and was expensive to find.
 *
 * ---------------------------------------------------------------------------
 */

import { setWorkerUrl } from 'maplibre-gl';
/*
 * Tell MapLibre where its worker actually is.
 *
 * MapLibre 6 ships the worker as a SEPARATE module (maplibre-gl-worker.mjs)
 * instead of inlining it as a blob, and it works out the URL at runtime:
 *
 *   let e = import.meta.url;
 *   let t = e.endsWith('-dev.mjs') ? 'maplibre-gl-worker-dev.mjs' : 'maplibre-gl-worker.mjs';
 *   return new URL(`./${t}`, e).href;
 *
 * Because that path is assembled from a runtime string rather than a literal
 * `new URL('./file', import.meta.url)`, Vite cannot see it, never emits the
 * file, and never rewrites the reference. In a production build the bundle
 * therefore asks for /build/assets/maplibre-gl-worker.mjs, which 404s.
 *
 * The consequence is specific and very easy to misread: raster tiles are
 * decoded on the main thread and keep working, so the satellite basemap looks
 * perfectly healthy, while EVERY GeoJSON source silently yields zero tiles —
 * because tiling GeoJSON is precisely what the worker does. That is why the
 * parcel polygons, the parcel pins, the municipal boundary and the drawing
 * preview were all invisible at once, with the data present, the layers built
 * in the right order, and no style error anywhere.
 *
 * `?worker&url` is the suffix that works, and the distinction matters:
 *
 *   ?url         copies the file verbatim and returns its path
 *   ?worker&url  BUNDLES it as a worker chunk and returns that chunk's path
 *
 * Plain `?url` is not enough here, because maplibre-gl-worker.mjs is only
 * 18 KB of glue whose first statement is
 *
 *   import{...}from"./maplibre-gl-shared.mjs"
 *
 * a 482 KB sibling. Copied verbatim into assets/, that import resolves to
 * /build/assets/maplibre-gl-shared.mjs, which does not exist — so the worker
 * was served with a 200 and then failed to initialise, which looks almost
 * identical to the 404: satellite imagery (raster, main thread) still true,
 * every GeoJSON source still false, and isStyleLoaded() false with it, because
 * a style is only "loaded" once all its sources are.
 *
 * `?worker&url` makes Vite bundle the glue and the shared module into one
 * self-contained chunk, so there is no sibling left to resolve at runtime.
 *
 * Set here, in the entry point, because all three map screens need it: the GIS
 * map, the parcel form and the farmer portal viewer.
 */
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);
