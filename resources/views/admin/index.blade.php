@extends('layouts.admin')
@section('title', 'Overview')

@section('content-header')
    <p class="admin-kicker">Workspace</p>
    <h1>Overview</h1>
    <p class="admin-intro">Manage your infrastructure, access, and panel configuration.</p>
@endsection

@section('content')
<div class="admin-metrics">
    @foreach(['servers' => 'Servers', 'nodes' => 'Nodes', 'users' => 'Users', 'locations' => 'Locations'] as $key => $label)
        <a class="admin-metric" href="{{ route('admin.'.$key) }}">
            @include('partials.navigation-icon', ['name' => $key])
            <div><strong>{{ number_format($counts[$key]) }}</strong><span>{{ $label }}</span></div>
        </a>
    @endforeach
</div>
<div class="admin-workspace">
    <section class="box">
        <div class="box-header with-border"><h2 class="box-title">Manage workspace</h2></div>
        <div class="box-body">
            @foreach([
                ['servers', 'Servers', 'Resources, allocations, and server configuration.'],
                ['nodes', 'Nodes & infrastructure', 'Manage the machines running your servers.'],
                ['users', 'People & access', 'Accounts, permissions, and administration.'],
                ['settings', 'Panel settings', 'Branding, email, and workspace preferences.']
            ] as [$key, $label, $description])
                <a class="admin-action-row" href="{{ route('admin.'.$key) }}">
                    @include('partials.navigation-icon', ['name' => $key])
                    <div><strong>{{ $label }}</strong><p>{{ $description }}</p></div><span aria-hidden="true">&rarr;</span>
                </a>
            @endforeach
        </div>
    </section>
    <section class="box">
        <div class="box-header with-border"><h2 class="box-title">Panel information</h2></div>
        <div class="box-body">
            <div class="admin-version-row"><span>Rockdactyl</span><code>{{ config('app.fork-version') }}</code></div>
            <div class="admin-version-row"><span>Pterodactyl</span><code>{{ config('app.version') }}</code></div>
            <div class="admin-version-row"><span>Appearance</span><span>{{ config('branding.theme_preset') === 'blue' ? 'Cobalt' : 'Crimson' }}</span></div>
            <p class="admin-version-note">@if($version->isLatestPanel())Pterodactyl is up to date.@else A Pterodactyl update is available. Check compatibility before updating.@endif</p>
            <a class="admin-action-row" href="https://pterodactyl.io" target="_blank" rel="noopener noreferrer">
                <div><strong>Documentation</strong><p>Setup and administration guides.</p></div><span aria-hidden="true">&nearr;</span>
            </a>
        </div>
    </section>
</div>
<section class="box">
    <div class="box-header with-border"><h2 class="box-title">Recently added servers</h2></div>
    <div class="box-body">
        @forelse($recentServers as $server)
            <a class="admin-action-row" href="{{ route('admin.servers.view', $server->id) }}">
                @include('partials.navigation-icon', ['name' => 'servers'])
                <div><strong>{{ $server->name }}</strong><p>{{ $server->node->name }} &middot; {{ $server->uuidShort }}</p></div>
                <span aria-hidden="true">&rarr;</span>
            </a>
        @empty
            <p class="admin-intro">No servers yet. Add a node, then create your first server.</p>
            <a class="btn btn-primary" href="{{ route('admin.servers') }}">Manage servers</a>
        @endforelse
    </div>
</section>
@endsection
