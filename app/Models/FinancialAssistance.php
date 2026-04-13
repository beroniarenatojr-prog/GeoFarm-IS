<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancialAssistance extends Model
{
    protected $table = 'financial_assistance';

    protected $fillable = [
        'program_name',
        'assistance_type_id',
        'description',
        'total_budget',
        'start_date',
        'end_date',
        'status',
        'created_by',
    ];

    protected $casts = [
        'total_budget' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function assistanceType(): BelongsTo
    {
        return $this->belongsTo(AssistanceType::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(AssistanceDistribution::class, 'assistance_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
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
