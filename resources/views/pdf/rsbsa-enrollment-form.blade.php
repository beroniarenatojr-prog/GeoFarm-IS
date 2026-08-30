@php
    /**
     * RSBSA Enrollment Form (DA, revised 01-2024), reproduced for LEGAL bond
     * paper. Every label, Tagalog gloss and footnote from the official form is
     * kept verbatim. Layout is pure tables — DomPDF has no flexbox or grid.
     */
    // Every size below comes from config/rsbsa-form.php — edit there, not here.
    $cfg  = config('rsbsa-form');
    $f    = $cfg['font'];
    $sp   = $cfg['spacing'];
    $hd   = $cfg['header'];
    $bx   = $cfg['boxes'];
    $pc   = $cfg['parcels'];
    $sig  = $cfg['signatures'];
    $stub = $cfg['stub'];

    $cb = fn ($checked) => $checked ? 'X' : '';

    /** A run of single-character cells, optionally grouped with dashes. */
    $boxes = function ($value, int $count, int $group = 0) use ($bx) {
        $s = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $value));
        $out = '<table style="border-collapse:collapse;"><tr>';
        for ($i = 0; $i < $count; $i++) {
            if ($group && $i > 0 && $i % $group === 0) {
                $out .= '<td style="width:6px;text-align:center;font-size:6px;border:none;">&ndash;</td>';
            }
            $ch = $s[$i] ?? '';
            $out .= '<td style="border:1px solid #000;'
                . 'width:' . $bx['width'] . 'px;height:' . $bx['height'] . 'px;'
                . 'text-align:center;font-size:' . $bx['font'] . 'px;font-weight:bold;padding:0;'
                . 'line-height:' . $bx['height'] . 'px;">' . e($ch) . '</td>';
        }
        return $out . '</tr></table>';
    };

    /** Embed a local file as a data URI so DomPDF never has to fetch it. */
    $embed = function (?string $absolutePath) {
        if (!$absolutePath || !is_file($absolutePath)) {
            return null;
        }
        $ext = strtolower(pathinfo($absolutePath, PATHINFO_EXTENSION));
        $mime = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif'][$ext] ?? null;
        if (!$mime) {
            return null;
        }
        return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($absolutePath));
    };

    // First matching file wins, so the seal can be dropped in under any of these names.
    $logoPath = collect($hd['logo_files'])
        ->map(fn ($p) => public_path($p))
        ->first(fn ($p) => is_file($p));

    $daLogo = $embed($logoPath);

    /** Scale to a target width, keeping the source aspect ratio. */
    $logoBox = function (int $targetWidth) use ($logoPath) {
        if (!$logoPath) {
            return ['w' => $targetWidth, 'h' => $targetWidth];
        }
        [$w, $h] = getimagesize($logoPath);
        return ['w' => $targetWidth, 'h' => (int) round($targetWidth * $h / max($w, 1))];
    };

    $photo = $farmer->photo_path ? $embed(storage_path('app/public/' . $farmer->photo_path)) : null;

    // RSBSA Finder QR printed on the client's stub.
    $qrImage = $embed(
        collect($stub['qr_files'])
            ->map(fn ($p) => public_path($p))
            ->first(fn ($p) => is_file($p))
    );

    $birth   = $farmer->birthdate;
    $parcels = $farmer->parcels->values();
    $edu     = strtolower((string) $farmer->highest_education);
    $rel     = strtolower((string) $farmer->religion);
    $isOther = $rel !== '' && !str_contains($rel, 'christ') && !str_contains($rel, 'islam')
        && !str_contains($rel, 'muslim') && !str_contains($rel, 'none');
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RSBSA Enrollment Form — {{ $farmer->full_name }}</title>
<style>
    /* All sizes come from config/rsbsa-form.php. */
    @page { size: {{ $cfg['paper']['size'] }} {{ $cfg['paper']['orientation'] }}; margin: {{ $cfg['paper']['margin'] }}; }

    body { font-family: Arial, Helvetica, sans-serif; font-size: {{ $f['base'] }}px; color: #000; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    td { vertical-align: top; }

    .grid > tbody > tr > td { border: 1px solid #000; padding: 4px 5px; }

    .bar {
        background: #000; color: #fff; font-weight: bold;
        font-size: {{ $f['section_bar'] }}px; padding: {{ $sp['section_bar_padding'] }}; letter-spacing: .3px;
    }

    .l    { font-size: {{ $f['label'] }}px; font-weight: bold; }        /* field label   */
    .g    { font-size: {{ $f['gloss'] }}px; font-style: italic; font-weight: normal; } /* tagalog gloss */
    .u    { font-size: {{ $f['under'] }}px; font-style: italic; display: block; text-align: center; }
    .v    { font-size: {{ $f['value'] }}px; font-weight: bold; text-transform: uppercase; }
    .vs   { font-size: {{ $f['value_small'] }}px; font-weight: bold; text-transform: uppercase; }

    .cb {
        display: inline-block;
        width: {{ $sp['checkbox'] }}px; height: {{ $sp['checkbox'] }}px;
        border: 1px solid #000; text-align: center;
        line-height: {{ $sp['checkbox'] }}px; font-size: {{ $sp['checkbox'] - 1 }}px;
        font-weight: bold; margin-right: 3px;
    }

    .fill  { border-bottom: 1px solid #000; min-height: {{ $sp['fill_min_height'] }}px; }
    .cell  { border: 1px solid #000; padding: 1px 3px; }

    .center { text-align: center; }
    .tiny   { font-size: {{ $f['tiny'] }}px; line-height: 1.35; }
    .just   { font-size: {{ $f['consent'] }}px; line-height: 1.2; text-align: justify; }
    .legend { font-size: {{ $f['legend'] }}px; line-height: 1.15; }

    /* Page 2 carries three full parcel blocks plus the consent section, so it
       runs tighter than page 1 to stay on one sheet. */
    .p2 > tbody > tr > td { padding: {{ $sp['page2_cell_padding'] }}; }

    /* PART 3 is denser than page 1, so its text steps down a notch. */
    .p2 .l  { font-size: {{ $f['label_p2'] }}px; }
    .p2 .g  { font-size: {{ $f['gloss_p2'] }}px; }
    .p2 .u  { font-size: {{ $f['under_p2'] }}px; }
    .p2 .vs { font-size: {{ $f['value_small_p2'] }}px; }

    /* Page 1 holds fewer rows, so they breathe to fill the sheet. */
    .p1 > tbody > tr > td { padding: {{ $sp['page1_cell_padding'] }}; }

    .brk { page-break-after: always; }
</style>
</head>
<body>

{{-- ========================================================= PAGE 1 HEADER --}}
{{-- Title, transaction code and instructions share one frame, as on the
     official form; the 2x2 picture is a cell inside that frame, not beside it. --}}
<div style="text-align:right;font-size:5.5px;font-style:italic;">{{ $hd['revision_note'] }}</div>

<table style="border:1px solid #000;">
    <tr>
        <td style="padding:0;border-right:1px solid #000;">
            {{-- masthead --}}
            <table>
                <tr>
                    <td style="width:54px;padding:3px 0 0 5px;">
                        @php $lb = $logoBox($hd['logo_width']); @endphp
                        @if($daLogo)
                            <img src="{{ $daLogo }}" style="width:{{ $lb['w'] }}px;height:{{ $lb['h'] }}px;">
                        @else
                            <div style="width:40px;height:40px;border:1.5px solid #1a7a3c;border-radius:20px;
                                        text-align:center;font-size:4.5px;color:#1a7a3c;font-weight:bold;padding-top:12px;line-height:1.15;">
                                DEPARTMENT<br>OF<br>AGRICULTURE
                            </div>
                        @endif
                    </td>
                    <td style="padding:4px 0 0 0;">
                        <div style="font-size:{{ $hd['title_small'] }}px;font-weight:bold;">REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE</div>
                        <div style="font-size:{{ $hd['title_large'] }}px;font-weight:bold;letter-spacing:.1px;line-height:1.15;">RSBSA Enrollment Form</div>
                    </td>
                </tr>
            </table>

            {{-- transaction code --}}
            <table style="margin-top:3px;">
                <tr>
                    <td style="width:74px;padding:0 0 4px 5px;">
                        <div style="font-size:8px;font-weight:bold;">TRANSACTION CODE:</div>
                        <div style="font-size:7px;font-weight:bold;font-style:italic;margin-top:4px;">With PhilID/<br>ePhilID? PCN:</div>
                        <div style="font-size:7px;font-weight:bold;font-style:italic;margin-top:5px;">No PhilID/<br>ePhilID? TRN:</div>
                    </td>
                    <td style="padding:0 5px 4px 0;">
                        <div style="margin-top:14px;">{!! $boxes('', $bx['transaction_length'], $bx['transaction_group']) !!}</div>
                        <div style="margin-top:5px;">{!! $boxes($farmer->reference_code, $bx['transaction_length'], $bx['transaction_group']) !!}</div>
                    </td>
                </tr>
            </table>
        </td>

        {{-- 2x2 picture --}}
        <td class="center" style="width:{{ $hd['picture_cell_width'] }}px;padding:4px;">
            @if($photo)
                <img src="{{ $photo }}" style="width:{{ $hd['photo_size'] }}px;height:{{ $hd['photo_size'] }}px;">
            @else
                <div style="font-size:11px;font-weight:bold;padding-top:14px;line-height:1.25;">2x2<br>PICTURE</div>
                <div style="font-size:7.5px;margin-top:12px;line-height:1.25;">PHOTO TAKEN<br>WITHIN 6 MONTHS</div>
            @endif
        </td>
    </tr>
    <tr>
        <td colspan="2" style="border-top:1px solid #000;padding:2px 5px;font-size:{{ $hd['instructions_font'] }}px;font-weight:bold;">
            INSTRUCTIONS (PANUTO): Write in <b>CAPITAL LETTERS</b>. Put <b>X</b> on the box of your answer.
            <span class="g">(Magsulat gamit ang <b>MALALAKING LETRA</b>. Lagyan ng <b>X</b> ang kahon ng iyong sagot.)</span>
        </td>
    </tr>
</table>

<div class="bar" style="margin-top:2px;">PART 1: PERSONAL INFORMATION</div>

<table class="grid p1">
    {{-- Surname / First name --}}
    <tr>
        <td style="width:50%;">
            <span class="l">SURNAME <span class="g">(APELYIDO)</span></span>
            <div class="v">{{ $farmer->last_name }}</div>
        </td>
        <td>
            <span class="l">FIRST NAME <span class="g">(PANGALAN)</span></span>
            <div class="v">{{ $farmer->first_name }}</div>
        </td>
    </tr>

    {{-- Middle / Extension / Sex --}}
    <tr>
        <td colspan="2" style="padding:0;">
            <table><tr>
                <td class="cell" style="width:37%;">
                    <span class="l">MIDDLE NAME <span class="g">(GITNANG PANGALAN)</span></span>
                    <div class="v">{{ $farmer->middle_name }}</div>
                    <span class="cb">{{ $cb(!$farmer->middle_name) }}</span><span class="g">No Middle Name (Legal na walang gitnang pangalan)</span>
                </td>
                <td class="cell" style="width:33%;">
                    <span class="l">EXTENSION NAME</span>
                    <div class="v">{{ $farmer->suffix }}</div>
                    <span class="cb">{{ $cb(!$farmer->suffix) }}</span><span class="g">No Extension Name</span>
                </td>
                <td class="cell">
                    <span class="l">SEX <span class="g">(KASARIAN)</span>:</span>
                    <div style="margin-top:8px;">
                        <span class="cb">{{ $cb($farmer->sex === 'Male') }}</span><span class="l">Male <span class="g">(Lalaki)</span></span>
                        &nbsp;&nbsp;
                        <span class="cb">{{ $cb($farmer->sex === 'Female') }}</span><span class="l">Female <span class="g">(Babae)</span></span>
                    </div>
                </td>
            </tr></table>
        </td>
    </tr>

    {{-- Permanent address --}}
    <tr>
        <td colspan="2" style="padding:0;">
            <table><tr>
                <td class="cell" style="width:17%;">
                    <span class="l">PERMANENT ADDRESS</span><br>
                    <span class="g">(PERMANENTENG TIRAHAN)</span>
                </td>
                <td style="padding:0;border:1px solid #000;">
                    <table>
                        <tr>
                            <td style="width:33%;padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->house_lot_number }}</div>
                                <span class="u">HOUSE/LOT/BLDG NO./PUROK</span>
                            </td>
                            <td style="width:34%;padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->street_sitio }}</div>
                                <span class="u">STREET/SITIO/SUBDIVISION</span>
                            </td>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->barangay }}</div>
                                <span class="u">BARANGAY</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->city_municipality }}</div>
                                <span class="u">CITY/MUNICIPALITY</span>
                            </td>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->province }}</div>
                                <span class="u">PROVINCE</span>
                            </td>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->region }}</div>
                                <span class="u">REGION</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr></table>
        </td>
    </tr>

    <tr>
        <td colspan="2" style="padding:1px 3px;">
            <span class="l" style="font-size:8.6px;">Answer only if declared permanent address is in NCR</span>
            <span class="g">(Sagutan lamang kung ang permanenteng tirahan ay sa NCR).</span>
        </td>
    </tr>

    {{-- Provincial address --}}
    <tr>
        <td colspan="2" style="padding:0;">
            <table><tr>
                <td class="cell" style="width:17%;">
                    <span class="l">PROVINCIAL ADDRESS</span><br>
                    <span class="g">(TIRAHAN SA LABAS NG NCR)</span>
                </td>
                <td style="padding:0;border:1px solid #000;">
                    <table>
                        <tr>
                            <td style="width:33%;padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->provincial_house_lot }}</div>
                                <span class="u">HOUSE/LOT/BLDG NO./PUROK</span>
                            </td>
                            <td style="width:34%;padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->provincial_street_sitio }}</div>
                                <span class="u">STREET/SITIO/SUBDIVISION</span>
                            </td>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->provincial_barangay }}</div>
                                <span class="u">BARANGAY</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->provincial_city_municipality }}</div>
                                <span class="u">CITY/MUNICIPALITY</span>
                            </td>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->provincial_province }}</div>
                                <span class="u">PROVINCE</span>
                            </td>
                            <td style="padding:1px 3px;">
                                <div class="fill vs">{{ $farmer->provincial_region }}</div>
                                <span class="u">REGION</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr></table>
        </td>
    </tr>

    {{-- Birth / place / mobile --}}
    <tr>
        <td colspan="2" style="padding:0;">
            <table><tr>
                <td class="cell" style="width:27%;">
                    <span class="l">DATE OF BIRTH</span><br><span class="g">(PETSA NG KAPANGANAKAN)</span>
                    <table style="margin-top:2px;">
                        <tr>
                            <td class="cell center" style="width:33%;">
                                <div class="vs">{{ $birth?->format('m') }}</div><span class="u">MON</span>
                            </td>
                            <td class="cell center" style="width:33%;">
                                <div class="vs">{{ $birth?->format('d') }}</div><span class="u">DD</span>
                            </td>
                            <td class="cell center">
                                <div class="vs">{{ $birth?->format('Y') }}</div><span class="u">YYYY</span>
                            </td>
                        </tr>
                    </table>
                </td>
                <td class="cell" style="width:32%;">
                    <span class="l">PLACE OF BIRTH</span><br><span class="g">(LUGAR NG KAPANGANAKAN)</span>
                    <div class="fill vs" style="margin-top:2px;">{{ $farmer->birth_city_municipality }}</div>
                    <span class="u">CITY / MUNICIPALITY</span>
                    <div class="fill vs" style="margin-top:3px;">{{ $farmer->birth_province }}</div>
                    <span class="u">PROVINCE/STATE, COUNTRY</span>
                </td>
                <td class="cell">
                    <span class="l">MOBILE NUMBER</span>
                    <div style="margin-top:2px;">{!! $boxes($farmer->mobile_no, $bx['mobile_length'], $bx['mobile_group']) !!}</div>
                    <div style="margin-top:3px;">
                        <span class="l">DO YOU OWN THE MOBILE NUMBER WRITTEN ABOVE?</span>
                        <span class="g">(Ikaw ba ang nagmamay-ari ng numero sa itaas?)</span>
                        <span class="cb">X</span><span class="l">Yes</span>
                        <span class="cb"></span><span class="l">No</span>
                    </div>
                    <div class="l" style="margin-top:2px;">If No, Full Name and relationship with owner of number:</div>
                    <table><tr>
                        <td style="width:60%;padding:1px 2px;">
                            <div class="fill">&nbsp;</div><span class="u" style="color:#c00;">FULL NAME</span>
                        </td>
                        <td style="padding:1px 2px;">
                            <div class="fill">&nbsp;</div><span class="u" style="color:#c00;">RELATIONSHIP</span>
                        </td>
                    </tr></table>
                </td>
            </tr></table>
        </td>
    </tr>

    {{-- Mother's maiden name --}}
    <tr>
        <td colspan="2">
            <span class="l">MOTHER'S MAIDEN NAME <span class="g">(PANGALAN NG INA SA PAGKADALAGA)</span></span>
            <table style="margin-top:1px;">
                <tr>
                    <td style="width:25%;padding:1px 3px;">
                        <div class="fill vs">{{ $farmer->mother_first_name }}</div><span class="u">FIRST NAME</span>
                    </td>
                    <td style="width:25%;padding:1px 3px;">
                        <div class="fill vs">{{ $farmer->mother_middle_name }}</div><span class="u">MIDDLE NAME</span>
                    </td>
                    <td style="width:30%;padding:1px 3px;">
                        <div class="fill vs">{{ $farmer->mother_last_name ?: $farmer->mother_maiden_name }}</div><span class="u">SURNAME</span>
                    </td>
                    <td style="padding:1px 3px;">
                        <div class="fill vs">&nbsp;</div><span class="u">EXT NAME</span>
                    </td>
                </tr>
            </table>
        </td>
    </tr>

    {{-- Civil status | Education --}}
    <tr>
        <td style="width:50%;">
            <span class="l">CIVIL STATUS <span class="g">(Katayuang sibil)</span></span>
            <table style="margin-top:3px;">
                <tr>
                    <td style="border:none;padding:1px;width:50%;">
                        <span class="cb">{{ $cb($farmer->civil_status === 'Single') }}</span><span class="l">Single <span class="g">(Walang asawa)</span></span>
                    </td>
                    <td style="border:none;padding:1px;">
                        <span class="cb">{{ $cb($farmer->civil_status === 'Widowed') }}</span><span class="l">Widow/er <span class="g">(Balo)</span></span>
                    </td>
                </tr>
                <tr>
                    <td style="border:none;padding:1px;">
                        <span class="cb">{{ $cb($farmer->civil_status === 'Married') }}</span><span class="l">Married <span class="g">(Kasal)</span></span>
                    </td>
                    <td style="border:none;padding:1px;">
                        <span class="cb">{{ $cb($farmer->civil_status === 'Separated') }}</span><span class="l">Legally Separated <span class="g">(Hiwalay)</span></span>
                    </td>
                </tr>
            </table>
            <div class="l" style="margin-top:3px;">Name of spouse if married:</div>
            <table>
                <tr>
                    <td style="width:25%;padding:1px 2px;"><div class="fill">&nbsp;</div><span class="u">FIRST NAME</span></td>
                    <td style="width:25%;padding:1px 2px;"><div class="fill">&nbsp;</div><span class="u">MIDDLE NAME</span></td>
                    <td style="width:30%;padding:1px 2px;"><div class="fill">&nbsp;</div><span class="u">SURNAME</span></td>
                    <td style="padding:1px 2px;"><div class="fill">&nbsp;</div><span class="u">EXT NAME</span></td>
                </tr>
            </table>
        </td>
        <td>
            <span class="l">HIGHEST FORMAL EDUCATION</span><br>
            <span class="g">(PINAKAMATAAS NA ANTAS NG PINAG-ARALAN)</span>
            <table style="margin-top:2px;">
                @php
                    $eduRows = [
                        ['Pre-school' => 'pre', 'Senior High School (K-12)' => 'senior'],
                        ['Elementary' => 'element', 'College' => 'college'],
                        ['High School (non K-12)' => 'high school (non', 'Post-graduate' => 'post'],
                        ['Junior High School (K-12)' => 'junior', 'Vocational' => 'vocational'],
                        ['None' => 'none', '' => null],
                    ];
                @endphp
                @foreach($eduRows as $row)
                    <tr>
                        @foreach($row as $label => $needle)
                            <td style="border:none;padding:1px;width:50%;">
                                @if($label !== '')
                                    <span class="cb">{{ $cb($edu !== '' && $needle && str_contains($edu, $needle)) }}</span><span class="l">{{ $label }}</span>
                                @endif
                            </td>
                        @endforeach
                    </tr>
                @endforeach
            </table>
        </td>
    </tr>

    {{-- RSBSA no | proof of identity --}}
    <tr>
        <td>
            <span class="l">RSBSA Number <span class="g">(system-generated)</span></span><br>
            <span class="g">if registered</span>
            <div style="margin-top:2px;">{!! $boxes($farmer->rsbsa_no, $bx['rsbsa_length'], $bx['rsbsa_group']) !!}</div>
        </td>
        <td>
            <span class="l">SUBMITTED VALID PROOF OF IDENTITY</span><br>
            <span class="g">(ISINUMITENG KATIBAYAN NG PAGKATAO)</span>
            <div style="margin-top:2px;">
                <span class="l">ID/Document Type:</span>
                <span class="g">Refer to the list at the back (Tingnan ang listahan sa likod)</span>
                <div class="fill vs">{{ $farmer->valid_id_type }}</div>
            </div>
            <div style="margin-top:2px;">
                <span class="l">ID/Document Number:</span>
                <div class="fill vs">{{ $farmer->id_number }}</div>
            </div>
        </td>
    </tr>

    {{-- Religion | PWD | 4Ps --}}
    <tr>
        <td>
            <span class="l">RELIGION <span class="g">(Relihiyon)</span></span>
            <div style="margin-top:3px;">
                <span class="cb">{{ $cb(str_contains($rel, 'christ')) }}</span><span class="l">Christianity</span>&nbsp;
                <span class="cb">{{ $cb(str_contains($rel, 'islam') || str_contains($rel, 'muslim')) }}</span><span class="l">Islam</span>&nbsp;
                <span class="cb">{{ $cb($isOther) }}</span><span class="l">Others</span>&nbsp;
                <span class="cb">{{ $cb($rel === '' || str_contains($rel, 'none')) }}</span><span class="l">None</span>
            </div>
        </td>
        <td style="padding:0;">
            <table><tr>
                <td class="cell" style="width:50%;">
                    <span class="l">PERSON WITH DISABILITY (PWD)</span> <span class="g">(May Kapansanan)</span><br>
                    <span class="cb">{{ $cb($farmer->pwd) }}</span><span class="l">Yes</span>&nbsp;
                    <span class="cb">{{ $cb(!$farmer->pwd) }}</span><span class="l">No</span>
                </td>
                <td class="cell">
                    <span class="l">4Ps BENEFICIARY</span><br>
                    <span class="g">(DSWD Pantawid Pamilyang Pilipino Program)</span><br>
                    <span class="cb">{{ $cb($farmer->is_4ps) }}</span><span class="l">Yes</span>&nbsp;
                    <span class="cb">{{ $cb(!$farmer->is_4ps) }}</span><span class="l">No</span>
                </td>
            </tr></table>
        </td>
    </tr>

    {{-- ICC / IPs --}}
    <tr>
        <td colspan="2">
            <span class="l">PART OF INDIGENOUS CULTURAL COMMUNITY (ICC) / INDIGENOUS PEOPLES (IPs)</span>
            &nbsp;<span class="cb">{{ $cb($farmer->is_indigenous) }}</span><span class="l">Yes</span>
            &nbsp;<span class="cb">{{ $cb(!$farmer->is_indigenous) }}</span><span class="l">No</span>
            &nbsp;<span class="l">If Yes, name of ICC/IP:</span>
            <span class="vs">{{ $farmer->indigenous_community }}</span>
        </td>
    </tr>

    {{-- Organisations --}}
    <tr>
        <td colspan="2">
            <span class="l">MEMBERSHIP IN FARMERS or IRRIGATORS ASSOCIATION / COOPERATIVE / ORGANIZATION Names:</span>
            <table style="margin-top:1px;">
                <tr>
                    @foreach([$farmer->organization_name, $farmer->organization_name_2, $farmer->organization_name_3] as $i => $org)
                        <td class="cell" style="width:33.33%;">
                            <span class="g">{{ $i + 1 }}</span>
                            <div class="vs">{{ $org }}</div>
                        </td>
                    @endforeach
                </tr>
            </table>
        </td>
    </tr>
</table>

<div class="bar" style="margin-top:2px;">PART 2: LIVELIHOOD PROFILE</div>

<table class="grid p1">
    <tr>
        <td style="width:22%;">
            <span class="cb">{{ $cb($farmer->livelihood_type === 'Farmer') }}</span><span class="l" style="font-size:9.5px;">FARMER <span class="g">(MAGSASAKA)</span></span>
        </td>
        <td style="width:31%;">
            <span class="cb">{{ $cb($farmer->livelihood_type === 'Farm Worker') }}</span><span class="l" style="font-size:9.5px;">FARM WORKER <span class="g">(MANGGAGAWA SA SAKAHAN)</span></span>
        </td>
        <td style="width:24%;">
            <span class="cb">{{ $cb($farmer->livelihood_type === 'Fisher') }}</span><span class="l" style="font-size:9.5px;">FISHER <span class="g">(MANGINGISDA)</span></span>
        </td>
        <td>
            <span class="cb">{{ $cb($farmer->livelihood_type === 'Agri-Youth') }}</span><span class="l" style="font-size:9.5px;">AGRI-YOUTH</span>
        </td>
    </tr>
    <tr>
        <td class="tiny">If you are a FARMER, proceed to PART 3 <span class="g">(Kung ikaw ay MAGSASAKA, sagutan ang PART 3).</span></td>
        <td class="tiny" colspan="2">
            If you are a FARM WORKER or FISHER, kindly request a CERTIFICATION AS FARM WORKER/FISHER from the
            City/Municipal Agriculture Office <span class="g">(Mag-request ng SERTIPIKASYON BILANG MANGGAGAWA SA SAKAHAN / MANGINGISDA mula sa City/Municipal Agriculture Office).</span>
        </td>
        <td class="tiny">If you are an AGRI-YOUTH, proceed to PART 4 <span class="g">(Kung ikaw ay AGRI-YOUTH, sagutan ang PART 4).</span></td>
    </tr>
</table>

{{-- Client's copy stub --}}
<table style="margin-top:5px;border:1px solid #000;border-top:2px dashed #000;">
    <tr>
        <td style="width:70px;padding:3px;">
            @php $lbs = $logoBox($stub['logo_width']); @endphp
            @if($daLogo)
                <img src="{{ $daLogo }}" style="width:{{ $lbs['w'] }}px;height:{{ $lbs['h'] }}px;">
            @else
                <div style="width:34px;height:34px;border:1.5px solid #1a7a3c;border-radius:17px;
                            text-align:center;font-size:4px;color:#1a7a3c;font-weight:bold;padding-top:11px;line-height:1.1;">
                    DEPT OF<br>AGRICULTURE
                </div>
            @endif
        </td>
        <td style="padding:3px;">
            <div style="font-size:9px;font-weight:bold;">REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE</div>
            <div style="font-size:15px;font-weight:bold;">RSBSA Enrollment Stub: Client's Copy</div>
        </td>
        <td style="width:33%;padding:3px;border-left:1px solid #000;">
            <div class="tiny">
                Gamitin ang RSBSA Finder upang malaman kung ikaw ay matagumpay na naka-rehistro sa RSBSA.
                Gamit ang Internet, puntahan ang website:
                <div class="center" style="font-size:9.5px;font-weight:bold;margin:2px 0;">{{ $stub['finder_url'] }}</div>
                Maari ring i-scan ang QR code sa kanan.
            </div>
        </td>
        <td class="center" style="width:66px;padding:3px;">
            @if($qrImage)
                <img src="{{ $qrImage }}" style="width:{{ $stub['qr_size'] }}px;height:{{ $stub['qr_size'] }}px;">
            @else
                <div style="width:{{ $stub['qr_size'] }}px;height:{{ $stub['qr_size'] }}px;border:1px solid #000;font-size:6.5px;padding-top:{{ (int) round($stub['qr_size'] / 2) - 4 }}px;">QR CODE</div>
            @endif
        </td>
    </tr>
    <tr>
        <td colspan="4" style="padding:3px;border-top:1px solid #000;">
            <span class="l">NAME OF ENROLLEE:</span>
            <table style="margin-top:1px;">
                <tr>
                    <td style="width:25%;padding:1px 3px;"><div class="fill vs">{{ $farmer->first_name }}</div><span class="u">FIRST NAME</span></td>
                    <td style="width:25%;padding:1px 3px;"><div class="fill vs">{{ $farmer->middle_name }}</div><span class="u">MIDDLE NAME</span></td>
                    <td style="width:30%;padding:1px 3px;"><div class="fill vs">{{ $farmer->last_name }}</div><span class="u">SURNAME</span></td>
                    <td style="padding:1px 3px;"><div class="fill vs">{{ $farmer->suffix }}</div><span class="u">EXT NAME</span></td>
                </tr>
            </table>
            <table style="margin-top:2px;"><tr>
                <td style="width:90px;"><span class="l">TRANSACTION CODE:</span></td>
                <td>{!! $boxes($farmer->reference_code, $bx['transaction_length'], $bx['transaction_group']) !!}</td>
            </tr></table>
        </td>
    </tr>
</table>

<div class="brk"></div>

{{-- ========================================================= PAGE 2 --}}
<table>
    <tr>
        <td style="width:82px;">
            @php $lb2 = $logoBox($hd['page2_logo_width']); @endphp
            @if($daLogo)
                <img src="{{ $daLogo }}" style="width:{{ $lb2['w'] }}px;height:{{ $lb2['h'] }}px;">
            @else
                <div style="width:42px;height:42px;border:2px solid #1a7a3c;border-radius:21px;
                            text-align:center;font-size:4.5px;color:#1a7a3c;font-weight:bold;padding-top:13px;line-height:1.2;">
                    DEPARTMENT<br>OF<br>AGRICULTURE
                </div>
            @endif
        </td>
        <td style="padding-top:6px;">
            <div style="font-size:{{ $hd['page2_title_small'] }}px;font-weight:bold;">REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE</div>
            <div style="font-size:{{ $hd['page2_title_large'] }}px;font-weight:bold;">RSBSA Enrollment Form</div>
        </td>
    </tr>
</table>

<div class="bar" style="margin-top:2px;">PART 3: FARM PARCEL INFORMATION</div>

<table class="grid p2">
    <tr>
        <td colspan="2" class="center" style="width:36%;"><b style="font-size:12px;">FARM PARCEL DESCRIPTION</b></td>
        <td class="center" style="width:11%;"><span class="l" style="font-size:8.8px;">CROPPING SCHEDULE</span><br><span class="g">(Ex: Jan-Mar)</span></td>
        <td class="center" style="width:13%;"><span class="l" style="font-size:8.8px;">COMMODITY</span></td>
        <td class="center" style="width:8%;"><span class="l" style="font-size:8.8px;">SIZE (HA)</span></td>
        <td class="center" style="width:9%;"><span class="l" style="font-size:8.8px;">NO. OF HEADS /TREES</span></td>
        <td class="center" style="width:11%;"><span class="l" style="font-size:8.8px;">FARM TYPE</span><br><span class="g">(Refer to the list below; tingnan ang listahan sa ibaba)</span></td>
        <td class="center"><span class="l" style="font-size:8.8px;">Organic Agri? (Y/N)</span></td>
    </tr>

    @for($i = 0; $i < $pc['slots']; $i++)
        @php $p = $parcels[$i] ?? null; @endphp
        <tr>
            <td class="center" style="width:14px;vertical-align:middle;"><b style="font-size:17px;">{{ $i + 1 }}</b></td>
            <td>
                <table><tr>
                    <td style="width:34px;border:none;padding:0;"><span class="l">FARM<br>LOCATION:</span></td>
                    <td style="border:none;padding:0;">
                        <div class="fill vs">{{ $p?->barangay }}</div><span class="u">BARANGAY</span>
                        <div class="fill vs" style="margin-top:2px;">{{ collect([$p?->city_municipality, $p?->province])->filter()->implode(', ') }}</div>
                        <span class="u">CITY/MUNICIPALITY, PROVINCE</span>
                    </td>
                </tr></table>

                <div style="margin-top:2px;">
                    <span class="l">TOTAL PARCEL AREA (Ha):</span>
                    <span style="display:inline-block;width:44px;border-bottom:1px solid #000;" class="vs center">{{ $p?->total_area_ha }}</span>
                    <span class="l">ha</span>
                </div>
                <div>
                    <span class="l">Within Ancestral Domain (AD)</span>
                    <span class="cb">{{ $cb($p?->within_ancestral) }}</span><span class="l">Yes</span>
                    <span class="cb">{{ $cb($p && !$p->within_ancestral) }}</span><span class="l">No</span>
                </div>
                <div>
                    <span class="l">Agrarian Reform Beneficiary (ARB)</span>
                    <span class="cb">{{ $cb($p?->arb) }}</span><span class="l">Yes</span>
                    <span class="cb">{{ $cb($p && !$p->arb) }}</span><span class="l">No</span>
                </div>
                <div style="margin-top:1px;">
                    <span class="l">Submitted Proof of Land Ownership<sup>1</sup>/ Farming Agreement<sup>2</sup></span><br>
                    <span class="g">(Refer to the list below; tingnan ang listahan sa ibaba):</span>
                    <span style="display:inline-block;width:40px;border-bottom:1px solid #000;" class="vs">{{ $p?->proof_of_ownership }}</span>
                </div>
                <div style="margin-top:1px;">
                    <span class="l">Type of Ownership/Tenure:</span>
                    <table><tr>
                        <td style="border:none;padding:0;width:50%;">
                            <span class="cb">{{ $cb($p?->ownership_type === 'Registered Owner') }}</span><span class="l">Registered Owner</span>
                        </td>
                        <td style="border:none;padding:0;">
                            <span class="cb">{{ $cb($p?->ownership_type === 'Lessee') }}</span><span class="l">Lessee</span>
                        </td>
                    </tr><tr>
                        <td style="border:none;padding:0;">
                            <span class="cb">{{ $cb($p?->ownership_type === 'Tenant') }}</span><span class="l">Tenant</span>
                        </td>
                        <td style="border:none;padding:0;">
                            <span class="cb">{{ $cb($p && $p->ownership_type && !in_array($p->ownership_type, ['Registered Owner','Lessee','Tenant'], true)) }}</span><span class="l">Others</span>
                        </td>
                    </tr></table>
                </div>
                <div style="margin-top:1px;">
                    <span class="l">Name of Land Owner:</span>
                    <table><tr>
                        <td style="border:none;padding:0;width:36%;"><div class="fill vs">{{ $p?->land_owner_name }}</div><span class="u">FIRST NAME</span></td>
                        <td style="border:none;padding:0;width:36%;"><div class="fill">&nbsp;</div><span class="u">SURNAME</span></td>
                        <td style="border:none;padding:0;"><div class="fill">&nbsp;</div><span class="u">EXT NAME</span></td>
                    </tr></table>
                </div>
                <div>
                    <span class="l">RSBSA Number</span> <span class="g">(system-generated):</span>
                    {!! $boxes('', $bx['tiller_length'], $bx['tiller_group']) !!}
                </div>
            </td>

            <td style="padding:0;">
                <div style="border-bottom:1px solid #000;padding:2px;height:{{ $pc['row_height'] }}px;" class="vs">{{ $p?->cropping_schedule }}</div>
                <div class="center g" style="padding:3px 2px;font-size:8px;">For intercropping, use the row below</div>
            </td>
            <td style="padding:0;">
                <div style="border-bottom:1px solid #000;padding:2px;height:{{ $pc['row_height'] }}px;" class="vs">{{ $p?->commodity }}</div>
                <div style="height:{{ $pc['intercrop_height'] }}px;"></div>
            </td>
            <td style="padding:0;">
                <div style="border-bottom:1px solid #000;padding:2px;height:{{ $pc['row_height'] }}px;" class="vs center">{{ $p?->total_area_ha }}</div>
                <div style="height:{{ $pc['intercrop_height'] }}px;"></div>
            </td>
            <td style="padding:0;">
                <div style="border-bottom:1px solid #000;padding:2px;height:{{ $pc['row_height'] }}px;" class="vs center">{{ $p?->no_of_heads_trees }}</div>
                <div style="height:{{ $pc['intercrop_height'] }}px;"></div>
            </td>
            <td style="padding:0;">
                <div style="border-bottom:1px solid #000;padding:2px;height:{{ $pc['row_height'] }}px;" class="vs center">{{ $p?->farmType?->type_name }}</div>
                <div style="height:{{ $pc['intercrop_height'] }}px;"></div>
            </td>
            <td style="padding:0;">
                <div style="border-bottom:1px solid #000;padding:2px;height:{{ $pc['row_height'] }}px;" class="vs center">{{ $p ? ($p->is_organic ? 'Y' : 'N') : '' }}</div>
                <div style="height:{{ $pc['intercrop_height'] }}px;"></div>
            </td>
        </tr>

        <tr>
            <td colspan="2">
                <table><tr>
                    <td style="border:none;padding:0;width:64px;"><b style="font-size:9.5px;">ROTATIONAL TILLER:</b></td>
                    <td style="border:none;padding:0;">
                        <span class="l">FULL NAME:</span>
                        <span style="display:inline-block;width:110px;border-bottom:1px solid #000;">&nbsp;</span><br>
                        <span class="l">RSBSA Number <span class="g">(system-generated):</span></span>
                        {!! $boxes('', $bx['tiller_length'], $bx['tiller_group']) !!}
                    </td>
                </tr></table>
            </td>
            <td colspan="6"><b style="font-size:9.5px;">REMARKS:</b></td>
        </tr>
    @endfor
</table>

{{-- Legends --}}
<table class="grid p2" style="margin-top:2px;">
    <tr>
        <td style="width:29%;">
            <div class="l" style="font-style:italic;font-size:8.6px;">ACCEPTED PROOF OF IDENTITY (ID/DOCUMENT)</div>
            <table><tr>
                <td class="legend" style="border:none;padding:0;">
                    &bull; Birth Certificate<br>&bull; <i>PhilID/National ID/E-PhilID</i><br>&bull; <i>Passport</i><br>&bull; <i>Driver's License</i><br>
                    &bull; <i>e-Card / UMID</i><br>&bull; <i>SSS ID</i><br>&bull; <i>PRC ID</i><br>&bull; <i>IBP ID</i><br>&bull; <i>NBI Clearance</i><br>&bull; <i>Voter's ID</i>
                </td>
                <td class="legend" style="border:none;padding:0;">
                    &bull; <i>TIN ID</i><br>&bull; <i>Pag-IBIG ID</i><br>&bull; <i>Senior Citizen ID</i><br>&bull; <i>PWD ID</i><br>&bull; <i>Solo Parent ID</i><br>
                    &bull; <i>4Ps ID</i><br>&bull; <i>Postal ID</i><br>&bull; <i>PhilHealth ID</i><br>&bull; <i>City/Municipal/Barangay ID</i><br>&bull; <i>Employee/School ID</i>
                </td>
            </tr></table>
        </td>
        <td style="width:52%;">
            <div class="l" style="font-style:italic;font-size:8.6px;">ACCEPTED PROOF OF LAND OWNERSHIP<sup>1</sup> / FARMING AGREEMENT<sup>2</sup> (DOCUMENT)</div>
            <table><tr>
                <td class="legend" style="border:none;padding:0;">
                    (a) Certificate of Land Transfer<br>(b) Emancipation Patent<br>
                    (c) Individual Certificate of Land<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ownership Award (CLOA)<br>
                    (d) Collective CLOA<br>(e) Co-ownership CLOA<br>
                    (f) Agricultural sales patent<br>(g) Homestead patent
                </td>
                <td class="legend" style="border:none;padding:0;">
                    (h) Free Patent<br>(i) Certificate of Title or Regular Title<br>
                    (j) Certificate of Ancestral Domain Title<br>(k) Certificate of Ancestral Land Title<br>
                    (l) Tax Declaration<br>(m) Others (e.g. Barangay Certification,<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Lease or Tenancy Agreement)<br>
                    <span style="font-size:4.6px;"><sup>1</sup> - for Registered Owners<br><sup>2</sup> - for Tenants, Lessees, Others</span>
                </td>
            </tr></table>
        </td>
        <td>
            <div class="l center" style="font-style:italic;font-size:8.6px;">FARM TYPE</div>
            <table style="margin-top:2px;"><tr>
                <td class="legend center" style="border:none;padding:0;width:16px;">1<br>2<br>3<br>4<br>N/A</td>
                <td class="legend" style="border:none;padding:0;width:10px;">-<br>-<br>-<br>-<br>-</td>
                <td class="legend" style="border:none;padding:0;">
                    Irrigated<br>Rainfed Upland<br>Rainfed Lowland<br>Urban/Peri-Urban<br>Not Applicable<br>
                    <span style="padding-left:6px;">(for fisheries)</span>
                </td>
            </tr></table>
        </td>
    </tr>
</table>

<div class="bar" style="margin-top:2px;">PART 4: CONSENT FORM AND DATA PRIVACY NOTICE</div>

<table class="grid p2">
    <tr>
        <td class="just" style="padding:4px 6px;">
            &nbsp;&nbsp;&nbsp;&nbsp;I hereby declare that all information indicated in this form are true, correct and complete, and that they may be
            used by the Department of Agriculture for the purposes of registration to the RSBSA and other legitimate interests of the
            Department pursuant to its mandates. I am fully aware that I can be held liable for any misdeclaration or intentional omission
            made herein pursuant to applicable laws and regulations.
            <br>
            &nbsp;&nbsp;&nbsp;&nbsp;Furthermore, I hereby give consent to the Department of Agriculture to conduct validation activities on my declared
            farm parcels through the RSBSA Georeferencing Activity.
        </td>
    </tr>
</table>

<table class="grid p2" style="margin-top:1px;">
    <tr>
        <td class="center" style="width:22%;height:{{ $sig['consent_row_height'] }}px;">
            <div class="vs" style="padding-top:16px;">{{ now()->format('m/d/Y') }}</div>
        </td>
        <td class="center" style="width:44%;">
            <div class="v" style="padding-top:14px;">{{ $farmer->full_name }}</div>
        </td>
        <td style="height:{{ $sig['consent_row_height'] }}px;"></td>
    </tr>
    <tr>
        <td class="center"><b style="font-size:10px;">DATE</b></td>
        <td class="center"><b style="font-size:10px;">PRINTED NAME OF REGISTRANT</b></td>
        <td class="center"><b style="font-size:10px;">SIGNATURE / THUMBMARK</b></td>
    </tr>
</table>

<table class="grid p2" style="margin-top:1px;">
    <tr><td colspan="4" style="padding:2px 4px;"><b style="font-size:10px;">VERIFIED TRUE AND CORRECT BY:</b></td></tr>
    <tr>
        <td style="height:{{ $sig['verifier_row_height'] }}px;width:25%;"></td>
        <td style="height:{{ $sig['verifier_row_height'] }}px;width:25%;"></td>
        <td style="height:{{ $sig['verifier_row_height'] }}px;width:25%;"></td>
        <td style="height:{{ $sig['verifier_row_height'] }}px;"></td>
    </tr>
    <tr>
        <td class="center" style="font-size:5.8px;padding:1px;">
            <b>SIGNATURE ABOVE PRINTED NAME / DATE</b><br>
            <b>Barangay Chairperson / ICC/IPS Leader/Elder (IPs) / C/Mun Veterinarian<br>
            (Livestock)/ Mill District Officer (Sugarcane)/ C/MARO (ARBs)</b>
        </td>
        <td class="center" style="font-size:5.8px;padding:1px;">
            <b>SIGNATURE ABOVE PRINTED NAME / DATE</b><br>
            <b>City/Municipal Agri-Fishery Council (C/MAFC)<br>Chairperson</b>
        </td>
        <td class="center" style="font-size:5.8px;padding:1px;">
            <b>SIGNATURE ABOVE PRINTED NAME / DATE</b><br>
            <b>City/Municipal Agriculturist (C/MA)</b><br><i>required</i>
        </td>
        <td class="center" style="font-size:5.8px;padding:1px;">
            <b>SIGNATURE ABOVE PRINTED NAME / DATE</b><br>
            <b>Enumerator (if administered)</b><br><i>required</i>
        </td>
    </tr>
</table>

<div class="bar center" style="margin-top:1px;">DATA PRIVACY NOTICE</div>

<table class="grid p2">
    <tr>
        <td class="just" style="padding:3px 6px;font-size:5.5px;">
            &nbsp;&nbsp;&nbsp;&nbsp;The Department of Agriculture (DA) commits to uphold your rights to privacy as a data subject under the Data Privacy Act of 2012 (DPA).
            In this regard, the DA shall strictly implement controls and measures compliant to the DPA, its IRR, and the Circulars issued by the National Privacy
            Commission. All personal information collected through this Form shall be used for purposes of documentation, planning, and policy-making, reporting and
            other connected processes in availing of agri-fishery related interventions. Your information is retained for the duration necessary for the aforesaid
            purposes, complying with applicable laws and regulations. Personal data processed is not shared with any other party, unless such disclosure is allowed
            under the DPA. As a data subject, you have the right to reasonable access to personal data, correction of inaccuracies, deletion of information, objection
            to processing, data portability, claim for compensation for harm caused by misuse, and the option to file a complaint with the NPC for violation of privacy rights.
            <br>&nbsp;&nbsp;&nbsp;&nbsp;For any data privacy-related concerns, you may contact the Data Privacy Officer at dpo@da.gov.ph.
        </td>
    </tr>
</table>

<div class="center" style="margin-top:2px;font-size:9px;font-weight:bold;">
    THIS OFFICIAL RSBSA ENROLLMENT FORM IS NOT FOR SALE
</div>

</body>
</html>
