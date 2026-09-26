<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Weighted moving average
    |--------------------------------------------------------------------------
    |
    | Rule-based, statistical forecasting from a farmer's own recorded harvests.
    | Nothing here is trained, fitted or learned: the weights below are chosen
    | by the office, not derived from the data, and can be tuned without
    | touching code.
    |
    | Most recent season first. The three must sum to 1.0 for the full-history
    | case; shorter histories are renormalised by the divisor, so a two-season
    | average uses 0.5 and 0.3 over 0.8 rather than quietly under-predicting.
    |
    */

    'weights' => [0.5, 0.3, 0.2],

    /*
    |--------------------------------------------------------------------------
    | Assessment threshold
    |--------------------------------------------------------------------------
    |
    | A farmer is flagged for assessment when actual yield falls more than this
    | percentage below the prediction. 20 means "came in more than a fifth
    | short of what their own history suggested".
    |
    */

    'yield_gap_threshold_percent' => 20,

    /*
    |--------------------------------------------------------------------------
    | Calamity
    |--------------------------------------------------------------------------
    |
    | A season disturbed by weather says nothing useful about what a farm
    | normally produces, so those seasons are left out of the average. The flag
    | is NOT a column: it is read from the climate risk assessment already
    | linked to the cropping through crop_season_id, so the two can never
    | disagree and no duplicate field has to be kept in step.
    |
    | `climate_events` records what the farmer reported. 'none' is one of its
    | permitted values and means exactly that, so it never counts as a calamity.
    |
    */

    'calamity' => [

        // An assessment naming any of these marks its season as affected.
        'events' => [
            'flooding', 'drought', 'extreme_heat',
            'strong_winds', 'heavy_rainfall', 'unpredictable_rainfall', 'other',
        ],

        /*
         * Reported event mapped to the calamity vocabulary the module reports.
         *
         * 'pest' is deliberately absent: the assessment's own event list has no
         * pest option, so claiming one from this data would be an invention.
         * Anything unmapped becomes 'other', which is honest about what is
         * known rather than guessing at a cause.
         */
        'types' => [
            'flooding'               => 'flood',
            'drought'                => 'drought',
            'strong_winds'           => 'typhoon',
            'heavy_rainfall'         => 'other',
            'unpredictable_rainfall' => 'other',
            'extreme_heat'           => 'other',
            'other'                  => 'other',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Units
    |--------------------------------------------------------------------------
    |
    | yield_kg is not always kilograms — crop_seasons carries a production_unit,
    | and some croppings are recorded in sacks. Adding 40 sacks to 5,000 kg
    | would report 5,040 kg of production, so only rows on the kilogram basis
    | are used. A null unit is a row encoded before the column existed, which
    | means kilograms.
    |
    */

    'kilogram_units' => ['kg'],

];
