<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CropSeason extends Model
{
    /** What fertilizer_class accepts. */
    public const FERTILIZER_CLASSES = ['organic', 'inorganic', 'mixed'];

    protected $fillable = [
        'parcel_id','season','cropping_year','crop_id',
        'area_planted_ha','planting_date','harvest_date','yield_kg','inputs_used',
        'production_cost','fertilizer_type','fertilizer_qty_kg','fertilizer_class',
    ];

    protected $casts = ['inputs_used' => 'array', 'planting_date' => 'date', 'harvest_date' => 'date'];

    /** Derived costs travel with the row so the table need not recompute them. */
    protected $appends = ['cost_per_kg', 'cost_per_hectare'];

    /**
     * What it cost to produce a kilo of this harvest.
     *
     * Derived, never stored: a saved figure would disagree with its own cost
     * and yield the moment either is corrected. Null until BOTH are known —
     * a cost with no harvest yet has no per-kilo answer, and dividing by a
     * zero yield would report infinity as though it were a price.
     */
    public function getCostPerKgAttribute(): ?float
    {
        if ($this->production_cost === null || !$this->yield_kg) {
            return null;
        }

        return round((float) $this->production_cost / (float) $this->yield_kg, 2);
    }

    /** Cost of working one hectare this season, for comparing parcels. */
    public function getCostPerHectareAttribute(): ?float
    {
        if ($this->production_cost === null || !$this->area_planted_ha) {
            return null;
        }

        return round((float) $this->production_cost / (float) $this->area_planted_ha, 2);
    }

    /**
     * Only seasons on parcels belonging to verified farmers.
     *
     * Self-registered farmers awaiting verification must not influence
     * forecasts or municipal statistics - their data has not been checked.
     */
    public function scopeForVerifiedFarmers($query)
    {
        return $query->whereHas(
            'parcel.farmer',
            fn ($q) => $q->where('verification_status', Farmer::STATUS_VERIFIED)
        );
    }

    public function parcel() { return $this->belongsTo(FarmParcel::class, 'parcel_id'); }

    public function crop()   { return $this->belongsTo(Crop::class); }
}
