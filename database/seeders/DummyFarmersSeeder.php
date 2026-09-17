<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Models\Crop;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\FarmType;
use App\Models\Fishpond;
use App\Models\LivestockType;
use App\Models\User;
use App\Services\ParcelBoundaryService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Fictional farmers sitting in the state a public registration leaves them in.
 *
 * Every account here is invented. The names are common Filipino given names and
 * surnames combined by the generator, the numbers are in the 09xx format the
 * validator wants but belong to nobody, and the parcels are squares placed on
 * empty ground inside the municipality rather than over anyone's actual land.
 *
 * SAFETY
 *
 * Everything this creates is identified by one thing: the account email matches
 * dummy.farmerNNN@example.test. Re-running removes only rows reachable from
 * those accounts and rebuilds them, so the seeder is repeatable without ever
 * touching a real record. It issues no TRUNCATE and drops no table.
 *
 * .test is reserved by RFC 6761 and can never be a real domain, so none of
 * these addresses can reach a person even if something tried to send to one.
 *
 * WHAT IT DELIBERATELY DOES NOT CREATE
 *
 * No assistance programmes, no distributions, no interventions, no
 * recommendations and no verification history — these farmers have only just
 * submitted. They also carry no RSBSA number: that is assigned by the office at
 * verification, so a pending registration having one would misrepresent the
 * workflow being tested.
 *
 * Nor does it create climate risk assessments. A farmer who registered this
 * morning has not filled one in, and inventing answers would put fabricated
 * survey responses into the analytics the office is meant to trust.
 */
class DummyFarmersSeeder extends Seeder
{
    /** How the accounts are recognised, for both creation and clean-up. */
    private const EMAIL_PATTERN = 'dummy.farmer%@example.test';

    private const FARMERS = 55;

    /** Roughly the middle of Tumauini. Parcels are scattered around it. */
    private const CENTRE_LAT = 17.2700;
    private const CENTRE_LON = 121.8100;

    /** Keeps the scatter inside the municipality rather than in the next town. */
    private const SPREAD_DEG = 0.11;

    private const FIRST_NAMES = [
        'Juan', 'Maria', 'Jose', 'Rosario', 'Pedro', 'Luzviminda', 'Ricardo', 'Corazon',
        'Antonio', 'Teresita', 'Manuel', 'Lourdes', 'Eduardo', 'Remedios', 'Rolando',
        'Erlinda', 'Danilo', 'Nenita', 'Alfredo', 'Josefina', 'Reynaldo', 'Marilou',
        'Benigno', 'Purificacion', 'Ernesto', 'Milagros', 'Federico', 'Gliceria',
        'Arturo', 'Consuelo', 'Rodolfo', 'Adoracion', 'Efren', 'Natividad', 'Salvador',
    ];

    private const MIDDLE_NAMES = [
        'Bautista', 'Domingo', 'Agustin', 'Pascual', 'Cabbab', 'Tumaliuan', 'Bulan',
        'Guzman', 'Soriano', 'Malana', 'Addun', 'Bacud', 'Lasam', 'Taguba',
    ];

    private const LAST_NAMES = [
        'Dela Cruz', 'Santos', 'Reyes', 'Ramos', 'Mercado', 'Aquino', 'Castillo',
        'Villanueva', 'Bautista', 'Gonzales', 'Fernandez', 'Cabbab', 'Tumaliuan',
        'Bulan', 'Addun', 'Malana', 'Lasam', 'Taguba', 'Bacud', 'Pascual',
        'Agustin', 'Domingo', 'Mariano', 'Balauag', 'Cauilan', 'Dumlao', 'Respicio',
    ];

    private const FERTILISERS = ['Urea', 'Complete (14-14-14)', 'Ammonium Sulphate', 'Organic Compost'];

