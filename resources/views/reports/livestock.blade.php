<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"><title>Livestock Inventory</title>
    <style>body{font-family:sans-serif;font-size:12px;}h1{color:#166534;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#166534;color:white;padding:6px 10px;text-align:left;}td{padding:6px 10px;border-bottom:1px solid #e5e7eb;}</style>
</head>
<body>
    <h1>GeoFarm-IS — Livestock Inventory</h1>
    <p>Generated: {{ now()->format('F d, Y') }}</p>
    <table>
        <thead><tr><th>Type</th><th>Total Count</th></tr></thead>
        <tbody>
            @foreach($data as $row)
            <tr><td>{{ $row->livestockType?->type_name }}</td><td>{{ $row->total }}</td></tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
