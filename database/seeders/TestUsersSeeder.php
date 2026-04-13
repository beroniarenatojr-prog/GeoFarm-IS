<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class TestUsersSeeder extends Seeder
{
    public function run(): void
    {
        // Create Staff user
        $staff = User::firstOrCreate(
            ['email' => 'staff@geofarm.test'],
            [
                'name' => 'Staff User',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        
        if (!$staff->hasRole('Staff')) {
            $staff->assignRole('Staff');
        }

        // Create Viewer user
        $viewer = User::firstOrCreate(
            ['email' => 'viewer@geofarm.test'],
            [
                'name' => 'Viewer User',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        
        if (!$viewer->hasRole('Viewer')) {
            $viewer->assignRole('Viewer');
        }

        $this->command->info('Test users created:');
        $this->command->info('Staff: staff@geofarm.test / password');
        $this->command->info('Viewer: viewer@geofarm.test / password');
    }
}