    public function run(): void
    {
        $barangays = Barangay::orderBy('name')->pluck('name')->all();
        $crops     = Crop::orderBy('crop_name')->pluck('crop_name', 'id')->all();
        $livestock = LivestockType::orderBy('type_name')->pluck('type_name')->all();
        $farmTypes = FarmType::orderBy('id')->pluck('id')->all();

        if ($barangays === [] || $crops === [] || $farmTypes === []) {
            $this->command?->error(
                'Lookup tables are empty. Run BarangaySeeder and GeofarmSeeder first — '
                . 'this seeder only uses barangays, crops and farm types that already exist.'
            );

            return;
        }

        $removed = $this->removeExisting();

        if ($removed > 0) {
            $this->command?->info("Removed {$removed} dummy farmer(s) from a previous run.");
        }

        /*
         * Deterministic on purpose.
         *
         * The same seed produces the same 55 farmers every time, so a bug found
         * on this data can be reproduced after a re-seed, and two people running
         * it are looking at the same records.
         */
        mt_srand(20260917);

        $boundaries = app(ParcelBoundaryService::class);

        $madeFarmers = 0;
        $madeParcels = 0;
        $madeSeasons = 0;
        $madePonds   = 0;

        for ($n = 1; $n <= self::FARMERS; $n++) {
            $result = DB::transaction(fn () => $this->makeFarmer(
                $n, $barangays, $crops, $livestock, $farmTypes, $boundaries
            ));

            $madeFarmers++;
            $madeParcels += $result['parcels'];
            $madeSeasons += $result['seasons'];
            $madePonds   += $result['ponds'];
        }

        /*
         * Counted from the database, not from what this class inserted.
         *
         * FarmParcelObserver opens the current year's seasons from each
         * parcel's schedule, so the rows created here are only the earlier
         * years — reporting those alone understated the total by a third.
         */
        $parcelIds  = FarmParcel::whereIn('farmer_id', $this->dummyFarmerIds())->pluck('id');
        $allSeasons = DB::table('crop_seasons')->whereIn('parcel_id', $parcelIds)->count();

        $this->command?->info(
            "Created {$madeFarmers} pending farmers, {$madeParcels} parcels and {$madePonds} fishponds."
        );
        $this->command?->info(
            "Crop seasons: {$allSeasons} total — {$madeSeasons} earlier years seeded here, "
            . 'the rest opened for the current year by FarmParcelObserver.'
        );
        $this->command?->info('All are awaiting verification. Emails: ' . self::EMAIL_PATTERN);
    }

    /**
     * Take out what a previous run left, and nothing else.
     *
     * Scoped to the dummy email pattern on the USER account, then deleted
     * through the farmer, so the database's own cascades take the parcels and
     * crop seasons with it. Nothing is matched on name, barangay or anything
     * else a real farmer could share.
     */
    /** Every farmer reachable from a dummy account, by id. */
    private function dummyFarmerIds(): \Illuminate\Support\Collection
    {
        return Farmer::whereIn(
            'user_id',
            User::where('email', 'like', self::EMAIL_PATTERN)->select('id')
        )->pluck('id');
    }

    private function removeExisting(): int
    {
        $userIds = User::where('email', 'like', self::EMAIL_PATTERN)->pluck('id');

        if ($userIds->isEmpty()) {
            return 0;
        }

        $farmers = Farmer::whereIn('user_id', $userIds)->get();

        foreach ($farmers as $farmer) {
            // Deleted one at a time so model events fire and the cascades run
            // exactly as they would for a real deletion.
            $farmer->delete();
        }

        $count = $farmers->count();

        User::whereIn('id', $userIds)->delete();

        return $count;
    }

