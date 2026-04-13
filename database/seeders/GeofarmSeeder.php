<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class GeofarmSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('farm_types')->insertOrIgnore([
            ['type_name' => 'Irrigated',   'description' => 'Farm with irrigation system'],
            ['type_name' => 'Rainfed',     'description' => 'Dependent on rainfall'],
            ['type_name' => 'Upland',      'description' => 'Hilly or mountainous area'],
            ['type_name' => 'Lowland',     'description' => 'Flat low-lying area'],
            ['type_name' => 'Aquaculture', 'description' => 'Fish pond or cage'],
        ]);

        DB::table('crops')->insertOrIgnore([
            ['crop_name' => 'Rice',      'category' => 'Cereal'],
            ['crop_name' => 'Corn',      'category' => 'Cereal'],
            ['crop_name' => 'Sugarcane', 'category' => 'Cash crop'],
            ['crop_name' => 'Mungbean',  'category' => 'Legume'],
            ['crop_name' => 'Soybean',   'category' => 'Legume'],
            ['crop_name' => 'Wheat',     'category' => 'Cereal'],
            ['crop_name' => 'Tomato',    'category' => 'Vegetable'],
            ['crop_name' => 'Eggplant',  'category' => 'Vegetable'],
            ['crop_name' => 'Coconut',   'category' => 'Tree crop'],
            ['crop_name' => 'Banana',    'category' => 'Fruit'],
        ]);

        DB::table('livestock_types')->insertOrIgnore([
            ['type_name' => 'Cattle',  'category' => 'Large ruminant'],
            ['type_name' => 'Carabao', 'category' => 'Large ruminant'],
            ['type_name' => 'Goat',    'category' => 'Small ruminant'],
            ['type_name' => 'Sheep',   'category' => 'Small ruminant'],
            ['type_name' => 'Swine',   'category' => 'Pig'],
            ['type_name' => 'Chicken', 'category' => 'Poultry'],
            ['type_name' => 'Duck',    'category' => 'Poultry'],
            ['type_name' => 'Turkey',  'category' => 'Poultry'],
        ]);

        DB::table('associations')->insertOrIgnore([
            ['association_name' => 'San Jose Farmers Cooperative'],
            ['association_name' => 'Sta. Cruz Irrigators Association'],
            ['association_name' => 'Sto. Niño Vegetable Growers'],
            ['association_name' => 'Tumauini Rice Producers'],
        ]);

        // Default admin user — role assigned via RolePermissionSeeder
        DB::table('users')->insertOrIgnore([
            [
                'name'     => 'Administrator',
                'email'    => 'admin@geofarm.local',
                'password' => Hash::make('password'),
            ],
        ]);
    }
}
