export type DocCode = {
    label?: string;
    language?: string;
    value: string;
};

export type DocCallout = {
    title: string;
    body: string;
    tone?: 'info' | 'warning' | 'success';
};

export type DocStep = {
    title: string;
    body: string;
    code?: DocCode;
};

export type DocSection = {
    id: string;
    title: string;
    body?: string[];
    bullets?: string[];
    code?: DocCode[];
    callout?: DocCallout;
    steps?: DocStep[];
};

export type DocPage = {
    slug: string;
    eyebrow: string;
    title: string;
    description: string;
    sections: DocSection[];
};

export type DocNavItem = {
    href: string;
    title: string;
    description: string;
};

export type DocNavGroup = {
    label: string;
    items: readonly DocNavItem[];
};

export const repositoryUrl = 'https://github.com/devrock07/Rockdactyl';
export const releaseUrl = `${repositoryUrl}/releases/tag/v3.0.0`;

export const docsNavigation: readonly DocNavGroup[] = [
    {
        label: 'Start',
        items: [
            {
                href: '/docs',
                title: 'Overview',
                description: 'How Rockdactyl fits together',
            },
            {
                href: '/docs/installation',
                title: 'Installation',
                description: 'Install and verify a release',
            },
        ],
    },
    {
        label: 'Customize',
        items: [
            {
                href: '/docs/configuration',
                title: 'Configuration',
                description: 'Brand, presets, and media',
            },
        ],
    },
    {
        label: 'Operate',
        items: [
            {
                href: '/docs/operations',
                title: 'Operations',
                description: 'Telemetry, status, and alerts',
            },
            {
                href: '/docs/updates',
                title: 'Updates & recovery',
                description: 'Upgrade and restore safely',
            },
        ],
    },
    {
        label: 'Build',
        items: [
            {
                href: '/docs/troubleshooting',
                title: 'Troubleshooting',
                description: 'Fix common deployment issues',
            },
            {
                href: '/docs/development',
                title: 'Development',
                description: 'Architecture and test gates',
            },
        ],
    },
];

export const searchablePages = [
    ...docsNavigation.flatMap((group) =>
        group.items.map((item) => ({ ...item, group: group.label })),
    ),
    {
        href: '/changelog',
        title: 'Changelog',
        description: 'What shipped in Rockdactyl',
        group: 'Project',
    },
] as const;

const overview: DocPage = {
    slug: 'overview',
    eyebrow: 'Documentation',
    title: 'Operate the theme, not a pile of patches.',
    description:
        'Rockdactyl is a complete Pterodactyl distribution: interface, operator settings, release tooling, telemetry, and recovery are shipped as one tested unit.',
    sections: [
        {
            id: 'what-you-get',
            title: 'What you get',
            body: [
                'The client dashboard, server pages, login flow, public status page, and Blade-based administration area share one responsive visual system. Administrators control identity and media from Panel Settings instead of editing compiled files.',
            ],
            bullets: [
                'Crimson Red and Midnight Blue interface presets.',
                'Search, favorites, server groups, quick actions, and mobile navigation.',
                'Live and retained telemetry, persistent notifications, and public incidents.',
                'Checksum-verified releases, snapshots, restore, and upstream compatibility automation.',
            ],
        },
        {
            id: 'compatibility',
            title: 'Compatibility contract',
            body: [
                'Rockdactyl v3.0.0 is built on Pterodactyl Panel v1.15.1. Upgrade through a compatible Rockdactyl release so the theme, database migrations, and panel source move together.',
            ],
            callout: {
                title: 'Do not run the vanilla updater over a themed install',
                body: 'The official updater can replace Rockdactyl files without applying the matching theme release. Use the Rockdactyl manager for updates and recovery.',
                tone: 'warning',
            },
        },
        {
            id: 'choose-a-path',
            title: 'Choose a path',
            steps: [
                {
                    title: 'New install',
                    body: 'Back up the panel, download the manager, then install the latest verified release.',
                },
                {
                    title: 'Customize',
                    body: 'Open Admin → Settings to set the preset, identity, artwork, favicons, console media, glass, radius, and motion.',
                },
                {
                    title: 'Operate',
                    body: 'Enable the status surface and telemetry schedule, then verify notifications and server access with a normal user account.',
                },
            ],
        },
    ],
};

