<?php

namespace App\Services;

use App\Models\ClimateRiskAssessment;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\Fishpond;
use Illuminate\Support\Carbon;

/**
 * One farmer's land, judged parcel by parcel for a named upcoming season.
 *
 * A farm is not one thing. The same farmer works good land and poor land in
 * the same barangay, and a single whole-farm verdict hides the very parcel the
 * office needs to visit. ClimateRiskScorer answers "how exposed is this
 * operation"; this answers "which part of it, and on what evidence".
 *
 * It does NOT introduce a second methodology. The weights, thresholds and
 * bands all come from config/climate_risk.php — the same numbers
 * ClimateRiskScorer sums — so a figure produced here is comparable with one
 * produced there, and the panel still revises one file. Nothing here is
 * trained, nothing is fitted, and no output is a probability.
 *
 * The rule that governs every branch below:
 *
 *      LACK OF EVIDENCE IS NOT LOW RISK.
 *
 * A parcel nothing is known about returns level null, and the interface shows
 * that as its own state. Returning "low" for an empty record would tell the
 * office a farm was fine when the truth is that nobody has written anything
 * down about it.
 *
 * Livestock and aquaculture appear in full and are never scored, because this
 * schema holds current counts for them rather than dated production. When a
 * production-events table exists, ProductionHistory gains a source and the
 * kinds below stop resolving to none() — this class does not change.
 */
class ParcelRiskAnalyser
{
    public const KIND_CROP        = 'crop';
    public const KIND_LIVESTOCK   = 'livestock';
    public const KIND_AQUACULTURE = 'aquaculture';

    /** Wet cropping runs June-November; the dry cropping either side of it. */
    private const WET_MONTHS = [6, 7, 8, 9, 10, 11];

    public function __construct(
        private readonly ProductionHistory $history,
        private readonly CommodityCatalogue $commodities,
        private readonly ClimateRecommendationEngine $recommendations,
    ) {
    }

    /**
     * The season this analysis is about, when the caller does not name one.
     *
     * Deliberately the NEXT cropping rather than the current one: an analysis
     * exists so something can be done differently, and the season already in
     * the ground cannot be replanted.
     *
     * @return array{season: string, year: int, label: string}
     */
    public function upcomingPeriod(?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $month = (int) $now->format('n');
        $year  = (int) $now->format('Y');

        // Mid-wet season: the next cropping is the dry one, recorded against
        // the year it is harvested in.
        if (in_array($month, self::WET_MONTHS, true)) {
            return $this->period(CropSeason::SEASON_DRY, $year + 1);
        }

        // December: the dry cropping has begun, so the next is the following wet.
        if ($month === 12) {
            return $this->period(CropSeason::SEASON_WET, $year + 1);
        }

        // January-May: still in the dry cropping, wet season is next.
        return $this->period(CropSeason::SEASON_WET, $year);
    }

    private function period(string $season, int $year): array
    {
        return [
            'season' => $season,
            'year'   => $year,
            'label'  => ($season === CropSeason::SEASON_WET ? 'Wet Season ' : 'Dry Season ') . $year,
        ];
    }

    /**
     * Analyse every production unit belonging to one farmer.
     *
     * @param  string|null  $season  'wet'/'dry', or null to use the upcoming one.
     */
    public function forFarmer(Farmer $farmer, ?string $season = null, ?int $year = null): array
    {
        $period = $season === null
            ? $this->upcomingPeriod()
            : $this->period($season, $year ?? (int) Carbon::now()->format('Y'));

        $assessment = $farmer->latestRiskAssessment;
        $shared = $this->sharedFactors($assessment);

        $units = [];

        // Eager-loaded together: a farmer with a dozen parcels would otherwise
        // fetch a farm type per row while the page waits.
        foreach ($farmer->parcels()->with('farmType')->get() as $parcel) {
            $units[] = $this->parcelUnit($parcel, $period, $shared);
        }

        foreach ($farmer->fishponds()->get() as $pond) {
            $units[] = $this->pondUnit($pond, $shared);
        }

        $overall = $this->overallOf($units);
        $affected = $this->worstOf($units);

        return [
            'farmer' => [
                'id'       => $farmer->id,
                'name'     => $farmer->full_name,
                'barangay' => $farmer->barangay,
                'rsbsa_no' => $farmer->rsbsa_no,
            ],
            'period'  => $period,
            'overall' => $overall,
            'affected' => $affected,
            'units'   => $units,

            // The "why" is the affected parcel's own reasons, not a rewrite of
            // them: every line traces to a factor with a weight behind it.
            'why' => $affected['factors'] ?? [],

            'recommendations' => $this->recommendations->for($affected['factors'] ?? []),

            'assessment' => $assessment ? [
                'id'          => $assessment->id,
                'assessed_at' => $assessment->assessed_at,
                'is_stale'    => $assessment->is_stale,
                'risk_level'  => $assessment->risk_level,
                'risk_score'  => $assessment->risk_score,
            ] : null,

            'data_used' => $this->dataUsed($units, $assessment),

            /*
             * Stated on every payload so no screen can quietly imply otherwise.
             * There is no trained model here and no calibrated probability; the
             * score is a transparent sum of the stated rules in config.
             */
            'method' => [
                'type'    => 'rule_based',
                'version' => (string) config('climate_risk.version'),
                'note'    => 'Rule-based scoring from recorded farm data and the current assessment. Not a trained model and not a probability.',
            ],
        ];
    }

