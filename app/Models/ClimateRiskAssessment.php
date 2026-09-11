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
    /**
     * What this assessment is about.
     *
     * A farmer works several activities and each meets the weather
     * differently. A rice grower's "no water" barrier is about irrigation; the
     * same words against a carabao are about drinking water, and they call for
     * different advice and a different visit. Recording which activity was
     * being described is what stops one answer being counted against all of
     * them — which is exactly what happened before this existed.
     *
     * SCOPE_LIVESTOCK points at farm_parcel_id rather than at a column of its
     * own: a livestock holding is declared on farm_parcels with a commodity, a
     * barangay and a head count, and a second reference to the same thing
     * would create two answers to "which herd is this".
     */
    public const SCOPE_FARMER      = 'farmer';
    public const SCOPE_PARCEL      = 'parcel';
    public const SCOPE_LIVESTOCK   = 'livestock';
    public const SCOPE_AQUACULTURE = 'aquaculture';

    public const SCOPES = [
        self::SCOPE_FARMER,
        self::SCOPE_PARCEL,
        self::SCOPE_LIVESTOCK,
        self::SCOPE_AQUACULTURE,
    ];

    /** Scopes that name one activity rather than the whole holding. */
    public const ACTIVITY_SCOPES = [
        self::SCOPE_PARCEL,
        self::SCOPE_LIVESTOCK,
        self::SCOPE_AQUACULTURE,
    ];

    /**
     * Which answers a question offers, per activity.
     *
     * The columns are the same for every scope — "what losses did you have"
     * fits a field, a herd and a pond alike — but the ANSWERS are not. Asking
     * a carabao owner about seed cost, or a fishpond operator about their
     * planting schedule, is how a questionnaire teaches people it was not
     * written for them.
     *
     * Listed here rather than in the page, because the server has to enforce
     * the same narrowing. A form that merely hid seed cost from a livestock
     * assessment would still store it for anyone who posted it directly, and
     * the whole point of scoping is that a livestock record holds livestock
     * answers.
     *
     * A question absent from a scope's map offers its full list. A question in
     * that scope's 'hidden' list is not asked at all.
     */
    public const SCOPE_OPTIONS = [

        self::SCOPE_LIVESTOCK => [
            'loss_types' => [
                'livestock_death', 'livestock_illness',
                'additional_expenses', 'lost_income', 'other', 'none',
            ],
            'adaptation_practices' => [
                'livestock_shelter', 'improve_drainage', 'use_irrigation',
                'crop_insurance', 'farm_infrastructure', 'other', 'none',
            ],
            'anticipated_factors' => [
                'labour_cost', 'transport_cost', 'low_price',
                'extreme_heat', 'typhoon', 'flooding', 'drought',
                'pests_disease', 'no_irrigation', 'no_capital', 'other',
            ],
            // A cropping season is not a unit of livestock keeping.
            'hidden' => ['season_comparison'],
        ],

        self::SCOPE_AQUACULTURE => [
            'loss_types' => [
                'total_crop_loss', 'reduced_yield',
                'additional_expenses', 'lost_income', 'other', 'none',
            ],
            'adaptation_practices' => [
                'improve_drainage', 'use_irrigation', 'farm_infrastructure',
                'crop_insurance', 'other', 'none',
            ],
            'anticipated_factors' => [
                'labour_cost', 'transport_cost', 'low_price',
                'extreme_heat', 'typhoon', 'flooding', 'drought',
                'pests_disease', 'no_irrigation', 'no_capital', 'other',
            ],
            'hidden' => ['season_comparison'],
        ],
    ];

    /**
     * The answers one question may take under one scope.
     *
     * @param  array<int, string>  $full  the question's complete option list
     * @return array<int, string>
     */
    public static function optionsFor(string $scope, string $question, array $full): array
    {
        $narrowed = self::SCOPE_OPTIONS[$scope][$question] ?? null;

        return $narrowed === null ? $full : array_values(array_intersect($full, $narrowed));
    }

    /** Questions this scope does not ask at all. */
    public static function hiddenFor(string $scope): array
    {
        return self::SCOPE_OPTIONS[$scope]['hidden'] ?? [];
    }

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
        'farmer_id', 'scope_type', 'farm_parcel_id', 'fishpond_id', 'crop_season_id',
        'assessed_by', 'assessed_at',
        'climate_events', 'flood_frequency', 'drought_frequency', 'heat_frequency', 'storm_frequency',
        'worst_effect', 'loss_types', 'had_financial_loss', 'estimated_loss_amount',
        'had_cost_increase', 'estimated_extra_cost', 'season_comparison',
        'adaptation_practices', 'adaptation_effectiveness', 'adaptation_barrier',
        'received_assistance', 'assistance_types', 'assistance_helpfulness',
        'perceived_risk', 'anticipated_factors',
        'risk_level', 'risk_score', 'risk_factors', 'scoring_version', 'recommendations',
    ];

    protected $casts = [
        'assessed_at'          => 'datetime',
        'climate_events'       => 'array',
        'loss_types'           => 'array',
        'adaptation_practices' => 'array',
        'assistance_types'     => 'array',
        'anticipated_factors'  => 'array',
        'risk_factors'         => 'array',
        'recommendations'      => 'array',
    ];

    protected $appends = ['is_stale', 'is_scoped', 'scope_label'];

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

    /**
     * The newest assessment that legitimately describes one activity.
     *
     * Preference, not merger: an assessment written about this very parcel
     * beats a whole-farm one, and when neither exists the answer is none. The
     * farmer-level fallback is deliberate and narrow — a farmer who has only
     * ever taken the general assessment should still get an analysis, and
     * before scoping existed that is what every assessment was.
     *
     * What it will NOT do is reach sideways. Another parcel's assessment, or a
     * livestock assessment, never stands in for this one: those answers
     * describe different land and different animals, and lending them across
     * is the precise fault scoping was added to fix.
     *
     * @param  string  $scope     one of ACTIVITY_SCOPES
     * @param  int|null  $parcelId    for parcel and livestock scopes
     * @param  int|null  $fishpondId  for aquaculture
     */
    public static function bestFor(
        int $farmerId,
        string $scope,
        ?int $parcelId = null,
        ?int $fishpondId = null,
    ): ?self {
        $specific = static::query()
            ->where('farmer_id', $farmerId)
            ->where('scope_type', $scope)
            ->when($scope === self::SCOPE_AQUACULTURE,
                fn ($q) => $q->where('fishpond_id', $fishpondId),
                fn ($q) => $q->where('farm_parcel_id', $parcelId),
            )
            ->latest('assessed_at')
            ->first();

        if ($specific) {
            return $specific;
        }

        return static::query()
            ->where('farmer_id', $farmerId)
            ->where('scope_type', self::SCOPE_FARMER)
            ->latest('assessed_at')
            ->first();
    }

    /** Whether this assessment was written about one named activity. */
    public function getIsScopedAttribute(): bool
    {
        return in_array($this->scope_type, self::ACTIVITY_SCOPES, true);
    }

    /**
     * How the analysis names the assessment it used.
     *
     * Shown on the page so a reader can tell whether a result rests on an
     * assessment of this very activity or on the farmer's general one.
     */
    public function getScopeLabelAttribute(): string
    {
        return match ($this->scope_type) {
            self::SCOPE_PARCEL      => 'Crop Parcel Assessment',
            self::SCOPE_LIVESTOCK   => 'Livestock Assessment',
            self::SCOPE_AQUACULTURE => 'Aquaculture Assessment',
            default                 => 'Whole-Farm Assessment',
        };
    }

    public function farmer(): BelongsTo     { return $this->belongsTo(Farmer::class); }
    public function fishpond(): BelongsTo   { return $this->belongsTo(Fishpond::class); }
    public function parcel(): BelongsTo     { return $this->belongsTo(FarmParcel::class, 'farm_parcel_id'); }
    public function season(): BelongsTo     { return $this->belongsTo(CropSeason::class, 'crop_season_id'); }
    public function assessor(): BelongsTo   { return $this->belongsTo(User::class, 'assessed_by'); }
}
