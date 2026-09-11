<?php

namespace App\Http\Controllers\Farmer;

use App\Http\Controllers\Controller;
use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Services\AuditService;
use App\Services\ClimateRecommendationEngine;
use App\Services\CommodityCatalogue;
use App\Services\ClimateRiskScorer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * The climate and financial risk questionnaire, filled in from the portal.
 *
 * Each submission is a new row. Re-assessing never overwrites: the office
 * needs to see how a holding's exposure changed, and the research needs the
 * history intact.
 *
 * The instrument asks for production cost and income, but this controller does
 * not collect them. Both already exist on crop_seasons, so the form shows the
 * chosen season's recorded figures instead of asking a farmer to type numbers
 * the office already holds - two copies free to disagree would be worse than
 * one.
 */
class ClimateRiskAssessmentController extends Controller
{
    public function create(Request $request)
    {
        $farmer = $this->farmerFor($request);

        return Inertia::render('Farmer/RiskAssessment', [
            'farmer'  => ['id' => $farmer->id, 'name' => $farmer->full_name],
            // Only completed croppings: the questionnaire asks about the most
            // recently finished season, and one still growing has no outcome.
            'seasons' => $farmer->parcels
                ->flatMap->seasons
                ->whereNotNull('harvest_date')
                ->sortByDesc('harvest_date')
                ->take(10)
                ->map(fn ($season) => [
                    'id'              => $season->id,
                    'label'           => trim(sprintf(
                        '%s %s %s',
                        $season->crop?->crop_name ?? 'Crop',
                        ucfirst($season->season ?? ''),
                        $season->cropping_year ?? '',
                    )),
                    'parcel_id'       => $season->parcel_id,
                    'production_cost' => $season->production_cost,
                    'total_income'    => $season->total_income,
                    'net_farm_income' => $season->net_farm_income,
                    'outcome'         => $season->financial_outcome,
                ])->values(),
            'latest'  => $farmer->latestRiskAssessment,

            /*
             * What this farmer actually works, for the "what are you
             * assessing?" step.
             *
             * Built from their own records, so the choices are their real
             * parcels and ponds rather than a generic list. Without this step
             * every assessment landed on the whole farm, and a rice answer was
             * counted against a carabao.
             */
            'activities' => $this->activitiesFor($farmer),

            // The answers each scope offers, so the page narrows its lists the
            // same way the validator does.
            'scopeOptions' => ClimateRiskAssessment::SCOPE_OPTIONS,

            /*
             * Arrived from a dashboard "Assess" button.
             *
             * Resolved here rather than trusted from the query string: the id
             * is checked against this farmer's own records first, so a link
             * naming someone else's parcel preselects nothing instead of
             * quietly pointing the form at land that is not theirs.
             */
            'preselect' => $this->preselectFrom($request, $farmer),
        ]);
    }

    /** The activity a deep link named, if the farmer actually owns it. */
    private function preselectFrom(Request $request, Farmer $farmer): ?array
    {
        $scope = $request->query('scope');
        $id = $request->query('activity');

        if (! in_array($scope, ClimateRiskAssessment::ACTIVITY_SCOPES, true) || ! ctype_digit((string) $id)) {
            return null;
        }

        $id = (int) $id;

        $owns = $scope === ClimateRiskAssessment::SCOPE_AQUACULTURE
            ? $farmer->fishponds->contains('id', $id)
            : $farmer->parcels->contains('id', $id);

        if (! $owns) {
            return null;
        }

        return [
            'scope' => $scope,
            'farm_parcel_id' => $scope === ClimateRiskAssessment::SCOPE_AQUACULTURE ? '' : $id,
            'fishpond_id' => $scope === ClimateRiskAssessment::SCOPE_AQUACULTURE ? $id : '',
        ];
    }

    /**
     * The farmer's assessable activities, grouped by what they are.
     *
     * A livestock holding is a farm parcel whose commodity is an animal —
     * that is how the register records it, with a barangay and a head count —
     * so livestock and crop parcels come from the same table and are told
     * apart by their commodity.
     */
    private function activitiesFor(Farmer $farmer): array
    {
        $catalogue = app(CommodityCatalogue::class);

        $parcels = $farmer->parcels->map(fn ($parcel) => [
            'id'        => $parcel->id,
            'kind'      => $catalogue->kindOf($parcel->commodity) === CommodityCatalogue::KIND_LIVESTOCK
                ? ClimateRiskAssessment::SCOPE_LIVESTOCK
                : ClimateRiskAssessment::SCOPE_PARCEL,
            'commodity' => $parcel->commodity,
            'barangay'  => $parcel->barangay,
            'label'     => $parcel->parcel_number ? "Parcel #{$parcel->parcel_number}" : 'Parcel',
            'size'      => $catalogue->kindOf($parcel->commodity) === CommodityCatalogue::KIND_LIVESTOCK
                ? ['value' => (float) ($parcel->no_of_heads_trees ?? 0), 'unit' => 'heads']
                : ['value' => (float) ($parcel->total_area_ha ?? 0), 'unit' => 'ha'],
        ]);

        return [
            ClimateRiskAssessment::SCOPE_PARCEL => $parcels
                ->where('kind', ClimateRiskAssessment::SCOPE_PARCEL)->values()->all(),

            ClimateRiskAssessment::SCOPE_LIVESTOCK => $parcels
                ->where('kind', ClimateRiskAssessment::SCOPE_LIVESTOCK)->values()->all(),

            ClimateRiskAssessment::SCOPE_AQUACULTURE => $farmer->fishponds
                ->map(fn ($pond) => [
                    'id'        => $pond->id,
                    'kind'      => ClimateRiskAssessment::SCOPE_AQUACULTURE,
                    'commodity' => $pond->species,
                    'barangay'  => null,
                    'label'     => $pond->pond_type ? "Fish Pond ({$pond->pond_type})" : 'Fish Pond',
                    'size'      => ['value' => (float) ($pond->area_hectares ?? 0), 'unit' => 'ha'],
                ])->values()->all(),
        ];
    }

