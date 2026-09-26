<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One prediction, as it was made, for one cropping.
 *
 * Read only for evaluating how well the prediction logic performs. Nothing on
 * the analytics screens renders from this table — those are computed live so
 * they cannot drift from crop_seasons.
 *
 * The predicted_* columns are written once and never rewritten. See the
 * migration for why that is the whole point.
 */
class YieldPredictionSnapshot extends Model
{
    protected $fillable = [
        'parcel_id', 'farmer_id', 'crop_id',
        'cropping_year', 'season', 'barangay', 'area_planted_ha',
        'historical_average_kg', 'predicted_yield_kg',
        'predicted_low_kg', 'predicted_high_kg',
        'expected_change_pct', 'prediction_status',
        'confidence', 'data_points', 'basis',
        'methodology', 'generated_at',
        'actual_yield_kg', 'actual_recorded_at',
    ];

    protected $casts = [
        'cropping_year'         => 'integer',
        'data_points'           => 'integer',
        'area_planted_ha'       => 'decimal:2',
        'historical_average_kg' => 'decimal:2',
        'predicted_yield_kg'    => 'decimal:2',
        'predicted_low_kg'      => 'decimal:2',
        'predicted_high_kg'     => 'decimal:2',
        'expected_change_pct'   => 'decimal:2',
        'actual_yield_kg'       => 'decimal:2',
        'generated_at'          => 'datetime',
        'actual_recorded_at'    => 'datetime',
    ];

    public function parcel(): BelongsTo
    {
        return $this->belongsTo(FarmParcel::class, 'parcel_id');
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function crop(): BelongsTo
    {
        return $this->belongsTo(Crop::class);
    }

    /** Has the season this predicted actually been harvested and recorded? */
    public function isSettled(): bool
    {
        return $this->actual_yield_kg !== null;
    }

    /**
     * Predicted minus actual, in kilograms. Positive means the prediction was
     * too high. Null until the actual is known — never 0, which would read as
     * a perfect prediction.
     */
    public function errorKg(): ?float
    {
        if (! $this->isSettled() || $this->predicted_yield_kg === null) {
            return null;
        }

        return round((float) $this->predicted_yield_kg - (float) $this->actual_yield_kg, 2);
    }

    /**
     * The error as a percentage of what actually happened.
     *
     * Against the actual, not the prediction: "we were 10% over what the field
     * produced" is the question being asked. Undefined when the actual is
     * zero, which is a total crop failure and not something an error
     * percentage describes usefully.
     */
    public function errorPct(): ?float
    {
        $error = $this->errorKg();
        $actual = (float) $this->actual_yield_kg;

        if ($error === null || $actual <= 0.0) {
            return null;
        }

        return round(($error / $actual) * 100, 2);
    }
}
