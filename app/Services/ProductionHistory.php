<?php

namespace App\Services;

use App\Models\CropSeason;
use App\Models\FarmParcel;
use Illuminate\Support\Collection;

/**
 * What the records actually show about one parcel — and when they show nothing.
 *
 * One class decides what counts as evidence, because every screen that reports
 * a trend asks it. Left to each caller, "insufficient data" would mean one
 * thing on the farmer's portal and another on the office's analysis page, and
 * the two would eventually disagree about the same parcel in front of the same
 * farmer.
 *
 * Three rules run through all of it:
 *
 *  - Compare like with like. A dry-season figure describes a different crop
 *    cycle; a neighbouring parcel is different land; sacks are not kilograms.
 *    Any of those mixed together invents a rise or a collapse that never
 *    happened on the ground.
 *
 *  - Absence of evidence is reported as absence of evidence. A parcel with no
 *    records is never described as improving, never as declining, and never
 *    quietly treated as low risk.
 *
 *  - Nothing here is a prediction. These are recorded figures and the
 *    direction between them. There is no model, no probability and no
 *    confidence percentage, and none may be inferred from what this returns.
 *
 * Livestock and aquaculture have no dated production table in this schema, so
 * they resolve through none() rather than being made to look measured. When
 * such a table exists, it plugs in beside forParcel() without the callers or
 * the analyser changing.
 */
class ProductionHistory
{
    public const SUFFICIENCY_NONE       = 'none';
    public const SUFFICIENCY_LIMITED    = 'limited';
    public const SUFFICIENCY_SUFFICIENT = 'sufficient';

    public const TREND_IMPROVING = 'improving';
    public const TREND_DECLINING = 'declining';
    public const TREND_STEADY    = 'steady';

    /** At or above this many comparable records, a trend is worth reporting as such. */
    private const SUFFICIENT_AT = 3;

    /** Two points are the fewest that can show a direction at all. */
    private const TREND_NEEDS = 2;

    /**
     * Movement within this fraction reads as steady rather than as a direction.
     *
     * Yield varies between seasons for reasons nobody recorded. Calling a 1%
     * difference "declining" would put a factor on a farmer for noise.
     */
    private const STEADY_BAND = 0.05;

    /**
     * The comparable record for one parcel in one season of the year.
     *
     * @param  string  $season  'wet' or 'dry' — matched exactly, never merged.
     * @return array{records: array, comparable_seasons: int, sufficiency: string,
     *               trend: ?string, change_percent: ?float, unit: ?string, summary: string}
     */
    public function forParcel(FarmParcel $parcel, string $season): array
    {
        $rows = CropSeason::with('crop:id,crop_name')
            ->where('parcel_id', $parcel->id)
            ->where('season', $season)
            ->whereNotNull('yield_kg')
            ->where('yield_kg', '>', 0)
            ->whereNotNull('area_planted_ha')
            ->where('area_planted_ha', '>', 0)
            ->orderBy('cropping_year')
            ->get();

        $comparable = $this->largestComparableSet($rows);

        $records = $comparable->map(fn (CropSeason $s) => [
            'id'           => $s->id,
            'year'         => (int) $s->cropping_year,
            'season'       => $s->season,
            'crop'         => $s->crop?->crop_name,
            'yield'        => (float) $s->yield_kg,
            'unit'         => $s->production_unit ?? 'kg',
            'area_ha'      => (float) $s->area_planted_ha,
            'yield_per_ha' => round((float) $s->yield_kg / (float) $s->area_planted_ha, 2),
            'outcome'      => $s->financial_outcome,
        ])->values()->all();

        $count = count($records);
        $trend = $this->trendOf($records);

        return [
            'records'            => $records,
            'comparable_seasons' => $count,
            'sufficiency'        => $this->sufficiencyFor($count),
            'trend'              => $trend,
            'change_percent'     => $this->changePercent($records),
            'unit'               => $records[0]['unit'] ?? null,
            'summary'            => $this->summarise($count, $season, $trend),
        ];
    }

