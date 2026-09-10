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

        // The Viewer account went with the role it held.

        $this->command->info('Test users created:');
        $this->command->info('Staff: staff@geofarm.test / password');
    }
}
