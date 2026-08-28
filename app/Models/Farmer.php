<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Farmer extends Model
{
    /** Self-registered online, waiting for staff to verify documents in person. */
    public const STATUS_PENDING = 'pending';

    /** Documents checked by staff. Only these count as real farmers. */
    public const STATUS_VERIFIED = 'verified';

    /** Staff rejected the submission. Kept for audit, excluded from the registry. */
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'rsbsa_no','first_name','last_name','middle_name','suffix','birthdate','birthplace',
        'sex','civil_status','mobile_no','email','religion','pwd','is_4ps','is_indigenous',
        'mother_maiden_name','highest_education','photo_path','qr_code_path',
        'barangay','city_municipality','province','risk_status','risk_updated_at',
        'user_id',
        // Verification workflow
        'verification_status','reference_code','submitted_online_at',
        'verified_at','verified_by','rejection_reason',
        // RSBSA Additional Fields
        'birth_city_municipality','birth_province','mother_first_name','mother_middle_name','mother_last_name',
        'valid_id_type','id_number','house_lot_number','street_sitio','region',
        'indigenous_community','organization_name','organization_name_2','organization_name_3',
        'livelihood_type','id_proof_path',
        // Provincial Address (for NCR residents)
        'provincial_house_lot','provincial_street_sitio','provincial_barangay',
        'provincial_city_municipality','provincial_province','provincial_region',
    ];

    protected $casts = [
        'pwd' => 'boolean',
        'is_4ps' => 'boolean',
        'is_indigenous' => 'boolean',
        'birthdate' => 'date:Y-m-d',
        'submitted_online_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    /** Only verified farmers belong in the registry, reports and GIS layers. */
    public function scopeVerified($query)
    {
        return $query->where('verification_status', self::STATUS_VERIFIED);
    }

    /** Online submissions awaiting staff verification. */
    public function scopePending($query)
    {
        return $query->where('verification_status', self::STATUS_PENDING);
    }

    public function isPending(): bool
    {
        return $this->verification_status === self::STATUS_PENDING;
    }

    public function isVerified(): bool
    {
        return $this->verification_status === self::STATUS_VERIFIED;
    }

    public function user()                    { return $this->belongsTo(User::class); }
    public function verifier()                { return $this->belongsTo(User::class, 'verified_by'); }

    public function parcels(): HasMany        { return $this->hasMany(FarmParcel::class); }
    public function livestock(): HasMany      { return $this->hasMany(Livestock::class); }
    public function distributions(): HasMany  { return $this->hasMany(AssistanceDistribution::class); }
    public function associations()            { return $this->belongsToMany(Association::class, 'farmer_associations'); }
    
    // Agricultural Assets
    public function treeCrops(): HasMany      { return $this->hasMany(TreeCrop::class); }
    public function fishponds(): HasMany      { return $this->hasMany(Fishpond::class); }
    public function largeRuminants(): HasMany { return $this->hasMany(LargeRuminant::class); }
    public function smallRuminants(): HasMany { return $this->hasMany(SmallRuminant::class); }
    public function nativePigs(): HasMany     { return $this->hasMany(NativePig::class); }
    public function swineHybrid(): HasMany    { return $this->hasMany(SwineHybrid::class); }
    public function poultry(): HasMany        { return $this->hasMany(Poultry::class); }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->middle_name} {$this->last_name} {$this->suffix}");
    }
}
