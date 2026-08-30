<?php

/*
|--------------------------------------------------------------------------
| RSBSA Enrollment Form — overlay field map
|--------------------------------------------------------------------------
|
| The official DA form is stamped, never redrawn: RsbsaFormFiller imports each
| page of forms/rsbsa-official.pdf with FPDI and writes only the farmer's data
| on top. Every line, box and label in the output is the government's own file.
|
| ALL COORDINATES ARE IN POINTS (72/inch) MEASURED FROM THE TOP-LEFT OF THE
| PAGE. FPDF's Text($x, $y) with 'pt' units uses the same origin, so these are
| used as-is. Text sits ON the baseline given, so for a field whose caption is
| printed underneath, aim a few points above that caption.
|
| Page size is US Letter, 612 x 792 pt.
|
| If the DA ever reissues the form, every coordinate here must be re-measured.
| Treat this file as configuration, not code. See the calibration-grid and
| checkbox-detection recipes in docs/rsbsa-overlay.md.
|
*/

return [

    /*
    |----------------------------------------------------------------------
    | Source document
    |----------------------------------------------------------------------
    | Must be PDF 1.4 or older: FPDI's free parser cannot read compressed
    | cross-reference streams. If import fails, run once:
    |   qpdf --stream-data=uncompress in.pdf forms/rsbsa-official.pdf
    */
    'template'   => 'forms/rsbsa-official.pdf',
    'font'       => 'Helvetica',
    'page_width' => 612,
    'page_height' => 792,

    /*
    |----------------------------------------------------------------------
    | Plain text fields  —  [x, y_from_top, font_size]
    |----------------------------------------------------------------------
    | Verified against a rendered fill on page 1.
    */
    'fields' => [
        1 => [
            'surname'       => [150, 168, 10],
            'first_name'    => [395, 168, 10],
            'middle_name'   => [131, 189, 10],
            'ext_name'      => [330, 189, 10],

            'perm_house'    => [172, 242, 8],
            'perm_street'   => [285, 242, 8],
            'perm_barangay' => [430, 242, 8],
            'perm_city'     => [80,  277, 8],
            'perm_province' => [250, 277, 8],
            'perm_region'   => [430, 277, 8],

            // NCR-only provincial address block.
            //
            // These were 325 / 360, which put the second row's values straight
            // on top of their captions (captions print at 334.6 and 360.6, so
            // the gap was only 0.6pt). Re-set to give the same clearance the
            // permanent block above uses and is verified at: +14.6pt on the
            // house/street/barangay row, +12.1pt on the city/province/region row.
            'prov_house'    => [172, 320,   8],
            'prov_street'   => [285, 320,   8],
            'prov_barangay' => [430, 320,   8],
            'prov_city'     => [80,  348.5, 8],
            'prov_province' => [250, 348.5, 8],
            'prov_region'   => [430, 348.5, 8],

            // Place of birth sits between two printed captions:
            //   380.9 (LUGAR NG KAPANGANAKAN)   404.2 CITY / MUNICIPALITY
            //   404.2 CITY / MUNICIPALITY       423.6 PROVINCE/STATE, COUNTRY
            // birth_prov was 410 — only 5.8pt under the caption above it, so at
            // 8pt its ascenders ran into "CITY / MUNICIPALITY". Moved to 413.
            'birth_city'    => [205, 392, 8],
            'birth_prov'    => [205, 413, 8],

            // The mother's names were at 430, just 5.4pt below the gloss
            // "(PANGALAN NG INA SA PAGKADALAGA)" printed at 424.6 — the text
            // collided with it. The band runs 424.6 to 447.6 (the FIRST NAME /
            // MIDDLE NAME / SURNAME captions), so 435 sits clear of both.
            'mother_first'  => [72,  435, 8],
            'mother_mid'    => [145, 435, 8],
            'mother_sur'    => [220, 435, 8],

            // Spouse row runs between "Name of spouse if married:" (501.6) and
            // the FIRST NAME / MIDDLE NAME / SURNAME captions (519.9). At 505
            // the first two ran into that label; 512 clears both sides.
            'spouse_first'  => [78,  512, 8],
            'spouse_mid'    => [150, 512, 8],
            'spouse_sur'    => [225, 512, 8],

            'id_type'       => [420, 555, 8],
            'id_number'     => [437, 570, 8],
            'icc_ip_name'   => [255, 597, 7],

            'org_1'         => [90,  628, 7],
            'org_2'         => [258, 628, 7],
            'org_3'         => [428, 628, 7],
        ],
    ],

    /*
    |----------------------------------------------------------------------
    | Checkboxes  —  [centre_x, centre_y_from_top]
    |----------------------------------------------------------------------
    | Centres of the printed boxes, found by the checkbox-detection script.
    | An X is drawn centred on each.
    */
    'checks' => [
        1 => [
            'no_middle_name'  => [99.6,  203.3],
            'no_ext_name'     => [310.3, 203.5],
            'sex_male'        => [462.5, 203.8],
            'sex_female'      => [507.1, 204.0],

            'owns_mobile_yes' => [504.0, 412.1],
            'owns_mobile_no'  => [533.0, 412.1],

            // Automatic detection found only Widow/er and Married. "Single"
            // and "Legally Separated" render differently and were derived by
            // symmetry from their row/column neighbours:
            //     Single  [x of Married]  [y of Widow]
            //     Separated [x of Widow]  [y of Married]
            // BOTH MUST BE CONFIRMED on the calibration grid before trusting a
            // printed form — a wrong tick here misstates a civil status.
            'civil_single'    => [71.8,  466.6],  // UNVERIFIED
            'civil_widow'     => [177.4, 466.6],
            'civil_married'   => [71.8,  481.2],
            'civil_separated' => [177.4, 481.2],  // UNVERIFIED

            'edu_preschool'   => [344.9, 474.5],
            'edu_shs'         => [445.0, 474.7],
            'edu_elementary'  => [345.1, 488.2],
            'edu_college'     => [445.0, 488.0],
            'edu_hs_nonk12'   => [345.1, 500.9],
            'edu_postgrad'    => [444.7, 501.4],
            'edu_jhs'         => [344.9, 513.8],
            'edu_vocational'  => [445.0, 513.8],
            'edu_none'        => [507.1, 514.3],

            'relig_christ'    => [72.7,  567.6],
            'relig_islam'     => [145.7, 567.6],
            'relig_others'    => [200.9, 567.6],
            'relig_none'      => [265.2, 567.6],

            'icc_yes'         => [73.7,  593.8],
            'icc_no'          => [110.6, 593.8],
            'pwd_yes'         => [342.7, 593.3],
            'pwd_no'          => [380.6, 593.3],
            'fourps_yes'      => [455.8, 596.6],
            'fourps_no'       => [485.0, 596.6],

            'sector_farmer'     => [75.4,  667.9],
            'sector_farmworker' => [184.6, 667.7],
            'sector_fisher'     => [376.6, 667.9],
            'sector_agriyouth'  => [487.0, 667.7],
        ],
    ],

    /*
    |----------------------------------------------------------------------
    | Character-box fields  —  [first_box_centre_x, y, pitch, max_chars]
    |----------------------------------------------------------------------
    | One character per printed box, each centred in its box.
    |
    | The date centres come from the small M O N / D D / Y Y Y Y guide letters
    | printed beneath each box: each letter sits under its own box, so the
    | letter positions ARE the box centres. Do not guess the pitch.
    |
    | The mobile row's first two boxes are PRE-PRINTED "0" and "9" on the form.
    | Only the remaining 10 digits are stamped, starting at box 3 (x = 387);
    | the filler strips a leading 09 / +639 for exactly this reason.
    */
    'char_boxes' => [
        1 => [
            'birth_month' => [78,  390, 12.0, 2],
            'birth_day'   => [116, 390, 12.0, 2],
            'birth_year'  => [150, 390, 11.7, 4],
            'mobile'      => [387, 390, 14.0, 10],
        ],
    ],

    /*
    |----------------------------------------------------------------------
    | PART 3 — Farm Parcel Information (page 2)
    |----------------------------------------------------------------------
    | The three parcel blocks are identical and evenly stacked, so parcel 1 is
    | mapped once and the rest derived by adding y_offset. Data keys are
    | parcel1_*, parcel2_*, parcel3_* — see RsbsaFieldMapper.
    |
    | Measured on page 2 of the official form:
    |   parcel body runs y = 72.7 .. 486.1 (3 blocks)
    |   "LOCATION:" captions at 87.7 / 224.3 / 361.1   -> pitch 136.6, 136.8
    |   "Type of Ownership" at 151.7 / 288.4 / 425.1   -> pitch 136.7, 136.7
    |
    | Right-hand column boundaries come from the DOCX table grid (14 columns
    | totalling 496.9pt from x = 62):
    |   cropping 237-311 | commodity 311-390 | size 390-437
    |   heads 437-479    | farm type 479-523 | organic 523-558
    |
    | Your schema stores ONE commodity per parcel, so values go in the first
    | commodity row (y = 72.7..91.4 for parcel 1).
    */
    'parcels' => [
        'page'     => 2,
        'count'    => 3,
        'y_offset' => 136.7,

        'fields' => [
            // left description block
            'barangay'      => [120, 87.0,  7],
            'city_province' => [90,  99.0,  7],
            'total_area'    => [186, 110.3, 7],
            'proof'         => [255, 143.0, 7],
            'land_owner'    => [80,  182.0, 7],

            // first commodity row on the right
            'cropping_schedule' => [245, 85.0, 7],
            'commodity'         => [318, 85.0, 7],
            'size_ha'           => [400, 85.0, 7],
            'heads_trees'       => [448, 85.0, 7],
            'farm_type'         => [492, 85.0, 7],
            'organic'           => [536, 85.0, 7],
        ],

        // UNVERIFIED — derived from each label's x minus roughly half a box.
        // The checkbox-detection script could not be run here (no pdftoppm),
        // so confirm these on the calibration grid before relying on a
        // printed form. A wrong tick here misstates land tenure.
        'checks' => [
            'ad_yes'         => [160.5, 118.9],
            'ad_no'          => [177.5, 118.9],
            'arb_yes'        => [160.3, 126.3],
            'arb_no'         => [178.0, 126.3],
            'own_registered' => [79.0,  158.5],
            'own_lessee'     => [145.0, 158.9],
            'own_tenant'     => [79.0,  165.8],
            'own_others'     => [145.0, 165.8],
        ],
    ],

    /*
    |----------------------------------------------------------------------
    | Font sizes for the generic stampers
    |----------------------------------------------------------------------
    */
    'check_font_size'    => 9,
    'char_box_font_size' => 9,

    // An X is centred horizontally, then dropped this far below the box
    // centre so it sits optically centred rather than baseline-centred.
    'check_baseline_drop' => 3.2,
];