    /**
     * Factors that describe the whole farm rather than one parcel.
     *
     * Flooding, drought and severe damage were answered about the operation,
     * not about a particular field, so they legitimately apply to every unit on
     * it. The peer and yield comparisons are NOT here: those are specific to a
     * parcel and season, and are computed per unit below.
     */
    private function sharedFactors(?ClimateRiskAssessment $assessment): array
    {
        if (! $assessment) {
            return [];
        }

        $weights = config('climate_risk.weights');
        $limits  = config('climate_risk.thresholds');
        $frequent = $limits['frequent_answers'];

        $factors = [];

        if (in_array($assessment->flood_frequency, $frequent, true)) {
            $factors[] = $this->factor('frequent_flooding', $weights['frequent_flooding'],
                'Flooding was reported as a frequent problem on this farm', 'assessment');
        }

        if (in_array($assessment->drought_frequency, $frequent, true)) {
            $factors[] = $this->factor('frequent_drought', $weights['frequent_drought'],
                'Drought or prolonged dry periods were reported as frequent', 'assessment');
        }

        if (in_array($assessment->worst_effect, $limits['severe_effects'], true)) {
            $factors[] = $this->factor('severe_climate_damage', $weights['severe_climate_damage'],
                'Climate events have caused severe or total loss of production', 'assessment');
        }

        // Only when the question was actually answered. An unanswered Q13 is
        // not the same as answering "none" and must not be scored as one.
        $practices = $assessment->adaptation_practices;

        if (is_array($practices) && $practices !== []
            && $practices === [ClimateRiskAssessment::EXCLUSIVE_CHOICE]) {
            $factors[] = $this->factor('no_adaptation', $weights['no_adaptation'],
                'No climate adaptation practices are currently in use', 'assessment');
        }

        if ($assessment->had_financial_loss === 'yes') {
            $factors[] = $this->factor('reported_financial_loss', $weights['reported_financial_loss'],
                'The farmer reported financial loss from climate events', 'assessment');
        }

        return $factors;
    }

    /** One parcel, typed by what it produces. */
    private function parcelUnit(FarmParcel $parcel, array $period, array $shared): array
    {
        $kind = $this->commodities->kindOf($parcel->commodity);

        $label = $parcel->parcel_number
            ? "Parcel #{$parcel->parcel_number}"
            : ($parcel->barangay ? "Parcel in {$parcel->barangay}" : 'Parcel');

        // Livestock declared on a parcel is still livestock: heads today, with
        // no dated production behind it.
        if ($kind === CommodityCatalogue::KIND_LIVESTOCK) {
            return $this->unmeasured(
                id: "parcel-{$parcel->id}",
                kind: self::KIND_LIVESTOCK,
                label: $label,
                commodity: $parcel->commodity,
                size: ['value' => (float) ($parcel->no_of_heads_trees ?? 0), 'unit' => 'heads'],
                barangay: $parcel->barangay,
                shared: $shared,
                historyKind: 'livestock',
            );
        }

        $history = $this->history->forParcel($parcel, $period['season']);
        $factors = array_merge($this->historyFactors($parcel, $history), $shared);

        return [
            'id'                => "parcel-{$parcel->id}",
            'parcel_id'         => $parcel->id,
            'kind'              => self::KIND_CROP,
            'label'             => $label,
            'commodity'         => $parcel->commodity,
            'size'              => ['value' => (float) ($parcel->total_area_ha ?? 0), 'unit' => 'ha'],
            'barangay'          => $parcel->barangay,
            'farm_type'         => $parcel->farmType?->type_name,
            'history'           => $history,
            'data_sufficiency'  => $history['sufficiency'],
            'factors'           => $factors,
            'level'             => $this->levelFor($factors, $history, hasAssessment: $shared !== []),
            'score'             => $this->scoreFor($factors, $history, hasAssessment: $shared !== []),
            'note'              => null,
        ];
    }

