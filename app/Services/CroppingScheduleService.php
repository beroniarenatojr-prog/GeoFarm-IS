<?php

namespace App\Services;

use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\FarmParcel;
use Illuminate\Support\Collection;

/**
 * Opens the croppings a parcel's schedule implies.
 *
 * A parcel declared as Wet/Dry is worked twice a year, so the office should
 * not have to remember to create two seasonal records by hand — and when they
 * did, one of the two was routinely forgotten and that parcel's annual cost
 * came out half of what it really was.
 *
 * What this does NOT do is invent production. The rows it opens carry only
 * what the parcel already states — its area, its commodity, its organic
 * practice — and wait for staff to encode the harvest. An empty seasonal row
 * is a reminder that the season is unrecorded; a missing one is invisible.
 */
class CroppingScheduleService
{
    /**
     * How the RSBSA form's schedule maps to croppings.
     *
     * Keyed on the lower-cased schedule so "Wet/Dry", "wet/dry" and the older
     * free-text values entered before the field became a dropdown all land in
     * the same place.
     */
    private const SCHEDULES = [
        'wet'     => [CropSeason::SEASON_WET],
        'dry'     => [CropSeason::SEASON_DRY],
        'wet/dry' => [CropSeason::SEASON_WET, CropSeason::SEASON_DRY],
        'dry/wet' => [CropSeason::SEASON_WET, CropSeason::SEASON_DRY],
        'both'    => [CropSeason::SEASON_WET, CropSeason::SEASON_DRY],
    ];

    /**
     * The croppings a schedule string calls for.
     *
     * @return list<string>
     */
    public function seasonsFor(?string $schedule): array
    {
        $key = strtolower(trim((string) $schedule));

        return self::SCHEDULES[$key] ?? [];
    }

    /**
     * Open this parcel's seasons for a year, creating only what is missing.
     *
     * Idempotent by design. Re-registering, editing a parcel or re-running
     * this for the same year must never produce a second "2026 wet" — that is
     * not a second harvest, it is the same one counted twice in every report.
     *
     * @return Collection<int, CropSeason> the rows that were newly opened
     */
    public function openFor(FarmParcel $parcel, ?int $year = null): Collection
    {
        $seasons = $this->seasonsFor($parcel->cropping_schedule);

        if ($seasons === []) {
            return collect();
        }

        $year ??= (int) now()->year;
        $opened = collect();

        foreach ($seasons as $season) {
            $existing = CropSeason::where('parcel_id', $parcel->id)
                ->where('cropping_year', $year)
                ->where('season', $season)
                ->first();

            if ($existing) {
                continue;
            }

            $opened->push(CropSeason::create([
                'parcel_id'     => $parcel->id,
                'cropping_year' => $year,
                'season'        => $season,
                // The parcel's own figures, as a starting point. Staff correct
                // the area when only part of a holding was planted.
                'area_planted_ha' => $parcel->total_area_ha,
                'crop_id'         => $this->cropFor($parcel->commodity),
                // Practice is recorded per season because it changes between
                // them; the parcel's answer is what it starts as.
                'is_organic'      => $parcel->is_organic,
            ]));
        }

        return $opened;
    }

    /**
     * Match a parcel's free-text commodity to a crop on file.
     *
     * Returns null rather than creating one. commodity is typed by hand, so
     * creating a crop from it would fill the reference table with "Rice ",
     * "rice" and "Ricce" — and those become the categories every yield report
     * is grouped by. An unmatched commodity leaves the season waiting for
     * staff to pick the crop, which is the honest state.
     */
    private function cropFor(?string $commodity): ?int
    {
        if (blank($commodity)) {
            return null;
        }

        return Crop::whereRaw('LOWER(crop_name) = ?', [strtolower(trim($commodity))])
            ->value('id');
    }
}