const installation: DocPage = {
    slug: 'installation',
    eyebrow: 'Get started',
    title: 'Install a verified release.',
    description:
        'Use the manager on an existing Pterodactyl 1.15.1 panel. It validates the archive and checksum, snapshots panel files, runs migrations, builds caches, and can restore its original snapshot.',
    sections: [
        {
            id: 'requirements',
            title: 'Requirements',
            bullets: [
                'A working Pterodactyl Panel 1.15.1 installation on Linux.',
                'PHP 8.2 or 8.3, Composer, MariaDB or MySQL, and standard panel services.',
                'Root or sudo access and enough disk space for a complete file snapshot.',
                'A separate database dump and a copy of the panel .env file.',
            ],
            callout: {
                title: 'Back up first',
                body: 'The manager snapshots application files. It intentionally does not replace your own database and .env backups.',
                tone: 'warning',
            },
        },
        {
            id: 'install',
            title: 'Install',
            body: [
                'Download the manager first so you can inspect it before running it. Rockdactyl does not recommend piping a network response directly into a privileged shell.',
            ],
            code: [
                {
                    label: 'Download',
                    language: 'bash',
                    value: 'curl -fsSL https://raw.githubusercontent.com/devrock07/Rockdactyl/main/install.sh \\\n  -o /tmp/rockdactyl-install.sh',
                },
                {
                    label: 'Run',
                    language: 'bash',
                    value: 'sudo bash /tmp/rockdactyl-install.sh install',
                },
            ],
        },
        {
            id: 'verify',
            title: 'Verify the panel',
            steps: [
                {
                    title: 'Open the login page',
                    body: 'Confirm the configured identity, favicon, media, and centered form render without a browser error.',
                },
                {
                    title: 'Check client flows',
                    body: 'Open the dashboard, notification center, search, one server console, Files, Backups, Databases, Schedules, and Startup.',
                },
                {
                    title: 'Check administration',
                    body: 'Open Settings and a create/import modal for Locations, Databases, Mounts, Nests, Nodes, Servers, and Users.',
                },
                {
                    title: 'Check mobile',
                    body: 'At a narrow viewport, verify the header, bottom navigation, dialogs, menus, and server actions remain inside the screen.',
                },
            ],
            callout: {
                title: 'Release artifacts',
                body: 'The v3.0.0 release publishes panel.tar.gz and panel.tar.gz.sha256. The manager verifies both before changing the panel.',
                tone: 'success',
            },
        },
    ],
};

const configuration: DocPage = {
    slug: 'configuration',
    eyebrow: 'Customize',
    title: 'Make the panel yours.',
    description:
        'The Theme Studio in Admin Settings is the source of truth for visual identity. Saved settings apply across login, dashboard, server, status, and administration surfaces.',
    sections: [
        {
            id: 'identity',
            title: 'Identity',
            body: [
                'Set the panel name, compact mark or full logo, footer owner, footer start year, and favicon assets. Use a short mark when the full logo would be unreadable in the mobile header.',
            ],
            bullets: [
                'Panel name and short mark are plain text fallbacks.',
                'Logo accepts a local public path or an HTTPS media URL.',
                'Footer identity and year are rendered from saved settings.',
                'Favicon files should preserve the expected filenames and dimensions.',
            ],
        },
        {
            id: 'presets',
            title: 'Visual preset',
            body: [
                'Choose Crimson Red for the default Rockdactyl identity or Midnight Blue for a cooler operator surface. Both presets style client and admin states; the selection is not a dashboard-only color swap.',
            ],
            callout: {
                title: 'Two presets by design',
                body: 'Rockdactyl intentionally ships two finished presets instead of a long list of partially themed accent colors.',
                tone: 'info',
            },
        },
        {
            id: 'media',
            title: 'Dashboard, login, and console media',
            body: [
                'Dashboard and login media accept local public paths or remote image URLs. Console media also supports animated GIF, MP4, WebM, OGG, and MOV sources with a separate visibility control.',
                'Prefer locally hosted, licensed media. Use low-detail, dark assets and keep console visibility between 12% and 24% so output stays readable.',
            ],
            code: [
                {
                    label: 'Local dashboard image',
                    value: '/branding/dashboard.webp',
                },
                {
                    label: 'Local console video',
                    value: '/branding/console.webm',
                },
            ],
        },
        {
            id: 'motion',
            title: 'Surface and motion controls',
            bullets: [
                'Glass strength controls blur and transparency without hiding borders.',
                'Radius changes are applied through shared tokens so cards, menus, and dialogs stay consistent.',
                'Motion intensity respects the browser reduced-motion preference and coarse-pointer devices.',
            ],
        },
    ],
};