    private function pondUnit(Fishpond $pond, array $shared): array
    {
        return $this->unmeasured(
            id: "pond-{$pond->id}",
            kind: self::KIND_AQUACULTURE,
            label: $pond->pond_type ? "Fish Pond ({$pond->pond_type})" : 'Fish Pond',
            commodity: $pond->species,
            size: ['value' => (float) ($pond->area_hectares ?? 0), 'unit' => 'ha'],
            barangay: null,
            shared: $shared,
            historyKind: 'aquaculture',
        );
    }

    /**
     * A unit this system holds no production history for.
     *
     * Shown in full — the record exists and the office should see it — but
     * never given a level. The assessment factors travel with it as context,
     * clearly sourced, because a farm that floods frequently floods over its
     * animals too; what cannot be said is how that has affected production,
     * because nothing recorded it.
     */
    private function unmeasured(
        string $id,
        string $kind,
        string $label,
        ?string $commodity,
        array $size,
        ?string $barangay,
        array $shared,
        string $historyKind,
    ): array {
        return [
            'id'               => $id,
            'kind'             => $kind,
            'label'            => $label,
            'commodity'        => $commodity,
            'size'             => $size,
            'barangay'         => $barangay,
            'history'          => $this->history->none($historyKind),
            'data_sufficiency' => ProductionHistory::SUFFICIENCY_NONE,

            // Context, not a score. Nothing below sums these into a level.
            'factors'          => $shared,
            'level'            => null,
            'score'            => null,
            'note'             => $kind === self::KIND_LIVESTOCK
                ? 'Insufficient historical livestock data'
                : 'Insufficient historical aquaculture data',
        ];
    }

    /**
     * Factors this parcel's own records raise, for this season of the year.
     *
     * Silent when the figures are absent. A parcel with no costed season is
     * not low risk and not high risk — it is unmeasured, and inventing a factor
     * from missing data would band a farmer for incomplete paperwork.
     */
    private function historyFactors(FarmParcel $parcel, array $history): array
    {
        $weights = config('climate_risk.weights');
        $factors = [];

        if ($history['records'] === []) {
            return $factors;
        }

        if ($history['trend'] === ProductionHistory::TREND_DECLINING) {
            $factors[] = $this->factor(
                'declining_yield',
                $weights['declining_yield'],
                'Yield per hectare has fallen across comparable recorded seasons on this parcel',
                'history',
                ['change_percent' => $history['change_percent'], 'seasons' => $history['comparable_seasons']],
            );
        }

        $latest = $history['records'][count($history['records']) - 1];

        if ($latest['outcome'] === CropSeason::OUTCOME_LOSS) {
            $factors[] = $this->factor(
                'previous_season_loss',
                $weights['previous_season_loss'],
                'The last comparable season recorded on this parcel did not cover its costs',
                'history',
                ['year' => $latest['year']],
            );
        }

        $peers = $this->peerYield($parcel, $history);

        if ($peers !== null && $latest['yield_per_ha'] <= $peers * config('climate_risk.thresholds.yield_ratio')) {
            $factors[] = $this->factor(
                'yield_below_peers',
                $weights['yield_below_peers'],
                'Yield per hectare is below other farms growing the same crop nearby',
                'history',
                ['this_parcel' => $latest['yield_per_ha'], 'nearby_average' => $peers],
            );
        }

        return $factors;
    }

    /**
     * Average yield per hectare on comparable land nearby.
     *
     * Null below the configured minimum. An "average" drawn from one other farm
     * says nothing, and would raise a farmer's level on a single neighbour's
     * record. Matched on unit as well as crop, so sacks are never averaged
     * against kilograms.
     */
    private function peerYield(FarmParcel $parcel, array $history): ?float
    {
        $latest = $history['records'][count($history['records']) - 1] ?? null;

        if (! $latest || ! $parcel->barangay) {
            return null;
        }

        $unit = $latest['unit'] === 'kg' ? null : $latest['unit'];

        $peers = CropSeason::forVerifiedFarmers()
            ->where('season', $latest['season'])
            ->whereHas('parcel', fn ($q) => $q
                ->where('barangay', $parcel->barangay)
                ->where('id', '!=', $parcel->id))
            ->when($latest['crop'], fn ($q) => $q->whereHas('crop', fn ($c) => $c->where('crop_name', $latest['crop'])))
            ->when($unit === null, fn ($q) => $q->whereNull('production_unit'), fn ($q) => $q->where('production_unit', $unit))
            ->whereNotNull('yield_kg')->where('yield_kg', '>', 0)
            ->whereNotNull('area_planted_ha')->where('area_planted_ha', '>', 0)
            ->get();

        if ($peers->count() < config('climate_risk.thresholds.minimum_peers')) {
            return null;
        }

        return round($peers->sum('yield_kg') / max($peers->sum('area_planted_ha'), 1), 2);
    }

