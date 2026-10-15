<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    {{-- viewport-fit=cover so the installed app can paint into the area behind
         an iPhone's home indicator, and the farmer bottom navigation can then
         pad itself out of it with env(safe-area-inset-bottom). Without it iOS
         letterboxes the page and the nav floats above a white band. --}}
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>GeoFarm-IS - Agriculture Information System</title>
    {{-- Cache-busted on file mtime: browsers hold onto favicons hard, and a
         stale one survives an ordinary reload. --}}
    <link rel="icon" type="image/jpeg" href="{{ asset('images/Logo.jpeg') }}?v={{ @filemtime(public_path('images/Logo.jpeg')) ?: 1 }}">

    {{-- ----------------------------------------------- installable app ----
         The manifest is a static file rather than a route: it never varies by
         user, and serving it from public/ keeps it out of the session and CSRF
         path entirely. Named .webmanifest so nothing confuses it with Vite's
         build manifest at /build/manifest.json. --}}
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">
    <meta name="theme-color" content="#006400">

    {{-- iOS ignores the manifest's icons and its display mode. These three are
         what make a home-screen launch open standalone with the right icon;
         without them the app opens in a Safari tab with a screenshot icon. --}}
    <link rel="apple-touch-icon" href="{{ asset('icons/apple-touch-icon.png') }}">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="GeoFarm">
    {{-- black-translucent would let the page run under the status bar, which
         reads as a broken header on every screen in this app. --}}
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="mobile-web-app-capable" content="yes">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
</head>
<body class="bg-gray-50 text-gray-900 antialiased">
    @inertia
</body>
</html>
