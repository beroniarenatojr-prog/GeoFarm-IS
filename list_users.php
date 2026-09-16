<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$users = App\Models\User::with('roles')->get();

echo "Total Users: " . $users->count() . "\n\n";
echo str_pad("ID", 5) . " | " . str_pad("Name", 30) . " | " . str_pad("Email", 35) . " | " . "Roles\n";
echo str_repeat("-", 100) . "\n";

foreach ($users as $user) {
    $roles = $user->roles->pluck('name')->implode(', ');
    echo str_pad($user->id, 5) . " | " . 
         str_pad($user->name, 30) . " | " . 
         str_pad($user->email, 35) . " | " . 
         $roles . "\n";
}
