<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Agricultural Assets Report</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        h1 { text-align: center; color: #2d5016; }
        h2 { color: #4a7c2c; margin-top: 20px; border-bottom: 2px solid #4a7c2c; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #4a7c2c; color: white; padding: 8px; text-align: left; }
        td { padding: 6px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary { background-color: #e8f5e9; padding: 10px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <h1>Agricultural Assets Report</h1>
    <p style="text-align: center; color: #666;">Generated: {{ date('F d, Y') }}</p>

    <h2>Tree Crops</h2>
    <table>
        <thead>
            <tr>
                <th>Barangay</th>
                <th>Crop Type</th>
                <th>Total Trees</th>
                <th>Total Area (ha)</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data['tree_crops'] as $row)
            <tr>
                <td>{{ $row->barangay }}</td>
                <td>{{ $row->crop_type }}</td>
                <td>{{ number_format($row->total_trees ?? 0) }}</td>
                <td>{{ number_format($row->total_area ?? 0, 2) }}</td>
            </tr>
            @empty
            <tr><td colspan="4" style="text-align: center;">No data</td></tr>
            @endforelse
        </tbody>
    </table>

    <h2>Fishponds</h2>
    <table>
        <thead>
            <tr>
                <th>Barangay</th>
                <th>Species</th>
                <th>Total Area (ha)</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data['fishponds'] as $row)
            <tr>
                <td>{{ $row->barangay }}</td>
                <td>{{ $row->species }}</td>
                <td>{{ number_format($row->total_area, 2) }}</td>
            </tr>
            @empty
            <tr><td colspan="3" style="text-align: center;">No data</td></tr>
            @endforelse
        </tbody>
    </table>

    <h2>Large Ruminants</h2>
    <table>
        <thead>
            <tr>
                <th>Barangay</th>
                <th>Type</th>
                <th>Male</th>
                <th>Female</th>
                <th>Total</th>
                <th>Large Raisers</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data['large_ruminants'] as $row)
            <tr>
                <td>{{ $row->barangay }}</td>
                <td>{{ $row->animal_type }}</td>
                <td>{{ number_format($row->total_male) }}</td>
                <td>{{ number_format($row->total_female) }}</td>
                <td>{{ number_format($row->total_heads) }}</td>
                <td>{{ $row->large_raisers }}</td>
            </tr>
            @empty
            <tr><td colspan="6" style="text-align: center;">No data</td></tr>
            @endforelse
        </tbody>
    </table>

    <h2>Small Ruminants</h2>
    <table>
        <thead>
            <tr>
                <th>Barangay</th>
                <th>Type</th>
                <th>Male</th>
                <th>Female</th>
                <th>Total</th>
                <th>Large Raisers</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data['small_ruminants'] as $row)
            <tr>
                <td>{{ $row->barangay }}</td>
                <td>{{ $row->animal_type }}</td>
                <td>{{ number_format($row->total_male) }}</td>
                <td>{{ number_format($row->total_female) }}</td>
                <td>{{ number_format($row->total_heads) }}</td>
                <td>{{ $row->large_raisers }}</td>
            </tr>
            @empty
            <tr><td colspan="6" style="text-align: center;">No data</td></tr>
            @endforelse
        </tbody>
    </table>

    <h2>Swine</h2>
    <table>
        <thead>
            <tr>
                <th>Barangay</th>
                <th>Type</th>
                <th>Male</th>
                <th>Female</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data['swine'] as $row)
            <tr>
                <td>{{ $row->barangay }}</td>
                <td>{{ $row->type }}</td>
                <td>{{ number_format($row->total_male) }}</td>
                <td>{{ number_format($row->total_female) }}</td>
                <td>{{ number_format($row->total_heads) }}</td>
            </tr>
            @empty
            <tr><td colspan="5" style="text-align: center;">No data</td></tr>
            @endforelse
        </tbody>
    </table>

    <h2>Poultry</h2>
    <table>
        <thead>
            <tr>
                <th>Barangay</th>
                <th>Bird Type</th>
                <th>Male</th>
                <th>Female</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data['poultry'] as $row)
            <tr>
                <td>{{ $row->barangay }}</td>
                <td>{{ $row->bird_type }}</td>
                <td>{{ number_format($row->total_male) }}</td>
                <td>{{ number_format($row->total_female) }}</td>
                <td>{{ number_format($row->total_heads) }}</td>
            </tr>
            @empty
            <tr><td colspan="5" style="text-align: center;">No data</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