const operations: DocPage = {
    slug: 'operations',
    eyebrow: 'Operate',
    title: 'See what matters, keep the noise down.',
    description:
        'Rockdactyl adds operational context without replacing Pterodactyl permissions or Wings. Telemetry and notifications remain scoped to the signed-in user and the servers they can access.',
    sections: [
        {
            id: 'telemetry',
            title: 'Telemetry',
            body: [
                'The server console renders live CPU, memory, storage, and network charts. One-hour and 24-hour views use retained samples; the scheduled collector keeps seven days of data and prunes older rows.',
            ],
            code: [
                {
                    label: 'Run the collector manually',
                    language: 'bash',
                    value: 'php artisan rock:telemetry',
                },
                {
                    label: 'Confirm the scheduler',
                    language: 'bash',
                    value: 'php artisan schedule:list',
                },
            ],
        },
        {
            id: 'notifications',
            title: 'Persistent notifications',
            body: [
                'Offline, recovery, and high-CPU events are stored per user. Reading, clearing, and reloading the panel preserve notification state; a new server transition can create a new event later.',
            ],
            bullets: [
                'Offline and recovery events follow actual state transitions.',
                'CPU warnings are limited to one warning per server per hour.',
                'Owners and assigned subusers receive events only for accessible servers.',
            ],
        },
        {
            id: 'status',
            title: 'Public status and announcements',
            body: [
                'The public /status page shows service health without exposing server controls. Global incident announcements can be published from the administration interface and rendered consistently on desktop and mobile.',
            ],
            callout: {
                title: 'Permission boundary',
                body: 'Rockdactyl reuses Pterodactyl authentication and server-access middleware. It does not create a parallel account or authorization system.',
                tone: 'success',
            },
        },
        {
            id: 'mobile',
            title: 'Mobile operator flow',
            body: [
                'The compact header and bottom navigation keep Servers, Account, API, and Status reachable without horizontal scrolling. Menus and dialogs switch to viewport-safe surfaces with touch-sized targets.',
            ],
        },
    ],
};

const updates: DocPage = {
    slug: 'updates',
    eyebrow: 'Lifecycle',
    title: 'Update with a way back.',
    description:
        'The manager pins the selected release, verifies it, preserves the live environment and storage, and leaves a recoverable snapshot before the new source is activated.',
    sections: [
        {
            id: 'update',
            title: 'Update Rockdactyl',
            body: [
                'Refresh the manager, inspect it if needed, then run the update operation from the panel host.',
            ],
            code: [
                {
                    label: 'Download',
                    language: 'bash',
                    value: 'curl -fsSL https://raw.githubusercontent.com/devrock07/Rockdactyl/main/install.sh \\\n  -o /tmp/rockdactyl-install.sh',
                },
                {
                    label: 'Update',
                    language: 'bash',
                    value: 'sudo bash /tmp/rockdactyl-install.sh update',
                },
            ],
        },
        {
            id: 'restore',
            title: 'Restore the manager snapshot',
            body: [
                'Restore returns application files from the manager-created original backup while preserving the live .env, storage directory, and database. Use your own database dump if a database rollback is required.',
            ],
            code: [
                {
                    label: 'Restore',
                    language: 'bash',
                    value: 'sudo bash /tmp/rockdactyl-install.sh restore',
                },
            ],
            callout: {
                title: 'Database changes are not reversed',
                body: 'Restore is intentionally file-focused. Review the release migration notes before attempting a database rollback.',
                tone: 'warning',
            },
        },
        {
            id: 'autopilot',
            title: 'Upstream Autopilot',
            body: [
                'Repository automation watches official Pterodactyl releases, opens a compatibility update, runs backend, frontend, installer, release, container, and responsive gates, and publishes only after the change is reviewed and merged.',
            ],
            bullets: [
                'The upstream tag and commit are pinned together.',
                'Releases are reproduced and their archive byte streams are compared.',
                'Container images are built for linux/amd64 and linux/arm64.',
                'A failed gate blocks the release instead of silently shipping partial compatibility.',
            ],
        },
    ],
};

