<!DOCTYPE html>
<html data-rock-theme="{{ config('branding.theme_preset') === 'blue' ? 'blue' : 'makima' }}">
    <head>
        <title>{{ config('app.name', 'Pterodactyl') }}</title>

        @section('meta')
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta content="width=device-width, initial-scale=1" name="viewport">
            <meta name="csrf-token" content="{{ csrf_token() }}">
            <meta name="robots" content="noindex">
            <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png?v=rock-red-2">
            <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png?v=rock-red-2" sizes="32x32">
            <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png?v=rock-red-2" sizes="16x16">
            <link rel="manifest" href="/favicons/manifest.json?v=rock-red-2">
            <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#c94f59">
            <link rel="shortcut icon" href="/favicons/favicon.ico?v=rock-red-2">
            <meta name="msapplication-config" content="/favicons/browserconfig.xml?v=rock-red-2">
            <meta name="theme-color" content="#09090a">
        @show

        @section('user-data')
            @if(!is_null(Auth::user()))
                <script>
                    window.PterodactylUser = {!! json_encode(Auth::user()->toVueObject()) !!};
                </script>
            @endif
            @if(!empty($siteConfiguration))
                <script>
                    window.SiteConfiguration = {!! json_encode($siteConfiguration) !!};
                </script>
            @endif
        @show

        @yield('assets')

        @include('layouts.scripts')
        <link rel="stylesheet" href="/themes/pterodactyl/css/rock-matte.css?v=20260927-2">
    </head>
    <body class="{{ $css['body'] ?? 'bg-neutral-50' }}">
        @section('content')
            @yield('above-container')
            @yield('container')
            @yield('below-container')
        @show
        @section('scripts')
            {!! $asset->js('main.js') !!}
        @show
    </body>
</html>