    /** @return array{parcels: int, seasons: int, ponds: int} */
    private function makeFarmer(
        int $n,
        array $barangays,
        array $crops,
        array $livestock,
        array $farmTypes,
        ParcelBoundaryService $boundaries,
    ): array {
        $sequence = str_pad((string) $n, 3, '0', STR_PAD_LEFT);
        $email    = "dummy.farmer{$sequence}@example.test";

        $first  = self::FIRST_NAMES[($n * 7) % count(self::FIRST_NAMES)];
        $middle = self::MIDDLE_NAMES[($n * 5) % count(self::MIDDLE_NAMES)];
        $last   = self::LAST_NAMES[($n * 3) % count(self::LAST_NAMES)];

        // Spread across every barangay so barangay filtering has something to
        // filter, rather than 55 farmers in one village.
        $barangay = $barangays[$n % count($barangays)];

        $user = User::create([
            'name'      => "{$first} {$last}",
            'email'     => $email,
            'password'  => Hash::make('password'),
            // Matches a real registration: the account exists but cannot sign in
            // until the office approves it.
            'is_active' => false,
        ]);

        $user->assignRole('Farmer');

        $farmer = Farmer::create([
            'first_name'          => $first,
            'middle_name'         => $middle,
            'last_name'           => $last,
            'sex'                 => $n % 2 === 0 ? 'Female' : 'Male',
            'birthdate'           => now()->subYears(28 + ($n % 34))->subDays($n * 3)->toDateString(),
            'civil_status'        => ['Single', 'Married', 'Widowed'][$n % 3],
            'mobile_no'           => '09' . str_pad((string) (170000000 + $n * 13), 9, '0', STR_PAD_LEFT),
            'email'               => $email,
            'barangay'            => $barangay,
            'city_municipality'   => 'Tumauini',
            'province'            => 'Isabela',
            'region'              => 'Region II (Cagayan Valley)',
            'highest_education'   => ['Elementary', 'High School', 'College'][$n % 3],
            'is_4ps'              => $n % 9 === 0,
            'pwd'                 => false,
            'is_indigenous'       => $n % 17 === 0,
            'livelihood_type'     => 'Farmer',
            'user_id'             => $user->id,

            /*
             * The state a fresh registration leaves behind.
             *
             * rsbsa_no is deliberately absent: the office issues it at
             * verification, and a pending farmer holding one would make the
             * workflow look already finished.
             */
            'verification_status' => Farmer::STATUS_PENDING,
            'reference_code'      => 'RSBSA-' . now()->format('Y') . '-DMY' . $sequence,
            'submitted_online_at' => now()->subDays($n % 14)->subHours($n % 24),
        ]);

        $parcels = 0;
        $seasons = 0;

        // One parcel each, and a second for every third farmer — enough to pass
        // 50 comfortably while keeping holdings realistically uneven.
        $howMany = $n % 3 === 0 ? 2 : 1;

        for ($p = 1; $p <= $howMany; $p++) {
            $made = $this->makeParcel($farmer, $n, $p, $barangays, $crops, $livestock, $farmTypes, $boundaries);
            $parcels++;
            $seasons += $made;
        }

        // A handful of ponds so the aquaculture scope is exercisable at all.
        // Remove this block if you want parcels only.
        $ponds = 0;

        if ($n % 9 === 4) {
            Fishpond::create([
                'farmer_id'            => $farmer->id,
                'pond_type'            => $n % 2 === 0 ? 'freshwater' : 'brackish',
                'species'              => ['Tilapia', 'Hito', 'Bangus'][$n % 3],
                'area_hectares'        => round(0.15 + (mt_rand(0, 60) / 100), 2),
                'stocking_density'     => round(3 + (mt_rand(0, 40) / 10), 2),
                'estimated_population' => 1000 + ($n * 45),
                'harvest_cycle_months' => 4 + ($n % 3),
            ]);
            $ponds = 1;
        }

        return ['parcels' => $parcels, 'seasons' => $seasons, 'ponds' => $ponds];
    }

    /** @return int crop seasons created for this parcel */
    private function makeParcel(
        Farmer $farmer,
        int $n,
        int $index,
        array $barangays,
        array $crops,
        array $livestock,
        array $farmTypes,
        ParcelBoundaryService $boundaries,
    ): int {
        /*
         * Every seventh farmer's holding is livestock rather than a crop.
         *
         * The commodity is taken from livestock_types, which is what
         * CommodityCatalogue reads to decide the kind — so these genuinely
         * resolve as livestock instead of relying on the word looking like an
         * animal.
         */
        $isLivestock = $n % 7 === 0 && $index === 1;

        $commodity = $isLivestock
            ? $livestock[$n % count($livestock)]
            : array_values($crops)[$n % count($crops)];

        $area = $isLivestock
            ? round(0.5 + (mt_rand(0, 250) / 100), 2)
            : round(0.4 + (mt_rand(0, 450) / 100), 2);

        // A second parcel can sit in a neighbouring barangay, as real holdings do.
        $barangay = $index === 1
            ? $farmer->barangay
            : $barangays[($n + 5) % count($barangays)];

        $schedule = $isLivestock ? null : ['Wet', 'Dry', 'Wet/Dry'][$n % 3];

        $parcel = $farmer->parcels()->create([
            'parcel_number'      => "DMY-{$farmer->id}-{$index}",
            'location_address'   => "Sitio {$index}, {$barangay}",
            'barangay'           => $barangay,
            'city_municipality'  => 'Tumauini',
            'province'           => 'Isabela',
            'total_area_ha'      => $area,
            'farm_type_id'       => $farmTypes[$n % count($farmTypes)],
            'ownership_type'     => ['Registered Owner', 'Tenant', 'Lessee'][$n % 3],
            'land_owner_name'    => $n % 3 === 1 ? 'Fictional Lessor ' . $n : null,
            'within_ancestral'   => false,
            'arb'                => $n % 11 === 0,
            'commodity'          => $commodity,
            'cropping_schedule'  => $schedule,
            'no_of_heads_trees'  => $isLivestock ? 5 + ($n % 60) : null,
            'is_organic'         => $n % 6 === 0,
            'proof_of_ownership' => ['Title', 'Tax Declaration', 'Certification'][$n % 3],
        ]);

        $this->drawBoundary($parcel, $area, $n, $index, $boundaries);

        // FarmParcelObserver has already opened this year's seasons from the
        // schedule. Only the earlier years are added here.
        return $isLivestock ? 0 : $this->addHistory($parcel, $crops, $n);
    }

