<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The 46 barangays of Tumauini, Isabela.
 *
 * This list is authoritative: it drives the address type-aheads on the RSBSA
 * registration form, the parcel form and the registry filters, so a name that
 * is wrong here becomes a name wrongly spelled across the whole registry.
 *
 * Re-running is safe and is the point. The previous version returned early
 * whenever any barangay existed, which meant a correction to the list could
 * never reach a database that had already been seeded — including production.
 * This one reconciles instead: it adds what is missing, re-activates what is
 * on the list, and retires what is not.
 *
 * Retires, not deletes. barangay_boundaries and assistance_barangays both hold
 * a foreign key to this table with cascade-on-delete, so removing a row would
 * silently take a drawn boundary or a programme's targeting with it. Setting
 * is_active = false takes the name out of every picker while leaving the row
 * and everything hanging off it intact.
 */
class BarangaySeeder extends Seeder
{
    /**
     * @var list<string>
     */
    public const BARANGAYS = [
        'Annafunan',
        'Antagan I',
        'Antagan II',
        'Arcon',
        'Balug',
        'Banig',
        'Bantug',
        'Bayabo East',
        'Caligayan',
        'Camasi',
        'Carpentero',
        'Compania',
        'Cumabao',
        'Fermeldy',
        'Fugu Abajo',
        'Fugu Norte',
        'Fugu Sur',
        'Lalauanan',
        'Lanna',
        'Lapogan',
        'Lingaling',
        'Liwanag',
        'Malamag East',
        'Malamag West',
        'Maligaya',
        'Minanga',
        'Moldero',
        'Namnama',
        'Paragu',
        'Pilitan',
        'Barangay District 1',
        'Barangay District 2',
        'Barangay District 3',
        'Barangay District 4',
        'San Mateo',
        'San Pedro',
        'San Vicente',
        'Santa',
        'Santa Catalina',
        'Santa Visitacion',
        'Santo Niño',
        'Sinippil',
        'Sisim Abajo',
        'Sisim Alto',
        'Tunggui',
        'Ugad',
    ];

    public function run(): void
    {
        $known = DB::table('barangays')->pluck('name')->all();

        $missing = array_values(array_diff(self::BARANGAYS, $known));

        if ($missing !== []) {
            DB::table('barangays')->insert(array_map(fn (string $name) => [
                'name'         => $name,
                'municipality' => 'Tumauini',
                'province'     => 'Isabela',
                'is_active'    => true,
                'created_at'   => now(),
                'updated_at'   => now(),
            ], $missing));
        }

        // A barangay that was retired by an earlier run of this seeder comes
        // back if it returns to the official list.
        DB::table('barangays')
            ->whereIn('name', self::BARANGAYS)
            ->where('is_active', false)
            ->update(['is_active' => true, 'updated_at' => now()]);

        $retired = DB::table('barangays')
            ->whereNotIn('name', self::BARANGAYS)
            ->where('is_active', true)
            ->update(['is_active' => false, 'updated_at' => now()]);

        $this->command?->info(sprintf(
            'Barangays reconciled: %d added, %d retired, %d active.',
            count($missing),
            $retired,
            count(self::BARANGAYS),
        ));

        if ($retired > 0) {
            // Farmers and parcels store the barangay as text, not as a foreign
            // key, so a retired name stays on any record already carrying it.
            // Those records are not rewritten here - correcting someone's
            // address is the office's call, not a seeder's.
            $this->command?->warn(
                "{$retired} barangay(s) are no longer on the official list and have been "
                . 'deactivated. Existing farmer and parcel records still carry those names.'
            );
        }
    }
}
