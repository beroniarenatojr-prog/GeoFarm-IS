<?php

namespace App\Services;

use App\Models\AgriculturalIntervention;
use App\Models\AssistanceDistribution;
use App\Models\FarmParcel;
use App\Models\Fishpond;
use App\Models\FollowUp;
use App\Models\Recommendation;
use Illuminate\Validation\ValidationException;

/**
 * Ownership and scope rules for the agricultural support workflow.
 *
 * These are enforced from model saving hooks rather than from form requests.
 * A controller can forget a rule, and a second controller written later will
 * not know the first one's rules existed; a saving hook is on the only road in.
 * Request validation stays useful for producing friendly field errors early,
 * but it is no longer the thing standing between a typed id and the database.
 *
 * The rule underneath all of it: an id arriving in a request is a claim, not a
 * fact. Every parcel, pond, intervention, hand-out and follow-up referenced by
 * a record must be shown to belong to the same farmer as that record.
 *
 * Failures are thrown as ValidationException so they surface the way every
 * other validation failure in this application does — a 422 for JSON, a
 * redirect with errors for Inertia — instead of as a 500.
 */
class WorkflowIntegrity
{
    public function __construct(private readonly CommodityCatalogue $commodities)
    {
    }

    /**
     * A recommendation's scope must agree with what it points at.
     *
     * farmer      — no parcel, no pond
     * parcel      — a parcel of this farmer's, no pond
     * livestock   — a parcel of this farmer's that is a livestock holding
     * aquaculture — a pond of this farmer's, no parcel
     *
     * @throws ValidationException
     */
    public function assertRecommendationScope(Recommendation $recommendation): void
    {
        $scope    = $recommendation->scope_type ?? Recommendation::SCOPE_FARMER;
        $farmerId = (int) $recommendation->farmer_id;
        $parcelId = $recommendation->farm_parcel_id;
        $pondId   = $recommendation->fishpond_id;

        if (! in_array($scope, Recommendation::SCOPES, true)) {
            $this->fail('scope_type', "Unknown recommendation scope [{$scope}].");
        }

        if ($farmerId <= 0) {
            $this->fail('farmer_id', 'A recommendation must belong to a farmer.');
        }

        match ($scope) {
            Recommendation::SCOPE_FARMER      => $this->assertFarmerScope($parcelId, $pondId),
            Recommendation::SCOPE_PARCEL      => $this->assertParcelScope($farmerId, $parcelId, $pondId),
            Recommendation::SCOPE_LIVESTOCK   => $this->assertLivestockScope($farmerId, $parcelId, $pondId),
            Recommendation::SCOPE_AQUACULTURE => $this->assertAquacultureScope($farmerId, $parcelId, $pondId),
        };

        if ($recommendation->priority !== null
            && ! in_array($recommendation->priority, Recommendation::PRIORITIES, true)) {
            $this->fail('priority', "Unknown priority [{$recommendation->priority}].");
        }

        if ($recommendation->status !== null
            && ! in_array($recommendation->status, Recommendation::STATUSES, true)) {
            $this->fail('status', "Unknown recommendation status [{$recommendation->status}].");
        }

        if ($recommendation->data_sufficiency !== null
            && ! in_array($recommendation->data_sufficiency, Recommendation::SUFFICIENCIES, true)) {
            $this->fail(
                'data_sufficiency',
                "Unknown data sufficiency [{$recommendation->data_sufficiency}]. "
                . "Pass ProductionHistory's value through Recommendation::normaliseSufficiency() first."
            );
        }
    }

    /**
     * A follow-up must agree with everything it is attached to.
     *
     * @throws ValidationException
     */
    public function assertFollowUpConsistency(FollowUp $followUp): void
    {
        $farmerId = (int) $followUp->farmer_id;

        if ($farmerId <= 0) {
            $this->fail('farmer_id', 'A follow-up must belong to a farmer.');
        }

        if ($followUp->status !== null && ! in_array($followUp->status, FollowUp::STATUSES, true)) {
            // Catches 'due' in particular, which is derived and must never be stored.
            $this->fail('status', "Unknown follow-up status [{$followUp->status}].");
        }

        if ($id = $followUp->agricultural_intervention_id) {
            $intervention = AgriculturalIntervention::find($id);

            if (! $intervention) {
                $this->fail('agricultural_intervention_id', 'That intervention does not exist.');
            }

            if ((int) $intervention->farmer_id !== $farmerId) {
                $this->fail(
                    'agricultural_intervention_id',
                    'That intervention belongs to a different farmer.'
                );
            }
        }

        if ($id = $followUp->assistance_distribution_id) {
            $distribution = AssistanceDistribution::find($id);

            if (! $distribution) {
                $this->fail('assistance_distribution_id', 'That assistance record does not exist.');
            }

            if ((int) $distribution->farmer_id !== $farmerId) {
                $this->fail(
                    'assistance_distribution_id',
                    'That assistance record belongs to a different farmer.'
                );
            }
        }

        if ($followUp->farm_parcel_id) {
            $this->assertParcelBelongsTo($farmerId, $followUp->farm_parcel_id, 'farm_parcel_id');
        }

        $this->assertChainIsSafe($followUp);
    }