    /**
     * A square of empty ground inside the municipality.
     *
     * Written through ParcelBoundaryService so geom and geojson_data are filled
     * the same way an imported boundary fills them, rather than by hand-rolling
     * WKB that the GIS overlay might read differently.
     *
     * overwrite_area is false: the area was chosen above, and letting the
     * service recompute it from the square would replace a realistic figure
     * with one derived from an arbitrary shape.
     */
    private function drawBoundary(
        FarmParcel $parcel,
        float $area,
        int $n,
        int $index,
        ParcelBoundaryService $boundaries,
    ): void {
        $lat = self::CENTRE_LAT + ((mt_rand(0, 2000) / 1000) - 1) * self::SPREAD_DEG;
        $lon = self::CENTRE_LON + ((mt_rand(0, 2000) / 1000) - 1) * self::SPREAD_DEG;

        // Side of a square of this many hectares, in degrees at this latitude.
        $sideMetres = sqrt(max($area, 0.1) * 10_000);
        $dLat = $sideMetres / 111_132.0;
        $dLon = $sideMetres / (111_320.0 * cos(deg2rad($lat)));

        $geometry = [
            'type'        => 'Polygon',
            'coordinates' => [[
                [round($lon, 6), round($lat, 6)],
                [round($lon + $dLon, 6), round($lat, 6)],
                [round($lon + $dLon, 6), round($lat + $dLat, 6)],
                [round($lon, 6), round($lat + $dLat, 6)],
                [round($lon, 6), round($lat, 6)],
            ]],
        ];

        /*
         * 'drawn' rather than one of the import sources: boundary_source is an
         * enum of drawn|shapefile|kml|geojson, and this shape came from no file.
         * boundary_file stays null for the same reason — there is no file to
         * name, and putting the seeder's name there would invent provenance.
         */
        $boundaries->store($parcel, $geometry, [
            'source'         => 'drawn',
            'file'           => null,
            'overwrite_area' => false,
        ], null);
    }

    /**
     * Earlier seasons, so the history-driven analysis has something to read.
     *
     * The number of years varies on purpose, because ProductionHistory bands
     * its answer on how many comparable records exist: three or more reads as
     * sufficient, one or two as limited, none as insufficient. A test set where
     * every farmer had four years would only ever exercise one of those.
     *
     * Yields move year to year with no trend imposed — some parcels drift up,
     * some down, most wander. Nothing here is a real harvest figure.
     */
    private function addHistory(FarmParcel $parcel, array $crops, int $n): int
    {
        // 0, 1, 2, 3 or 4 previous years, spread across the set.
        $years = $n % 5;

        if ($years === 0) {
            return 0;
        }

        $cropId = array_search($parcel->commodity, $crops, true) ?: array_key_first($crops);
        $season = str_contains(strtolower((string) $parcel->cropping_schedule), 'dry') ? 'dry' : 'wet';
        $area   = (float) $parcel->total_area_ha;

        $made = 0;

        for ($back = 1; $back <= $years; $back++) {
            $year = (int) now()->year - $back;

            // Around 3.5 t/ha, wandering by up to a third either way.
            $perHa   = 3_500 * (0.7 + (mt_rand(0, 60) / 100));
            $yield   = round($area * $perHa, 2);
            $price   = round(17 + (mt_rand(0, 900) / 100), 2);
            $income  = round($yield * $price, 2);
            $labour  = round($area * (8_000 + mt_rand(0, 4_000)), 2);
            $inputs  = round($area * (12_000 + mt_rand(0, 9_000)), 2);

            $plantMonth = $season === 'dry' ? 11 : 6;
            $planting   = now()->setDate($year, $plantMonth, 1 + ($n % 20))->startOfDay();

            $parcel->seasons()->create([
                'season'            => $season,
                'cropping_year'     => $year,
                'crop_id'           => $cropId,
                'area_planted_ha'   => $area,
                'planting_date'     => $planting->toDateString(),
                'harvest_date'      => $planting->copy()->addDays(105 + ($n % 25))->toDateString(),
                'yield_kg'          => $yield,
                'production_unit'   => 'kg',
                'selling_price'     => $price,
                'production_cost'   => $inputs,
                'labor_cost'        => $labour,
                'other_cost'        => round($area * mt_rand(500, 2_500), 2),
                'total_income'      => $income,
                'fertilizer_type'   => self::FERTILISERS[$n % count(self::FERTILISERS)],
                'fertilizer_qty_kg' => round($area * (40 + mt_rand(0, 60)), 2),
                'fertilizer_class'  => ['inorganic', 'organic', 'mixed'][$n % 3],
                'is_organic'        => (bool) $parcel->is_organic,
            ]);

            $made++;
        }

        return $made;
    }
}
