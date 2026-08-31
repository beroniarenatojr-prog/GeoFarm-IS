<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssistanceType extends Model
{
    /** What a programme of this type actually hands out. */
    public const DISTRIBUTION_TYPES = ['financial', 'material', 'training', 'service'];

    /** Category given to types the office adds itself via "Other". */
    public const CUSTOM_CATEGORY = 'Other';

    protected $fillable = [
        'category',
        'type_name',
        'description',
        // Without this, a type created through "Other" would silently fall back
        // to the column default ('financial') and a material programme would
        // never offer its item list.
        'distribution_type',
    ];

    public $timestamps = false;

    public function programs(): HasMany
    {
        return $this->hasMany(FinancialAssistance::class, 'assistance_type_id');
    }
}
