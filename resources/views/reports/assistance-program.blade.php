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

        .meta { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .meta td { padding: 3px 0; vertical-align: top; }
        .meta .k { color: #6b7280; width: 110px; }
        .meta .v { font-weight: bold; }

        table.rows { width: 100%; border-collapse: collapse; }
        table.rows th { background: #166534; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
        table.rows td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
        table.rows tr.total td { border-top: 2px solid #166534; border-bottom: 0; font-weight: bold; }

        .num { text-align: right; }
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

    <table class="meta">
        <tr>
            <td class="k">Type</td>
            <td class="v">{{ $program->assistanceType?->type_name ?? 'Untyped' }}</td>
            <td class="k">Status</td>
            <td class="v">{{ ucfirst($program->status) }}</td>
        </tr>
        <tr>
            <td class="k">Period</td>
            <td class="v">
                {{ $program->start_date?->format('M d, Y') ?? '—' }}
                to {{ $program->end_date?->format('M d, Y') ?? '—' }}
            </td>
            <td class="k">Beneficiaries</td>
            {{-- Forfeited rows excluded: those goods went back on the shelf. --}}
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
                <th>Farmer</th>
                <th>Barangay</th>
                <th>Date</th>
                <th class="num">Amount (PHP)</th>
                <th>Item given</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data as $row)
                <tr>
                    <td>{{ $row['farmer'] }}</td>
                    <td>{{ $row['barangay'] ?: '—' }}</td>
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
                    <td>
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
                    <td colspan="3">Total released</td>
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
