# Installation

Rockdactyl `v3.0.0` is a complete Pterodactyl Panel distribution based on
Pterodactyl `v1.15.1`. Install it over a working panel on that base, or use the
manager for a verified forward upgrade from an older `1.x` base. It is not a
plugin that can be added to an arbitrary Pterodactyl release.

## Before you begin

Confirm all of the following:

-   The existing panel is a working Pterodactyl `1.x` release no newer than
    `1.15.1`; same-base installation is the lowest-risk path.
-   You have root or `sudo` access to the panel host.
-   `curl`, `tar`, `sha256sum`, PHP, and Composer are installed.
-   The host is using PHP `8.2` or `8.3` with the normal Pterodactyl extensions.
-   The Pterodactyl queue worker and one-minute scheduler are already configured.
-   You have enough free space for at least one complete panel-file snapshot.
-   You have a recent, tested database backup and a separate copy of `.env`.
-   Any custom backup and lock directories are real, root-owned directories that
    are not writable by group or other users.

The installer backs up panel files. It does **not** export the panel database or
validate your external backup system.

## Recommended: installation manager

Download the manager so it can be reviewed before execution:

```bash
curl -fsSL https://raw.githubusercontent.com/devrock07/Rockdactyl/main/install.sh \
  -o /tmp/rockdactyl-install.sh
less /tmp/rockdactyl-install.sh
sudo bash /tmp/rockdactyl-install.sh install
```

Omit `install` to use the interactive menu:

```bash
sudo bash /tmp/rockdactyl-install.sh
```

### Manager operations

| Operation | Command                                        | Behavior                                                                                             |
| --------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Install   | `sudo bash /tmp/rockdactyl-install.sh install` | Saves the first manager-created original snapshot, then installs the latest verified release         |
| Update    | `sudo bash /tmp/rockdactyl-install.sh update`  | Creates a timestamped pre-update file snapshot, then installs the latest verified release            |
| Restore   | `sudo bash /tmp/rockdactyl-install.sh restore` | Restores the original pre-theme snapshot while preserving the current `.env` and `storage` directory |

`restore` also preserves database changes. It does not reverse Rockdactyl
migrations. Keep the independent database backup created before installation
if a full point-in-time rollback may be required.

### What the manager verifies

Before maintenance mode begins, the manager:

1. validates the requested panel path;
2. checks required commands and detects `www-data`, `nginx`, or `apache` as the
   web-server account;
3. resolves the latest GitHub release;
4. downloads `panel.tar.gz` and `panel.tar.gz.sha256`;
5. verifies the SHA-256 checksum and binds release provenance to the Git tag;
6. cross-checks the archived Pterodactyl base metadata; and
7. rejects traversal, duplicate members, links, special files, `.env`, and
   `storage/**` entries.

It then creates and verifies a checksummed snapshot, extracts the release into a
private staging directory, enables maintenance mode, removes stale application
files, deploys the staged tree, runs Composer and database migrations, clears
optimized caches, restarts the queue, repairs ownership and writable-directory
permissions, and brings the panel online. If staging, dependency installation,
or a signal interrupts the operation before migrations begin, an exit guard
restores code from the pre-operation snapshot while preserving the current
`.env` and `storage`, then runs `php artisan up` when the panel was not already
in maintenance mode.

Once database migration work begins, automatic file rollback is disabled. This
avoids pairing older source with a partially or fully migrated schema. The
manager leaves the snapshot in place and reports it for deliberate recovery.
The panel remains in maintenance mode instead of exposing a potentially
half-migrated deployment. Use the independent database backup with the matching
file snapshot when an exact point-in-time rollback is required.

### Source installations reporting `canary`

Pterodactyl Git checkouts and source archives can report `canary` even at a
stable release tag. The manager resolves their base from a numeric
`.rock/upstream-version` marker, or from a single exact numeric Git tag at HEAD
when `config/app.php` is unchanged. Development commits and ambiguous tags are
not automatically treated as a stable release.

For a source archive without either marker, pass the version you actually
installed. For example, **only if the panel came from Pterodactyl v1.15.1**:

```bash
sudo env ROCK_PANEL_VERSION=1.15.1 bash /tmp/rockdactyl-install.sh install
```

