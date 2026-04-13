<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUsersSeeder extends Seeder
{
    public function run(): void
    {
        // Create a regular Admin user for testing
        $admin = User::firstOrCreate(
            ['email' => 'admin@geofarm.test'],
            [
                'name' => 'Regular Admin',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        
        if (!$admin->hasRole('Admin')) {
            $admin->syncRoles(['Admin']);
        }

        $this->command->info('Test Admin users created:');
        $this->command->info('Regular Admin: admin@geofarm.test / password');
    }
}
