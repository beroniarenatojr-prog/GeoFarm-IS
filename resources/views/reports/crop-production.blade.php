<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"><title>Crop Production</title>
    <style>body{font-family:sans-serif;font-size:12px;}h1{color:#166534;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#166534;color:white;padding:6px 10px;text-align:left;}td{padding:6px 10px;border-bottom:1px solid #e5e7eb;}</style>
</head>
<body>
    <h1>GeoFarm-IS — Crop Production Report</h1>
    <p>Generated: {{ now()->format('F d, Y') }}</p>
    <table>
        <thead><tr><th>Crop</th><th>Season</th><th>Year</th><th>Area (ha)</th><th>Yield (kg)</th></tr></thead>
        <tbody>
            @foreach($data as $row)
            <tr><td>{{ $row->crop?->crop_name }}</td><td>{{ $row->season }}</td><td>{{ $row->cropping_year }}</td><td>{{ $row->total_area }}</td><td>{{ $row->total_yield }}</td></tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
