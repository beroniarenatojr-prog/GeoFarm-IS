<?php

/*
|--------------------------------------------------------------------------
| Climate and financial risk scoring
|--------------------------------------------------------------------------
|
| DRAFT WEIGHTS — NOT VALIDATED.
|
| These are a starting scheme for adviser and panel review. They are not
| derived from a trained model and carry no statistical validity: nothing here
| has been fitted against outcomes, so a score is a transparent sum of stated
| rules and nothing more. It must not be described as a machine-learning
| prediction, and the score must not be reported as a probability.
|
| Every weight and threshold is here rather than in code so the panel can
| revise them without a developer. Each factor a score awards is recorded on
| the assessment alongside the total, so any single result can be audited back
| to the rules and figures that produced it.
|
| When the trained model arrives, it replaces ClimateRiskScorer; this file and
| the stored results stay as the baseline it is measured against.
|
*/

return [

    /*
    | Version stamped onto every scored assessment. Bump it whenever a weight
    | or threshold below changes, so a result computed under old rules is never
    | silently compared with one computed under new rules.
    */
    'version' => 'draft-2026-09',

    /*
    | Score bands. A score is 0-100, the sum of the weights whose conditions
    | were met, capped at 100.
    */
    'bands' => [
        'moderate' => 30,   // at or above this, MODERATE
        'high'     => 60,   // at or above this, HIGH
    ],

    /*
    | What each factor contributes when its condition holds.
    |
    | Recorded history is weighted above self-report throughout: a season that
    | actually lost money is a stronger signal than a farmer's recollection of
    | how often it flooded.
    */
    'weights' => [
        // From crop_seasons — figures the office recorded.
        'previous_season_loss'   => 30,
        'cost_per_kilo_above_peers' => 20,
        'yield_below_peers'      => 20,
        'declining_yield'        => 5,

        // From the questionnaire — what the farmer reported.
        'frequent_flooding'      => 15,
        'frequent_drought'       => 15,
        'severe_climate_damage'  => 10,
        'no_adaptation'          => 10,
        'reported_financial_loss' => 10,
    ],

    /*
    | When a factor counts.
    */
    'thresholds' => [
        // Q2/Q3 answers at or beyond these count as frequent.
        'frequent_answers' => ['frequently', 'very_frequently'],

        // Q6 answers that count as severe damage.
        'severe_effects' => ['severe', 'total_loss'],

        // Fractions of the peer median/average, so the same numbers work for
        // any crop or barangay.
        'cost_per_kilo_ratio' => 1.20,  // 20% above peers
        'yield_ratio'         => 0.80,  // 20% below peers

        // Below this many comparable seasons, peer comparison is not
        // attempted at all - a "peer average" drawn from one other farm says
        // nothing, and would put a factor on a farmer for no reason.
        'minimum_peers' => 3,
    ],

    /*
    |----------------------------------------------------------------------
    | Recommended actions
    |----------------------------------------------------------------------
    |
    | DRAFT WORDING — FOR MAO / ADVISER REVIEW.
    |
    | Written to the same standard as the weights above: these are neutral
    | prompts to consult the Municipal Agriculture Office, not agronomic
    | prescriptions. None of it is drawn from an approved DA or MAO advisory,
    | and it should be replaced with the office's own guidance before the
    | system is used to advise real farmers.
    |
    | The deliberate limit: nothing here names a variety, a chemical, a rate or
    | a schedule. Those are decisions for an agriculturist who has seen the
    | land, and a system that issued them from a questionnaire would be giving
    | technical advice it has no basis for.
    |
    | Keyed by the factor keys ClimateRiskScorer emits, so a recommendation
    | only ever appears because a specific, stated condition was found true.
    |
    */
    'recommendations' => [

        'previous_season_loss' => 'Review the major expenses from last season against what the harvest earned, and discuss the result with the Municipal Agriculture Office before committing to the same inputs again.',

        'cost_per_kilo_above_peers' => 'Production costs per kilo are higher than nearby farms growing the same crop. Ask the Municipal Agriculture Office to review the main expense items - seed, fertiliser, labour and land preparation - for cost-reducing practices suited to the area.',

        'yield_below_peers' => 'Yield is below other farms growing the same crop nearby. Request a technical assessment of crop management practices from the Municipal Agriculture Office.',

        'declining_yield' => 'Yield on this parcel has fallen across recent seasons. Ask the Municipal Agriculture Office about soil testing and appropriate production interventions.',

        'frequent_flooding' => 'Flooding is a recurring problem on this farm. Consult the Municipal Agriculture Office about drainage and flood-management practices, and about flood-tolerant varieties and planting schedules suitable for the area.',

        'frequent_drought' => 'Dry periods are a recurring problem on this farm. Consult the Municipal Agriculture Office about water-management practices, irrigation options, and drought-tolerant varieties suitable for the area.',

        'severe_climate_damage' => 'Climate events have caused severe losses on this farm. Coordinate with the Municipal Agriculture Office for a technical assessment and to ask what agricultural assistance is available.',

        'no_adaptation' => 'No climate adaptation practices are currently recorded. Ask the Municipal Agriculture Office which practices are appropriate for this farm and what technical assistance is available.',

        'reported_financial_loss' => 'Coordinate with the Municipal Agriculture Office regarding assistance programmes and support available to farmers who have experienced climate-related losses.',
    ],

    /*
    | Shown when the assessment raises no factors.
    |
    | A farmer at lower risk still gets advice - the point of the assessment is
    | to say what to do next, not only to warn. Left out, a clean result would
    | read as the system having nothing to offer.
    |
    | These carry the same shape as the keyed advice above so a screen never has
    | to tell the two apart.
    */
    'baseline_recommendations' => [
        [
            'title'    => 'Keep recording every season',
            'category' => 'planning',
            'text'     => 'Keep recording production costs, harvest weights and selling prices each season, so changes in profitability are visible early.',
        ],
        [
            'title'    => 'Continue current adaptation practices',
            'category' => 'climate',
            'text'     => 'Continue the climate adaptation practices already in use.',
        ],
        [
            'title'    => 'Watch input costs against farmgate price',
            'category' => 'inputs',
            'text'     => 'Monitor input costs against the price the harvest earns.',
        ],
        [
            'title'    => 'Ask about further improvements',
            'category' => 'assistance',
            'text'     => 'Ask the Municipal Agriculture Office about practices that may further improve productivity.',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | How a recommendation is presented
    |--------------------------------------------------------------------------
    |
    | Presentation only. Nothing here changes a score, a band or whether a
    | recommendation appears at all - that is still decided solely by which
    | factor the scorer found true. This adds a short title, a category and a
    | priority so the interface can lead with the few actions that matter
    | rather than listing nine of equal weight.
    |
    | Priority is stated rather than derived from the weights, because urgency
    | and contribution are not the same thing: a small weight can still be the
    | thing to do first if it is cheap and time-bound.
    |
    | Keyed by the factor keys ClimateRiskScorer and ParcelRiskAnalyser emit.
    */
    'recommendation_meta' => [
        'previous_season_loss' => [
            'title' => 'Review last season’s costs against its income',
            'category' => 'planning', 'priority' => 'high',
        ],
        'cost_per_kilo_above_peers' => [
            'title' => 'Review the main input costs',
            'category' => 'inputs', 'priority' => 'high',
        ],
        'yield_below_peers' => [
            'title' => 'Request a technical assessment of crop management',
            'category' => 'crop', 'priority' => 'high',
        ],
        'declining_yield' => [
            'title' => 'Ask about soil testing for this parcel',
            'category' => 'soil', 'priority' => 'medium',
        ],
        'frequent_flooding' => [
            'title' => 'Inspect and improve drainage',
            'category' => 'water', 'priority' => 'high',
        ],
        'frequent_drought' => [
            'title' => 'Review water and irrigation management',
            'category' => 'water', 'priority' => 'high',
        ],
        'severe_climate_damage' => [
            'title' => 'Request a technical assessment and ask about assistance',
            'category' => 'climate', 'priority' => 'high',
        ],
        'no_adaptation' => [
            'title' => 'Adopt climate adaptation practices',
            'category' => 'climate', 'priority' => 'medium',
        ],
        'reported_financial_loss' => [
            'title' => 'Coordinate with the office on assistance programmes',
            'category' => 'assistance', 'priority' => 'medium',
        ],
    ],

    /*
    | Categories a recommendation can belong to.
    |
    | A screen shows only the categories that actually appear in a farmer's
    | result, so a crop farmer is never shown an empty livestock heading.
    */
    'categories' => [
        'crop'        => ['label' => 'Crop Management',            'icon' => '🌱'],
        'water'       => ['label' => 'Water Management',           'icon' => '💧'],
        'pest'        => ['label' => 'Pest & Disease Management',  'icon' => '🦠'],
        'climate'     => ['label' => 'Climate Preparedness',       'icon' => '🌦'],
        'soil'        => ['label' => 'Soil Management',            'icon' => '🌾'],
        'livestock'   => ['label' => 'Livestock Management',       'icon' => '🐄'],
        'aquaculture' => ['label' => 'Aquaculture Management',     'icon' => '🐟'],
        'inputs'      => ['label' => 'Input & Resource Management','icon' => '📦'],
        'planning'    => ['label' => 'Production Planning',        'icon' => '📅'],
        'assistance'  => ['label' => 'Agricultural Assistance',    'icon' => '🏢'],
    ],

    /*
    | How many actions lead the result before the rest are folded away.
    |
    | Three, because a farmer handed nine things to do does none of them.
    */
    'top_actions' => 3,

    /*
    |--------------------------------------------------------------------------
    | Agricultural office interventions
    |--------------------------------------------------------------------------
    |
    | What the OFFICE might do, as distinct from what the farmer is advised to
    | do. The two are deliberately different sentences: "improve drainage" is
    | for the farmer; "visit the farm and assess drainage" is the office's own
    | work, and only the office can do it.
    |
    | Nothing here happens on its own. These are suggestions a staff member may
    | choose to open as a real intervention; until somebody does, no record
    | exists. A system that opened its own work would fill the queue with
    | visits nobody agreed to make.
    |
    | DRAFT WORDING — FOR MAO / ADVISER REVIEW, to the same standard as the
    | advice above: no variety, chemical, rate or schedule is named.
    |
    */
    'intervention_types' => [
        'farm_visit'           => ['label' => 'Farm visit', 'icon' => '🏢'],
        'drainage_assessment'  => ['label' => 'Drainage and water assessment', 'icon' => '💧'],
        'water_assessment'     => ['label' => 'Water supply assessment', 'icon' => '💧'],
        'technical_assistance' => ['label' => 'Technical assistance', 'icon' => '🌱'],
        'soil_testing'         => ['label' => 'Soil testing', 'icon' => '🌾'],
        'field_monitoring'     => ['label' => 'Field monitoring', 'icon' => '🦠'],
        'livestock_monitoring' => ['label' => 'Livestock monitoring', 'icon' => '🐄'],
        'pond_monitoring'      => ['label' => 'Aquaculture monitoring', 'icon' => '🐟'],
        'cost_review'          => ['label' => 'Production cost review', 'icon' => '📦'],
        'assistance_referral'  => ['label' => 'Assistance programme referral', 'icon' => '🏢'],
    ],

    /*
    | Which intervention each risk factor suggests.
    |
    | Keyed by the same factor keys ClimateRiskScorer and ParcelRiskAnalyser
    | emit, so an office suggestion is traceable to the identical stated
    | condition as the farmer's recommendation — one chain, two audiences.
    |
    | A factor absent from this map suggests no intervention at all. That is
    | the honest outcome for a condition the office has not decided how to act
    | on, and far better than defaulting everything to a farm visit.
    */
    'interventions' => [
        'frequent_flooding' => [
            'type' => 'drainage_assessment',
            'reason' => 'Flooding reported as a frequent problem on this farm',
        ],
        'frequent_drought' => [
            'type' => 'water_assessment',
            'reason' => 'Drought or prolonged dry periods reported as frequent',
        ],
        'severe_climate_damage' => [
            'type' => 'farm_visit',
            'reason' => 'Climate events have caused severe or total loss of production',
        ],
        'no_adaptation' => [
            'type' => 'technical_assistance',
            'reason' => 'No climate adaptation practices are currently in use',
        ],
        'reported_financial_loss' => [
            'type' => 'assistance_referral',
            'reason' => 'Farmer reported financial loss from climate events',
        ],
        'previous_season_loss' => [
            'type' => 'cost_review',
            'reason' => 'The last comparable season did not cover its costs',
        ],
        'cost_per_kilo_above_peers' => [
            'type' => 'cost_review',
            'reason' => 'Production cost per kilo is well above comparable nearby farms',
        ],
        'yield_below_peers' => [
            'type' => 'technical_assistance',
            'reason' => 'Yield per hectare is below comparable nearby farms',
        ],
        'declining_yield' => [
            'type' => 'soil_testing',
            'reason' => 'Yield per hectare has fallen across comparable recorded seasons',
        ],
    ],

    /*
    | How long after opening an intervention its target date falls, by
    | priority. A starting point staff can change on the record, not a rule.
    */
    'intervention_target_days' => [
        'high'   => 7,
        'medium' => 21,
        'low'    => 60,
    ],
];
