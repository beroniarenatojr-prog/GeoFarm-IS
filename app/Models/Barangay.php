<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Barangay extends Model
{
    protected $fillable = [
        'name',
        'municipality',
        'province',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * The barangays currently on the official list.
     *
     * BarangaySeeder retires a name by setting is_active = false rather than
     * deleting the row, because barangay_boundaries and assistance_barangays
     * both cascade on delete — removing a row would silently take a drawn
     * boundary or a programme's targeting with it. That only works if readers
     * honour the flag: the public landing page did not, and reported every
     * retired name as though it were a barangay of Tumauini.
     *
     * Use this scope rather than repeating the where clause, so a reader
     * cannot forget it again.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function assistancePrograms(): BelongsToMany
    {
        return $this->belongsToMany(FinancialAssistance::class, 'assistance_barangays', 'barangay_id', 'assistance_id');
    }
}
