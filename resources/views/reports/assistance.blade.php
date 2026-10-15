<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"><title>Assistance Summary</title>
    <style>body{font-family:sans-serif;font-size:12px;}h1{color:#166534;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#166534;color:white;padding:6px 10px;text-align:left;}td{padding:6px 10px;border-bottom:1px solid #e5e7eb;}</style>
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
                <th>Farmer</th>
                <th>Barangay</th>
                <th>Program</th>
                <th>Date</th>
                <th style="text-align:right">Amount (PHP)</th>
                <th>Item given</th>
                <th>Status</th>
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
                <td style="text-align:right">
                    @if($d->amount_given !== null)
                        {{ number_format($d->amount_given, 2) }}
                    @else
                        &mdash;
                    @endif
                </td>
                <td>
                    @forelse($d->itemIssues as $issue)
                        {{ rtrim(number_format((float) $issue->quantity, 2), '0.') }}
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