    /**
     * The band, or nothing at all.
     *
     * Null when there is neither a recorded history nor an assessment: with no
     * input of any kind a score of zero would be an artefact of silence, and
     * banding it "low" would report an unvisited farm as a healthy one.
     */
    private function levelFor(array $factors, array $history, bool $hasAssessment): ?string
    {
        if ($history['records'] === [] && ! $hasAssessment) {
            return null;
        }

        $score = min(100, (int) array_sum(array_column($factors, 'weight')));
        $bands = config('climate_risk.bands');

        return match (true) {
            $score >= $bands['high']     => ClimateRiskScorer::LEVEL_HIGH,
            $score >= $bands['moderate'] => ClimateRiskScorer::LEVEL_MODERATE,
            default                      => ClimateRiskScorer::LEVEL_LOW,
        };
    }

    private function scoreFor(array $factors, array $history, bool $hasAssessment): ?int
    {
        if ($history['records'] === [] && ! $hasAssessment) {
            return null;
        }

        return min(100, (int) array_sum(array_column($factors, 'weight')));
    }

    /** Counts by band, with the unmeasured kept apart from the low. */
    private function overallOf(array $units): array
    {
        $counts = ['high' => 0, 'moderate' => 0, 'low' => 0, 'insufficient' => 0];

        foreach ($units as $unit) {
            $counts[$unit['level'] ?? 'insufficient']++;
        }

        $worst = $this->worstOf($units);

        return [
            'level'  => $worst['level'] ?? null,
            'score'  => $worst['score'] ?? null,
            'counts' => $counts,
            'units'  => count($units),
        ];
    }

    /**
     * The parcel that decides the farm's verdict.
     *
     * The worst one, not an average: averaging a failing parcel against three
     * healthy ones produces a comfortable number and sends nobody to look at
     * the failing one.
     */
    private function worstOf(array $units): ?array
    {
        $rank = ['high' => 3, 'moderate' => 2, 'low' => 1];

        $scored = array_filter($units, fn ($u) => $u['level'] !== null);

        if ($scored === []) {
            return null;
        }

        usort($scored, fn ($a, $b) => [$rank[$b['level']], $b['score'] ?? 0] <=> [$rank[$a['level']], $a['score'] ?? 0]);

        return $scored[0];
    }

    /**
     * What actually went into this, and what was not there to go in.
     *
     * Both halves matter equally. A page that lists only what it used lets the
     * reader assume the rest was considered and found fine.
     */
    private function dataUsed(array $units, ?ClimateRiskAssessment $assessment): array
    {
        $used = [];
        $missing = [];

        if ($assessment) {
            $used[] = 'Current climate and financial risk assessment';
        } else {
            $missing[] = 'No climate risk assessment has been completed for this farmer';
        }

        $cropUnits = array_filter($units, fn ($u) => $u['kind'] === self::KIND_CROP);
        $seasons = array_sum(array_column(array_column($cropUnits, 'history'), 'comparable_seasons'));

        if ($seasons > 0) {
            $used[] = "{$seasons} comparable recorded cropping season" . ($seasons === 1 ? '' : 's');
        } else {
            $missing[] = 'No comparable cropping seasons are recorded for this season of the year';
        }

        if ($cropUnits !== []) {
            $used[] = count($cropUnits) . ' crop parcel' . (count($cropUnits) === 1 ? '' : 's') . ' with recorded characteristics';
        }

        foreach ([self::KIND_LIVESTOCK => 'livestock production', self::KIND_AQUACULTURE => 'aquaculture harvest'] as $kind => $what) {
            $of = array_filter($units, fn ($u) => $u['kind'] === $kind);

            if ($of !== []) {
                $used[] = count($of) . ' ' . $kind . ' record' . (count($of) === 1 ? '' : 's') . ' (current information)';
                $missing[] = "No historical {$what} time series is recorded";
            }
        }

        return ['used' => array_values($used), 'missing' => array_values($missing)];
    }

    /** One reason, with its weight, its wording and where it came from. */
    private function factor(string $key, int $weight, string $label, string $source, array $evidence = []): array
    {
        return array_filter([
            'key'      => $key,
            'weight'   => $weight,
            'label'    => $label,
            'source'   => $source,
            'evidence' => $evidence ?: null,
        ], fn ($value) => $value !== null);
    }
}
