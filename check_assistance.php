<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\AssistanceDistribution;
use App\Models\FinancialAssistance;

echo "Financial Assistance Programs:\n";
$programs = FinancialAssistance::all();
foreach ($programs as $prog) {
    echo "  ID: {$prog->id} - Name: {$prog->name} - Type: {$prog->type}\n";
}

echo "\n\nAssistance Distributions:\n";
$distributions = AssistanceDistribution::with('program')->get();
foreach ($distributions as $dist) {
    echo "  ID: {$dist->id}\n";
    echo "  Assistance ID: {$dist->assistance_id}\n";
    echo "  Farmer ID: {$dist->farmer_id}\n";
    echo "  Amount: {$dist->amount_given}\n";
    echo "  Program loaded: " . ($dist->program ? $dist->program->name : 'NULL') . "\n\n";
}
