<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BarangaySeeder extends Seeder
{
    public function run(): void
    {
        // Check if barangays already exist
        if (DB::table('barangays')->count() > 0) {
            $this->command->info('Barangays already seeded. Skipping...');
            return;
        }

        $barangays = [
            'Annafunan',
            'Antagan I',
            'Antagan II',
            'Banig',
            'Bayabo',
            'Bintawan',
            'Caligayan',
            'Carpentero',
            'Cumabao',
            'Dadda',
            'Dangan',
            'Fugu',
            'Lacab',
            'Lingaling',
            'Malamag',
            'Malannao',
            'Maligaya',
            'Minanga',
            'Mozzozzin Norte',
            'Mozzozzin Sur',
            'Namnama',
            'Paragu',
            'Pengue',
            'Pilitan',
            'Poblacion I',
            'Poblacion II',
            'Poblacion III',
            'Poblacion IV',
            'Quezon',
            'Rugao',
            'San Andres',
            'San Bernardo',
            'San Fermin',
            'San Isidro',
            'San Manuel',
            'San Mateo',
            'San Pablo',
            'San Vicente',
            'Santor',
            'Sima',
            'Sinippil',
            'Sisim',
            'Terere',
            'Ugad',
            'Uleg',
            'Yumangit',
        ];

        $data = [];
        foreach ($barangays as $barangay) {
            $data[] = [
                'name' => $barangay,
                'municipality' => 'Tumauini',
                'province' => 'Isabela',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        DB::table('barangays')->insert($data);
        $this->command->info('Barangays seeded successfully!');
    }
}
