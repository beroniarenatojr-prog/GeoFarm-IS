<?php

namespace App\Services;

use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Models\Recommendation;

/**
 * Turns the analysis the office already runs into recommendation rows it can
 * review, accept, reject and convert.
 *
 * This generates nothing of its own. Every line it writes comes from
 * ParcelRiskAnalyser — which resolves the right assessment per activity, reads
 * real crop_seasons history through ProductionHistory, and asks
 * ClimateRecommendationEngine for wording — and this class only persists what
 * came back, with the evidence attached.
 *
 * What it deliberately does NOT do:
 *
 *   - score anything. ClimateRiskScorer and its weights are untouched.
 *   - invent a factor. A recommendation exists only where the analyser raised
 *     the condition behind it, so a farmer with no flooding gets no flooding
 *     advice.
 *   - claim a programme exists. The wording comes from config, which speaks of
 *     "assistance programmes and support available" and never names one.
 *   - turn a missing record into a finding. An activity with no history is
 *     written down as insufficient, never as low risk and never as a trend.
 *
 * Re-running is safe by construction: every row goes through
 * Recommendation::remember(), so the same assessment producing the same advice
 * for the same activity lands on the same fingerprint and the existing row is
 * returned untouched — including one staff have already rejected or closed.
 */
class RecommendationGenerator
{
    /**
     * Reasons for advice that answers the absence of something rather than a
     * condition that was found.
     *
     * Both are statements of fact about the record, not inferences about the
     * farm, which is the distinction that keeps "nothing was recorded" from
     * reading as "nothing is wrong".
     */
    private const REASON_NO_HISTORY = 'No comparable production history has been recorded for this activity, '
        . 'so no trend can be established.';

    private const REASON_NOTHING_RAISED = 'No risk factors were raised for this activity by the current assessment '
        . 'or by its recorded history.';

    public function __construct(
        private readonly ParcelRiskAnalyser $analyser,
    ) {
    }

    /**
     * Record the current advice for every activity a farmer has.
     *
     * @return array{created: int, existing: int, recommendations: list<Recommendation>}
     */
    public function forFarmer(Farmer $farmer): array
    {
        $analysis = $this->analyser->forFarmer($farmer);

        $created  = 0;
        $existing = 0;
        $rows     = [];

        foreach ($analysis['units'] ?? [] as $unit) {
            foreach ($this->rowsForUnit($farmer, $unit) as $attributes) {
                $before = Recommendation::where('fingerprint', Recommendation::fingerprintFor($attributes))->exists();

                $row = Recommendation::remember($attributes);

                $before ? $existing++ : $created++;
                $rows[] = $row;
            }
        }

        /*
         * A farmer with nothing encoded yet.
         *
         * The analyser works activity by activity, so a farmer whose parcels
         * and ponds have not been entered produces no units and would otherwise
         * lose the advice from their whole-farm assessment entirely. Recorded
         * at farmer scope, which is what that assessment actually describes.
         */
        if (($analysis['units'] ?? []) === []) {
            foreach ($this->rowsForWholeFarm($farmer) as $attributes) {
                $before = Recommendation::where('fingerprint', Recommendation::fingerprintFor($attributes))->exists();

                $rows[] = Recommendation::remember($attributes);

                $before ? $existing++ : $created++;
            }
        }

        return ['created' => $created, 'existing' => $existing, 'recommendations' => $rows];
    }

    /**
     * One activity's advice, as rows.
     *
     * @return list<array<string, mixed>>
     */
    private function rowsForUnit(Farmer $farmer, array $unit): array
    {
        $scope = $this->scopeFor($unit['kind'] ?? null);

        if ($scope === null) {
            return [];
        }

        // The analyser names the activity; this never guesses one. A unit that
        // cannot say which parcel or pond it describes is skipped rather than
        // attached to something plausible.
        $isPond = $scope === Recommendation::SCOPE_AQUACULTURE;

        $parcelId = $isPond ? null : ($unit['parcel_id'] ?? null);
        $pondId   = $isPond ? ($unit['fishpond_id'] ?? null) : null;

        if (($isPond ? $pondId : $parcelId) === null) {
            return [];
        }

        $factors = $this->factorsByKey($unit['factors'] ?? []);

        return $this->rows(
            farmer: $farmer,
            advice: $unit['recommendations'] ?? [],
            factors: $factors,
            scope: $scope,
            parcelId: $parcelId,
            pondId: $pondId,
            assessmentId: $unit['assessment']['id'] ?? null,
            sufficiency: $unit['data_sufficiency'] ?? null,
        );
    }

