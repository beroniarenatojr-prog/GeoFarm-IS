<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Crop extends Model
{
    public $timestamps = false;
    protected $fillable = [
        'crop_name',
        'category',
        'seeding_rate_kg_per_ha',
        'fertilizer_bags_per_ha',
        'optimal_temp_min',
        'optimal_temp_max',
        'optimal_rainfall_min',
        'optimal_rainfall_max',
        'soil_ph_min',
        'soil_ph_max',
    ];
}
