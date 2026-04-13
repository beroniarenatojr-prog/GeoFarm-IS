<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CropRecommendationsSeeder extends Seeder
{
    public function run(): void
    {
        $recommendations = [
            ['crop_name' => 'Rice', 'seeding_rate_kg_per_ha' => 20, 'fertilizer_bags_per_ha' => 2],
            ['crop_name' => 'Corn', 'seeding_rate_kg_per_ha' => 15, 'fertilizer_bags_per_ha' => 2.5],
            ['crop_name' => 'Vegetables', 'seeding_rate_kg_per_ha' => 5, 'fertilizer_bags_per_ha' => 3],
            ['crop_name' => 'Sugarcane', 'seeding_rate_kg_per_ha' => 100, 'fertilizer_bags_per_ha' => 4],
        ];

        foreach ($recommendations as $rec) {
            DB::table('crops')
                ->where('crop_name', $rec['crop_name'])
                ->update([
                    'seeding_rate_kg_per_ha' => $rec['seeding_rate_kg_per_ha'],
                    'fertilizer_bags_per_ha' => $rec['fertilizer_bags_per_ha'],
                ]);
        }

        $this->command->info('Crop recommendations seeded successfully.');
    }
}
