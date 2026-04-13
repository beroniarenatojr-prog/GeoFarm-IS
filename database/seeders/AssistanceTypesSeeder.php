<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AssistanceTypesSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            // Financial & Credit
            ['category' => 'Financial & Credit', 'type_name' => 'Cash Assistance', 'description' => 'Direct cash support for farmers'],
            ['category' => 'Financial & Credit', 'type_name' => 'Low Interest Loan', 'description' => 'Affordable credit for agricultural activities'],
            ['category' => 'Financial & Credit', 'type_name' => 'Credit Assistance', 'description' => 'Credit facilitation and guarantee programs'],
            
            // Production Inputs
            ['category' => 'Production Inputs', 'type_name' => 'Seed Distribution', 'description' => 'Free or subsidized seeds for planting'],
            ['category' => 'Production Inputs', 'type_name' => 'Fertilizer Voucher', 'description' => 'Vouchers for purchasing fertilizers'],
            ['category' => 'Production Inputs', 'type_name' => 'Organic Fertilizer', 'description' => 'Distribution of organic fertilizers'],
            ['category' => 'Production Inputs', 'type_name' => 'Pesticide Support', 'description' => 'Pest control materials and chemicals'],
            
            // Machinery & Infrastructure
            ['category' => 'Machinery & Infrastructure', 'type_name' => 'Farm Machinery', 'description' => 'Tractors, harvesters, and other equipment'],
            ['category' => 'Machinery & Infrastructure', 'type_name' => 'Post-Harvest Facility', 'description' => 'Drying, storage, and processing facilities'],
            ['category' => 'Machinery & Infrastructure', 'type_name' => 'Irrigation Support', 'description' => 'Irrigation systems and water management'],
            
            // Crop & Asset Insurance
            ['category' => 'Crop & Asset Insurance', 'type_name' => 'Free Crop Insurance', 'description' => 'Insurance coverage for crop losses'],
            ['category' => 'Crop & Asset Insurance', 'type_name' => 'Livestock Insurance', 'description' => 'Insurance for livestock and poultry'],
            
            // Training & Extension
            ['category' => 'Training & Extension', 'type_name' => 'Farmer Training (FFS)', 'description' => 'Farmer Field School training programs'],
            ['category' => 'Training & Extension', 'type_name' => 'ATI Training', 'description' => 'Agricultural Training Institute programs'],
            ['category' => 'Training & Extension', 'type_name' => 'Technology Transfer', 'description' => 'Modern farming technology adoption'],
            
            // Livelihood & Market Support
            ['category' => 'Livelihood & Market Support', 'type_name' => 'Livestock Dispersal', 'description' => 'Distribution of livestock for livelihood'],
            ['category' => 'Livelihood & Market Support', 'type_name' => 'Fishing Gear Support', 'description' => 'Fishing equipment and gear'],
            ['category' => 'Livelihood & Market Support', 'type_name' => 'Market Linkage', 'description' => 'Connecting farmers to markets'],
            
            // Special Programs
            ['category' => 'Special Programs', 'type_name' => 'Coconut Industry Support', 'description' => 'Support for coconut farmers'],
            ['category' => 'Special Programs', 'type_name' => 'SAAD Program', 'description' => 'Special Area for Agricultural Development'],
            ['category' => 'Special Programs', 'type_name' => 'Disaster Relief', 'description' => 'Emergency assistance for calamities'],
        ];

        foreach ($types as $type) {
            DB::table('assistance_types')->insert($type + ['created_at' => now()]);
        }

        $this->command->info('Assistance types seeded successfully.');
    }
}
