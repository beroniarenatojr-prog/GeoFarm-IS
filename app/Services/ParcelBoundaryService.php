<?php

namespace App\Services;

use App\Models\FarmParcel;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Everything that happens to a parcel boundary once it reaches the server.
 *
 * The browser parses the uploaded file — shapefiles and KML are far easier to
 * read with the JavaScript libraries than in PHP — but nothing it sends is
 * trusted here. The geometry is re-validated by MySQL itself, the area is
 * recomputed rather than taken from the request, and overlaps are found with a
 * spatial query instead of by comparing polygons in the browser.
 */
class ParcelBoundaryService
{
    /**
     * Above this, a boundary is almost certainly not one farm.
     *
     * Philippine holdings average well under two hectares and the largest here
     * are tens. A polygon of hundreds is a barangay or a municipality that has
     * been imported into the wrong screen — which would silently become one
     * farmer's 248,000-hectare holding, overlapping every real parcel inside it.
     */
    public const IMPLAUSIBLE_PARCEL_HA = 500.0;

    /**
     * Validate a GeoJSON geometry by asking the database to parse it.
     *
     * Note what is NOT checked: MariaDB 10.4 has no ST_IsValid, so a polygon
     * whose outline crosses itself cannot be detected here. Such a shape still
     * parses and still has an area, so it will be accepted and stored. The
     * browser-side check catches the common cases before upload.
     *
     * @throws RuntimeException when it is not a usable polygon
     */
    public function validateGeometry(array $geometry): void
    {
        $type = $geometry['type'] ?? null;

        if (!in_array($type, ['Polygon', 'MultiPolygon'], true)) {
            throw new RuntimeException(
                'A parcel boundary must be a Polygon or MultiPolygon; this file contained '
                . ($type ? "a {$type}." : 'no geometry.')
            );
        }

        try {
            $row = DB::selectOne(
                'SELECT ST_Area(ST_GeomFromGeoJSON(?)) AS a',
                [json_encode($geometry)]
            );
        } catch (\Throwable $e) {
            throw new RuntimeException(
                'That boundary could not be read as a shape. It may be corrupt, or use a projection other than latitude/longitude.'
            );
        }

        if (!$row || (float) $row->a <= 0) {
            throw new RuntimeException('That boundary encloses no area.');
        }
    }

    /**
     * Area in hectares, measured on the spheroid.
     *
     * ST_Area on a lat/lng geometry returns square degrees, which is not an
     * area anyone can use — a degree of longitude is ~106 km at the equator and
     * shrinks toward the poles. Turf reports the same figure in the browser;
     * this is the copy that gets stored.
     */
    public function areaHectares(array $geometry): float
    {
        $ring = $this->outerRing($geometry);

        if (count($ring) < 4) {
            return 0.0;
        }

        // Shoelace on a local equirectangular projection about the shape's own
        // latitude. Over a few hundred metres the distortion is far below the
        // precision of the source data.
        $lat0 = array_sum(array_column($ring, 1)) / count($ring);
        $mPerDegLat = 111_132.0;
        $mPerDegLng = 111_320.0 * cos(deg2rad($lat0));

        $sum = 0.0;
        for ($i = 0, $n = count($ring) - 1; $i < $n; $i++) {
            [$x1, $y1] = $ring[$i];
            [$x2, $y2] = $ring[$i + 1];
            $sum += ($x1 * $mPerDegLng) * ($y2 * $mPerDegLat) - ($x2 * $mPerDegLng) * ($y1 * $mPerDegLat);
        }

        return round(abs($sum / 2) / 10_000, 4);
    }

    /** The first ring of the first polygon — the outer boundary. */
    private function outerRing(array $geometry): array
    {
        return $geometry['type'] === 'MultiPolygon'
            ? ($geometry['coordinates'][0][0] ?? [])
            : ($geometry['coordinates'][0] ?? []);
    }

    /**
     * Other parcels whose boundary genuinely overlaps this one.
     *
     * Runs in SQL so it stays workable as the registry grows — the alternative
     * is shipping every stored polygon to the browser to compare them there.
     *
     * The test is ST_Intersects AND NOT ST_Touches, which was arrived at by
     * measuring what this database actually does rather than by reading the
     * function names:
     *
     *   - ST_Overlaps returns TRUE for parcels that merely share a fence line,
     *     and FALSE for one parcel wholly inside another — so it both invents
     *     conflicts and misses duplicate imports.
     *   - ST_Touches correctly isolates edge-only contact, which is what a
     *     neighbouring field looks like and is not a conflict.
     *
     * No square-metre figure is reported. ST_Intersection on this version
     * returns a MULTIPOLYGON of roughly twice the true area when the shapes
     * coincide, and a number that wrong is worse than no number. Severity is
     * expressed as containment instead, which the predicates do get right.
     */
    public function findOverlaps(array $geometry, ?int $ignoreParcelId = null): array
    {
        $json = json_encode($geometry);

        $rows = DB::select(
            "SELECT p.id,
                    p.parcel_number,
                    p.barangay,
                    p.total_area_ha,
                    CONCAT_WS(', ', f.last_name, f.first_name) AS farmer,
                    ST_Contains(p.geom, ST_GeomFromGeoJSON(?)) AS covers_new,
                    ST_Contains(ST_GeomFromGeoJSON(?), p.geom) AS inside_new
               FROM farm_parcels p
               LEFT JOIN farmers f ON f.id = p.farmer_id
              WHERE p.geom IS NOT NULL
                AND (? IS NULL OR p.id <> ?)
                AND ST_Intersects(p.geom, ST_GeomFromGeoJSON(?))
                AND NOT ST_Touches(p.geom, ST_GeomFromGeoJSON(?))",
            [$json, $json, $ignoreParcelId, $ignoreParcelId, $json, $json]
        );

        return array_map(fn ($row) => [
            'id'            => $row->id,
            'parcel_number' => $row->parcel_number,
            'barangay'      => $row->barangay,
            'area_ha'       => $row->total_area_ha,
            'farmer'        => trim($row->farmer ?? '') ?: 'Unassigned',
            'kind'          => ($row->covers_new && $row->inside_new) ? 'identical'
                : ($row->covers_new ? 'contains this one'
                : ($row->inside_new ? 'sits inside this one' : 'partly overlaps')),
        ], $rows);
    }

    /**
     * Write the boundary, its area and where it came from.
     *
     * $meta['overwrite_area'] decides whether the recorded area is replaced.
     * A surveyed file is authoritative and should replace it; an outline
     * sketched by hand on the map should not overwrite a figure that may have
     * come off a land title.
     */
    public function store(FarmParcel $parcel, array $geometry, array $meta, ?int $userId): void
    {
        $json = json_encode($geometry);

        DB::transaction(function () use ($parcel, $json, $geometry, $meta, $userId) {
            DB::statement(
                'UPDATE farm_parcels SET geom = ST_GeomFromGeoJSON(?) WHERE id = ?',
                [$json, $parcel->id]
            );

            $fields = [
                // Kept in step with geom so the GIS overlay, which reads this
                // column, never shows a boundary the parcel form does not have.
                'geojson_data'         => $json,
                'boundary_source'      => $meta['source'],
                'boundary_file'        => $meta['file'] ?? null,
                'boundary_imported_at' => now(),
                'boundary_imported_by' => $userId,
            ];

            if ($meta['overwrite_area'] ?? true) {
                $fields['total_area_ha'] = $this->areaHectares($geometry);
            }

            $parcel->forceFill($fields)->save();
        });
    }
}
