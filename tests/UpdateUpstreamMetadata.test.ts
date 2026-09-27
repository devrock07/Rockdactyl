import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

type VersionFile = { path: string; theme?: boolean; upstream?: boolean };

const projectRoot = path.resolve(__dirname, '..');
const synchronizedVersionFiles: VersionFile[] = [
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
const fixtureFiles = [
    '.rock/upstream-version',
    'config/app.php',
    'package.json',
    'scripts/update-upstream-metadata.js',
    'website/package.json',
    'website/package-lock.json',
    ...synchronizedVersionFiles.map((file) => file.path),
];

const read = (root: string, file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

const createFixture = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rock-theme-metadata-'));
    for (const file of new Set(fixtureFiles)) {
        const destination = path.join(root, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(projectRoot, file), destination);
    }
    return root;
};

const nextPatch = (version: string): string => {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
};

const runUpdater = (root: string, upstreamVersion: string, themeVersion: string) =>
    spawnSync(
        process.execPath,
        [path.join(root, 'scripts/update-upstream-metadata.js'), `v${upstreamVersion}`, `v${themeVersion}`],
        {
            cwd: root,
            encoding: 'utf8',
        }
    );

describe('update-upstream-metadata', () => {
    const fixtures: string[] = [];

    it('accepts a synchronized release metadata fixture', () => {
        const root = createFixture();
        fixtures.push(root);
        const result = spawnSync(
            process.execPath,
            [path.join(root, 'scripts/update-upstream-metadata.js'), '--check'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Release metadata is consistent');
    });

    it('rejects inconsistent structured release metadata', () => {
        const root = createFixture();
        fixtures.push(root);
        fs.writeFileSync(
            path.join(root, 'config/app.php'),
            read(root, 'config/app.php').replace(
                /('fork-version'\s*=>\s*')[^']+(')/,
                (_match, prefix, suffix) => `${prefix}0.0.1${suffix}`
            )
        );
        const result = spawnSync(
            process.execPath,
            [path.join(root, 'scripts/update-upstream-metadata.js'), '--check'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Release metadata is inconsistent');
    });

    it('rejects a stale container minor tag', () => {
        const root = createFixture();
        fixtures.push(root);
        const dockerReadme = read(root, '.github/docker/README.md');
        const minor = JSON.parse(read(root, 'package.json')).version.split('.').slice(0, 2).join('.');
        fs.writeFileSync(path.join(root, '.github/docker/README.md'), dockerReadme.replace(`| \`${minor}\``, '| `0.0`'));
        const result = spawnSync(
            process.execPath,
            [path.join(root, 'scripts/update-upstream-metadata.js'), '--check'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('minor image tag');
    });

    it('rejects a stale structured field even when the expected version appears elsewhere', () => {
        const root = createFixture();
        fixtures.push(root);
        const manifest = JSON.parse(read(root, 'package.json')) as { version: string };
        const readme = read(root, 'README.md').replace(
            `Rockdactyl \`v${manifest.version}\` is based on and supports`,
            `Rockdactyl \`v0.0.1\` is based on and supports`
        );
        fs.writeFileSync(path.join(root, 'README.md'), `${readme}\nExpected elsewhere: ${manifest.version}\n`);
        const result = spawnSync(
            process.execPath,
            [path.join(root, 'scripts/update-upstream-metadata.js'), '--check'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('README.md release heading');
    });

    afterEach(() => {
        while (fixtures.length) {
            const fixture = fixtures.pop();
            if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
        }
    });

    it('synchronizes every published compatibility reference', () => {
        const root = createFixture();
        fixtures.push(root);

        const previousTheme = JSON.parse(read(root, 'package.json')).version as string;
        const previousUpstreamTag = read(root, '.rock/upstream-version').trim();
        const previousUpstream = previousUpstreamTag.replace(/^v/, '');
        const themeVersion = nextPatch(previousTheme);
        const upstreamVersion = nextPatch(previousUpstream);
        const result = runUpdater(root, upstreamVersion, themeVersion);

        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
        expect(read(root, '.rock/upstream-version')).toBe(`v${upstreamVersion}\n`);
        expect(JSON.parse(read(root, 'package.json'))).toMatchObject({
            version: themeVersion,
            description: `Rockdactyl, a polished and responsive UI mod for Pterodactyl Panel ${upstreamVersion}.`,
        });
        expect(JSON.parse(read(root, 'website/package.json')).version).toBe(themeVersion);
        expect(JSON.parse(read(root, 'website/package-lock.json'))).toMatchObject({
            version: themeVersion,
            packages: { '': { version: themeVersion } },
        });
        expect(read(root, 'config/app.php')).toContain(`'version' => '${upstreamVersion}'`);
        expect(read(root, 'config/app.php')).toContain(`'fork-version' => '${themeVersion}'`);

        for (const file of synchronizedVersionFiles) {
            const contents = read(root, file.path);
            if (file.theme) {
                expect(contents).toContain(themeVersion);
                expect(contents).not.toContain(previousTheme);
            }
            if (file.upstream) {
                expect(contents).toContain(upstreamVersion);
                expect(contents).not.toContain(previousUpstream);
            }
        }

        const readme = read(root, 'README.md');
        expect(readme).toContain(`/pterodactyl/panel/releases/tag/v${upstreamVersion}`);
        expect(readme).toContain(`Rockdactyl \`v${themeVersion}\``);
        expect(readme).toContain(`| Rockdactyl | \`${themeVersion}\``);
    });

    it('does not partially write metadata when a tracked marker is missing', () => {
        const root = createFixture();
        fixtures.push(root);

        const previousTheme = JSON.parse(read(root, 'package.json')).version as string;
        const previousUpstream = read(root, '.rock/upstream-version').trim().replace(/^v/, '');
        const originalConfig = read(root, 'config/app.php');
        const originalPackage = read(root, 'package.json');
        const securityFile = path.join(root, 'SECURITY.md');

        fs.writeFileSync(
            securityFile,
            read(root, 'SECURITY.md').split(previousUpstream).join('version-marker-removed')
        );
        const result = runUpdater(root, nextPatch(previousUpstream), nextPatch(previousTheme));

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('SECURITY.md Pterodactyl version');
        expect(read(root, 'config/app.php')).toBe(originalConfig);
        expect(read(root, 'package.json')).toBe(originalPackage);
        expect(read(root, '.rock/upstream-version')).toBe(`v${previousUpstream}\n`);
    });

    it('supports a theme-only release without rewriting upstream-only files', () => {
        const root = createFixture();
        fixtures.push(root);

        const previousTheme = JSON.parse(read(root, 'package.json')).version as string;
        const upstreamVersion = read(root, '.rock/upstream-version').trim().replace(/^v/, '');
        const securityBefore = read(root, 'SECURITY.md');
        const featureTemplateBefore = read(root, '.github/ISSUE_TEMPLATE/2-feature-request.yml');
        const themeVersion = nextPatch(previousTheme);
        const result = runUpdater(root, upstreamVersion, themeVersion);

        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
        expect(JSON.parse(read(root, 'package.json')).version).toBe(themeVersion);
        expect(read(root, '.rock/upstream-version')).toBe(`v${upstreamVersion}\n`);
        expect(read(root, 'SECURITY.md')).toBe(securityBefore);
        expect(read(root, '.github/ISSUE_TEMPLATE/2-feature-request.yml')).toBe(featureTemplateBefore);
        expect(read(root, 'docker-compose.example.yml')).toContain(`rock-theme:${themeVersion}`);
    });

    it('rejects stale documentation-site package metadata', () => {
        const root = createFixture();
        fixtures.push(root);

        const websiteManifest = JSON.parse(read(root, 'website/package.json')) as { version: string };
        websiteManifest.version = '0.0.1';
        fs.writeFileSync(path.join(root, 'website/package.json'), `${JSON.stringify(websiteManifest, null, 4)}\n`);

        const result = spawnSync(
            process.execPath,
            [path.join(root, 'scripts/update-upstream-metadata.js'), '--check'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('website/package.json version');
    });
});
