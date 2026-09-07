<?php

namespace App\Http\Controllers\Farmer;

use App\Http\Controllers\Controller;
use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Services\AuditService;
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
        ]);
    }

    public function store(Request $request)
    {
        $farmer = $this->farmerFor($request);

        $data = $request->validate($this->rules($farmer));

        $this->rejectContradictoryChoices($request);

        $assessment = ClimateRiskAssessment::create($data + [
            'farmer_id'   => $farmer->id,
            'assessed_by' => $request->user()->id,
            'assessed_at' => now(),
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

    private function rules(Farmer $farmer): array
    {
        $in = fn (array $options) => ['nullable', Rule::in($options)];

        return [
            // Both must belong to this farmer, or the assessment would attach
            // to someone else's land.
            'farm_parcel_id' => ['nullable', Rule::exists('farm_parcels', 'id')->where('farmer_id', $farmer->id)],
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
            'loss_types.*' => Rule::in(ClimateRiskAssessment::LOSS_TYPES),

            'had_financial_loss' => $in(ClimateRiskAssessment::YES_NO_UNSURE),
            // The amount is only meaningful once a loss is claimed, and is
            // then the point of the question.
            'estimated_loss_amount' => 'exclude_unless:had_financial_loss,yes|required|numeric|min:0|max:99999999.99',

            'had_cost_increase'    => $in(ClimateRiskAssessment::YES_NO_UNSURE),
            'estimated_extra_cost' => 'exclude_unless:had_cost_increase,yes|required|numeric|min:0|max:99999999.99',

            'season_comparison' => $in(ClimateRiskAssessment::SEASON_COMPARISONS),

            'adaptation_practices'   => 'nullable|array',
            'adaptation_practices.*' => Rule::in(ClimateRiskAssessment::ADAPTATION_PRACTICES),
            'adaptation_effectiveness' => $in(ClimateRiskAssessment::EFFECTIVENESS),
            'adaptation_barrier'       => $in(ClimateRiskAssessment::ADAPTATION_BARRIERS),

            'received_assistance' => $in(ClimateRiskAssessment::YES_NO_UNSURE),
            'assistance_types'    => 'exclude_unless:received_assistance,yes|nullable|array',
            'assistance_types.*'  => Rule::in(ClimateRiskAssessment::ASSISTANCE_TYPES),
            'assistance_helpfulness' => $in(ClimateRiskAssessment::HELPFULNESS),

            'perceived_risk'       => $in(ClimateRiskAssessment::PERCEIVED_RISKS),
            'anticipated_factors'  => 'nullable|array|max:' . ClimateRiskAssessment::MAX_ANTICIPATED_FACTORS,
            'anticipated_factors.*' => Rule::in(ClimateRiskAssessment::ANTICIPATED_FACTORS),
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
