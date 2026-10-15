<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"><title>Assistance Summary</title>
    <style>
        body { font-family: sans-serif; font-size: 11px; }
        h1 { color: #166534; }
        /*
         * Fixed layout with declared widths. Seven columns on auto layout size
         * themselves from their contents, so the headings and the cells beneath
         * them stop lining up as soon as one farmer has a longer name than the
         * next — and DomPDF measures differently from the browser, so the PDF
         * and the preview disagreed as well.
         */
        table { width: 100%; border-collapse: collapse; margin-top: 16px; table-layout: fixed; }
        th { background: #166534; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
        td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; word-wrap: break-word; }
        /* On the heading as well as the cells, so one column is never aligned
           two different ways. */
        .num { text-align: right; }
    </style>
</head>
<body>
    <h1>GeoFarm-IS — Assistance Distribution Summary</h1>
    <p>Generated: {{ now()->format('F d, Y') }}</p>
    {{--
        The unit is in the column heading, not on every figure.

        DomPDF's built-in fonts carry no glyph for U+20B1, so the "₱" that used
        to prefix each amount printed as a hollow box — on a report that goes to
        the DA.
    --}}
    <table>
        <thead>
            <tr>
                <th style="width:18%">Farmer</th>
                <th style="width:12%">Barangay</th>
                <th style="width:18%">Program</th>
                <th style="width:11%">Date</th>
                <th style="width:13%" class="num">Amount (PHP)</th>
                <th style="width:17%">Item given</th>
                <th style="width:11%">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data as $d)
            <tr>
                <td>{{ trim(($d->farmer?->first_name ?? '') . ' ' . ($d->farmer?->last_name ?? '')) ?: 'Farmer no longer on file' }}</td>
                {{-- Where the farmer is, falling back to the land the release
                     was recorded against. --}}
                <td>{{ $d->farmer?->barangay ?: ($d->parcel?->barangay ?: '—') }}</td>
                <td>{{ $d->program?->program_name }}</td>
                <td>{{ $d->distribution_date?->format('M d, Y') }}</td>
                <td class="num">
                    @if($d->amount_given !== null)
                        {{ number_format($d->amount_given, 2) }}
                    @else
                        &mdash;
                    @endif
                </td>
                <td>
                    @forelse($d->itemIssues as $issue)
                        {{--
                            Two rtrim calls, not one with '0.' as the charlist.

                            rtrim('100.00', '0.') strips EVERY trailing '0' and
                            '.' — it is a set of characters, not a suffix — so
                            100 sacks printed as "1" on a report of what was
                            handed out. The zeros have to go before the point
                            does, each in its own pass.
                        --}}
                        {{ rtrim(rtrim(number_format((float) $issue->quantity, 2), '0'), '.') }}
                        {{ $issue->item?->unit }} {{ $issue->item?->item_name }}@if(!$loop->last)<br>@endif
                    @empty
                        &mdash;
                    @endforelse
                </td>
                <td>{{ $d->status }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
