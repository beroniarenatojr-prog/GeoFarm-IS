<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $program->program_name }} — Distribution Report</title>
    {{--
        No peso sign anywhere in here, deliberately.

        DomPDF's built-in fonts have no glyph for U+20B1, so a "₱" comes out as
        a hollow box on the printed page — which is how the figures on an
        official report end up looking like an error. The unit is stated once in
        the column heading instead, which is also how the DA's own forms do it.
    --}}
    <style>
        body { font-family: sans-serif; font-size: 11px; color: #111827; }
        h1 { color: #166534; font-size: 18px; margin: 0 0 2px; }
        h2 { font-size: 13px; margin: 20px 0 6px; color: #166534; }
        .sub { color: #6b7280; font-size: 10px; margin: 0 0 14px; }

        /*
         * Both tables are fixed-layout with declared column widths.
         *
         * On auto layout the columns size themselves from their contents, so a
         * long label pushes its own value sideways and no two rows line up —
         * which is exactly what "Awaiting collection" did to the 0 beside it.
         * Fixed layout also keeps the HTML preview and the PDF identical,
         * because DomPDF's auto-layout measurements are not the browser's.
         */
        .meta { width: 100%; border-collapse: collapse; margin-bottom: 16px; table-layout: fixed; }
        .meta td { padding: 3px 0; vertical-align: top; }
        .meta .k { color: #6b7280; }
        .meta .v { font-weight: bold; }

        table.rows { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.rows th { background: #166534; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
        table.rows td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        table.rows tr.total td { border-top: 2px solid #166534; border-bottom: 0; font-weight: bold; }

        /* Applied to the heading AND the cells under it, so a column is never
           aligned one way in the header and another in the body. */
        .num { text-align: right; }
        /* Long farmer names and item lists wrap instead of forcing the column
           wider than its declared share. */
        .wrap { word-wrap: break-word; }
        .muted { color: #9ca3af; }
        .empty { padding: 24px; text-align: center; color: #6b7280; }
    </style>
</head>
<body>
    <h1>{{ $program->program_name }}</h1>
    <p class="sub">
        GeoFarm-IS &mdash; Municipal Agriculture Office, Tumauini, Isabela<br>
        Generated {{ now()->format('F d, Y \a\t g:i A') }}
    </p>

    {{-- Widths on the first row only; the rest inherit them under fixed
         layout. The third column is the widest label column because
         "Awaiting collection" lives in it. --}}
    <table class="meta">
        <tr>
            <td class="k" style="width:13%">Type</td>
            <td class="v" style="width:30%">{{ $program->assistanceType?->type_name ?? 'Untyped' }}</td>
            <td class="k" style="width:22%">Status</td>
            <td class="v" style="width:35%">{{ ucfirst($program->status) }}</td>
        </tr>
        <tr>
            <td class="k">Period</td>
            <td class="v">
                {{ $program->start_date?->format('M d, Y') ?? '—' }}
                to {{ $program->end_date?->format('M d, Y') ?? '—' }}
            </td>
            {{-- Forfeited rows excluded: those goods went back on the shelf. --}}
            <td class="k">Beneficiaries</td>
            <td class="v">{{ $summary['beneficiaries'] }}</td>
        </tr>
        <tr>
            <td class="k">Received</td>
            <td class="v">{{ $summary['received'] }}</td>
            <td class="k">Awaiting collection</td>
            <td class="v">{{ $summary['awaiting'] }}</td>
        </tr>
    </table>

    <h2>Distributions</h2>

    <table class="rows">
        <thead>
            <tr>
                <th style="width:23%">Farmer</th>
                <th style="width:14%">Barangay</th>
                <th style="width:12%">Date</th>
                <th style="width:14%" class="num">Amount (PHP)</th>
                <th style="width:23%">Item given</th>
                <th style="width:14%">Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data as $row)
                <tr>
                    <td class="wrap">{{ $row['farmer'] }}</td>
                    <td class="wrap">{{ $row['barangay'] ?: '—' }}</td>
                    <td>{{ $row['date'] ?? '—' }}</td>
                    <td class="num">
                        {{-- A blank cell, not 0.00, where no cash was given: a
                             goods-only hand-out did not pay out nothing, it paid
                             out nothing in cash. --}}
                        @if($row['amount'] !== null)
                            {{ number_format($row['amount'], 2) }}
                        @else
                            <span class="muted">&mdash;</span>
                        @endif
                    </td>
                    <td class="wrap">
                        @if(count($row['items']))
                            @foreach($row['items'] as $item)
                                {{ $item }}@if(!$loop->last)<br>@endif
                            @endforeach
                        @else
                            <span class="muted">&mdash;</span>
                        @endif
                    </td>
                    <td>{{ $row['status_label'] }}</td>
                </tr>
            @empty
                <tr><td colspan="6" class="empty">No distributions have been recorded for this programme.</td></tr>
            @endforelse

            @if(count($data))
                <tr class="total">
                    {{-- Right-aligned so the label sits immediately left of its
                         own figure. Left-aligned across three columns it read as
                         an unrelated caption with a number floating away from
                         it, which is what made the row look misaligned. --}}
                    <td colspan="3" class="num">Total released</td>
                    <td class="num">
                        {{--
                            A dash, not 0.00, on a programme that released no
                            cash at all.

                            "Total released 0.00" under a list of fertiliser
                            sacks says the programme handed out nothing, which
                            is the opposite of what the rows above it show. A
                            goods programme has no cash total, rather than a
                            cash total of zero.
                        --}}
                        @if($summary['cash_total'] > 0)
                            {{ number_format($summary['cash_total'], 2) }}
                        @else
                            <span class="muted">&mdash;</span>
                        @endif
                    </td>
                    <td colspan="2">
                        {{ $summary['received'] }} of {{ $summary['beneficiaries'] }} collected
                    </td>
                </tr>
            @endif
        </tbody>
    </table>

    {{-- Stated because the total above counts only what has actually been
         handed over, which is not the same as what the programme has allocated. --}}
    @if($summary['awaiting'] > 0)
        <p class="sub" style="margin-top:14px">
            The total covers goods and cash already released. {{ $summary['awaiting'] }}
            {{ \Illuminate\Support\Str::plural('beneficiary', $summary['awaiting']) }}
            {{ $summary['awaiting'] === 1 ? 'is' : 'are' }} still awaiting collection and
            {{ $summary['awaiting'] === 1 ? 'is' : 'are' }} not included in it.
        </p>
    @endif
</body>
</html>
