@extends('layouts.admin')
@include('partials/admin.settings.nav', ['activeTab' => 'basic'])

@section('title')
    Settings
@endsection

@section('content-header')
    <h1>Settings</h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Settings</li>
    </ol>
@endsection

@section('content')
    @yield('settings::nav')
    <div class="row">
        <div class="col-xs-12">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">General</h3>
                </div>
                <form action="{{ route('admin.settings') }}" method="POST">
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-4">
                                <label class="control-label">Panel Name</label>
                                <div>
                                    <input type="text" class="form-control" name="app:name" value="{{ old('app:name', config('app.name')) }}" />
                                </div>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Require 2-Factor Authentication</label>
                                <div>
                                    <div class="btn-group" data-toggle="buttons">
                                        @php
                                            $level = old('pterodactyl:auth:2fa_required', config('pterodactyl.auth.2fa_required'));
                                        @endphp
                                        <label class="btn btn-primary @if ($level == 0) active @endif">
                                            <input type="radio" name="pterodactyl:auth:2fa_required" autocomplete="off" value="0" @if ($level == 0) checked @endif> Not Required
                                        </label>
                                        <label class="btn btn-primary @if ($level == 1) active @endif">
                                            <input type="radio" name="pterodactyl:auth:2fa_required" autocomplete="off" value="1" @if ($level == 1) checked @endif> Admin Only
                                        </label>
                                        <label class="btn btn-primary @if ($level == 2) active @endif">
                                            <input type="radio" name="pterodactyl:auth:2fa_required" autocomplete="off" value="2" @if ($level == 2) checked @endif> All Users
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Default Language</label>
                                <div>
                                    <select name="app:locale" class="form-control">
                                        @foreach($languages as $key => $value)
                                            <option value="{{ $key }}" @if(config('app.locale') === $key) selected @endif>{{ $value }}</option>
                                        @endforeach
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="box-header with-border">
                        <h3 class="box-title">Dashboard</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-4">
                                <label class="control-label">Dashboard Title</label>
                                <input type="text" class="form-control" name="branding:dashboard_title" value="{{ old('branding:dashboard_title', config('branding.dashboard_title')) }}" maxlength="100" />
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Dashboard Subtitle</label>
                                <input type="text" class="form-control" name="branding:dashboard_subtitle" value="{{ old('branding:dashboard_subtitle', config('branding.dashboard_subtitle')) }}" maxlength="160" />
                                <p class="text-muted"><small>Use <code>{username}</code> for the signed-in user.</small></p>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Dashboard Image</label>
                                <input type="text" class="form-control" name="branding:dashboard_image" value="{{ old('branding:dashboard_image', config('branding.dashboard_image')) }}" placeholder="/branding/hero.png or https://..." maxlength="500" />
                            </div>
                        </div>
                    </div>
                    <div class="box-header with-border">
                        <h3 class="box-title">Theme Studio</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-4">
                                <label class="control-label" for="theme-preset">Preset</label>
                                @php($themePreset = old('branding:theme_preset', config('branding.theme_preset', 'makima')))
                                @php($themePreset = in_array($themePreset, ['makima', 'blue'], true) ? $themePreset : 'makima')
                                <select class="form-control" id="theme-preset" name="branding:theme_preset">
                                    <option value="makima" @if($themePreset === 'makima') selected @endif>Crimson Red</option>
                                    <option value="blue" @if($themePreset === 'blue') selected @endif>Midnight Blue</option>
                                </select>
                            </div>
                            <div class="form-group col-md-3" hidden>
                                <label class="control-label">Glass</label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="theme-glass" name="branding:glass_strength" value="{{ old('branding:glass_strength', config('branding.glass_strength', 18)) }}" min="0" max="30" />
                                    <span class="input-group-addon">px</span>
                                </div>
                            </div>
                            <div class="form-group col-md-3" hidden>
                                <label class="control-label">Radius</label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="theme-radius" name="branding:card_radius" value="{{ old('branding:card_radius', config('branding.card_radius', 12)) }}" min="6" max="20" />
                                    <span class="input-group-addon">px</span>
                                </div>
                            </div>
                            <div class="form-group col-md-2" hidden>
                                <label class="control-label">Motion</label>
                                @php($motionEnabled = (int) old('branding:motion_enabled', config('branding.motion_enabled', true)))
                                <select class="form-control" id="theme-motion" name="branding:motion_enabled">
                                    <option value="1" @if($motionEnabled === 1) selected @endif>Enabled</option>
                                    <option value="0" @if($motionEnabled === 0) selected @endif>Reduced</option>
                                </select>
                            </div>
                        </div>
                        <p class="help-block">Both palettes use matte surfaces, consistent spacing, and static navigation. Decorative glass and particle effects are disabled.</p>
                        <div id="theme-preview" style="padding: 22px; border: 1px solid #2c3036; border-radius: 8px; background: #191b1f;">
                            <small style="letter-spacing:.14em;text-transform:uppercase;opacity:.55">Live preview</small>
                            <h3 style="margin:8px 0 5px">Rockdactyl</h3>
                            <span id="theme-preview-chip" style="display:inline-block;padding:5px 10px;border-radius:4px;border:1px solid currentColor">Workspace</span>
                        </div>
                    </div>
                    <div class="box-header with-border">
                        <h3 class="box-title">Login</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-4">
                                <label class="control-label">Title</label>
                                <input type="text" class="form-control" name="branding:login_title" value="{{ old('branding:login_title', config('branding.login_title', 'Server control.')) }}" maxlength="80" />
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Subtitle</label>
                                <input type="text" class="form-control" name="branding:login_subtitle" value="{{ old('branding:login_subtitle', config('branding.login_subtitle', 'Use your account.')) }}" maxlength="120" />
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Artwork / Video</label>
                                <input type="text" class="form-control" name="branding:login_media" value="{{ old('branding:login_media', config('branding.login_media')) }}" placeholder="/branding/login.webp, .gif, .mp4 or https://..." maxlength="500" />
                            </div>
                        </div>
                    </div>
                    <div class="box-header with-border">
                        <h3 class="box-title">Console</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-6">
                                <label class="control-label">Background Media</label>
                                <input type="text" class="form-control" name="branding:console_background" value="{{ old('branding:console_background', config('branding.console_background')) }}" placeholder="/branding/console.webp, .gif, .mp4 or https://..." maxlength="500" />
                                <p class="text-muted"><small>Supports images, animated GIFs, MP4, WebM, OGG and MOV. Leave blank for the standard console.</small></p>
                            </div>
                            <div class="form-group col-md-2">
                                <label class="control-label">Media Visibility</label>
                                <div class="input-group">
                                    <input type="number" class="form-control" name="branding:console_background_opacity" value="{{ old('branding:console_background_opacity', config('branding.console_background_opacity', 18)) }}" min="5" max="45" step="1" />
                                    <span class="input-group-addon">%</span>
                                </div>
                                <p class="text-muted"><small>Recommended: 12-24% for readable output.</small></p>
                            </div>
                            <div class="form-group col-md-2">
                                <label class="control-label">Font Size</label>
                                <div class="input-group">
                                    <input type="number" class="form-control" name="branding:console_font_size" value="{{ old('branding:console_font_size', config('branding.console_font_size', 12)) }}" min="10" max="18" />
                                    <span class="input-group-addon">px</span>
                                </div>
                            </div>
                            <div class="form-group col-md-2">
                                <label class="control-label">Scanlines</label>
                                @php($scanlines = (int) old('branding:console_scanlines', config('branding.console_scanlines', false)))
                                <select class="form-control" name="branding:console_scanlines">
                                    <option value="0" @if($scanlines === 0) selected @endif>Off</option>
                                    <option value="1" @if($scanlines === 1) selected @endif>On</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="box-header with-border">
                        <h3 class="box-title">Public Status</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-2">
                                <label class="control-label">Status Page</label>
                                @php($statusEnabled = (int) old('branding:status_enabled', config('branding.status_enabled', true)))
                                <select class="form-control" name="branding:status_enabled">
                                    <option value="1" @if($statusEnabled === 1) selected @endif>Public</option>
                                    <option value="0" @if($statusEnabled === 0) selected @endif>Hidden</option>
                                </select>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Headline</label>
                                <input type="text" class="form-control" name="branding:status_title" value="{{ old('branding:status_title', config('branding.status_title', 'Systems operational')) }}" maxlength="80" />
                            </div>
                            <div class="form-group col-md-6">
                                <label class="control-label">Message</label>
                                <input type="text" class="form-control" name="branding:status_message" value="{{ old('branding:status_message', config('branding.status_message', 'Infrastructure is online and operating normally.')) }}" maxlength="240" />
                                <p class="text-muted"><small>Public URL: <code>{{ url('/status') }}</code></small></p>
                            </div>
                        </div>
                        <div class="row">
                            <div class="form-group col-md-4">
                                <label class="control-label">Show Node Cards</label>
                                @php($showNodes = (int) old('branding:status_show_nodes', config('branding.status_show_nodes', true)))
                                <select class="form-control" name="branding:status_show_nodes">
                                    <option value="1" @if($showNodes === 1) selected @endif>Visible</option>
                                    <option value="0" @if($showNodes === 0) selected @endif>Hidden</option>
                                </select>
                                <p class="text-muted"><small>Show individual node statuses on the public status page.</small></p>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Node Filter Mode</label>
                                @php($nodeMode = old('branding:status_node_mode', config('branding.status_node_mode', 'all')))
                                <select class="form-control" name="branding:status_node_mode">
                                    <option value="all" @if($nodeMode === 'all') selected @endif>All Nodes</option>
                                    <option value="operational_only" @if($nodeMode === 'operational_only') selected @endif>Operational Only</option>
                                    <option value="summary_only" @if($nodeMode === 'summary_only') selected @endif>Summary Totals Only</option>
                                </select>
                                <p class="text-muted"><small>Controls which node cards are rendered publicly.</small></p>
                            </div>
                        </div>
                    </div>
                    <div class="box-header with-border">
                        <h3 class="box-title">Announcement Banner</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-2">
                                <label class="control-label">Banner Status</label>
                                @php($announcementEnabled = (int) old('branding:announcement_enabled', config('branding.announcement_enabled', false)))
                                <select class="form-control" name="branding:announcement_enabled">
                                    <option value="1" @if($announcementEnabled === 1) selected @endif>Active</option>
                                    <option value="0" @if($announcementEnabled === 0) selected @endif>Disabled</option>
                                </select>
                            </div>
                            <div class="form-group col-md-2">
                                <label class="control-label">Severity Level</label>
                                @php($announcementType = old('branding:announcement_type', config('branding.announcement_type', 'notice')))
                                <select class="form-control" name="branding:announcement_type">
                                    <option value="notice" @if($announcementType === 'notice') selected @endif>Notice (Theme Accent)</option>
                                    <option value="warning" @if($announcementType === 'warning') selected @endif>Warning (Amber)</option>
                                    <option value="critical" @if($announcementType === 'critical') selected @endif>Critical (Crimson Red)</option>
                                </select>
                            </div>
                            <div class="form-group col-md-5">
                                <label class="control-label">Announcement Message</label>
                                <input type="text" class="form-control" name="branding:announcement_message" value="{{ old('branding:announcement_message', config('branding.announcement_message')) }}" placeholder="Scheduled maintenance will occur tonight at 00:00 UTC." maxlength="300" />
                            </div>
                            <div class="form-group col-md-3">
                                <label class="control-label">Action Link (Optional)</label>
                                <input type="text" class="form-control" name="branding:announcement_link" value="{{ old('branding:announcement_link', config('branding.announcement_link')) }}" placeholder="https://status.example.com or /status" maxlength="500" />
                            </div>
                        </div>
                    </div>
                    <div class="box-header with-border">
                        <h3 class="box-title">Branding</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-4">
                                <label class="control-label">Footer Owner</label>
                                <input type="text" class="form-control" name="branding:owner" value="{{ old('branding:owner', config('branding.owner')) }}" />
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Footer URL</label>
                                <input type="url" class="form-control" name="branding:url" value="{{ old('branding:url', config('branding.url')) }}" placeholder="https://example.com" />
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Header Mark</label>
                                <input type="text" class="form-control" name="branding:mark" value="{{ old('branding:mark', config('branding.mark')) }}" maxlength="12" />
                            </div>
                            <div class="form-group col-md-8">
                                <label class="control-label">Logo</label>
                                <input type="text" class="form-control" name="branding:logo" value="{{ old('branding:logo', config('branding.logo')) }}" placeholder="/branding/logo.png or https://..." maxlength="500" />
                                <p class="text-muted"><small>Optional. Leave blank to use the header mark.</small></p>
                            </div>
                            <div class="form-group col-md-4">
                                <label class="control-label">Start Year</label>
                                <input type="number" class="form-control" name="branding:start_year" value="{{ old('branding:start_year', config('branding.start_year')) }}" min="1900" max="{{ date('Y') }}" />
                            </div>
                        </div>
                    </div>
                    <div class="box-footer">
                        {!! csrf_field() !!}
                        <button type="submit" name="_method" value="PATCH" class="btn btn-sm btn-primary pull-right">Save</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection

