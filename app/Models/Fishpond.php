<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Fishpond extends Model
{
    protected $fillable = [
        'farmer_id',
        'pond_type',
        'species',
        'area_hectares',
        'stocking_density',
        'estimated_population',
        'harvest_cycle_months',
        'last_harvest',
        'next_harvest',
        'notes',
    ];

    protected $casts = [
        'area_hectares'        => 'decimal:2',
        'stocking_density'     => 'decimal:2',
        'estimated_population' => 'integer',
        'harvest_cycle_months' => 'integer',
        'last_harvest'         => 'date:Y-m-d',
        'next_harvest'         => 'date:Y-m-d',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    /**
     * Population the operator has not measured can be estimated from the
     * stocked density, which is what they usually do know.
     * 1 ha = 10,000 sq m.
     */
    public function projectedPopulation(): ?int
    {
        if ($this->estimated_population) {
            return $this->estimated_population;
        }

        return $this->stocking_density && $this->area_hectares
            ? (int) round((float) $this->stocking_density * (float) $this->area_hectares * 10000)
            : null;
    }
}
