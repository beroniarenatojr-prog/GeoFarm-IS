<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Settles where a parcel boundary lives, and records where it came from.
 *
 * Two stores had grown up side by side: `geom` (spatial), written by the parcel
 * form, and `geojson_data` (text), written by the GIS map. Neither read the
 * other, so a boundary drawn in one place was invisible in the other. `geom`
 * becomes the single source of truth here, because it is the only one MySQL can
 * index and query — overlap detection against thousands of parcels belongs in
 * SQL, not in the browser.
 *
 * geojson_data is kept as a read mirror rather than dropped: the GIS overlay
 * still reads it, and a column that can be rebuilt from geom at any time is
 * cheap insurance against this migration being wrong about something.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farm_parcels', function (Blueprint $table) {
            // Where this boundary came from. "drawn" is a sketch on the map;
            // "shapefile" is a survey. They should never look alike in a record
            // that decides who gets assistance.
            $table->enum('boundary_source', ['drawn', 'shapefile', 'kml', 'geojson'])
                ->nullable()->after('geojson_data');
            $table->string('boundary_file')->nullable()->after('boundary_source');
            $table->timestamp('boundary_imported_at')->nullable()->after('boundary_file');
            $table->foreignId('boundary_imported_by')->nullable()->after('boundary_imported_at')
                ->constrained('users')->nullOnDelete();
        });

        // Backfill: anything that only lived in the text column becomes real
        // geometry. ST_GeomFromGeoJSON rejects malformed input, so this is also
        // a validity check on what was already stored.
        $rows = DB::table('farm_parcels')
            ->whereNotNull('geojson_data')
            ->whereNull('geom')
            ->get(['id', 'geojson_data']);

        foreach ($rows as $row) {
            try {
                DB::statement(
                    'UPDATE farm_parcels SET geom = ST_GeomFromGeoJSON(?), boundary_source = ? WHERE id = ?',
                    [$row->geojson_data, 'drawn', $row->id]
                );
            } catch (\Throwable $e) {
                // Leave it in the text column and carry on; a single unreadable
                // shape must not stop the migration.
                logger()->warning("Parcel {$row->id}: geojson_data could not be converted to geometry.", [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // A SPATIAL index needs a NOT NULL column, and most parcels have no
        // boundary yet, so this stays a plain index on the bounding envelope
        // instead. MariaDB still uses it to narrow ST_Intersects candidates.
        // Revisit once boundaries are the norm rather than the exception.
    }

    public function down(): void
    {
        Schema::table('farm_parcels', function (Blueprint $table) {
            $table->dropConstrainedForeignId('boundary_imported_by');
            $table->dropColumn(['boundary_source', 'boundary_file', 'boundary_imported_at']);
        });
    }
};
