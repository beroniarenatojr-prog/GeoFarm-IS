<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A completed climate and financial risk questionnaire.
 *
 * The option lists live here rather than in the migration or the controller so
 * the questionnaire, the validation and any later analysis all read the same
 * definition. Revising the instrument between research rounds means editing
 * one array, not a schema and three call sites.
 *
 * The financial figures are not on this model. They belong to the crop season
 * this assessment points at, which is where cost and income are already
 * recorded - see CropSeason::$financial_outcome.
 */
class ClimateRiskAssessment extends Model
{
    /** How often something happened over the past three years (Q2-Q5). */
    public const FREQUENCIES = ['never', 'rarely', 'sometimes', 'frequently', 'very_frequently'];

    /** Q1 - climate events experienced. */
    public const CLIMATE_EVENTS = [
        'heavy_rainfall', 'flooding', 'drought', 'extreme_heat',
        'strong_winds', 'unpredictable_rainfall', 'other', 'none',
    ];

    /** Q6 - worst effect on production. */
    public const EFFECTS = [
        'no_significant_effect', 'slight', 'moderate', 'severe', 'total_loss',
    ];

    /** Q7 - kinds of loss experienced. */
    public const LOSS_TYPES = [
        'reduced_yield', 'crop_damage', 'total_crop_loss', 'livestock_death',
        'livestock_illness', 'delayed_planting', 'delayed_harvesting',
        'additional_expenses', 'lost_income', 'other', 'none',
    ];

    /** Q8, Q9, Q16 - a plain yes/no that allows honest uncertainty. */
    public const YES_NO_UNSURE = ['yes', 'no', 'not_sure'];

    /** Q12 - this season against the last. */
    public const SEASON_COMPARISONS = [
        'much_better', 'better', 'about_the_same', 'worse', 'much_worse', 'not_sure',
    ];

    /** Q13 - adaptation practices in use. */
    public const ADAPTATION_PRACTICES = [
        'change_planting_schedule', 'change_harvesting_schedule',
        'drought_tolerant_varieties', 'flood_tolerant_varieties',
        'improve_drainage', 'use_irrigation', 'diversify_crops',
        'adjust_fertilizer', 'crop_protection', 'farm_infrastructure',
        'livestock_shelter', 'crop_insurance', 'other', 'none',
    ];

    /** Q14, Q18 - how well something worked. */
    public const EFFECTIVENESS = [
        'very_effective', 'effective', 'moderately_effective',
        'slightly_effective', 'not_effective', 'not_applicable',
    ];

    public const HELPFULNESS = [
        'very_helpful', 'helpful', 'moderately_helpful',
        'slightly_helpful', 'not_helpful', 'not_applicable',
    ];

    /** Q15 - why more is not being done. */
    public const ADAPTATION_BARRIERS = [
        'no_money', 'no_knowledge', 'no_equipment', 'no_water',
        'no_government_support', 'not_available_locally', 'not_needed',
        'other', 'not_applicable',
    ];

    /** Q17 - climate-related assistance received. */
    public const ASSISTANCE_TYPES = [
        'seeds', 'fertilizer', 'irrigation', 'crop_protection', 'financial',
        'livestock', 'training', 'disaster_recovery', 'other',
    ];

    /** Q19 - the farmer's own expectation for next season. */
    public const PERCEIVED_RISKS = [
        'very_unlikely', 'unlikely', 'moderately_likely', 'likely', 'very_likely', 'not_sure',
    ];

    /** Q20 - what the farmer thinks could cause a loss. At most three. */
    public const ANTICIPATED_FACTORS = [
        'seed_cost', 'fertilizer_cost', 'pesticide_cost', 'labour_cost',
        'transport_cost', 'low_price', 'low_yield', 'flooding', 'drought',
        'extreme_heat', 'typhoon', 'pests_disease', 'no_irrigation',
        'no_capital', 'other',
    ];

    /** Q20 asks for the main factors, not every factor. */
    public const MAX_ANTICIPATED_FACTORS = 3;

    /**
     * Selecting this alongside anything else contradicts itself: a farmer has
     * either experienced no events or some, not both.
     */
    public const EXCLUSIVE_CHOICE = 'none';

    /** After this long an assessment no longer describes current conditions. */
    public const STALE_AFTER_MONTHS = 12;

    protected $fillable = [
        'farmer_id', 'farm_parcel_id', 'crop_season_id', 'assessed_by', 'assessed_at',
        'climate_events', 'flood_frequency', 'drought_frequency', 'heat_frequency', 'storm_frequency',
        'worst_effect', 'loss_types', 'had_financial_loss', 'estimated_loss_amount',
        'had_cost_increase', 'estimated_extra_cost', 'season_comparison',
        'adaptation_practices', 'adaptation_effectiveness', 'adaptation_barrier',
        'received_assistance', 'assistance_types', 'assistance_helpfulness',
        'perceived_risk', 'anticipated_factors',
    ];

    protected $casts = [
        'assessed_at'          => 'datetime',
        'climate_events'       => 'array',
        'loss_types'           => 'array',
        'adaptation_practices' => 'array',
        'assistance_types'     => 'array',
        'anticipated_factors'  => 'array',
    ];

    protected $appends = ['is_stale'];

    /**
     * Whether this assessment is old enough that conditions may have moved on.
     *
     * Drives the portal's "Assessment Needs Updating" state. Derived rather
     * than stored, because staleness is a function of today's date - a stored
     * flag would be wrong the day after it was written.
     */
    public function getIsStaleAttribute(): bool
    {
        return $this->assessed_at !== null
            && $this->assessed_at->lt(now()->subMonths(self::STALE_AFTER_MONTHS));
    }

    public function farmer(): BelongsTo     { return $this->belongsTo(Farmer::class); }
    public function parcel(): BelongsTo     { return $this->belongsTo(FarmParcel::class, 'farm_parcel_id'); }
    public function season(): BelongsTo     { return $this->belongsTo(CropSeason::class, 'crop_season_id'); }
    public function assessor(): BelongsTo   { return $this->belongsTo(User::class, 'assessed_by'); }
}
