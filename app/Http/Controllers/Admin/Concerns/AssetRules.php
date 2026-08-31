<?php

namespace App\Http\Controllers\Admin\Concerns;

/**
 * Validation shared by the RSBSA asset controllers.
 *
 * These five animal tables (poultry, large/small ruminants, native pigs and
 * hybrid swine) carry an identical block of husbandry columns. Keeping the
 * rules in one place is what stops them drifting apart again — the controllers
 * had already fallen behind their own tables, silently discarding purpose,
 * health status and vaccination dates that staff had typed in.
 */
trait AssetRules
{
    /** Values the health_status enum actually accepts, in every animal table. */
    public const HEALTH_STATUSES = ['healthy', 'sick', 'treated', 'vaccinated'];

    /**
     * The husbandry columns every animal table shares.
     *
     * is_large_raiser is deliberately absent: the TracksHerdSize trait derives
     * it on save, and total_heads is a STORED GENERATED column that MySQL
     * refuses to be told about. Both are read-only from here.
     */
    protected function animalRules(): array
    {
        return [
            'male_count'       => 'required|integer|min:0|max:1000000',
            'female_count'     => 'required|integer|min:0|max:1000000',
            'purpose'          => 'nullable|string|max:40',
            'health_status'    => 'nullable|in:' . implode(',', self::HEALTH_STATUSES),
            'last_vaccination' => 'nullable|date|before_or_equal:today',
            'notes'            => 'nullable|string|max:2000',
        ];
    }

    /**
     * The same block plus the farmer, for creating a record.
     *
     * Updates leave farmer_id out on purpose: a record cannot be reassigned to
     * a different farmer by editing it, which would move assets between people
     * without any trace.
     */
    protected function animalRulesForCreate(): array
    {
        return ['farmer_id' => 'required|exists:farmers,id'] + $this->animalRules();
    }
}