@section('footer-scripts')
    @parent
    <script>
        (() => {
            const preset = document.getElementById('theme-preset');
            const glass = document.getElementById('theme-glass');
            const radius = document.getElementById('theme-radius');
            const motion = document.getElementById('theme-motion');
            const preview = document.getElementById('theme-preview');
            const chip = document.getElementById('theme-preview-chip');
            const presets = {
                'makima': ['#c94f59', '#0d0d0f'],
                'blue': ['#5b8cff', '#09111e'],
            };
            const hexToRgb = (value) => {
                const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);
                return match ? match.slice(1).map((part) => parseInt(part, 16)) : [201, 79, 89];
            };
            const render = () => {
                const colors = presets[preset.value] || presets.makima;
                const rgb = hexToRgb(colors[0]);
                const bright = rgb.map((channel) => Math.round(channel + (255 - channel) * .38)).join(', ');
                document.documentElement.dataset.rockTheme = preset.value;
                document.documentElement.dataset.rockMotion = motion.value === '1' ? 'full' : 'reduced';
                document.documentElement.style.setProperty('--admin-accent', colors[0]);
                document.documentElement.style.setProperty('--admin-accent-bright', `rgb(${bright})`);
                document.documentElement.style.setProperty('--admin-accent-soft', `rgba(${rgb.join(', ')}, .12)`);
                document.documentElement.style.setProperty('--admin-accent-border', `rgba(${rgb.join(', ')}, .34)`);
                document.documentElement.style.setProperty('--admin-radius', `${radius.value}px`);
                document.documentElement.style.setProperty('--admin-glass', `${glass.value}px`);
                preview.style.borderRadius = '8px';
                preview.style.background = '#191b1f';
                chip.style.color = colors[0];
                chip.style.borderColor = `${colors[0]}66`;
                chip.style.background = `${colors[0]}22`;
            };
            [preset, glass, radius, motion].forEach((input) => input && input.addEventListener('input', render));
            render();
        })();
    </script>
@endsection
