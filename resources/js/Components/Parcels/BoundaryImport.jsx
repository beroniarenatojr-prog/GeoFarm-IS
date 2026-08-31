import { useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Upload, FileWarning, CheckCircle2, Loader2 } from 'lucide-react';
import area from '@turf/area';
import centroid from '@turf/centroid';
import bbox from '@turf/bbox';

/**
 * Import a surveyed parcel boundary from a Shapefile, KML or GeoJSON file.
 *
 * Parsing happens here rather than on the server because the JavaScript
 * libraries for these formats are far better than the PHP equivalents — shpjs
 * reads a zipped shapefile including its .dbf and .prj, and togeojson handles
 * the KML dialects that Google Earth produces. The server still re-validates
 * and re-measures everything; nothing here is trusted.
 */

const ACCEPT = '.zip,.kml,.kmz,.geojson,.json';

/** First polygon in whatever the parser returned. */
function firstPolygon(parsed) {
    if (!parsed) return null;

    if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') return parsed;
    if (parsed.type === 'Feature') return firstPolygon(parsed.geometry);

    if (parsed.type === 'FeatureCollection') {
        const hit = parsed.features?.find(f =>
            f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon');
        return hit ? hit.geometry : null;
    }

    // shpjs hands back an array when the zip holds several layers.
    if (Array.isArray(parsed)) {
        for (const part of parsed) {
            const hit = firstPolygon(part);
            if (hit) return hit;
        }
    }

    return null;
}

/**
 * Coordinates must be longitude/latitude. A shapefile in a projected system
 * (UTM metres, PRS92 grid) parses fine but its numbers are in the hundreds of
 * thousands, which would silently place the parcel off the map.
 */
function looksProjected(geometry) {
    const ring = geometry.type === 'MultiPolygon'
        ? geometry.coordinates[0][0]
        : geometry.coordinates[0];

    return ring.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90);
}

export default function BoundaryImport({ parcelId, onImported }) {
    const fileRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState(null);
    const [preview, setPreview] = useState(null);

    const overlapWarning = usePage().props.flash?.overlapWarning;
    const forThisParcel = String(overlapWarning?.parcel_id) === String(parcelId);
    const conflicts = forThisParcel ? overlapWarning.overlaps : null;
    const oversize = forThisParcel ? overlapWarning.oversize : null;
    const needsConfirm = Boolean(conflicts?.length || oversize);

    const read = async (file) => {
        const name = file.name.toLowerCase();

        if (name.endsWith('.zip')) {
            // Dynamic import: shpjs and togeojson are only needed when someone
            // actually imports a file, and they are not small.
            const shp = (await import('shpjs')).default;
            return { parsed: await shp(await file.arrayBuffer()), source: 'shapefile' };
        }

        if (name.endsWith('.kml') || name.endsWith('.kmz')) {
            const { kml } = await import('@tmcw/togeojson');
            const text = await file.text();
            const doc = new DOMParser().parseFromString(text, 'text/xml');

            if (doc.querySelector('parsererror')) {
                throw new Error('That KML file could not be read — it may be damaged.');
            }

            return { parsed: kml(doc), source: 'kml' };
        }

        return { parsed: JSON.parse(await file.text()), source: 'geojson' };
    };

    const handle = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setBusy(true);
        setProblem(null);
        setPreview(null);

        try {
            const { parsed, source } = await read(file);
            const geometry = firstPolygon(parsed);

            if (!geometry) {
                throw new Error('No polygon found in that file. A parcel boundary must be an area, not a point or a line.');
            }

            if (looksProjected(geometry)) {
                throw new Error(
                    'That file uses a projected coordinate system (metres), not latitude and longitude. '
                    + 'Re-export it as WGS 84 / EPSG:4326 and try again.'
                );
            }

            const sqm = area(geometry);
            const point = centroid(geometry).geometry.coordinates;

            setPreview({
                geometry,
                source,
                file: file.name,
                hectares: sqm / 10000,
                sqm,
                centroid: point,
                bounds: bbox(geometry),
            });

            // Draw it straight away so the boundary can be judged against the
            // imagery before anyone commits it.
            onImported?.({ geometry, bounds: bbox(geometry), centroid: point });
        } catch (e) {
            setProblem(e.message || 'That file could not be read.');
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const save = (confirmOverlap = false) => {
        if (!preview) return;

        router.post(`/admin/parcels/${parcelId}/boundary`, {
            geometry: preview.geometry,
            source: preview.source,
            file: preview.file,
            confirm_overlap: confirmOverlap,
        }, {
            preserveScroll: true,
            onSuccess: () => setPreview(p => (p ? { ...p, saved: true } : null)),
        });
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Import a surveyed boundary</h3>
                    <p className="text-xs text-slate-500">
                        Shapefile (.zip), KML, or GeoJSON — in latitude/longitude (WGS 84).
                    </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {busy ? 'Reading…' : 'Choose file'}
                    <input ref={fileRef} type="file" accept={ACCEPT} onChange={handle} className="hidden" disabled={busy} />
                </label>
            </div>

            {problem && (
                <p className="mt-2 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                    <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{problem}</span>
                </p>
            )}

            {preview && (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <p className="text-sm font-medium text-emerald-900">
                        {preview.file}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-emerald-700">Area</dt>
                            <dd className="font-semibold tabular-nums text-emerald-900">
                                {preview.hectares.toFixed(4)} ha
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-emerald-700">Square metres</dt>
                            <dd className="font-semibold tabular-nums text-emerald-900">
                                {Math.round(preview.sqm).toLocaleString('en-PH')}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-emerald-700">Centre</dt>
                            <dd className="font-mono text-xs text-emerald-900">
                                {preview.centroid[1].toFixed(5)}, {preview.centroid[0].toFixed(5)}
                            </dd>
                        </div>
                    </dl>

                    {oversize && (
                        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                            <p className="text-sm font-semibold text-amber-900">
                                That is {Number(oversize.area_ha).toLocaleString('en-PH')} ha — far larger than a farm
                            </p>
                            <p className="mt-1 text-sm text-amber-900">
                                Anything over {oversize.limit} ha is usually a barangay or municipal outline
                                imported into the wrong screen. Administrative boundaries belong in the
                                boundaries layer, not on a farmer&rsquo;s parcel.
                            </p>
                        </div>
                    )}

                    {conflicts?.length > 0 && (
                        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                            <p className="text-sm font-semibold text-amber-900">
                                This land is already claimed by {conflicts.length === 1 ? 'another parcel' : `${conflicts.length} other parcels`}
                            </p>
                            <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
                                {conflicts.map(c => (
                                    <li key={c.id}>
                                        {c.parcel_number || `Parcel #${c.id}`} — {c.farmer}
                                        {c.barangay ? `, ${c.barangay}` : ''}
                                        <span className="text-amber-700"> ({c.kind})</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-1.5 text-xs text-amber-800">
                                Save anyway only if the office already knows about this.
                            </p>
                        </div>
                    )}

                    {preview.saved ? (
                        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-800">
                            <CheckCircle2 className="h-4 w-4" /> Boundary saved to this parcel.
                        </p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => save(needsConfirm)}
                            className="mt-3 rounded-md bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                        >
                            {needsConfirm ? 'Save anyway' : 'Save this boundary'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
