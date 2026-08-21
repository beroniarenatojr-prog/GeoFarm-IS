<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Farmer;

$farmer = Farmer::where('rsbsa_no', '12345')->with('distributions.program')->first();

if ($farmer) {
    echo "Farmer found: {$farmer->first_name} {$farmer->last_name}\n";
    echo "Distributions count: " . $farmer->distributions->count() . "\n\n";
    
    if ($farmer->distributions->count() > 0) {
        echo "Distributions:\n";
        foreach ($farmer->distributions as $dist) {
            echo "  - ID: {$dist->id}\n";
            echo "    Program: " . ($dist->program->name ?? 'N/A') . "\n";
            echo "    Amount Given: " . ($dist->amount_given ?? 'NULL') . "\n";
            echo "    Date: {$dist->distribution_date}\n";
            echo "    Program Type: " . ($dist->program->type ?? 'N/A') . "\n\n";
        }
    } else {
        echo "No distributions found for this farmer.\n";
    }
} else {
    echo "Farmer with RSBSA 12345 not found.\n";
}
