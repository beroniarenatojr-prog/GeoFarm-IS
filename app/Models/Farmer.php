<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Farmer extends Model
{
    protected $fillable = [
        'rsbsa_no','first_name','last_name','middle_name','suffix','birthdate','birthplace',
        'sex','civil_status','mobile_no','email','religion','pwd','is_4ps',
        'mother_maiden_name','highest_education','photo_path','qr_code_path',
        'barangay','city_municipality','province','risk_status','risk_updated_at',
    ];

    protected $casts = ['pwd' => 'boolean', 'is_4ps' => 'boolean', 'birthdate' => 'date'];

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