    public function store(
        Request $request,
        ClimateRiskScorer $scorer,
        ClimateRecommendationEngine $recommendations,
    ) {
        $farmer = $this->farmerFor($request);

        /*
         * The scope decides which answers are even acceptable, so it is read
         * before the rest is validated. Anything unrecognised falls back to a
         * whole-farm assessment — which is what an assessment naming no
         * activity actually is — and the scope_type rule then rejects it.
         */
        $scope = in_array($request->input('scope_type'), ClimateRiskAssessment::SCOPES, true)
            ? $request->input('scope_type')
            : ClimateRiskAssessment::SCOPE_FARMER;

        $data = $request->validate($this->rules($farmer, $scope));

        $this->rejectContradictoryChoices($request);

        /*
         * A whole-farm assessment names no activity.
         *
         * Cleared rather than trusted: a form that changed scope after a
         * parcel was picked would otherwise leave the parcel id behind, and
         * the record would claim to be about land it was not written for.
         */
        if ($scope === ClimateRiskAssessment::SCOPE_FARMER) {
            $data['farm_parcel_id'] = null;
            $data['fishpond_id'] = null;
        }

        if ($scope === ClimateRiskAssessment::SCOPE_AQUACULTURE) {
            $data['farm_parcel_id'] = null;
        } else {
            $data['fishpond_id'] = null;
        }

        // Written explicitly rather than left to the column default, so the
        // stored row says what it is instead of relying on the schema to.
        $data['scope_type'] = $scope;

        $assessment = ClimateRiskAssessment::create($data + [
            'farmer_id'   => $farmer->id,
            'assessed_by' => $request->user()->id,
            'assessed_at' => now(),
        ]);

        /*
         * Score it now and keep the result.
         *
         * Stored rather than computed on read, because the weights live in
         * config and the panel is expected to revise them. An assessment that
         * silently reported a different level in June than it did in March
         * could not be cited, so each result carries the version of the rules
         * that produced it.
         */
        $result = $scorer->score($assessment->load('season.parcel'));

        $assessment->update([
            'risk_level'      => $result['level'],
            'risk_score'      => $result['score'],
            'risk_factors'    => $result['factors'],
            'scoring_version' => $result['version'],
            // Kept with the score, not worked out again when the page is
            // opened: what the farmer was actually advised, on the day they
            // were advised it, is the part that matters if anyone asks later.
            // Worded for the activity this assessment was about, so a herd is
            // never advised about planting schedules.
            'recommendations' => $recommendations->for($result['factors'], $assessment->scope_type),
        ]);

        AuditService::log('create', 'climate_risk_assessments', $assessment->id, null, [
            'farmer_id'      => $farmer->id,
            'crop_season_id' => $assessment->crop_season_id,
        ]);

        return redirect()
            ->route('farmer.dashboard')
            ->with('success', 'Your risk assessment has been recorded.');
    }

    /**
     * The farmer whose assessment this is.
     *
     * A farmer reaches this only through their own account, so the record is
     * found from the signed-in user rather than from anything in the request -
     * there is no id to tamper with.
     */
    private function farmerFor(Request $request): Farmer
    {
        return Farmer::where('user_id', $request->user()->id)
            ->with(['parcels.seasons.crop'])
            ->firstOrFail();
    }