    /** @return list<array<string, mixed>> */
    private function rowsForWholeFarm(Farmer $farmer): array
    {
        $assessment = $farmer->latestRiskAssessment;

        if (! $assessment) {
            return [];
        }

        $advice = $assessment->recommendations;

        if (! is_array($advice) || $advice === []) {
            return [];
        }

        return $this->rows(
            farmer: $farmer,
            advice: $advice,
            factors: $this->factorsByKey($assessment->risk_factors ?? []),
            scope: Recommendation::SCOPE_FARMER,
            parcelId: null,
            pondId: null,
            assessmentId: $assessment->id,
            // No parcel means no production history to judge; saying so is
            // honest, and saying "sufficient" would not be.
            sufficiency: ProductionHistory::SUFFICIENCY_NONE,
        );
    }

    /**
     * Build the attribute sets, one per piece of advice.
     *
     * @return list<array<string, mixed>>
     */
    private function rows(
        Farmer $farmer,
        array $advice,
        array $factors,
        string $scope,
        ?int $parcelId,
        ?int $pondId,
        ?int $assessmentId,
        ?string $sufficiency,
    ): array {
        $rows = [];

        foreach ($advice as $item) {
            $key = $item['key'] ?? null;

            if ($key === null) {
                continue;
            }

            $factor = $factors[$key] ?? null;

            $rows[] = [
                'farmer_id'                  => $farmer->id,
                'climate_risk_assessment_id' => $assessmentId,
                'farm_parcel_id'             => $parcelId,
                'fishpond_id'                => $pondId,
                'scope_type'                 => $scope,
                'factor_key'                 => $key,
                'title'                      => $this->truncate($item['title'] ?? $key, 255),
                'reason'                     => $this->truncate($this->reasonFor($key, $factor), 255),
                'priority'                   => $this->priorityFor($item['priority'] ?? null),
                'category'                   => $item['category'] ?? null,
                'evidence_source'            => $this->evidenceSourceFor($key, $factor),
                'data_sufficiency'           => Recommendation::normaliseSufficiency($sufficiency),
                'generated_at'               => now(),
            ];
        }

        return $rows;
    }

    /**
     * Why this advice was produced.
     *
     * The factor's own label wherever there is one — the analyser writes those
     * from the farmer's actual answers and their actual records, so the reason
     * is the evidence rather than a restatement of the advice.
     */
    private function reasonFor(string $key, ?array $factor): string
    {
        if ($factor && ! empty($factor['label'])) {
            return $factor['label'];
        }

        if (str_starts_with($key, 'missing_evidence_')) {
            return self::REASON_NO_HISTORY;
        }

        return self::REASON_NOTHING_RAISED;
    }

    /**
     * Where the evidence came from.
     *
     * assessment and history are the analyser's own words for it. The other two
     * are advice that answers an absence: baseline when nothing was raised,
     * missing_evidence when there is no history to raise anything from.
     */
    private function evidenceSourceFor(string $key, ?array $factor): string
    {
        if (str_starts_with($key, 'missing_evidence_')) {
            return 'missing_evidence';
        }

        if (str_starts_with($key, 'baseline_')) {
            return 'baseline';
        }

        $source = $factor['source'] ?? null;

        return in_array($source, Recommendation::EVIDENCE_SOURCES, true) ? $source : 'baseline';
    }

    private function scopeFor(?string $kind): ?string
    {
        return match ($kind) {
            ParcelRiskAnalyser::KIND_CROP        => Recommendation::SCOPE_PARCEL,
            ParcelRiskAnalyser::KIND_LIVESTOCK   => Recommendation::SCOPE_LIVESTOCK,
            ParcelRiskAnalyser::KIND_AQUACULTURE => Recommendation::SCOPE_AQUACULTURE,
            default                              => null,
        };
    }

    private function priorityFor(?string $priority): string
    {
        return in_array($priority, Recommendation::PRIORITIES, true) ? $priority : 'medium';
    }

    /** @param array<int, array<string, mixed>> $factors */
    private function factorsByKey(array $factors): array
    {
        $byKey = [];

        foreach ($factors as $factor) {
            if (is_array($factor) && isset($factor['key'])) {
                $byKey[$factor['key']] = $factor;
            }
        }

        return $byKey;
    }

    /** title and reason are varchar(255); the office's wording can run longer. */
    private function truncate(string $value, int $limit): string
    {
        return mb_strlen($value) <= $limit ? $value : mb_substr($value, 0, $limit - 1) . '…';
    }
}
