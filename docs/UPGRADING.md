# Upgrading and recovery

Rockdactyl versions and Pterodactyl versions are related but independent. Check
both before every update.

| Installed component | Current supported release |
| ------------------- | ------------------------- |
| Rockdactyl          | `v3.0.0`                  |
| Pterodactyl base    | `v1.15.1`                 |

The supported Pterodactyl base is recorded in `.rock/upstream-version` and the
application version is recorded in `config/app.php`. Do not run the official
Pterodactyl self-updater directly over Rockdactyl: it can overwrite theme code
without applying the corresponding compatibility work.

## Update checklist

Before updating a production panel:

1. Read the [Rockdactyl release notes](https://github.com/devrock07/Rockdactyl/releases).
2. Confirm that the target release declares the same Pterodactyl base or a newer
   base in the same major release line.
3. Export the database and copy `.env` outside the panel directory.
4. Confirm recent panel and database backups can be read.
5. Check available disk space and schedule a maintenance window.
6. Record nonstandard ownership, service names, reverse-proxy settings, and
   local source modifications.
7. Test the release on a staging copy when the panel has local modifications.

The release archive is a full source overlay. Uncommitted edits made directly
inside a production panel are not merged and may be overwritten.

## Update with the manager

Download the current manager, inspect it, and run the update action:

```bash
curl -fsSL https://raw.githubusercontent.com/devrock07/Rockdactyl/main/install.sh \
  -o /tmp/rockdactyl-install.sh
sudo bash /tmp/rockdactyl-install.sh update
```

The update action creates a timestamped snapshot under
`/var/backups/rock-theme/` by default. Set `PANEL_DIR` and
`ROCK_BACKUP_ROOT` when your deployment uses different paths:

```bash
sudo env \
  PANEL_DIR=/srv/pterodactyl \
  ROCK_BACKUP_ROOT=/srv/backups/rock-theme \
  bash /tmp/rockdactyl-install.sh update
```

The manager always installs the latest non-draft GitHub release. Use the manual
process in [Installation](./INSTALLATION.md) when a change-control policy
requires a pinned tag.

## Verify an update

Run the server-side checks from the panel directory:

```bash
php artisan p:info
php artisan migrate:status
php artisan schedule:list
php artisan queue:restart
```

Then verify login, dashboard, admin settings, server console, file actions,
backups, databases, schedules, startup variables, notification read/clear, both
theme presets, `/status`, and at least one mobile viewport. Review
`storage/logs/laravel-*.log`, the browser console, and failed queue jobs for new
errors.

## Understand manager backups

The manager uses these file snapshots:

| Snapshot                            | Created when                                                                               | Used automatically by `restore` |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| `original-panel.tar.gz`             | First managed installation, unless a Rockdactyl marker or original snapshot already exists | Yes                             |
| `before-install-<timestamp>.tar.gz` | A later install when the original slot is already occupied                                 | No                              |
| `before-update-<timestamp>.tar.gz`  | Every managed update                                                                       | No                              |
| `before-restore-<timestamp>.tar.gz` | Immediately before restoring the original panel                                            | No                              |

The built-in restore action targets only `original-panel.tar.gz`. Timestamped
snapshots are safety archives for a deliberate manual recovery; the manager
does not present a snapshot picker.

Each archive has a neighboring `.sha256` record. The manager verifies the
checksum and safe archive member types before it trusts a snapshot for recovery.
All of these are panel-file archives, not database dumps. Copy each critical
archive together with its checksum off the panel host and apply your normal
retention policy.

## Restore the original panel

To return to the manager-created pre-theme panel files:

```bash
sudo bash /tmp/rockdactyl-install.sh restore
```

The restore action:

-   validates `original-panel.tar.gz`;
-   creates a fresh `before-restore` snapshot;
-   preserves the current `.env` and `storage` directory;
-   replaces the remaining panel files with the original snapshot;
-   reinstalls PHP dependencies, clears caches, restarts the queue, repairs
    permissions, and returns the panel online.

It intentionally preserves the current database. If a Rockdactyl migration or
later application change must also be reversed, use the matching independent
database backup and a reviewed recovery plan. Do not restore an old database
over a live panel without first protecting the current state.

## Recover from a failed update

If the manager exits before migrations begin, its cleanup handler restores code
from the pre-operation snapshot, preserves the live `.env` and `storage`, and
attempts to bring the panel online. It prints a manual snapshot path if
automatic restoration fails. A panel that was already in maintenance mode is
left there. Confirm the state explicitly:

```bash
cd /var/www/pterodactyl
php artisan up
php artisan optimize:clear
```

Next, inspect the failed stage output and `storage/logs/laravel-*.log`. The
manager deliberately skips automatic file rollback once migration work starts,
because old code and a newer schema can be less recoverable than the failed
deployment. It deliberately keeps the panel offline for operator review. Use
matching file and database backups for an exact point-in-time rollback, and
protect the current database before restoring an older copy.

For a timestamped snapshot, do not extract it blindly over the current tree.
Extra files from the failed version can remain and create an invalid mixed
installation. Restore it in a maintenance window using the same preservation,
dependency, cache, ownership, and database decisions as a full panel recovery.

## Release artifacts

A version tag creates a draft only after the frontend, full backend database
matrix, and `linux/amd64` plus `linux/arm64` container build all pass. The draft
contains:

-   `panel.tar.gz` — source plus compiled production frontend assets;
-   `panel.tar.gz.sha256` — SHA-256 verification file; and
-   generated GitHub release notes.

The archive also contains `.rock/release.json`, binding its Rockdactyl version,
Pterodactyl base, and source commit to the checksum-protected payload. Release
automation downloads and validates these fields before treating an existing
release as healthy. Archive entries use stable ordering, normalized ownership
and modes, the source commit timestamp, and timestamp-free gzip output. Local
and hosted release gates compare two clean frontend builds, then use the same
packager to prepare two independent staging trees and stop if either comparison
differs. GitHub's job summary records the source commit, size, and SHA-256 digest
for release diagnosis.

Publishing the reviewed draft makes those artifacts public and starts the
versioned/`latest` multi-architecture container build.

Verify a pinned release before extraction:

```bash
release=v3.0.0
curl -fL -O "https://github.com/devrock07/Rockdactyl/releases/download/$release/panel.tar.gz"
curl -fL -O "https://github.com/devrock07/Rockdactyl/releases/download/$release/panel.tar.gz.sha256"
sha256sum --check panel.tar.gz.sha256
tar -tzf panel.tar.gz >/dev/null
```

Never use `curl ... | tar` for deployment. An HTTP error page can otherwise be
passed to `tar`, obscuring the actual download failure.

## Automatic Pterodactyl compatibility updates

The **Upstream Autopilot** workflow checks the latest official Pterodactyl
release daily and can also be run manually with a specific stable tag. When an
update exists, it:

1. performs a three-tree merge using the old official release as the base, the
   Rockdactyl tree as the customized side, and the new official release as the
   upstream side;
2. updates version metadata and exports an isolated, read-only candidate bundle;
3. runs TypeScript, ESLint, Jest, and two matching production Webpack builds;
4. runs PHP formatting, unit, and integration checks on PHP 8.2/8.3 across
   MariaDB 10/11 and MySQL 8/9;
5. builds the candidate container for both `linux/amd64` and `linux/arm64`;
6. fast-forwards `main` only after every validation job succeeds;
7. creates the next patch release with a compiled archive and checksum; and
8. dispatches and awaits the versioned/`latest` and `edge` container publishes;
   and
9. verifies commit-specific GHCR source markers before reporting success.

A failed merge or validation leaves `main` and the latest release unchanged and
opens one actionable GitHub issue. After promotion starts, the exact validated
commit remains on `automation/upstream-candidate` until its tag, release assets,
and container channels are verified. Retries use that preserved commit even if
`main` later advances without changing the Rockdactyl version, and a newer
upstream release waits for the incomplete publication to finish. If `main` moves
to another Rockdactyl version or a newer release appears, the older pending
candidate is blocked rather than allowed to move GitHub or container `latest`
aliases backwards. Healthy runs use the immutable version tag as their release
source and `main` as their `edge` source, so ordinary post-release commits do not
invalidate publication checks. Upstream tag commits are SHA-pinned during
detection, and the retry marker is removed only with an exact-SHA lease. The
workflow rejects version downgrades and never force-pushes `main` or an existing
release tag.

Autopilot owns the release attached to its bot-pushed tag. The normal Release
workflow ignores `github-actions[bot]` tag events, preventing a competing draft,
while human-pushed version tags retain the standard reviewed-draft process.
Autopilot-created drafts contain an exact source-commit marker and must also be
authored by `github-actions[bot]`; drafts without both proofs are left untouched
for human review.

Automatic compatibility is a release-engineering safety net, not a substitute
for staging. Review each generated release before production deployment. The
implementation and required repository permissions are documented in
[Upstream Autopilot](./development/UPSTREAM_AUTOMATION.md).