    private function rules(Farmer $farmer, string $scope = ClimateRiskAssessment::SCOPE_FARMER): array
    {
        $in = fn (array $options) => ['nullable', Rule::in($options)];

        /*
         * Answers narrowed to the ones this activity actually offers.
         *
         * Enforced here and not only in the form: hiding seed cost from a
         * livestock assessment on screen would still let it be posted
         * directly, and a livestock record holding a seed-cost answer is the
         * very mixing scoping exists to prevent.
         */
        $scoped = fn (string $question, array $full) => [
            'nullable',
            Rule::in(ClimateRiskAssessment::optionsFor($scope, $question, $full)),
        ];

        return [
            /*
             * Optional, and absent means the whole farm.
             *
             * That is not leniency: an assessment naming no activity IS a
             * whole-farm assessment, which is what every one recorded before
             * scoping existed was. Requiring it would break those callers to
             * no benefit. A value that is present but unrecognised is still
             * refused.
             */
            'scope_type' => ['nullable', Rule::in(ClimateRiskAssessment::SCOPES)],

            /*
             * The activity must belong to this farmer, and must match the
             * scope claimed for it. Required for an activity scope, because an
             * assessment that names no activity is a whole-farm assessment
             * however it is labelled.
             */
            'farm_parcel_id' => [
                Rule::requiredIf(fn () => in_array(
                    request('scope_type'),
                    [ClimateRiskAssessment::SCOPE_PARCEL, ClimateRiskAssessment::SCOPE_LIVESTOCK],
                    true,
                )),
                'nullable',
                Rule::exists('farm_parcels', 'id')->where('farmer_id', $farmer->id),
            ],

            'fishpond_id' => [
                Rule::requiredIf(fn () => request('scope_type') === ClimateRiskAssessment::SCOPE_AQUACULTURE),
                'nullable',
                Rule::exists('fishponds', 'id')->where('farmer_id', $farmer->id),
            ],

            'crop_season_id' => ['nullable', Rule::exists('crop_seasons', 'id')
                ->whereIn('parcel_id', $farmer->parcels->pluck('id')->all() ?: [0])],

            'climate_events'   => 'nullable|array',
            'climate_events.*' => Rule::in(ClimateRiskAssessment::CLIMATE_EVENTS),
            'flood_frequency'   => $in(ClimateRiskAssessment::FREQUENCIES),
            'drought_frequency' => $in(ClimateRiskAssessment::FREQUENCIES),
            'heat_frequency'    => $in(ClimateRiskAssessment::FREQUENCIES),
            'storm_frequency'   => $in(ClimateRiskAssessment::FREQUENCIES),

            'worst_effect' => $in(ClimateRiskAssessment::EFFECTS),
            'loss_types'   => 'nullable|array',
            'loss_types.*' => $scoped('loss_types', ClimateRiskAssessment::LOSS_TYPES),

            'had_financial_loss' => $in(ClimateRiskAssessment::YES_NO_UNSURE),
            // The amount is only meaningful once a loss is claimed, and is
            // then the point of the question.
            'estimated_loss_amount' => 'exclude_unless:had_financial_loss,yes|required|numeric|min:0|max:99999999.99',

            'had_cost_increase'    => $in(ClimateRiskAssessment::YES_NO_UNSURE),
            'estimated_extra_cost' => 'exclude_unless:had_cost_increase,yes|required|numeric|min:0|max:99999999.99',

            'season_comparison' => $in(ClimateRiskAssessment::SEASON_COMPARISONS),

            'adaptation_practices'   => 'nullable|array',
            'adaptation_practices.*' => $scoped('adaptation_practices', ClimateRiskAssessment::ADAPTATION_PRACTICES),
            'adaptation_effectiveness' => $in(ClimateRiskAssessment::EFFECTIVENESS),
            'adaptation_barrier'       => $in(ClimateRiskAssessment::ADAPTATION_BARRIERS),

            'received_assistance' => $in(ClimateRiskAssessment::YES_NO_UNSURE),
            'assistance_types'    => 'exclude_unless:received_assistance,yes|nullable|array',
            'assistance_types.*'  => Rule::in(ClimateRiskAssessment::ASSISTANCE_TYPES),
            'assistance_helpfulness' => $in(ClimateRiskAssessment::HELPFULNESS),

            'perceived_risk'       => $in(ClimateRiskAssessment::PERCEIVED_RISKS),
            'anticipated_factors'  => 'nullable|array|max:' . ClimateRiskAssessment::MAX_ANTICIPATED_FACTORS,
            'anticipated_factors.*' => $scoped('anticipated_factors', ClimateRiskAssessment::ANTICIPATED_FACTORS),
        ];
    }

    /**
     * "None" cannot be true alongside something.
     *
     * A farmer who selects both None and Flooding has answered two
     * incompatible things, and the row would be unusable for analysis. Caught
     * here rather than in the rules array because Laravel has no rule for
     * "this value excludes every other".
     */
    private function rejectContradictoryChoices(Request $request): void
    {
        $exclusive = [
            'climate_events'       => 'climate events',
            'loss_types'           => 'types of loss',
            'adaptation_practices' => 'adaptation practices',
        ];

        $errors = [];

        foreach ($exclusive as $field => $label) {
            $chosen = (array) $request->input($field, []);

            if (in_array(ClimateRiskAssessment::EXCLUSIVE_CHOICE, $chosen, true) && count($chosen) > 1) {
                $errors[$field] = "Choose either \"None\" or specific {$label}, not both.";
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
