<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Models\Crop;
use App\Models\CropSeason;
use App\Models\FarmParcel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Generates plausible multi-year cropping history so the forecasting features
 * have something to work with during development and demos.
 *
 * This is SAMPLE DATA. Do not run it against production records - the yield
 * figures are synthetic and would corrupt real forecasts.
 */
class CropHistorySeeder extends Seeder
{
    /** Typical yield per hectare (kg) and duration (days) by crop name. */
    private const PROFILES = [
        'Rice'      => ['yield' => 4200, 'days' => 115],
        'Palay'     => ['yield' => 4200, 'days' => 115],
        'Corn'      => ['yield' => 5000, 'days' => 105],
        'Mais'      => ['yield' => 5000, 'days' => 105],
        'Tomato'    => ['yield' => 18000, 'days' => 90],
        'Eggplant'  => ['yield' => 15000, 'days' => 95],
        'Onion'     => ['yield' => 12000, 'days' => 100],
        'Garlic'    => ['yield' => 6000, 'days' => 110],
        'Cassava'   => ['yield' => 14000, 'days' => 270],
        'Banana'    => ['yield' => 16000, 'days' => 300],
        'Mango'     => ['yield' => 9000, 'days' => 150],
        'Peanut'    => ['yield' => 1600, 'days' => 100],
        'Mongo'     => ['yield' => 1100, 'days' => 70],
        'Squash'    => ['yield' => 13000, 'days' => 85],
    ];

    private const DEFAULT_PROFILE = ['yield' => 4000, 'days' => 110];

    public function run(): void
    {
        $parcels = FarmParcel::all();
        $crops = Crop::all();

        if ($parcels->isEmpty() || $crops->isEmpty()) {
            $this->command->warn('CropHistorySeeder skipped: needs at least one farm parcel and one crop.');

            return;
        }

        // Barangay-level comparison needs parcels spread across barangays. If
        // everything sits in one or two, distribute the sample parcels so the
        // comparison view has something meaningful to show.
        $this->spreadParcelsAcrossBarangays($parcels);

        $startYear = (int) now()->subYears(4)->format('Y');
        $currentYear = (int) now()->format('Y');
        $created = 0;

        foreach ($parcels as $parcel) {
            // Each parcel sticks to one or two crops, as a real farm would.
            $parcelCrops = $crops->random(min(2, $crops->count()));

            for ($year = $startYear; $year <= $currentYear; $year++) {
                foreach (['dry', 'wet'] as $season) {
                    foreach ($parcelCrops as $crop) {
                        // Not every crop is planted every season.
                        if (random_int(1, 100) > 65) {
                            continue;
                        }

                        $profile = $this->profileFor($crop->crop_name);

                        // Dry season plantings start Dec-Feb, wet season Jun-Aug.
                        $plantingMonth = $season === 'dry'
                            ? [12, 1, 2][random_int(0, 2)]
                            : [6, 7, 8][random_int(0, 2)];

                        // A December dry-season planting belongs to the prior calendar year.
                        $plantingYear = ($season === 'dry' && $plantingMonth === 12) ? $year - 1 : $year;

                        $planting = Carbon::create($plantingYear, $plantingMonth, random_int(1, 28));

                        // Skip anything that would be planted in the future.
                        if ($planting->isFuture()) {
                            continue;
                        }

                        $days = $profile['days'] + random_int(-8, 8);
                        $harvest = $planting->copy()->addDays($days);

                        $area = max(0.25, round((float) ($parcel->total_area_ha ?: 1) * (random_int(50, 100) / 100), 2));

                        // Yield varies with a mild upward drift over the years, a
                        // wet-season penalty, and random seasonal noise.
                        $yearFactor = 1 + (($year - $startYear) * 0.03);
                        $seasonFactor = $season === 'wet' ? 0.88 : 1.0;
                        $noise = random_int(80, 120) / 100;

                        $yieldKg = $harvest->isFuture()
                            ? null // Standing crop - no harvest recorded yet.
                            : round($profile['yield'] * $area * $yearFactor * $seasonFactor * $noise, 2);

                        CropSeason::create([
                            'parcel_id'       => $parcel->id,
                            'season'          => $season,
                            'cropping_year'   => $year,
                            'crop_id'         => $crop->id,
                            'area_planted_ha' => $area,
                            'planting_date'   => $planting->toDateString(),
                            'harvest_date'    => $harvest->isFuture() ? null : $harvest->toDateString(),
                            'yield_kg'        => $yieldKg,
                        ]);

                        $created++;
                    }
                }
            }
        }

        // A few forward-looking plantings so the harvest calendar and risk
        // advisory have upcoming windows to report on.
        foreach ($parcels as $parcel) {
            $crop = $crops->random();
            $profile = $this->profileFor($crop->crop_name);
            $planting = now()->addDays(random_int(5, 90));

            CropSeason::create([
                'parcel_id'       => $parcel->id,
                'season'          => in_array((int) $planting->format('n'), [6, 7, 8, 9, 10, 11], true) ? 'wet' : 'dry',
                'cropping_year'   => (int) $planting->format('Y'),
                'crop_id'         => $crop->id,
                'area_planted_ha' => max(0.25, round((float) ($parcel->total_area_ha ?: 1) * 0.8, 2)),
                'planting_date'   => $planting->toDateString(),
                'harvest_date'    => null,
                'yield_kg'        => null,
            ]);

            $created++;
        }

        $this->command->info("CropHistorySeeder: created {$created} cropping season records (sample data).");
    }

    private function profileFor(?string $cropName): array
    {
        foreach (self::PROFILES as $name => $profile) {
            if ($cropName && stripos($cropName, $name) !== false) {
                return $profile;
            }
        }

        return self::DEFAULT_PROFILE;
    }

    /**
     * Assign parcels round-robin across the real barangay list when they are
     * all bunched into very few barangays. Sample data only.
     */
    private function spreadParcelsAcrossBarangays($parcels): void
    {
        $distinct = $parcels->pluck('barangay')->filter()->unique();

        if ($distinct->count() >= 4) {
            return; // Already spread out enough.
        }

        $barangays = Barangay::where('is_active', true)->orderBy('name')->pluck('name');

        if ($barangays->count() < 4) {
            return;
        }

        foreach ($parcels->values() as $index => $parcel) {
            $parcel->update([
                'barangay' => $barangays[$index % $barangays->count()],
            ]);
        }

        $this->command->info('CropHistorySeeder: redistributed sample parcels across barangays.');
    }
}
