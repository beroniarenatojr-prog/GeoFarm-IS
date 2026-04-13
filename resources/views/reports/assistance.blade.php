<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"><title>Assistance Summary</title>
    <style>body{font-family:sans-serif;font-size:12px;}h1{color:#166534;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#166534;color:white;padding:6px 10px;text-align:left;}td{padding:6px 10px;border-bottom:1px solid #e5e7eb;}</style>
</head>
<body>
    <h1>GeoFarm-IS — Assistance Distribution Summary</h1>
    <p>Generated: {{ now()->format('F d, Y') }}</p>
    <table>
        <thead><tr><th>Farmer</th><th>Program</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
            @foreach($data as $d)
            <tr>
                <td>{{ $d->farmer?->first_name }} {{ $d->farmer?->last_name }}</td>
                <td>{{ $d->assistance?->program_name }}</td>
                <td>{{ $d->distribution_date }}</td>
                <td>₱{{ number_format($d->amount_given, 2) }}</td>
                <td>{{ $d->status }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
