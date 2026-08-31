<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FarmMachinery extends Model
{
    protected $table = 'farm_machinery';

    public const TYPES = [
        'Hand Tractor', 'Four-Wheel Tractor', 'Thresher', 'Rice Mill', 'Corn Mill',
        'Harvester', 'Water Pump', 'Sprayer', 'Dryer', 'Shredder', 'Other',
    ];

    public const ACQUISITION = ['purchased', 'donated', 'loaned', 'inherited'];

    public const STATUSES = ['active', 'for_repair', 'decommissioned'];

    protected $fillable = [
        'farmer_id',
        'machinery_type',
        'brand',
        'model',
        'serial_number',
        'engine_number',
        'year_acquired',
        'acquisition_type',
        'status',
        'notes',
    ];

    protected $casts = [
        'year_acquired' => 'integer',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    /** Years since acquisition, for replacement planning. */
    public function getAgeYearsAttribute(): ?int
    {
        return $this->year_acquired ? max(0, (int) date('Y') - $this->year_acquired) : null;
    }
}