    /**
     * The shape returned for a production type this system keeps no history for.
     *
     * Deliberately the same shape as forParcel() so a caller never has to ask
     * which kind it is holding — and deliberately empty, because the honest
     * answer for livestock and aquaculture today is that no time series exists.
     */
    public function none(string $kind): array
    {
        $wording = [
            'livestock'   => 'No historical livestock production time series is currently recorded.',
            'aquaculture' => 'No historical aquaculture harvest time series is currently recorded.',
        ];

        return [
            'records'            => [],
            'comparable_seasons' => 0,
            'sufficiency'        => self::SUFFICIENCY_NONE,
            'trend'              => null,
            'change_percent'     => null,
            'unit'               => null,
            'summary'            => $wording[$kind] ?? 'No historical production records are available.',
        ];
    }

    /**
     * The biggest set of rows that can honestly be compared with one another.
     *
     * Grouped by crop AND unit together. Rice against corn on the same parcel
     * is two different productions; 40 sacks against 4,000 kg differ by a
     * hundredfold in this column alone. Either mixed in would manufacture a
     * trend, so the largest self-consistent group wins and the rest are set
     * aside — the biggest group being, simply, the most evidence.
     *
     * @param  Collection<int, CropSeason>  $rows
     * @return Collection<int, CropSeason>
     */
    private function largestComparableSet(Collection $rows): Collection
    {
        if ($rows->isEmpty()) {
            return $rows;
        }

        $groups = $rows->groupBy(fn (CropSeason $s) => ($s->crop_id ?? 'none') . '|' . ($s->production_unit ?? 'kg'));

        // Ties go to the group holding the most recent record: that is how the
        // parcel is being recorded now, so it is the set still being added to.
        $newest = $rows->sortByDesc('cropping_year')->first();
        $newestKey = ($newest->crop_id ?? 'none') . '|' . ($newest->production_unit ?? 'kg');

        $best = $groups->sortByDesc(
            fn (Collection $group, string $key) => [$group->count(), $key === $newestKey ? 1 : 0]
        )->first();

        return $best->sortBy('cropping_year')->values();
    }

    private function sufficiencyFor(int $count): string
    {
        return match (true) {
            $count === 0                 => self::SUFFICIENCY_NONE,
            $count < self::SUFFICIENT_AT => self::SUFFICIENCY_LIMITED,
            default                      => self::SUFFICIENCY_SUFFICIENT,
        };
    }

    /**
     * Direction of travel, per hectare.
     *
     * Per hectare rather than by raw weight, because half the land producing
     * nearly the same tonnage is a better season, not a worse one — raw totals
     * report that backwards.
     */
    private function trendOf(array $records): ?string
    {
        $change = $this->changePercent($records);

        if ($change === null) {
            return null;
        }

        return match (true) {
            abs($change) <= self::STEADY_BAND * 100 => self::TREND_STEADY,
            $change > 0                             => self::TREND_IMPROVING,
            default                                 => self::TREND_DECLINING,
        };
    }

    /** Null below two records: one point is not a direction. */
    private function changePercent(array $records): ?float
    {
        if (count($records) < self::TREND_NEEDS) {
            return null;
        }

        $first = $records[0]['yield_per_ha'];
        $last  = $records[count($records) - 1]['yield_per_ha'];

        if ($first <= 0) {
            return null;
        }

        return round((($last - $first) / $first) * 100, 1);
    }

    /** Plain wording for the screen, saying exactly how much was found. */
    private function summarise(int $count, string $season, ?string $trend): string
    {
        $label = $season === CropSeason::SEASON_WET ? 'wet-season' : 'dry-season';

        if ($count === 0) {
            return "No comparable {$label} records are held for this parcel.";
        }

        if ($count === 1) {
            return "Only 1 comparable {$label} record is held for this parcel, so no trend can be established.";
        }

        $direction = match ($trend) {
            self::TREND_IMPROVING => 'Production has risen across them.',
            self::TREND_DECLINING => 'Production has fallen across them.',
            self::TREND_STEADY    => 'Production has held roughly steady across them.',
            default               => '',
        };

        $caveat = $count < self::SUFFICIENT_AT
            ? ' That is a short run, so the direction is indicative rather than established.'
            : '';

        return trim("{$count} comparable {$label} records are held for this parcel. {$direction}{$caveat}");
    }
}
