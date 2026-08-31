<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancialAssistance extends Model
{
    protected $table = 'financial_assistance';

    public const STATUS_DRAFT     = 'draft';
    public const STATUS_ACTIVE    = 'active';
    public const STATUS_INACTIVE  = 'inactive';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_ACTIVE,
        self::STATUS_INACTIVE,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    /**
     * Statuses the row toggle may flip. Completed and cancelled are endings —
     * reopening one is a deliberate act that belongs in the edit form, not a
     * single click in a list.
     */
    public const TOGGLEABLE = [self::STATUS_DRAFT, self::STATUS_ACTIVE, self::STATUS_INACTIVE];

    protected $fillable = [
        'program_name',
        'assistance_type_id',
        'description',
        'total_budget',
        // Per beneficiary, unlike total_budget which is the whole programme.
        'standard_cash_amount',
        'start_date',
        'end_date',
        'status',
        'created_by',
        'is_locked',
        'locked_at',
        'locked_by',
    ];

    protected $casts = [
        'total_budget' => 'decimal:2',
        'standard_cash_amount' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'is_locked' => 'boolean',
        'locked_at' => 'datetime',
    ];

    public function assistanceType(): BelongsTo
    {
        return $this->belongsTo(AssistanceType::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(AssistanceDistribution::class, 'assistance_id');
    }

    /** What this programme hands out, for material and mixed programmes. */
    public function programItems(): HasMany
    {
        return $this->hasMany(AssistanceProgramItem::class, 'assistance_id');
    }

    /** Every stock movement this programme has caused. */
    public function itemIssues(): HasMany
    {
        return $this->hasMany(InventoryDistribution::class, 'assistance_id');
    }

    /**
     * Whether the programme hands out goods. Driven by the assistance type's
     * distribution_type, with the item list as the override: a "financial"
     * type that has items attached is a mixed programme.
     */
    public function isMaterial(): bool
    {
        return $this->assistanceType?->distribution_type === 'material'
            || $this->programItems()->exists();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function locker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    /** Whether the row toggle may flip this programme's status. */
    public function canToggleStatus(): bool
    {
        return !$this->is_locked && in_array($this->status, self::TOGGLEABLE, true);
    }

    /** Draft counts as "off": the toggle turns it on. */
    public function oppositeStatus(): string
    {
        return $this->status === self::STATUS_ACTIVE
            ? self::STATUS_INACTIVE
            : self::STATUS_ACTIVE;
    }

    public function barangays(): BelongsToMany
    {
        return $this->belongsToMany(Barangay::class, 'assistance_barangays', 'assistance_id', 'barangay_id');
    }

    // Helper methods
    public function getTotalDistributedAttribute()
    {
        return $this->distributions()->sum('amount_given');
    }

    public function getBeneficiariesCountAttribute()
    {
        return $this->distributions()->distinct('farmer_id')->count('farmer_id');
    }

    public function getClaimedCountAttribute()
    {
        return $this->distributions()->where('status', 'claimed')->count();
    }

    public function getPendingCountAttribute()
    {
        return $this->distributions()->where('status', 'pending')->count();
    }
}