    /**
     * The forward chain must not point at itself, at another farmer, or round
     * in a circle.
     *
     * @throws ValidationException
     */
    private function assertChainIsSafe(FollowUp $followUp): void
    {
        $nextId = $followUp->next_follow_up_id;

        if (! $nextId) {
            return;
        }

        if ($followUp->exists && (int) $nextId === (int) $followUp->getKey()) {
            $this->fail('next_follow_up_id', 'A follow-up cannot be its own next step.');
        }

        $next = FollowUp::find($nextId);

        if (! $next) {
            $this->fail('next_follow_up_id', 'That follow-up does not exist.');
        }

        if ((int) $next->farmer_id !== (int) $followUp->farmer_id) {
            $this->fail('next_follow_up_id', 'The next follow-up belongs to a different farmer.');
        }

        /*
         * Walk forward from the proposed next step. If the chain comes back to
         * this row, linking them would close a loop that later readers would
         * follow forever.
         *
         * The depth cap is a second line of defence: if a cycle already exists
         * in the data from before this check, the walk still terminates.
         */
        if (! $followUp->exists) {
            return;
        }

        $selfId = (int) $followUp->getKey();
        $seen   = [];
        $cursor = $next;

        for ($hops = 0; $cursor && $hops < FollowUp::MAX_CHAIN_DEPTH; $hops++) {
            $cursorId = (int) $cursor->getKey();

            if ($cursorId === $selfId) {
                $this->fail('next_follow_up_id', 'That would make the follow-up chain circular.');
            }

            if (isset($seen[$cursorId])) {
                // A pre-existing loop further down the chain; stop rather than spin.
                break;
            }

            $seen[$cursorId] = true;
            $cursor = $cursor->next_follow_up_id ? FollowUp::find($cursor->next_follow_up_id) : null;
        }
    }

    private function assertFarmerScope(?int $parcelId, ?int $pondId): void
    {
        if ($parcelId !== null) {
            $this->fail('farm_parcel_id', 'A whole-farm recommendation cannot name a parcel.');
        }

        if ($pondId !== null) {
            $this->fail('fishpond_id', 'A whole-farm recommendation cannot name a fishpond.');
        }
    }

    private function assertParcelScope(int $farmerId, ?int $parcelId, ?int $pondId): void
    {
        if ($pondId !== null) {
            $this->fail('fishpond_id', 'A parcel recommendation cannot name a fishpond.');
        }

        if ($parcelId === null) {
            $this->fail('farm_parcel_id', 'A parcel recommendation must name a parcel.');
        }

        $this->assertParcelBelongsTo($farmerId, $parcelId, 'farm_parcel_id');
    }

    private function assertLivestockScope(int $farmerId, ?int $parcelId, ?int $pondId): void
    {
        if ($pondId !== null) {
            $this->fail('fishpond_id', 'A livestock recommendation cannot name a fishpond.');
        }

        if ($parcelId === null) {
            $this->fail('farm_parcel_id', 'A livestock recommendation must name the holding.');
        }

        $parcel = $this->assertParcelBelongsTo($farmerId, $parcelId, 'farm_parcel_id');

        /*
         * Whether a parcel is livestock is decided by CommodityCatalogue, which
         * answers from which lookup table the commodity name appears in. No new
         * classification is introduced here, and no list of animal words.
         *
         * KIND_UNKNOWN is refused rather than allowed through. farm_parcels
         * .commodity is free text typed over years, so a name that matches no
         * lookup row is entirely possible — but calling it livestock anyway
         * would be asserting something nobody recorded.
         */
        $kind = $this->commodities->kindOf($parcel->commodity);

        if ($kind !== CommodityCatalogue::KIND_LIVESTOCK) {
            $this->fail('farm_parcel_id', match ($kind) {
                CommodityCatalogue::KIND_CROP => sprintf(
                    'Parcel %s is a crop holding (%s), so it cannot carry livestock advice.',
                    $parcel->parcel_number ?: $parcel->id,
                    $parcel->commodity
                ),
                default => sprintf(
                    'Parcel %s has commodity "%s", which is not in the livestock list, '
                    . 'so it cannot be confirmed as a livestock holding.',
                    $parcel->parcel_number ?: $parcel->id,
                    $parcel->commodity ?: '(none recorded)'
                ),
            });
        }
    }

    private function assertAquacultureScope(int $farmerId, ?int $parcelId, ?int $pondId): void
    {
        if ($parcelId !== null) {
            $this->fail('farm_parcel_id', 'An aquaculture recommendation cannot name a parcel.');
        }

        if ($pondId === null) {
            $this->fail('fishpond_id', 'An aquaculture recommendation must name a fishpond.');
        }

        $pond = Fishpond::find($pondId);

        if (! $pond) {
            $this->fail('fishpond_id', 'That fishpond does not exist.');
        }

        if ((int) $pond->farmer_id !== $farmerId) {
            $this->fail('fishpond_id', 'That fishpond belongs to a different farmer.');
        }
    }

    /** @throws ValidationException */
    private function assertParcelBelongsTo(int $farmerId, int $parcelId, string $field): FarmParcel
    {
        $parcel = FarmParcel::find($parcelId);

        if (! $parcel) {
            $this->fail($field, 'That parcel does not exist.');
        }

        if ((int) $parcel->farmer_id !== $farmerId) {
            $this->fail($field, 'That parcel belongs to a different farmer.');
        }

        return $parcel;
    }

    /**
     * @throws ValidationException
     * @return never
     */
    private function fail(string $field, string $message): void
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
