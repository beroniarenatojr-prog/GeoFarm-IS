<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Farmer Demographics</title>
    <style>
        body { font-family: sans-serif; font-size: 12px; }
        h1 { color: #166534; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #166534; color: white; padding: 6px 10px; text-align: left; }
        td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <h1>GeoFarm-IS — Farmer Demographics</h1>
    <p>Generated: {{ now()->format('F d, Y') }}</p>
    <table>
        <thead><tr><th>Barangay</th><th>Sex</th><th>Count</th></tr></thead>
        <tbody>
            @foreach($data as $row)
            <tr><td>{{ $row->barangay }}</td><td>{{ $row->sex }}</td><td>{{ $row->count }}</td></tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
