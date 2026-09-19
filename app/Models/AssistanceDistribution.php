<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssistanceDistribution extends Model
{
    protected $fillable = [
        'assistance_id',
        'farmer_id',
        /*
         * These two were missing.
         *
         * The columns, the foreign keys and the intervention()/parcel()
         * relations below have existed since the workflow migration, but
         * neither name was fillable — so create() and fill() dropped them in
         * silence and every release was recorded unlinked, however carefully
         * the caller passed them. That is why no distribution in the registry
         * points at the intervention that authorised it.
         */
        'intervention_id',
        'farm_parcel_id',
        'distribution_date',
        'quantity_given',
        'amount_given',
        'status',
        // The office's own reference from the voucher or release slip.
        'reference_no',
        'is_customized',
        'customization_reason',
        'notes',
    ];

    protected $casts = [
        'distribution_date' => 'date',
        'quantity_given' => 'decimal:2',
        'amount_given' => 'decimal:2',
        'is_customized' => 'boolean',
    ];

    public $timestamps = false;

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            $model->created_at = now();
        });

        // Record when a distribution is updated — e.g. marking pending → claimed.
        static::updating(function ($model) {
            $model->updated_at = now();
        });
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(FinancialAssistance::class, 'assistance_id');
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    /**
     * The goods issued as part of this payout. Empty for cash-only assistance.
     * These rows are the actual stock movements — deleting this payout takes
     * them with it, which is why returning the stock has to happen first.
     */
    public function itemIssues(): HasMany
    {
        return $this->hasMany(InventoryDistribution::class, 'assistance_distribution_id');
    }

    /**
     * The office visit this hand-out came out of, when it came out of one.
     *
     * Nullable and expected to be: most assistance has no intervention behind
     * it — a farmer can simply be on a programme.
     */
    public function intervention(): BelongsTo
    {
        return $this->belongsTo(AgriculturalIntervention::class, 'intervention_id');
    }

    /** The holding the support was for. Null for cash paid to the farmer. */
    public function parcel(): BelongsTo
    {
        return $this->belongsTo(FarmParcel::class, 'farm_parcel_id');
    }

    /** Checks scheduled to see what the assistance achieved. */
    public function followUps(): HasMany
    {
        return $this->hasMany(FollowUp::class, 'assistance_distribution_id');
    }
}
