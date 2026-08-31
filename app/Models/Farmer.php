<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Farmer extends Model
{
    /** Self-registered online, waiting for staff to verify documents in person. */
    public const STATUS_PENDING = 'pending';

    /** Documents checked by staff. Only these count as real farmers. */
    public const STATUS_VERIFIED = 'verified';

    /** Staff rejected the submission. Kept for audit, excluded from the registry. */
    public const STATUS_REJECTED = 'rejected';

    /**
     * The RSBSA reference number, exactly as the registry writes it:
     * 00-00-00-000-00000 — region, province, municipality, barangay, then the
     * farmer's sequence. Fourteen digits, four hyphens, nothing else.
     */
    public const RSBSA_REGEX = '/^\d{2}-\d{2}-\d{2}-\d{3}-\d{5}$/';
    public const RSBSA_RULE = 'regex:' . self::RSBSA_REGEX;
    public const RSBSA_MASK = '00-00-00-000-00000';

    /** Philippine mobile number as dialled locally: 09 then nine more digits. */
    public const MOBILE_REGEX = '/^09\d{9}$/';
    public const MOBILE_RULE = 'regex:' . self::MOBILE_REGEX;
    public const MOBILE_MASK = '09000000000';

    /**
     * Laravel's default regex message ("format is invalid") tells a clerk
     * nothing, so both rules say what the format actually is.
     */
    public const FORMAT_MESSAGES = [
        'rsbsa_no.regex'  => 'The RSBSA number must be written as ' . self::RSBSA_MASK
            . ' — 14 digits with the hyphens.',
        'mobile_no.regex' => 'The mobile number must be 11 digits starting with 09, like '
            . self::MOBILE_MASK . '.',
    ];

    /** Whether a value already matches the registry format. */
    public static function isValidRsbsa(?string $value): bool
    {
        return $value !== null && $value !== '' && (bool) preg_match(self::RSBSA_REGEX, $value);
    }

    public static function isValidMobile(?string $value): bool
    {
        return $value !== null && $value !== '' && (bool) preg_match(self::MOBILE_REGEX, $value);
    }

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

    /** Accessors are not serialized unless appended, and the UI reads full_name. */
    protected $appends = ['full_name'];

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
    public function machinery(): HasMany      { return $this->hasMany(FarmMachinery::class); }

    /**
     * Crop seasons reach a farmer through their parcels — crop_seasons has no
     * farmer_id of its own, because a season is always planted on a parcel.
     */
    public function cropSeasons(): HasManyThrough
    {
        return $this->hasManyThrough(CropSeason::class, FarmParcel::class, 'farmer_id', 'parcel_id');
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->middle_name} {$this->last_name} {$this->suffix}");
    }
}
