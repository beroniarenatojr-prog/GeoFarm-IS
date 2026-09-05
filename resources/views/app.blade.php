<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>GeoFarm-IS - Agriculture Information System</title>
    {{-- Cache-busted on file mtime: browsers hold onto favicons hard, and a
         stale one survives an ordinary reload. --}}
    <link rel="icon" type="image/jpeg" href="{{ asset('images/Logo.jpeg') }}?v={{ @filemtime(public_path('images/Logo.jpeg')) ?: 1 }}">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
</head>
<body class="bg-gray-50 text-gray-900 antialiased">
    @inertia
</body>
</html>
