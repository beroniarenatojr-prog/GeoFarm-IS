<?php

namespace App\Services;

use App\Models\Crop;
use App\Models\LivestockType;
use Illuminate\Support\Collection;

/**
 * The things a parcel can be used to produce, from the tables that already
 * hold them.
 *
 * farm_parcels.commodity is free text and always has been — there is no
 * commodity table and no foreign key. Rather than invent one, this reads the
 * two lookups the office already maintains and presents them as a single list.
 *
 * The crop-or-livestock answer comes from WHICH TABLE a name was found in, not
 * from matching against a list of animal words. That distinction is the whole
 * point: "Duck" is livestock because it is a row in livestock_types, and it
 * stays livestock when somebody adds "Duckweed" to crops next year.
 *
 * Nothing here writes. A commodity that matches no lookup row is still a valid
 * thing to have typed — the register holds free text entered over years — so
 * an unknown name resolves to KIND_UNKNOWN and the form simply stops asserting
 * which fields apply.
 */
class CommodityCatalogue
{
    public const KIND_CROP      = 'crop';
    public const KIND_LIVESTOCK = 'livestock';
    public const KIND_UNKNOWN   = 'unknown';

    /**
     * Every commodity the office can pick, both kinds together.
     *
     * @return Collection<int, array{name: string, kind: string, category: ?string}>
     */
    public function all(): Collection
    {
        $crops = Crop::orderBy('crop_name')->get(['crop_name', 'category'])
            ->map(fn (Crop $c) => [
                'name'     => $c->crop_name,
                'kind'     => self::KIND_CROP,
                'category' => $c->category,
            ]);

        $livestock = LivestockType::orderBy('type_name')->get(['type_name', 'category'])
            ->map(fn (LivestockType $t) => [
                'name'     => $t->type_name,
                'kind'     => self::KIND_LIVESTOCK,
                'category' => $t->category,
            ]);

        /*
         * A name in both tables is listed once, as livestock.
         *
         * It should not happen, but if it ever does the stricter reading wins:
         * livestock is the kind that unlocks a head count, and offering the
         * same word twice with different rules would be worse than choosing.
         */
        return $livestock
            ->concat($crops)
            ->unique(fn (array $row) => mb_strtolower($row['name']))
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }

    /**
     * What kind of thing a commodity name is.
     *
     * Case- and space-insensitive, because the value being checked was typed
     * by hand into a text column for years before this existed.
     */
    public function kindOf(?string $commodity): string
    {
        if (blank($commodity)) {
            return self::KIND_UNKNOWN;
        }

        $needle = mb_strtolower(trim($commodity));

        if (LivestockType::whereRaw('LOWER(TRIM(type_name)) = ?', [$needle])->exists()) {
            return self::KIND_LIVESTOCK;
        }

        if (Crop::whereRaw('LOWER(TRIM(crop_name)) = ?', [$needle])->exists()) {
            return self::KIND_CROP;
        }

        return self::KIND_UNKNOWN;
    }

    /** Livestock has heads; a crop parcel has none. */
    public function takesHeadCount(?string $commodity): bool
    {
        return $this->kindOf($commodity) === self::KIND_LIVESTOCK;
    }

    /** A cropping schedule describes planting, so only a crop has one. */
    public function takesCroppingSchedule(?string $commodity): bool
    {
        return $this->kindOf($commodity) === self::KIND_CROP;
    }
}
