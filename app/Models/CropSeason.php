<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CropSeason extends Model
{
    /** What fertilizer_class accepts. */
    public const FERTILIZER_CLASSES = ['organic', 'inorganic', 'mixed'];

    /**
     * How a season ended financially.
     *
     * Named on the season, never on the farmer: the same farmer can profit in
     * the dry season and lose in the wet, so "palugi" describes a cropping,
     * not a person.
     */
    public const OUTCOME_PROFITABLE = 'profitable';
    public const OUTCOME_BREAK_EVEN = 'break_even';
    public const OUTCOME_LOSS       = 'loss';

    /** The two croppings a parcel's schedule can open. */
    public const SEASON_WET = 'wet';
    public const SEASON_DRY = 'dry';

    protected $fillable = [
        'parcel_id','season','cropping_year','crop_id',
        'area_planted_ha','planting_date','harvest_date','yield_kg','inputs_used',
        'production_unit','selling_price',
        'production_cost','labor_cost','other_cost','total_income',
        'fertilizer_type','fertilizer_qty_kg','fertilizer_class','is_organic',
    ];

    protected $casts = [
        'inputs_used'   => 'array',
        'planting_date' => 'date',
        'harvest_date'  => 'date',
        'is_organic'    => 'boolean',
    ];

    /** Derived figures travel with the row so the table need not recompute them. */
    protected $appends = [
        'cost_per_kg', 'cost_per_hectare', 'net_farm_income', 'financial_outcome',
        'gross_revenue', 'inputs_cost', 'input_cost_breakdown', 'grown_organically',
    ];

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
     * What the season cleared: income less what it cost to produce.
     *
     * Derived rather than stored, for the same reason as cost per kilo - a
     * saved figure would disagree with its own income and cost the moment
     * either is corrected.
     *
     * Null until BOTH are recorded. A half-encoded season is not break-even,
     * and an unrecorded income is not zero: reading absent as zero would
     * report a loss for every record the office has not finished entering.
     */
    public function getNetFarmIncomeAttribute(): ?float
    {
        if ($this->total_income === null || $this->production_cost === null) {
            return null;
        }

        return round((float) $this->total_income - (float) $this->production_cost, 2);
    }

    /**
     * Whether the season made money, broke even, or lost - "palugi".
     *
     * This is the historical outcome the risk model will later be trained and
     * measured against, so it is computed from recorded figures alone and
     * carries no judgement of its own.
     */
    public function getFinancialOutcomeAttribute(): ?string
    {
        $net = $this->net_farm_income;

        if ($net === null) {
            return null;
        }

        return match (true) {
            $net > 0  => self::OUTCOME_PROFITABLE,
            $net < 0  => self::OUTCOME_LOSS,
            default   => self::OUTCOME_BREAK_EVEN,
        };
    }

    /** Seasons that lost money, for the risk work and for MAO reporting. */
    public function scopeAtALoss($query)
    {
        return $query->whereNotNull('total_income')
            ->whereNotNull('production_cost')
            ->whereColumn('total_income', '<', 'production_cost');
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

    /**
     * What the harvest sold for.
     *
     * total_income is the stored answer and stays authoritative — the risk
     * scorer, net_farm_income and the palugi classification all read it, and a
     * second revenue column could only disagree with the first. This falls
     * back to quantity x price for a row where staff recorded the price but no
     * total, so the figure appears rather than reading as an empty cell.
     */
    public function getGrossRevenueAttribute(): ?float
    {
        if ($this->total_income !== null) {
            return round((float) $this->total_income, 2);
        }

        if ($this->yield_kg === null || $this->selling_price === null) {
            return null;
        }

        return round((float) $this->yield_kg * (float) $this->selling_price, 2);
    }

    /** What the itemised inputs cost, all categories together. */
    public function getInputsCostAttribute(): ?float
    {
        if (!$this->relationLoaded('inputs') && !$this->exists) {
            return null;
        }

        $inputs = $this->inputs;

        return $inputs->isEmpty() ? null : round((float) $inputs->sum('cost'), 2);
    }

    /**
     * Input cost per RSBSA reporting line.
     *
     * Summed from the input rows rather than stored as its own columns: a
     * fertilizer_cost column beside a list of fertilizers is two answers to
     * one question, and they drift the first time a row is corrected.
     */
    public function getInputCostBreakdownAttribute(): array
    {
        if (!$this->relationLoaded('inputs') && !$this->exists) {
            return [];
        }

        $inputs = $this->inputs;

        $sum = fn (array $types) => round(
            (float) $inputs->whereIn('input_type', $types)->sum('cost'),
            2,
        );

        return [
            'seed'       => $sum(['seed']),
            'fertilizer' => $sum(['fertilizer']),
            'chemical'   => $sum(SeasonalInput::CHEMICAL_TYPES),
            'other'      => $sum(['fuel', 'other']),
            'labor'      => round((float) ($this->labor_cost ?? 0), 2),
            'expenses'   => round((float) ($this->other_cost ?? 0), 2),
        ];
    }

    /**
     * Everything this cropping cost, from its own parts.
     *
     * Used to keep production_cost in step when staff itemise. Null when
     * nothing has been itemised, so a season costed as a single figure is left
     * exactly as the office entered it.
     */
    public function costFromParts(): ?float
    {
        $inputs = $this->inputs()->sum('cost');
        $labor  = $this->labor_cost;
        $other  = $this->other_cost;

        if (!$inputs && $labor === null && $other === null) {
            return null;
        }

        return round((float) $inputs + (float) $labor + (float) $other, 2);
    }

    /**
     * Whether this cropping was grown organically.
     *
     * Answered on the season first, because practice changes between them — a
     * farmer can crop organically in the wet season and not in the dry. Falls
     * back to the parcel's standing answer for every row encoded before the
     * season carried its own.
     */
    public function getGrownOrganicallyAttribute(): ?bool
    {
        return $this->is_organic ?? $this->parcel?->is_organic;
    }

    public function parcel() { return $this->belongsTo(FarmParcel::class, 'parcel_id'); }

    public function crop()   { return $this->belongsTo(Crop::class); }

    /** Fertilizer, chemicals and seed actually applied — many per season. */
    public function inputs()
    {
        return $this->hasMany(SeasonalInput::class, 'crop_season_id');
    }
}