const troubleshooting: DocPage = {
    slug: 'troubleshooting',
    eyebrow: 'Support',
    title: 'Fix the deployment, not the symptom.',
    description:
        'Start with the generated asset manifest, Laravel caches, browser cache, and the exact release version. Most visual breakage comes from source and compiled assets being out of sync.',
    sections: [
        {
            id: 'stale-assets',
            title: 'Blank pages or render errors',
            steps: [
                {
                    title: 'Confirm the release',
                    body: 'Verify the panel files and public/assets/manifest.json came from the same Rockdactyl release.',
                },
                {
                    title: 'Clear Laravel caches',
                    body: 'Clear configuration, route, and view caches, then rebuild them after the environment is correct.',
                    code: {
                        language: 'bash',
                        value: 'php artisan optimize:clear\nphp artisan optimize',
                    },
                },
                {
                    title: 'Invalidate browser and CDN caches',
                    body: 'Remove cached hashed assets after a deployment. A previous JavaScript bundle can fail against a newer backend.',
                },
            ],
        },
        {
            id: 'menus-and-uploads',
            title: 'Menus, uploads, and modals',
            body: [
                'If a file three-dot menu, backup download, upload button, or admin create/import modal does not open, first verify the compiled bundle and CSS manifest match. Then test without an injected browser stylesheet or stale service worker.',
            ],
            bullets: [
                'Keep dropdowns inside a viewport-safe portal and above transformed card layers.',
                'Do not apply overflow clipping to tables that own context menus.',
                'Verify file chooser and modal backdrops on both pointer and touch layouts.',
            ],
        },
        {
            id: 'notifications',
            title: 'Notifications return after reading',
            body: [
                'Confirm the read request succeeds and the rock_notifications row receives a read timestamp. A later offline or recovery transition is a new event and should appear again.',
            ],
        },
        {
            id: 'diagnostics',
            title: 'Collect useful diagnostics',
            code: [
                {
                    language: 'bash',
                    value: 'php artisan about\nphp artisan migrate:status\nphp artisan schedule:list',
                },
            ],
            callout: {
                title: 'Protect private data',
                body: 'Remove database passwords, API keys, Wings tokens, user data, public IPs, and console output before attaching diagnostics to an issue.',
                tone: 'info',
            },
        },
    ],
};

const development: DocPage = {
    slug: 'development',
    eyebrow: 'Contribute',
    title: 'Keep the panel upgradeable.',
    description:
        'Rockdactyl extends Pterodactyl rather than replacing its security model. Contributions should keep authorization, data ownership, and release boundaries explicit.',
    sections: [
        {
            id: 'stack',
            title: 'Project stack',
            bullets: [
                'Laravel and Blade for the panel backend and administration interface.',
                'React, TypeScript, Tailwind, and styled-components for the client application.',
                'Webpack 5 for the Pterodactyl-compatible production bundle.',
                'PHPUnit, PHPStan, PHP-CS-Fixer, ESLint, TypeScript, Jest, and Playwright for quality gates.',
            ],
        },
        {
            id: 'build',
            title: 'Build from source',
            code: [
                {
                    label: 'Frontend dependencies',
                    language: 'bash',
                    value: 'yarn install --frozen-lockfile',
                },
                {
                    label: 'Production assets',
                    language: 'bash',
                    value: 'yarn run build:production',
                },
                {
                    label: 'Type and lint checks',
                    language: 'bash',
                    value: 'yarn run tsc\nyarn run lint\nyarn test --runInBand',
                },
            ],
        },
        {
            id: 'boundaries',
            title: 'Architecture boundaries',
            bullets: [
                'Client endpoints remain behind Pterodactyl authentication and server-access middleware.',
                'User preferences, telemetry, and notifications use dedicated Rockdactyl tables with explicit ownership.',
                'Admin settings are persisted server-side and exposed to clients through sanitized branding state.',
                'Release archives are generated from committed source and validated before publication.',
            ],
        },
        {
            id: 'contribute',
            title: 'Contribute',
            body: [
                'Open a focused issue before a large change. Keep pull requests small, include desktop and mobile evidence for interface changes, and update the relevant docs and tests in the same change.',
            ],
            callout: {
                title: 'Security issues stay private',
                body: 'Use GitHub private vulnerability reporting. Do not publish exploit details in a public issue.',
                tone: 'warning',
            },
        },
    ],
};

export const docs: Record<string, DocPage> = {
    overview,
    installation,
    configuration,
    operations,
    updates,
    troubleshooting,
    development,
};
