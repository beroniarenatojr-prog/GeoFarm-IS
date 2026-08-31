<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Farm Assets — {{ $farmer->last_name }}, {{ $farmer->first_name }}</title>
    <style>
        /* Printed on the office's A4 stock. */
        @page { size: A4; margin: 14mm 12mm 16mm; }

        * { box-sizing: border-box; }
        body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 0; }

        h1 { font-size: 17px; color: #006400; margin: 0 0 2px; }
        h2 {
            font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
            color: #006400; margin: 16px 0 5px; padding-bottom: 3px;
            border-bottom: 1.5px solid #006400;
        }
        .sub { font-size: 10px; color: #6b7280; margin: 0; }

        .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .ident { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; margin: 10px 0 0; }
        .ident dt { font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
        .ident dd { margin: 1px 0 0; font-size: 11px; font-weight: 600; }

        .totals { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 12px; }
        .totals div { border: 1px solid #d1fae5; border-radius: 5px; padding: 6px 8px; }
        .totals b { display: block; font-size: 14px; color: #006400; }
        .totals span { font-size: 8.5px; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }

        table { width: 100%; border-collapse: collapse; }
        th {
            background: #006400; color: #fff; text-align: left; padding: 5px 7px;
            font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em;
        }
        td { padding: 5px 7px; border-bottom: 1px solid #e5e7eb; }
        .r { text-align: right; }
        .cap { text-transform: capitalize; }
        tfoot td { font-weight: 700; border-top: 1.5px solid #006400; border-bottom: none; }
        .none { color: #9ca3af; font-style: italic; padding: 6px 0; }

        /* Keep a category and its table together on one sheet. */
        section { break-inside: avoid; page-break-inside: avoid; }

        .sign { margin-top: 26px; display: flex; gap: 40px; }
        .sign div { flex: 1; border-top: 1px solid #9ca3af; padding-top: 3px; font-size: 9px; color: #6b7280; }
        footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 8.5px; color: #6b7280; }

        .noprint {
            position: fixed; top: 10px; right: 10px; background: #006400; color: #fff;
            border: 0; border-radius: 6px; padding: 8px 14px; font-size: 12px;
            font-weight: 600; cursor: pointer;
        }
        @media print { .noprint { display: none !important; } }
    </style>
</head>
<body>
<button class="noprint" onclick="window.print()">Print</button>

@php
    $n = fn ($v, $dp = 0) => number_format((float) $v, $dp);
    $d = fn ($v) => $v ? \Carbon\Carbon::parse($v)->format('d M Y') : '—';

    $crops   = collect($inventory['crops'] ?? []);
    $trees   = collect($inventory['tree_crops'] ?? []);
    $animals = collect($inventory['livestock'] ?? []);
    $ponds   = collect($inventory['fishponds'] ?? []);
    $mach    = collect($inventory['machinery'] ?? []);
@endphp

<div class="head">
    <div>
        <h1>Farm Assets Record</h1>
        <p class="sub">Municipal Agriculture Office · Tumauini, Isabela</p>
    </div>
    <p class="sub">Generated {{ now()->format('d M Y, g:i a') }}</p>
</div>

<dl class="ident">
    <div><dt>Farmer</dt><dd>{{ trim("{$farmer->first_name} {$farmer->last_name}") }}</dd></div>
    <div><dt>RSBSA No.</dt><dd>{{ $farmer->rsbsa_no ?: '—' }}</dd></div>
    <div><dt>Barangay</dt><dd>{{ $farmer->barangay ?: '—' }}</dd></div>
    <div><dt>Mobile</dt><dd>{{ $farmer->mobile_no ?: '—' }}</dd></div>
</dl>

<div class="totals">
    <div><b>{{ $n($summary['crop_area'] ?? 0, 2) }}</b><span>Hectares planted</span></div>
    <div><b>{{ $n($summary['crop_types'] ?? 0) }}</b><span>Crop types</span></div>
    <div><b>{{ $n($summary['trees'] ?? 0) }}</b><span>Trees</span></div>
    <div><b>{{ $n($summary['animals'] ?? 0) }}</b><span>Animals</span></div>
    <div><b>{{ $n($summary['pond_area'] ?? 0, 2) }}</b><span>Pond hectares</span></div>
    <div><b>{{ $n($summary['machinery'] ?? 0) }}</b><span>Machinery</span></div>
</div>

<section>
    <h2>Crops</h2>
    @if ($crops->isEmpty())
        <p class="none">No cropping seasons recorded.</p>
    @else
        <table>
            <thead><tr><th>Crop</th><th>Season</th><th>Year</th><th>Parcel</th><th class="r">Area (ha)</th><th class="r">Yield (kg)</th></tr></thead>
            <tbody>
            @foreach ($crops as $c)
                <tr>
                    <td>{{ $c['crop_name'] ?: '—' }}</td>
                    <td class="cap">{{ $c['season'] }}</td>
                    <td>{{ $c['cropping_year'] }}</td>
                    <td>{{ $c['parcel_number'] ? '#' . $c['parcel_number'] : '—' }}</td>
                    <td class="r">{{ $n($c['total_area'], 2) }}</td>
                    <td class="r">{{ $c['yield_kg'] !== null ? $n($c['yield_kg']) : '—' }}</td>
                </tr>
            @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4">Total</td>
                    <td class="r">{{ $n($inventory['total_crop_area'] ?? 0, 2) }}</td>
                    <td class="r">{{ $n($crops->sum('yield_kg')) }}</td>
                </tr>
            </tfoot>
        </table>
    @endif
</section>

<section>
    <h2>Tree Crops</h2>
    @if ($trees->isEmpty())
        <p class="none">No tree crops recorded.</p>
    @else
        <table>
            <thead><tr><th>Crop</th><th class="r">Trees</th><th class="r">Area (ha)</th><th class="r">Age (yrs)</th><th>Status</th></tr></thead>
            <tbody>
            @foreach ($trees as $t)
                <tr>
                    <td>{{ $t['crop_type'] }}</td>
                    <td class="r">{{ $n($t['quantity']) }}</td>
                    <td class="r">{{ $t['area_hectares'] !== null ? $n($t['area_hectares'], 2) : '—' }}</td>
                    <td class="r">{{ $t['age_years'] ?? '—' }}</td>
                    <td class="cap">{{ $t['status'] ? str_replace('_', '-', $t['status']) : '—' }}</td>
                </tr>
            @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td>Total</td>
                    <td class="r">{{ $n($trees->sum('quantity')) }}</td>
                    <td class="r">{{ $n($trees->sum('area_hectares'), 2) }}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>
    @endif
</section>

<section>
    <h2>Livestock &amp; Poultry</h2>
    @if ($animals->isEmpty())
        <p class="none">No livestock or poultry recorded.</p>
    @else
        <table>
            <thead>
                <tr>
                    <th>Type</th><th>Category</th><th class="r">Male</th><th class="r">Female</th>
                    <th class="r">Total</th><th>Purpose</th><th>Health</th><th>Last vaccinated</th>
                </tr>
            </thead>
            <tbody>
            @foreach ($animals as $a)
                <tr>
                    <td>{{ $a['type'] }}</td>
                    <td>{{ $a['category'] }}</td>
                    <td class="r">{{ $n($a['male']) }}</td>
                    <td class="r">{{ $n($a['female']) }}</td>
                    <td class="r">{{ $n($a['total']) }}</td>
                    <td>{{ $a['purpose'] ?: '—' }}</td>
                    <td class="cap">{{ $a['health_status'] ?: '—' }}</td>
                    <td>{{ $d($a['last_vaccination']) }}</td>
                </tr>
            @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2">Total heads</td>
                    <td class="r">{{ $n($animals->sum('male')) }}</td>
                    <td class="r">{{ $n($animals->sum('female')) }}</td>
                    <td class="r">{{ $n($animals->sum('total')) }}</td>
                    <td colspan="3"></td>
                </tr>
            </tfoot>
        </table>
    @endif
</section>

<section>
    <h2>Fishponds</h2>
    @if ($ponds->isEmpty())
        <p class="none">No fishponds recorded.</p>
    @else
        <table>
            <thead>
                <tr>
                    <th>Species</th><th>Pond type</th><th class="r">Area (ha)</th>
                    <th class="r">Stock</th><th>Last harvest</th><th>Next harvest</th>
                </tr>
            </thead>
            <tbody>
            @foreach ($ponds as $p)
                <tr>
                    <td>{{ $p['species'] }}</td>
                    <td class="cap">{{ $p['pond_type'] ?: '—' }}</td>
                    <td class="r">{{ $n($p['area_hectares'], 2) }}</td>
                    <td class="r">{{ $p['estimated_population'] !== null ? $n($p['estimated_population']) : '—' }}</td>
                    <td>{{ $d($p['last_harvest']) }}</td>
                    <td>{{ $d($p['next_harvest']) }}</td>
                </tr>
            @endforeach
            </tbody>
            <tfoot>
                <tr><td colspan="2">Total pond area</td><td class="r">{{ $n($ponds->sum('area_hectares'), 2) }}</td><td colspan="3"></td></tr>
            </tfoot>
        </table>
    @endif
</section>

<section>
    <h2>Farm Machinery</h2>
    @if ($mach->isEmpty())
        <p class="none">No machinery recorded.</p>
    @else
        <table>
            <thead>
                <tr>
                    <th>Type</th><th>Brand</th><th>Model</th><th>Serial no.</th>
                    <th class="r">Acquired</th><th>How</th><th>Status</th>
                </tr>
            </thead>
            <tbody>
            @foreach ($mach as $m)
                <tr>
                    <td>{{ $m['machinery_type'] }}</td>
                    <td>{{ $m['brand'] ?: '—' }}</td>
                    <td>{{ $m['model'] ?: '—' }}</td>
                    <td>{{ $m['serial_number'] ?: '—' }}</td>
                    <td class="r">{{ $m['year_acquired'] ?: '—' }}</td>
                    <td class="cap">{{ $m['acquisition_type'] ?: '—' }}</td>
                    <td class="cap">{{ $m['status'] ? str_replace('_', ' ', $m['status']) : '—' }}</td>
                </tr>
            @endforeach
            </tbody>
        </table>
    @endif
</section>

<div class="sign">
    <div>Recorded by</div>
    <div>Verified by (Municipal Agriculturist)</div>
    <div>Farmer&rsquo;s signature</div>
</div>

<footer>
    GeoFarm-IS · Municipal Agriculture Office, Tumauini, Isabela.
    This record reflects the register at the time of printing.
</footer>
</body>
</html>
