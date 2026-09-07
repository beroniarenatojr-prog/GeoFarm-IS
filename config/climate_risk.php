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
];