This declaration does not bypass downgrade, major-version, or metadata-conflict
checks. If you cannot identify the source version, use the official stable
`panel.tar.gz` release instead of guessing a version or editing `config/app.php`.

### Custom paths and output

The defaults are:

```text
PANEL_DIR=/var/www/pterodactyl
ROCK_BACKUP_ROOT=/var/backups/rock-theme
```

Pass alternatives as environment variables:

```bash
sudo env \
  PANEL_DIR=/srv/pterodactyl \
  ROCK_BACKUP_ROOT=/srv/backups/rock-theme \
  bash /tmp/rockdactyl-install.sh install
```

Both paths are resolved before any destructive step. The panel path must contain
`artisan`, cannot resolve to a broad system directory, and the backup root must
not be located inside the panel tree.

For automation or detailed diagnosis:

```bash
sudo bash /tmp/rockdactyl-install.sh update --no-animation
sudo bash /tmp/rockdactyl-install.sh update --verbose
sudo env NO_COLOR=1 bash /tmp/rockdactyl-install.sh update
```

`--verbose` streams command output. Without it, a failed stage prints the last
80 lines captured for that stage.

## Manual installation

Use this method when the manager cannot detect the correct web-server user or
when the deployment is controlled by an existing release process.

The examples assume:

```text
Panel path: /var/www/pterodactyl
Web user:   www-data
Database:   panel
DB user:    pterodactyl
```

Replace those values for your installation.

### 1. Back up the current installation

Run from a root shell so the backup destinations are writable:

```bash
tar -C /var/www/pterodactyl \
  -czf /root/pterodactyl-files-before-rock-theme.tar.gz .
cp /var/www/pterodactyl/.env /root/pterodactyl-env-before-rock-theme
mariadb-dump -u pterodactyl -p panel \
  > /root/pterodactyl-db-before-rock-theme.sql
```

Use `mysqldump` instead of `mariadb-dump` when appropriate. Store the resulting
files outside the panel directory and test that both archives can be read.

### 2. Download and verify the release

Do not pipe an unverified HTTP response directly into `tar`.

```bash
rock_download_dir="$(mktemp -d)"
cd "$rock_download_dir"

curl -fL -O \
  https://github.com/devrock07/Rockdactyl/releases/latest/download/panel.tar.gz
curl -fL -O \
  https://github.com/devrock07/Rockdactyl/releases/latest/download/panel.tar.gz.sha256

sha256sum --check panel.tar.gz.sha256
tar -tzf panel.tar.gz > archive-list.txt

if grep -Eq '(^/|(^|/)\.\.(/|$))' archive-list.txt; then
  echo 'Unsafe path found in archive.' >&2
  exit 1
fi

grep -Fxq './artisan' archive-list.txt
grep -Fxq './composer.json' archive-list.txt
```

Continue only when the checksum reports `panel.tar.gz: OK`, both required
files are found, and the path check succeeds.

### 3. Deploy the archive

```bash
(
set -euo pipefail
cd /var/www/pterodactyl

php artisan down
trap 'php artisan up' EXIT
tar -xzf "$rock_download_dir/panel.tar.gz" -C /var/www/pterodactyl
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --seed --force
php artisan optimize:clear
php artisan queue:restart

chown -R www-data:www-data /var/www/pterodactyl
find storage bootstrap/cache -type d -exec chmod 755 {} +
find storage bootstrap/cache -type f -exec chmod 644 {} +

php artisan up
trap - EXIT
)
```

The guarded subshell returns the panel online if a deployment command fails.
Fix the reported error before retrying, and verify `php artisan up` succeeded
before ending the maintenance window.

## Post-install verification

From the panel directory:

```bash
php artisan p:info
php artisan migrate:status
php artisan schedule:list
```

Then verify the following in a private browser window and a normal signed-in
session:

-   the login page loads without missing assets;
-   the client dashboard works at desktop and mobile widths;
-   **Admin → Settings** saves and reloads Rockdactyl values;
-   a server's console, files, backups, databases, schedules, and startup pages
    still perform their normal actions;
-   the worker is processing jobs;
-   `/status` returns the configured public status page when enabled; and
-   the browser console and `storage/logs/laravel-*.log` contain no new errors.

Finish by opening the [configuration guide](./CONFIGURATION.md). For deployment
problems, use the [troubleshooting guide](./TROUBLESHOOTING.md).
