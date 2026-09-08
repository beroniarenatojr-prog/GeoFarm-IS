<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * One cropping per parcel, per year, per season.
 *
 * Two rows for "Sakahan 1, 2026, wet" is not a second harvest, it is the same
 * one encoded twice - and it doubles that parcel's cost and production in
 * every report and in the risk scoring.
 *
 * Guarded rather than unconditional. This runs against a live registry, and
 * adding a unique index to a table that already holds duplicates fails
 * outright, taking the whole deployment with it. Where duplicates exist the
 * index is skipped and the conflicts are reported, so the office can merge
 * them and re-run; the controller rejects new duplicates either way, so the
 * problem stops growing in the meantime.
 */
return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('crop_seasons')
            ->select('parcel_id', 'cropping_year', 'season', DB::raw('COUNT(*) AS copies'))
            ->groupBy('parcel_id', 'cropping_year', 'season')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($duplicates->isNotEmpty()) {
            $summary = $duplicates
                ->map(fn ($row) => "parcel {$row->parcel_id} / {$row->cropping_year} / {$row->season} ({$row->copies} rows)")
                ->implode('; ');

            Log::warning('crop_seasons holds duplicate croppings; unique index not applied.', [
                'conflicts' => $duplicates->count(),
                'detail'    => $summary,
            ]);

            // Visible during migrate, not only in the log.
            echo "\n  SKIPPED unique index on crop_seasons: {$duplicates->count()} duplicate cropping(s) exist.\n"
                . "  {$summary}\n"
                . "  Merge these rows, then re-run this migration to apply the constraint.\n\n";

            return;
        }

        Schema::table('crop_seasons', function (Blueprint $table) {
            $table->unique(['parcel_id', 'cropping_year', 'season'], 'uniq_parcel_year_season');
        });
    }

    public function down(): void
    {
        // Never assume it was created — up() skips when duplicates were found.
        $exists = collect(DB::select('SHOW INDEX FROM `crop_seasons`'))
            ->contains(fn ($index) => $index->Key_name === 'uniq_parcel_year_season');

        if ($exists) {
            Schema::table('crop_seasons', function (Blueprint $table) {
                $table->dropUnique('uniq_parcel_year_season');
            });
        }
    }
};
