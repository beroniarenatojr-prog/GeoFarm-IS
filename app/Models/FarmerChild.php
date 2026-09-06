<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FarmerChild extends Model
{
    /**
     * Named explicitly rather than left to Eloquent's inflector, which turns
     * "FarmerChild" into "farmer_children" only because it knows this
     * particular irregular plural. Too subtle to rely on.
     */
    protected $table = 'farmer_children';

    protected $fillable = ['farmer_id', 'name', 'birthdate'];

    protected $casts = ['birthdate' => 'date'];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
