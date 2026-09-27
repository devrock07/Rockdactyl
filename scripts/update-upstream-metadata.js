#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const versionPattern = /^v(\d+)\.(\d+)\.(\d+)$/;

const synchronizedVersionFiles = [
    { path: 'README.md', theme: true, upstream: true },
    { path: 'docs/README.md', theme: true, upstream: true },
    { path: 'docs/INSTALLATION.md', theme: true, upstream: true },
    { path: 'docs/UPGRADING.md', theme: true, upstream: true },
    { path: 'SECURITY.md', upstream: true },
    { path: '.github/ISSUE_TEMPLATE/1-bug-report.yml', theme: true, upstream: true },
    { path: '.github/ISSUE_TEMPLATE/2-feature-request.yml', upstream: true },
    { path: '.github/ISSUE_TEMPLATE/3-installation-help.yml', theme: true, upstream: true },
    { path: '.github/docker/README.md', theme: true },
    { path: '.github/workflows/upstream-autopilot.yaml', upstream: true },
    { path: 'docker-compose.example.yml', theme: true },
    { path: 'docs/development/UPSTREAM_AUTOMATION.md', upstream: true },
    { path: 'website/app/page.tsx', theme: true, upstream: true },
    { path: 'website/lib/docs.ts', theme: true, upstream: true },
];

const websiteManifestFiles = ['website/package.json', 'website/package-lock.json'];

