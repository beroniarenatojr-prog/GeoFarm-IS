<?php

/*
|--------------------------------------------------------------------------
| RSBSA Enrollment Form — print layout
|--------------------------------------------------------------------------
|
| Every size, spacing and length used by the printable RSBSA Enrollment Form
| lives here, so the form can be tuned without touching the markup in
| resources/views/pdf/rsbsa-enrollment-form.blade.php.
|
| Units are CSS pixels unless the key says otherwise. DomPDF treats 1px as
| 1/96 inch, so 1px == 0.75pt on the printed sheet.
|
| Measurements marked "official:" were extracted from the DA's own file,
| public/images/RSBSA-REGISTRATION-FORM-01-2024_Latest.pdf.
|
| Config is not cached in development, so edits show on the next refresh.
| If you ever run `php artisan config:cache`, run `config:clear` after editing.
|
*/

return [

    /*
    |----------------------------------------------------------------------
    | Paper
    |----------------------------------------------------------------------
    | The official DA form is LETTER: its MediaBox is 612 x 792 pt =
    | 8.50 x 11.00 in. Matching it keeps every proportion below 1:1.
    |
    | Official printed content is 498.7pt wide => 56.7pt (20mm) side margins,
    | with only a thin margin top and bottom. 20mm here reproduces that width
    | exactly. 'margin' accepts any CSS shorthand.
    |
    | Other sizes DomPDF accepts: 'legal' (8.5x14), 'folio' (8.5x13), 'a4'.
    */
    'paper' => [
        'size'        => 'letter',
        'orientation' => 'portrait',
        'margin'      => '3mm 20mm',
    ],

    /*
    |----------------------------------------------------------------------
    | Type sizes
    |----------------------------------------------------------------------
    | The official form is dense: ~22pt of vertical pitch per field row, two
    | columns split at the halfway point. These sizes match that density.
    | Raise them for legibility; lower them if a section spills to a new page.
    */
    'font' => [
        'base'        => 8.7,      // fallback for anything unstyled
        'label'       => 8.7,   // official 6.5pt    // field captions, e.g. "SURNAME"
        'gloss'       => 7.3,   // official ~5.5pt    // italic Tagalog text, e.g. "(APELYIDO)"
        'under'       => 7.0,    // small captions printed under a line
        'value'       => 13.3,  // official 10pt     // the farmer's data on main fields
        'value_small' => 10.7,  // official 8pt    // the farmer's data on compact fields
        'tiny'        => 8,     // official 6pt      // footnotes under PART 2
        'consent'     => 3.7,    // PART 4 consent + data privacy paragraphs
        'legend'      => 3.3,    // the three legend panels on page 2
        'section_bar' => 11.3,  // official 8.5pt

        // PART 3 packs three parcel blocks plus consent onto one sheet, so
        // page 2 runs a notch below the official page-1 sizes.
        'label_p2'       => 5.0,
        'gloss_p2'       => 4.5,
        'under_p2'       => 4.7,
        'value_small_p2' => 6.0,
    ],

    /*
    |----------------------------------------------------------------------
    | Spacing
    |----------------------------------------------------------------------
    | Page 1 and page 2 are padded separately: page 1 has fewer rows so they
    | breathe, page 2 is dense and runs tight to stay on one sheet.
    */
    'spacing' => [
        'page1_cell_padding'  => '1px 4px',   // vertical then horizontal
        'page2_cell_padding'  => '0px 3px',
        'section_bar_padding' => '1px 5px',
        'fill_min_height'     => 9,          // height of a writable ruled line
        'checkbox'            => 8,           // the little X boxes
    ],

    /*
    |----------------------------------------------------------------------
    | Header
    |----------------------------------------------------------------------
    | Drop the DA seal into public/images/ under any of the names listed in
    | 'logo_files' — the first one found is used.
    |
    | official: 2x2 picture box is 122pt square (163px); the whole header
    | block including the transaction code runs ~131pt (175px) tall.
    */
    'header' => [
        'logo_files'         => ['images/DA.jpg', 'images/DA.png', 'images/da-logo.png', 'images/da.jpg'],
        'logo_width'         => 58,   // height follows the image's own ratio
        'title_small'        => 8.5,  // "REGISTRY SYSTEM FOR BASIC SECTORS..."
        'title_large'        => 22,   // "RSBSA Enrollment Form"
        'picture_cell_width' => 163,  // official: 122pt square
        'photo_size'         => 128,  // the farmer's photo inside that cell
        'revision_note'      => 'REVISED VERSION: 01-2024',
        'instructions_font'  => 6.4,

        // Page 2 repeats the masthead, but the official prints it smaller
        // there because PART 3 needs the room.
        'page2_logo_width'   => 40,
        'page2_title_small'  => 7,
        'page2_title_large'  => 15,
    ],

    /*
    |----------------------------------------------------------------------
    | Character boxes
    |----------------------------------------------------------------------
    | The one-letter-per-cell runs used for PCN, TRN, RSBSA number, mobile
    | number and the rotational tiller's RSBSA number.
    |
    | 'group' inserts a dash every N cells; set it to 0 for an unbroken run.
    | official: the PCN/TRN row is 16 cells split 4-4-4-4 by three dashes.
    */
    'boxes' => [
        'width'  => 8,
        'height' => 9,
        'font'   => 7,

        'transaction_length' => 16,
        'transaction_group'  => 4,
        'rsbsa_length'       => 14,
        'rsbsa_group'        => 4,
        'mobile_length'      => 11,
        'mobile_group'       => 0,
        'tiller_length'      => 10,
        'tiller_group'       => 4,
    ],

    /*
    |----------------------------------------------------------------------
    | PART 3 — farm parcels
    |----------------------------------------------------------------------
    | The official form prints three parcel blocks. Raising 'slots' adds more
    | blocks but will push PART 4 onto another page.
    */
    'parcels' => [
        'slots'            => 3,
        'row_height'       => 5,  // main commodity row on the right columns
        'intercrop_height' => 3,   // the "for intercropping" row beneath it
    ],

    /*
    |----------------------------------------------------------------------
    | PART 4 — signature blocks
    |----------------------------------------------------------------------
    | Blank space left for people to sign in.
    */
    'signatures' => [
        'consent_row_height'  => 8,
        'verifier_row_height' => 4,
    ],

    /*
    |----------------------------------------------------------------------
    | Stub (client's copy)
    |----------------------------------------------------------------------
    | Drop the RSBSA Finder QR into public/images/ under any name listed in
    | 'qr_files'; the first one found is printed. Without it, a labelled
    | placeholder box is drawn instead.
    */
    'stub' => [
        'logo_width' => 52,
        'qr_files'   => ['images/QR.png', 'images/QR.jpg', 'images/qr.png'],
        'qr_size'    => 46,
        'finder_url' => 'finder-rsbsa.da.gov.ph',
    ],

];