const replacePatternOnce = (contents, pattern, replacement, label) => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const matches = [...contents.matchAll(new RegExp(pattern.source, flags))];
    if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${label} field, found ${matches.length}.`);
    }

    return contents.replace(pattern, replacement);
};

const replaceVersionReferences = (contents, current, replacement, label) => {
    const matches = contents.split(current).length - 1;
    if (matches < 1) {
        throw new Error(`Expected at least one ${label} reference.`);
    }

    return contents.split(current).join(replacement);
};

const readReleaseMetadata = (root) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const upstreamTag = fs.readFileSync(path.join(root, '.rock', 'upstream-version'), 'utf8').trim();
    const appConfig = fs.readFileSync(path.join(root, 'config', 'app.php'), 'utf8');
    const upstreamMatch = appConfig.match(/'version'\s*=>\s*'([^']+)'/);
    const themeMatch = appConfig.match(/'fork-version'\s*=>\s*'([^']+)'/);

    if (!versionPattern.test(upstreamTag) || !versionPattern.test(`v${manifest.version || ''}`)) {
        throw new Error('The panel or Rockdactyl version is not valid semantic version metadata.');
    }
    if (!upstreamMatch || !themeMatch) throw new Error('config/app.php is missing release version metadata.');

    return {
        upstreamTag,
        upstreamVersion: upstreamTag.slice(1),
        themeTag: `v${manifest.version}`,
        themeVersion: manifest.version,
        configUpstreamVersion: upstreamMatch[1],
        configThemeVersion: themeMatch[1],
        description: manifest.description,
    };
};

const checkReleaseMetadata = (root) => {
    const metadata = readReleaseMetadata(root);
    const errors = [];
    const websiteManifest = JSON.parse(fs.readFileSync(path.join(root, 'website', 'package.json'), 'utf8'));
    const websiteLock = JSON.parse(fs.readFileSync(path.join(root, 'website', 'package-lock.json'), 'utf8'));
    const exactChecks = [
        ['README.md', /Rockdactyl `v([^`]+)` is based on and supports/, metadata.themeVersion, 'release heading'],
        ['README.md', /\| Rockdactyl\s*\| `([^`]+)`/, metadata.themeVersion, 'compatibility table'],
        ['README.md', /\| Pterodactyl Panel\s*\| `([^`]+)`/, metadata.upstreamVersion, 'compatibility table'],
        [
            'docs/README.md',
            /documentation covers Rockdactyl `v([^`]+)`, based on Pterodactyl Panel\s+`v[^`]+`/,
            metadata.themeVersion,
            'documentation release',
        ],
        [
            'docs/README.md',
            /documentation covers Rockdactyl `v[^`]+`, based on Pterodactyl Panel\s+`v([^`]+)`/,
            metadata.upstreamVersion,
            'documentation base',
        ],
        [
            'docs/INSTALLATION.md',
            /Rockdactyl `v([^`]+)` is a complete Pterodactyl Panel distribution/,
            metadata.themeVersion,
            'installation release',
        ],
        [
            'docs/INSTALLATION.md',
            /distribution based on\s+Pterodactyl `v([^`]+)`/,
            metadata.upstreamVersion,
            'installation base',
        ],
        ['docs/UPGRADING.md', /\| Rockdactyl\s*\| `v([^`]+)`/, metadata.themeVersion, 'upgrade table'],
        ['docs/UPGRADING.md', /\| Pterodactyl base\s*\| `v([^`]+)`/, metadata.upstreamVersion, 'upgrade table'],
        ['SECURITY.md', /\| Latest `\d+\.x` release \| `([^`]+)`/, metadata.upstreamVersion, 'support table'],
        [
            '.github/ISSUE_TEMPLATE/1-bug-report.yml',
            /placeholder:\s+v([^\s]+)/,
            metadata.themeVersion,
            'bug-report release',
        ],
        [
            '.github/ISSUE_TEMPLATE/1-bug-report.yml',
            /placeholder:\s+([0-9]+\.[0-9]+\.[0-9]+)\s*$/m,
            metadata.upstreamVersion,
            'bug-report base',
        ],
        [
            '.github/ISSUE_TEMPLATE/3-installation-help.yml',
            /placeholder:\s+v([^,\s]+), or the version being installed/,
            metadata.themeVersion,
            'installation-help release',
        ],
        [
            '.github/ISSUE_TEMPLATE/3-installation-help.yml',
            /placeholder:\s+([0-9]+\.[0-9]+\.[0-9]+)\s*$/m,
            metadata.upstreamVersion,
            'installation-help base',
        ],
        [
            '.github/docker/README.md',
            /\| `([0-9]+\.[0-9]+\.[0-9]+)`\s+\| Immutable release/,
            metadata.themeVersion,
            'immutable container tag',
        ],
        [
            'docker-compose.example.yml',
            /image:\s+ghcr\.io\/devrock07\/rock-theme:([^\s]+)/,
            metadata.themeVersion,
            'Compose image',
        ],
        [
            '.github/workflows/upstream-autopilot.yaml',
            /description: Optional Pterodactyl tag \(for example v([^\)]+)\)/,
            metadata.upstreamVersion,
            'autopilot example',
        ],
        [
            'docs/development/UPSTREAM_AUTOMATION.md',
            /tag such as\s+`v([^`]+)` for a controlled retry/,
            metadata.upstreamVersion,
            'autopilot documentation',
        ],
        [
            'website/app/page.tsx',
            /const releaseVersion = '([^']+)'/,
            metadata.themeVersion,
            'release version',
        ],
        ['website/lib/docs.ts', /releases\/tag\/v([^`';]+)[`';]/, metadata.themeVersion, 'release link'],
    ];

    if (metadata.configUpstreamVersion !== metadata.upstreamVersion) {
        errors.push(
            `config/app.php panel version ${metadata.configUpstreamVersion} does not match ${metadata.upstreamTag}.`
        );
    }
    if (metadata.configThemeVersion !== metadata.themeVersion) {
        errors.push(
            `config/app.php Rockdactyl version ${metadata.configThemeVersion} does not match ${metadata.themeTag}.`
        );
    }
    if (
        metadata.description !==
        `Rockdactyl, a polished and responsive UI mod for Pterodactyl Panel ${metadata.upstreamVersion}.`
    ) {
        errors.push('package.json description does not match the configured Pterodactyl version.');
    }
    if (websiteManifest.version !== metadata.themeVersion) {
        errors.push(`website/package.json version does not match ${metadata.themeTag}.`);
    }
    if (
        websiteLock.version !== metadata.themeVersion ||
        websiteLock.packages?.['']?.version !== metadata.themeVersion
    ) {
        errors.push(`website/package-lock.json version does not match ${metadata.themeTag}.`);
    }

    for (const file of synchronizedVersionFiles) {
        const contents = fs.readFileSync(path.join(root, file.path), 'utf8');
        if (file.theme && !contents.includes(metadata.themeVersion)) {
            errors.push(`${file.path} does not reference Rockdactyl ${metadata.themeVersion}.`);
        }
        if (file.upstream && !contents.includes(metadata.upstreamVersion)) {
            errors.push(`${file.path} does not reference Pterodactyl ${metadata.upstreamVersion}.`);
        }
        if (file.path === '.github/docker/README.md') {
            const minorTag = metadata.themeVersion.split('.').slice(0, 2).join('.');
            if (!new RegExp('\\|\\s*`' + minorTag.replace('.', '\\.') + '`\\s*\\|').test(contents)) {
                errors.push(`${file.path} does not publish the expected ${minorTag} minor image tag.`);
            }
        }
    }

    for (const [file, pattern, expected, label] of exactChecks) {
        const contents = fs.readFileSync(path.join(root, file), 'utf8');
        const match = contents.match(pattern);
        if (!match || match[1] !== expected) {
            errors.push(`${file} ${label} does not match ${expected}.`);
        }
    }

    if (errors.length) throw new Error(`Release metadata is inconsistent:\n- ${errors.join('\n- ')}`);
    return metadata;
};

const updateUpstreamMetadata = (root, upstreamTag, themeTag) => {
    if (!versionPattern.test(upstreamTag || '') || !versionPattern.test(themeTag || '')) {
        throw new Error('Usage: node scripts/update-upstream-metadata.js v<panel-version> v<theme-version>');
    }

    const upstreamVersionFile = path.join(root, '.rock', 'upstream-version');
    const packageFile = path.join(root, 'package.json');
    const previousUpstreamVersion = fs.readFileSync(upstreamVersionFile, 'utf8').trim().replace(/^v/, '');
    const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    const previousThemeVersion = manifest.version;
    const upstreamVersion = upstreamTag.replace(/^v/, '');
    const themeVersion = themeTag.replace(/^v/, '');
    const upstreamChanged = previousUpstreamVersion !== upstreamVersion;
    const themeChanged = previousThemeVersion !== themeVersion;
    const pendingWrites = new Map();

    if (!versionPattern.test(`v${previousUpstreamVersion}`) || !versionPattern.test(`v${previousThemeVersion}`)) {
        throw new Error('The current panel or Rockdactyl version is not valid semantic version metadata.');
    }
    if (!upstreamChanged && !themeChanged) {
        throw new Error('The requested panel and Rockdactyl versions are already current.');
    }

    const update = (relativePath, transform) => {
        const filename = path.join(root, relativePath);
        const current = fs.readFileSync(filename, 'utf8');
        const next = transform(current);
        if (next === current) {
            throw new Error(`${relativePath} did not change; its expected version marker may have moved.`);
        }
        pendingWrites.set(filename, next);
    };

    update('config/app.php', (contents) =>
        replacePatternOnce(
            replacePatternOnce(
                contents,
                /('version'\s*=>\s*')[^']+(')/,
                `$1${upstreamVersion}$2`,
                'Pterodactyl version'
            ),
            /('fork-version'\s*=>\s*')[^']+(')/,
            `$1${themeVersion}$2`,
            'Rockdactyl version'
        )
    );

    update('package.json', (contents) => {
        const packageManifest = JSON.parse(contents);
        packageManifest.version = themeVersion;
        packageManifest.description = `Rockdactyl, a polished and responsive UI mod for Pterodactyl Panel ${upstreamVersion}.`;
        return `${JSON.stringify(packageManifest, null, 4)}\n`;
    });

    if (themeChanged) {
        for (const manifestPath of websiteManifestFiles) {
            update(manifestPath, (contents) => {
                const websiteManifest = JSON.parse(contents);
                websiteManifest.version = themeVersion;
                if (manifestPath.endsWith('package-lock.json')) {
                    if (!websiteManifest.packages?.['']) {
                        throw new Error(`${manifestPath} is missing its root package metadata.`);
                    }
                    websiteManifest.packages[''].version = themeVersion;
                }
                return `${JSON.stringify(websiteManifest, null, 4)}\n`;
            });
        }
    }

    for (const file of synchronizedVersionFiles) {
        if ((!file.theme || !themeChanged) && (!file.upstream || !upstreamChanged)) continue;

        update(file.path, (contents) => {
            let next = contents;
            if (file.theme && themeChanged) {
                next = replaceVersionReferences(
                    next,
                    previousThemeVersion,
                    themeVersion,
                    `${file.path} Rockdactyl version`
                );
                if (file.path === '.github/docker/README.md') {
                    const previousMinor = previousThemeVersion.split('.').slice(0, 2).join('.');
                    const nextMinor = themeVersion.split('.').slice(0, 2).join('.');
                    next = replaceVersionReferences(
                        next,
                        `\`${previousMinor}\``,
                        `\`${nextMinor}\``,
                        `${file.path} minor tag`
                    );
                }
            }
            if (file.upstream && upstreamChanged) {
                next = replaceVersionReferences(
                    next,
                    previousUpstreamVersion,
                    upstreamVersion,
                    `${file.path} Pterodactyl version`
                );
            }
            return next;
        });
    }

    if (upstreamChanged) pendingWrites.set(upstreamVersionFile, `${upstreamTag}\n`);
    for (const [filename, contents] of pendingWrites) fs.writeFileSync(filename, contents);

    return { upstreamTag, themeTag };
};

const main = () => {
    const [, , upstreamTag, themeTag] = process.argv;
    try {
        if (upstreamTag === '--check') {
            const result = checkReleaseMetadata(path.resolve(__dirname, '..'));
            console.log(`Release metadata is consistent for ${result.themeTag} on ${result.upstreamTag}.`);
            return;
        }
        const result = updateUpstreamMetadata(path.resolve(__dirname, '..'), upstreamTag, themeTag);
        console.log(`Prepared Rockdactyl ${result.themeTag} for Pterodactyl ${result.upstreamTag}.`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
};

if (require.main === module) main();

module.exports = { checkReleaseMetadata, synchronizedVersionFiles, updateUpstreamMetadata };
