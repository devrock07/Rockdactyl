#!/usr/bin/env bash

set -Eeuo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="$(mktemp -d "${TMPDIR:-/tmp}/rock-theme-installer-test.XXXXXX")"
real_tar="$(command -v tar)"
real_stat="$(command -v stat)"

cleanup_test() {
    local status=$?
    trap - EXIT
    if [ "$status" -ne 0 ]; then
        printf '\nInstaller integration tests failed. Captured output:\n' >&2
        for log in "$workspace"/*.log; do
            [ -f "$log" ] || continue
            printf '\n--- %s ---\n' "$(basename "$log")" >&2
            tail -n 120 "$log" >&2
        done
    fi
    rm -rf -- "$workspace"
    exit "$status"
}

trap cleanup_test EXIT

fixture="$workspace/fixture"
release_fixture="$workspace/release-files"
mock_bin="$workspace/bin"
release_mock_bin="$workspace/release-bin"

mkdir -p \
    "$fixture" \
    "$release_fixture/bootstrap/cache" \
    "$release_fixture/config" \
    "$release_fixture/.rock" \
    "$mock_bin" \
    "$release_mock_bin"

printf '#!/usr/bin/env php\n' >"$release_fixture/artisan"
printf 'updated\n' >"$release_fixture/rock-theme-installed"
printf '{"schema":1,"theme_version":"9.9.9","pterodactyl_version":"v1.15.1","source_commit":"0000000000000000000000000000000000000000"}\n' >"$release_fixture/.rock/release.json"
printf 'v1.15.1\n' >"$release_fixture/.rock/upstream-version"
printf "<?php return ['version' => '1.15.1'];\n" >"$release_fixture/config/app.php"

"$real_tar" -C "$release_fixture" -czf "$fixture/panel.tar.gz" .
(
    cd "$fixture"
    checksum="$(sha256sum panel.tar.gz)"
    printf '%s  panel.tar.gz\n' "${checksum%% *}" >panel.tar.gz.sha256
)

protected_release="$workspace/protected-release-files"
cp -a "$release_fixture" "$protected_release"
printf 'APP_KEY=must-not-ship\n' >"$protected_release/.env"
"$real_tar" -C "$protected_release" -czf "$fixture/panel-protected.tar.gz" .

hardlink_release="$workspace/hardlink-release-files"
cp -a "$release_fixture" "$hardlink_release"
ln "$hardlink_release/artisan" "$hardlink_release/artisan-hardlink"
"$real_tar" -C "$hardlink_release" -czf "$fixture/panel-hardlink.tar.gz" .

"$real_tar" -C "$release_fixture" --transform='s|^\./|../|' -czf "$fixture/panel-traversal.tar.gz" .
printf 'this is not a gzip archive\n' >"$fixture/corrupt-panel.tar.gz"
(
    cd "$fixture"
    checksum="$(sha256sum corrupt-panel.tar.gz)"
    printf '%s  corrupt-panel.tar.gz\n' "${checksum%% *}" >corrupt-panel.tar.gz.sha256
)

cat >"$mock_bin/id" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = '-u' ]; then
    printf '0\n'
fi
exit 0
EOF

cat >"$mock_bin/stat" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = '-c' ] && [ "${2:-}" = '%u' ]; then
    target="${!#}"
    if [ -n "${MOCK_UNTRUSTED_PATH:-}" ] && [ "$target" = "$MOCK_UNTRUSTED_PATH" ]; then
        printf '1000\n'
        exit 0
    fi
    printf '0\n'
    exit 0
fi
exec "$REAL_STAT" "$@"
EOF

cat >"$mock_bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
output=''
url=''
while [ "$#" -gt 0 ]; do
    case "$1" in
        --output)
            output="$2"
            shift 2
            ;;
        --*) shift ;;
        *)
            url="$1"
            shift
            ;;
    esac
done

if [ "${MOCK_DOWNLOAD_FAIL:-0}" = '1' ] && [[ "$url" == */panel.tar.gz* ]]; then
    printf 'simulated download failure\n' >&2
    exit 22
fi

case "$url" in
    */releases/latest)
        printf '{"tag_name":"v9.9.9"}\n'
        ;;
    */commits/v9.9.9)
        printf '{"sha":"%s"}\n' "${MOCK_TAG_SOURCE:-0000000000000000000000000000000000000000}"
        ;;
    */panel.tar.gz.sha256)
        case "${MOCK_CHECKSUM_MODE:-valid}" in
            mismatch)
                printf '0000000000000000000000000000000000000000000000000000000000000000  panel.tar.gz\n' >"$output"
                ;;
            other-filename)
                sed 's/panel\.tar\.gz$/other.tar.gz/' "$INSTALLER_FIXTURE_DIR/panel.tar.gz.sha256" >"$output"
                ;;
            extra-entry)
                cp "$INSTALLER_FIXTURE_DIR/panel.tar.gz.sha256" "$output"
                printf '0000000000000000000000000000000000000000000000000000000000000000  other.tar.gz\n' >>"$output"
                ;;
            valid)
                if [ "${MOCK_CORRUPT_ARCHIVE:-0}" = '1' ]; then
                    sed 's/corrupt-panel/panel/' "$INSTALLER_FIXTURE_DIR/corrupt-panel.tar.gz.sha256" >"$output"
                else
                    archive_name='panel.tar.gz'
                    case "${MOCK_ARCHIVE_MODE:-valid}" in
                        protected) archive_name='panel-protected.tar.gz' ;;
                        hardlink) archive_name='panel-hardlink.tar.gz' ;;
                        traversal) archive_name='panel-traversal.tar.gz' ;;
                    esac
                    checksum="$(sha256sum "$INSTALLER_FIXTURE_DIR/$archive_name")"
                    printf '%s  panel.tar.gz\n' "${checksum%% *}" >"$output"
                fi
                ;;
            *)
                printf 'Unexpected checksum fixture mode: %s\n' "$MOCK_CHECKSUM_MODE" >&2
                exit 2
                ;;
        esac
        ;;
    */panel.tar.gz)
        if [ "${MOCK_CORRUPT_ARCHIVE:-0}" = '1' ]; then
            cp "$INSTALLER_FIXTURE_DIR/corrupt-panel.tar.gz" "$output"
        else
            case "${MOCK_ARCHIVE_MODE:-valid}" in
                protected) cp "$INSTALLER_FIXTURE_DIR/panel-protected.tar.gz" "$output" ;;
                hardlink) cp "$INSTALLER_FIXTURE_DIR/panel-hardlink.tar.gz" "$output" ;;
                traversal) cp "$INSTALLER_FIXTURE_DIR/panel-traversal.tar.gz" "$output" ;;
                valid) cp "$INSTALLER_FIXTURE_DIR/panel.tar.gz" "$output" ;;
            esac
        fi
        ;;
    *)
        printf 'Unexpected curl URL: %s\n' "$url" >&2
        exit 2
        ;;
esac
EOF

cat >"$mock_bin/php" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = '-r' ]; then
    script="${2:-}"
    if [[ "$script" == *tag_name* ]]; then
        cat >/dev/null
        printf 'v9.9.9'
        exit 0
    fi
    if [[ "$script" == *strtolower* ]] && [[ "$script" == *panel*tar*gz* ]]; then
        checksum_contents="$(<"${3:-/dev/null}")"
        if [[ "$checksum_contents" =~ ^([0-9A-Fa-f]{64})\ \ panel\.tar\.gz$ ]]; then
            printf '%s' "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]'
            exit 0
        fi
        exit 1
    fi
    if [[ "$script" == *file_put_contents* ]] && [[ "$script" == *pterodactyl_version* ]]; then
        cat >/dev/null
        printf 'v1.15.1\n' >"${4:?missing release-base path}"
        printf '0000000000000000000000000000000000000000\n' >"${5:?missing release-source path}"
        exit 0
    fi
    if [[ "$script" == *'data["sha"]'* ]]; then
        payload="$(cat)"
        if [[ "$payload" =~ \"sha\":\"([0-9a-f]{40})\" ]]; then
            printf '%s' "${BASH_REMATCH[1]}"
            exit 0
        fi
        exit 1
    fi
    if [[ "$script" == *stream_get_contents* ]] && [[ "$script" == *ltrim* ]]; then
        cat >/dev/null
        printf 'v1.15.1'
        exit 0
    fi
    if [[ "$script" == *version_compare* ]]; then
        IFS=. read -r installed_major installed_minor installed_patch <<<"${3#v}"
        IFS=. read -r release_major release_minor release_patch <<<"${4#v}"
        if [ "$installed_major" -lt "$release_major" ] ||
            { [ "$installed_major" -eq "$release_major" ] && [ "$installed_minor" -lt "$release_minor" ]; } ||
            { [ "$installed_major" -eq "$release_major" ] && [ "$installed_minor" -eq "$release_minor" ] && [ "$installed_patch" -le "$release_patch" ]; }; then
            exit 0
        fi
        exit 1
    fi
    if [[ "$script" == *file_get_contents* ]] && [ -f "${3:-}" ]; then
        if grep -Eq "'version' => 'v?canary'" "$3"; then
            printf 'canary'
            exit 0
        fi
        grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' "$3" | head -n 1
        exit 0
    fi
    exit 1
fi

case "${2:-}" in
    down)
        mkdir -p "$PANEL_DIR/storage/framework"
        touch "$PANEL_DIR/storage/framework/down"
        if [ "${MOCK_DOWN_FAIL:-0}" = '1' ]; then
            printf 'simulated maintenance failure\n' >&2
            exit 25
        fi
        ;;
    up)
        if [ "${MOCK_UP_FAIL:-0}" = '1' ]; then
            printf 'simulated maintenance exit failure\n' >&2
            exit 27
        fi
        rm -f "$PANEL_DIR/storage/framework/down"
        ;;
    migrate)
        if [ "${MOCK_MIGRATION_FAIL:-0}" = '1' ]; then
            printf 'simulated migration failure\n' >&2
            exit 26
        fi
        ;;
esac
EOF

cat >"$mock_bin/composer" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${MOCK_COMPOSER_WAIT:-0}" = '1' ]; then
    : >"$MOCK_COMPOSER_READY"
    sleep 5
    printf 'orphaned-child-write\n' >"$PANEL_DIR/storage/orphaned-child-write"
fi
if [ "${MOCK_TAMPER_BACKUP:-0}" = '1' ]; then
    snapshot="$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -name 'before-*.tar.gz' -print -quit)"
    [ -z "$snapshot" ] || printf 'tampered\n' >>"$snapshot"
fi
if [ "${MOCK_COMPOSER_FAIL:-0}" = '1' ]; then
    printf 'simulated composer failure\n' >&2
    exit 23
fi
printf 'mock dependencies installed\n'
EOF

cat >"$mock_bin/tar" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [ "${MOCK_BACKUP_FAIL:-0}" = '1' ] && [ "${1:-}" = '-C' ] && [ "${2:-}" = "$PANEL_DIR" ] && [ "${3:-}" = '-czf' ]; then
    printf 'simulated backup failure\n' >&2
    exit 73
fi

archive=''
destination=''
previous=''
for argument in "$@"; do
    case "$argument" in
        --file=*) archive="${argument#--file=}" ;;
        --directory=*) destination="${argument#--directory=}" ;;
        panel.tar.gz|*/panel.tar.gz) archive="$argument" ;;
        *)
            if [ "$previous" = '-C' ] || [ "$previous" = '--directory' ]; then
                destination="$argument"
            fi
            ;;
    esac
    previous="$argument"
done

if [[ "$archive" == */panel.tar.gz ]] && [ -n "$destination" ]; then
    if [ "${MOCK_EXTRACT_FAIL:-0}" = '1' ]; then
        printf 'partial\n' >"$destination/partial-extraction"
        printf 'simulated extraction failure\n' >&2
        exit 74
    fi
    if [ "${MOCK_EXTRACT_WAIT:-0}" = '1' ]; then
        printf 'partial\n' >"$destination/partial-extraction"
        : >"$MOCK_EXTRACT_READY"
        sleep 1
        printf 'orphaned-child-write\n' >"$PANEL_DIR/storage/orphaned-child-write"
    fi
fi

exec "$REAL_TAR" "$@"
EOF

cat >"$mock_bin/chown" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat >"$release_mock_bin/yarn" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${MOCK_YARN_FAIL:-0}" = '1' ]; then
    printf 'simulated frontend build failure\n' >&2
    exit 91
fi
if [ "${1:-}" = 'build:production' ]; then
    mkdir -p public/assets
    if [ "${MOCK_YARN_NONDETERMINISTIC:-0}" = '1' ]; then
        count=0
        [ ! -f "$MOCK_YARN_COUNTER" ] || count="$(<"$MOCK_YARN_COUNTER")"
        count=$((count + 1))
        printf '%s\n' "$count" >"$MOCK_YARN_COUNTER"
        printf 'compiled-%s\n' "$count" >public/assets/app.js
    else
        printf 'compiled\n' >public/assets/app.js
    fi
    integrity="$(node -e 'const fs=require("fs"),crypto=require("crypto"); process.stdout.write("sha384-"+crypto.createHash("sha384").update(fs.readFileSync(process.argv[1])).digest("base64"));' public/assets/app.js)"
    printf '{"main.js":{"src":"/assets/app.js","integrity":"%s"}}\n' "$integrity" >public/assets/manifest.json
fi
exit 0
EOF

chmod +x "$mock_bin/id" "$mock_bin/stat" "$mock_bin/curl" "$mock_bin/php" "$mock_bin/composer" "$mock_bin/tar" "$mock_bin/chown" "$release_mock_bin/yarn"

export INSTALLER_FIXTURE_DIR="$fixture"
export REAL_TAR="$real_tar"
export REAL_STAT="$real_stat"
export PATH="$mock_bin:$PATH"
export ROCK_NO_ANIMATION=1
export NO_COLOR=1
export ROCK_LOCK_ROOT="$workspace/manager locks"

clear_mocks() {
    unset ROCK_PANEL_VERSION
    export MOCK_DOWNLOAD_FAIL=0
    export MOCK_CORRUPT_ARCHIVE=0
    export MOCK_ARCHIVE_MODE=valid
    export MOCK_CHECKSUM_MODE=valid
    export MOCK_BACKUP_FAIL=0
    export MOCK_DOWN_FAIL=0
    export MOCK_EXTRACT_FAIL=0
    export MOCK_EXTRACT_WAIT=0
    export MOCK_LIVE_DATA_DURING_EXTRACT=0
    export MOCK_COMPOSER_FAIL=0
    export MOCK_COMPOSER_WAIT=0
    export MOCK_COMPOSER_READY="$workspace/composer-ready"
    export MOCK_MIGRATION_FAIL=0
    export MOCK_TAMPER_BACKUP=0
    export MOCK_UP_FAIL=0
    export MOCK_UNTRUSTED_PATH=''
    export MOCK_TAG_SOURCE=0000000000000000000000000000000000000000
    export ROCK_LOCK_FORCE_MKDIR=0
    export MOCK_EXTRACT_READY="$workspace/extract-ready"
    rm -f -- "$MOCK_EXTRACT_READY" "$MOCK_COMPOSER_READY"
}

reset_panel() {
    PANEL_DIR="$1"
    ROCK_BACKUP_ROOT="$2"
    export PANEL_DIR ROCK_BACKUP_ROOT

    rm -rf -- "$PANEL_DIR" "$ROCK_BACKUP_ROOT"
    mkdir -p "$PANEL_DIR/storage/framework" "$PANEL_DIR/bootstrap/cache"
    printf 'APP_KEY=current\n' >"$PANEL_DIR/.env"
    printf '#!/usr/bin/env php\n' >"$PANEL_DIR/artisan"
    printf 'original\n' >"$PANEL_DIR/original-marker"
    printf 'remove-on-update\n' >"$PANEL_DIR/stale-panel-file"
    printf 'persistent\n' >"$PANEL_DIR/storage/persistent-data"
    mkdir -p "$PANEL_DIR/config"
    printf "<?php return ['version' => '1.15.1'];\n" >"$PANEL_DIR/config/app.php"
}

run_installer() {
    local output="$1"
    local action="$2"
    shift 2
    bash "$root/install.sh" "$action" "$@" >"$output" 2>&1
}

expect_failure() {
    local output="$1"
    local action="$2"
    shift 2
    local status=0

    set +e
    run_installer "$output" "$action" "$@"
    status=$?
    set -e
    [ "$status" -ne 0 ]
}

assert_panel_online_and_original() {
    [ ! -f "$PANEL_DIR/storage/framework/down" ]
    [ -f "$PANEL_DIR/original-marker" ]
    [ ! -f "$PANEL_DIR/rock-theme-installed" ]
    [ ! -f "$PANEL_DIR/partial-extraction" ]
    grep -q '^APP_KEY=current$' "$PANEL_DIR/.env"
    grep -q '^persistent$' "$PANEL_DIR/storage/persistent-data"
}

# Syntax, help, and the interactive-free happy path on paths containing spaces.
clear_mocks
bash -n "$root/install.sh" "$root/release.sh" "$root/scripts/package-release.sh" "$root/scripts/verify-release-assets.sh" "$root/tests/InstallerSmokeTest.sh"
bash "$root/install.sh" --help | grep -q 'Rockdactyl installer'
reset_panel "$workspace/unsafe-lock-panel" "$workspace/unsafe-lock-backups"
set +e
ROCK_LOCK_ROOT=/ bash "$root/install.sh" update >"$workspace/unsafe-lock-root.log" 2>&1
unsafe_lock_status=$?
set -e
[ "$unsafe_lock_status" -ne 0 ]
grep -q 'Unsafe ROCK_LOCK_ROOT' "$workspace/unsafe-lock-root.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/untrusted-lock-panel" "$workspace/untrusted-lock-backups"
export MOCK_UNTRUSTED_PATH="$ROCK_LOCK_ROOT"
expect_failure "$workspace/untrusted-lock-root.log" update
grep -q 'ROCK_LOCK_ROOT must be owned by root' "$workspace/untrusted-lock-root.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/untrusted-backup-panel" "$workspace/untrusted-backup-root"
export MOCK_UNTRUSTED_PATH="$ROCK_BACKUP_ROOT"
expect_failure "$workspace/untrusted-backup-root.log" update
grep -q 'ROCK_BACKUP_ROOT must be owned by root' "$workspace/untrusted-backup-root.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/custom panel/root" "$workspace/custom backup root"
run_installer "$workspace/update-success.log" update
grep -q 'DEPLOYMENT COMPLETE' "$workspace/update-success.log"
grep -q '\[19/19\]' "$workspace/update-success.log"
[ -f "$PANEL_DIR/rock-theme-installed" ]
[ ! -f "$PANEL_DIR/stale-panel-file" ]
[ ! -f "$PANEL_DIR/storage/framework/down" ]
update_backup="$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -name 'before-update-*.tar.gz' -print -quit)"
[ -n "$update_backup" ]
"$real_tar" -tzf "$update_backup" | grep -Eq '^\./original-marker$'
[ -f "$update_backup.sha256" ]

# Compatibility is resolved from an existing theme marker first, then the official panel config.
clear_mocks
reset_panel "$workspace/mismatch-panel" "$workspace/mismatch-backups"
printf "<?php return ['version' => '1.16.0'];\n" >"$PANEL_DIR/config/app.php"
expect_failure "$workspace/base-mismatch.log" update
grep -q 'Pterodactyl base downgrade or major-version jump refused: panel is v1.16.0, release is v1.15.1' "$workspace/base-mismatch.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

clear_mocks
reset_panel "$workspace/base-upgrade-panel" "$workspace/base-upgrade-backups"
printf "<?php return ['version' => '1.14.1'];\n" >"$PANEL_DIR/config/app.php"
run_installer "$workspace/base-upgrade-success.log" update
grep -q 'Pterodactyl base upgrade verified: v1.14.1 -> v1.15.1' "$workspace/base-upgrade-success.log"

clear_mocks
reset_panel "$workspace/marker-conflict-panel" "$workspace/marker-conflict-backups"
printf "<?php return ['version' => '1.14.1'];\n" >"$PANEL_DIR/config/app.php"
mkdir -p "$PANEL_DIR/.rock"
printf 'v1.15.1\n' >"$PANEL_DIR/.rock/upstream-version"
expect_failure "$workspace/base-marker-conflict.log" update
grep -q 'Installed Pterodactyl metadata conflicts' "$workspace/base-marker-conflict.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

clear_mocks
reset_panel "$workspace/marker-panel" "$workspace/marker-backups"
mkdir -p "$PANEL_DIR/.rock"
printf 'v1.15.1\n' >"$PANEL_DIR/.rock/upstream-version"
run_installer "$workspace/base-marker-success.log" update
grep -q 'DEPLOYMENT COMPLETE' "$workspace/base-marker-success.log"

# Source archives and Git tags report canary rather than a stamped release.
clear_mocks
reset_panel "$workspace/canary-marker-panel" "$workspace/canary-marker-backups"
printf "<?php return ['version' => 'canary'];\n" >"$PANEL_DIR/config/app.php"
mkdir -p "$PANEL_DIR/.rock"
printf 'v1.15.1\n' >"$PANEL_DIR/.rock/upstream-version"
run_installer "$workspace/canary-marker.log" install
grep -q 'DEPLOYMENT COMPLETE' "$workspace/canary-marker.log"

clear_mocks
reset_panel "$workspace/canary-marker-newer-panel" "$workspace/canary-marker-newer-backups"
printf "<?php return ['version' => 'canary'];\n" >"$PANEL_DIR/config/app.php"
mkdir -p "$PANEL_DIR/.rock"
printf 'v1.16.0\n' >"$PANEL_DIR/.rock/upstream-version"
expect_failure "$workspace/canary-marker-downgrade.log" install
grep -q 'base downgrade or major-version jump refused' "$workspace/canary-marker-downgrade.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/canary-unknown-panel" "$workspace/canary-unknown-backups"
printf "<?php return ['version' => 'canary'];\n" >"$PANEL_DIR/config/app.php"
expect_failure "$workspace/canary-unknown.log" install
grep -q 'set ROCK_PANEL_VERSION to the verified base version' "$workspace/canary-unknown.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

export ROCK_PANEL_VERSION=1.15.1
printf "<?php return ['version' => 'vcanary'];\n" >"$PANEL_DIR/config/app.php"
run_installer "$workspace/canary-declared.log" install
grep -q 'Using operator-declared Pterodactyl base: v1.15.1' "$workspace/canary-declared.log"
grep -q 'DEPLOYMENT COMPLETE' "$workspace/canary-declared.log"

clear_mocks
reset_panel "$workspace/canary-newer-panel" "$workspace/canary-newer-backups"
printf "<?php return ['version' => 'canary'];\n" >"$PANEL_DIR/config/app.php"
export ROCK_PANEL_VERSION=v1.16.0
expect_failure "$workspace/canary-downgrade.log" install
grep -q 'base downgrade or major-version jump refused' "$workspace/canary-downgrade.log"
assert_panel_online_and_original
export ROCK_PANEL_VERSION=v2.0.0
expect_failure "$workspace/canary-major.log" install
grep -q 'base downgrade or major-version jump refused' "$workspace/canary-major.log"
export ROCK_PANEL_VERSION=canary
expect_failure "$workspace/canary-invalid.log" install
grep -q 'Invalid ROCK_PANEL_VERSION' "$workspace/canary-invalid.log"

clear_mocks
reset_panel "$workspace/declared-conflict-panel" "$workspace/declared-conflict-backups"
export ROCK_PANEL_VERSION=v1.14.1
expect_failure "$workspace/declared-conflict.log" install
grep -q 'Declared Pterodactyl version conflicts' "$workspace/declared-conflict.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/canary-git-panel" "$workspace/canary-git-backups"
printf "<?php return ['version' => 'canary'];\n" >"$PANEL_DIR/config/app.php"
git -C "$PANEL_DIR" init -q
git -C "$PANEL_DIR" add config/app.php
git -C "$PANEL_DIR" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm fixture
git -C "$PANEL_DIR" tag v1.15.1
export PANEL_DIR="$PANEL_DIR/"
run_installer "$workspace/canary-git.log" install
grep -q 'source base resolved from exact Git tag: v1.15.1' "$workspace/canary-git.log"
grep -q 'DEPLOYMENT COMPLETE' "$workspace/canary-git.log"

clear_mocks
reset_panel "$workspace/canary-dirty-panel" "$workspace/canary-dirty-backups"
printf "<?php return ['version' => 'canary'];\n" >"$PANEL_DIR/config/app.php"
git -C "$PANEL_DIR" init -q
git -C "$PANEL_DIR" add config/app.php
git -C "$PANEL_DIR" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm fixture
git -C "$PANEL_DIR" tag v1.15.1
printf '// modified\n' >>"$PANEL_DIR/config/app.php"
expect_failure "$workspace/canary-dirty.log" install
grep -q 'numeric base cannot be determined' "$workspace/canary-dirty.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/canary-ambiguous-panel" "$workspace/canary-ambiguous-backups"
printf "<?php return ['version' => 'canary'];\n" >"$PANEL_DIR/config/app.php"
git -C "$PANEL_DIR" init -q
git -C "$PANEL_DIR" add config/app.php
git -C "$PANEL_DIR" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm fixture
git -C "$PANEL_DIR" tag v1.15.1
git -C "$PANEL_DIR" tag v1.14.1
expect_failure "$workspace/canary-ambiguous.log" install
grep -q 'numeric base cannot be determined' "$workspace/canary-ambiguous.log"
assert_panel_online_and_original

git -C "$PANEL_DIR" tag -d v1.14.1 >/dev/null
printf 'changed\n' >"$PANEL_DIR/change.txt"
git -C "$PANEL_DIR" add change.txt
git -C "$PANEL_DIR" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm development
expect_failure "$workspace/canary-ancestor.log" install
grep -q 'numeric base cannot be determined' "$workspace/canary-ancestor.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/unknown-base-panel" "$workspace/unknown-base-backups"
rm -f "$PANEL_DIR/config/app.php"
expect_failure "$workspace/base-unknown.log" update
grep -q 'Unable to determine the installed Pterodactyl version' "$workspace/base-unknown.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]
export ROCK_PANEL_VERSION=1.15.1
expect_failure "$workspace/base-missing-override.log" install
grep -q 'only a fallback for a canary source installation' "$workspace/base-missing-override.log"
assert_panel_online_and_original

# The fallback lock blocks a concurrent manager and safely reclaims a stale owner.
clear_mocks
reset_panel "$workspace/locked-panel" "$workspace/locked-backups"
export ROCK_LOCK_FORCE_MKDIR=1
export MOCK_COMPOSER_WAIT=1
ROCK_FORCE_ANIMATION=1 ROCK_NO_ANIMATION=0 bash "$root/install.sh" update >"$workspace/lock-owner.log" 2>&1 &
lock_owner_pid=$!
for _ in {1..100}; do
    [ -f "$MOCK_COMPOSER_READY" ] && break
    kill -0 "$lock_owner_pid" >/dev/null 2>&1 || break
    sleep 0.05
done
[ -f "$MOCK_COMPOSER_READY" ]
set +e
bash "$root/install.sh" update >"$workspace/lock-contender.log" 2>&1
lock_contender_status=$?
set -e
[ "$lock_contender_status" -ne 0 ]
grep -q 'Another Rockdactyl manager is already operating' "$workspace/lock-contender.log"
kill -TERM "$lock_owner_pid"
set +e
wait "$lock_owner_pid"
lock_owner_status=$?
set -e
[ "$lock_owner_status" -eq 143 ]
grep -q 'Snapshot restored successfully' "$workspace/lock-owner.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/stale-lock-panel" "$workspace/stale-lock-backups"
export ROCK_LOCK_FORCE_MKDIR=1
panel_resolved="$(cd "$PANEL_DIR" && pwd -P)"
lock_key="$(printf '%s' "$panel_resolved" | sha256sum)"
lock_key="${lock_key%% *}"
stale_lock="$ROCK_LOCK_ROOT/rock-theme-manager-${lock_key}.lock.d"
mkdir -- "$stale_lock"
printf '999999999 - %s\n' "$panel_resolved" >"$stale_lock/owner"
touch -t 200001010000 "$stale_lock/owner"
run_installer "$workspace/stale-lock-success.log" update
grep -q 'DEPLOYMENT COMPLETE' "$workspace/stale-lock-success.log"
[ ! -d "$stale_lock" ]

clear_mocks
reset_panel "$workspace/recent-empty-lock-panel" "$workspace/recent-empty-lock-backups"
export ROCK_LOCK_FORCE_MKDIR=1
panel_resolved="$(cd "$PANEL_DIR" && pwd -P)"
lock_key="$(printf '%s' "$panel_resolved" | sha256sum)"
lock_key="${lock_key%% *}"
recent_empty_lock="$ROCK_LOCK_ROOT/rock-theme-manager-${lock_key}.lock.d"
mkdir -- "$recent_empty_lock"
expect_failure "$workspace/recent-empty-lock.log" update
grep -q 'Another Rockdactyl manager is already operating' "$workspace/recent-empty-lock.log"
rm -rf -- "$recent_empty_lock"

# Download and archive failures happen before maintenance mode or a snapshot.
clear_mocks
reset_panel "$workspace/download-panel" "$workspace/download-backups"
export MOCK_DOWNLOAD_FAIL=1
expect_failure "$workspace/download-failure.log" update
grep -q 'simulated download failure' "$workspace/download-failure.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

clear_mocks
reset_panel "$workspace/corrupt-panel" "$workspace/corrupt-backups"
export MOCK_CORRUPT_ARCHIVE=1
expect_failure "$workspace/corrupt-archive.log" update
grep -Eq 'Inspecting release archive|not in gzip format' "$workspace/corrupt-archive.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

clear_mocks
reset_panel "$workspace/protected-archive-panel" "$workspace/protected-archive-backups"
export MOCK_ARCHIVE_MODE=protected
expect_failure "$workspace/protected-archive.log" update
grep -q 'protected live-data path' "$workspace/protected-archive.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/tag-source-panel" "$workspace/tag-source-backups"
export MOCK_TAG_SOURCE=ffffffffffffffffffffffffffffffffffffffff
expect_failure "$workspace/tag-source.log" update
grep -q 'source commit does not match its Git tag' "$workspace/tag-source.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/hardlink-archive-panel" "$workspace/hardlink-archive-backups"
export MOCK_ARCHIVE_MODE=hardlink
expect_failure "$workspace/hardlink-archive.log" update
grep -q 'symbolic link, hard link, or special file' "$workspace/hardlink-archive.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/traversal-archive-panel" "$workspace/traversal-archive-backups"
export MOCK_ARCHIVE_MODE=traversal
expect_failure "$workspace/traversal-archive.log" update
grep -q 'unsafe path' "$workspace/traversal-archive.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/checksum-mismatch-panel" "$workspace/checksum-mismatch-backups"
export MOCK_CHECKSUM_MODE=mismatch
expect_failure "$workspace/checksum-mismatch.log" update
grep -q 'release archive checksum does not match' "$workspace/checksum-mismatch.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

clear_mocks
reset_panel "$workspace/checksum-filename-panel" "$workspace/checksum-filename-backups"
export MOCK_CHECKSUM_MODE=other-filename
expect_failure "$workspace/checksum-filename.log" update
grep -q 'checksum must contain exactly one entry for panel.tar.gz' "$workspace/checksum-filename.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

clear_mocks
reset_panel "$workspace/checksum-extra-entry-panel" "$workspace/checksum-extra-entry-backups"
export MOCK_CHECKSUM_MODE=extra-entry
expect_failure "$workspace/checksum-extra-entry.log" update
grep -q 'checksum must contain exactly one entry for panel.tar.gz' "$workspace/checksum-extra-entry.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

# A failed snapshot never takes the panel down or leaves a partial archive behind.
clear_mocks
reset_panel "$workspace/backup-panel" "$workspace/backup-failures"
export MOCK_BACKUP_FAIL=1
expect_failure "$workspace/backup-failure.log" update
grep -q 'simulated backup failure' "$workspace/backup-failure.log"
assert_panel_online_and_original
[ -z "$(find "$ROCK_BACKUP_ROOT" -maxdepth 1 -type f -print -quit)" ]

# Staging, dependency, and maintenance failures recover automatically. Database
# failures remain in maintenance mode so half-applied migrations are never exposed.
clear_mocks
reset_panel "$workspace/extract-panel" "$workspace/extract-backups"
export MOCK_EXTRACT_FAIL=1
expect_failure "$workspace/extract-failure.log" update
grep -q 'simulated extraction failure' "$workspace/extract-failure.log"
[ ! -f "$PANEL_DIR/storage/framework/down" ]
[ -f "$PANEL_DIR/original-marker" ]
[ ! -f "$PANEL_DIR/rock-theme-installed" ]
[ ! -f "$PANEL_DIR/partial-extraction" ]
grep -q '^APP_KEY=current$' "$PANEL_DIR/.env"
grep -q '^persistent$' "$PANEL_DIR/storage/persistent-data"

clear_mocks
reset_panel "$workspace/composer-panel" "$workspace/composer-backups"
export MOCK_COMPOSER_FAIL=1
expect_failure "$workspace/composer-failure.log" update
grep -q 'simulated composer failure' "$workspace/composer-failure.log"
grep -q 'Snapshot restored successfully' "$workspace/composer-failure.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/tampered-backup-panel" "$workspace/tampered-backups"
export MOCK_TAMPER_BACKUP=1
export MOCK_COMPOSER_FAIL=1
expect_failure "$workspace/tampered-backup.log" update
grep -q 'rollback snapshot checksum does not match' "$workspace/tampered-backup.log"
grep -q 'RECOVERY FAILED' "$workspace/tampered-backup.log"
[ -f "$PANEL_DIR/storage/framework/down" ]
[ -f "$PANEL_DIR/rock-theme-installed" ]

clear_mocks
reset_panel "$workspace/migration-panel" "$workspace/migration-backups"
export MOCK_MIGRATION_FAIL=1
expect_failure "$workspace/migration-failure.log" update
grep -q 'simulated migration failure' "$workspace/migration-failure.log"
grep -q 'automatic file rollback was skipped' "$workspace/migration-failure.log"
grep -q 'panel remains offline until recovery is reviewed' "$workspace/migration-failure.log"
[ -f "$PANEL_DIR/storage/framework/down" ]
[ -f "$PANEL_DIR/rock-theme-installed" ]

clear_mocks
reset_panel "$workspace/maintenance-panel" "$workspace/maintenance-backups"
export MOCK_DOWN_FAIL=1
expect_failure "$workspace/maintenance-failure.log" update
grep -q 'Panel returned online' "$workspace/maintenance-failure.log"
assert_panel_online_and_original

clear_mocks
reset_panel "$workspace/maintenance-exit-panel" "$workspace/maintenance-exit-backups"
export MOCK_UP_FAIL=1
expect_failure "$workspace/maintenance-exit-failure.log" update
grep -q 'simulated maintenance exit failure' "$workspace/maintenance-exit-failure.log"
grep -q 'panel remains offline until recovery is reviewed' "$workspace/maintenance-exit-failure.log"
[ -f "$PANEL_DIR/storage/framework/down" ]

# SIGTERM during a non-animated mutating step kills the active process group,
# restores the snapshot, and exits online.
clear_mocks
reset_panel "$workspace/interrupted-panel" "$workspace/interrupted-backups"
export MOCK_COMPOSER_WAIT=1
set +e
ROCK_NO_ANIMATION=1 bash "$root/install.sh" update >"$workspace/interrupted.log" 2>&1 &
installer_pid=$!
set -e
for _ in {1..100}; do
    [ -f "$MOCK_COMPOSER_READY" ] && break
    kill -0 "$installer_pid" >/dev/null 2>&1 || break
    sleep 0.05
done
[ -f "$MOCK_COMPOSER_READY" ]
kill -TERM "$installer_pid"
set +e
wait "$installer_pid"
interrupt_status=$?
set -e
[ "$interrupt_status" -eq 143 ]
grep -q 'Snapshot restored successfully' "$workspace/interrupted.log"
sleep 1.2
[ ! -f "$PANEL_DIR/storage/orphaned-child-write" ]
assert_panel_online_and_original

# Verbose mode has the same interruption guarantees.
clear_mocks
reset_panel "$workspace/verbose-interrupted-panel" "$workspace/verbose-interrupted-backups"
export MOCK_COMPOSER_WAIT=1
set +e
ROCK_VERBOSE=1 bash "$root/install.sh" update >"$workspace/verbose-interrupted.log" 2>&1 &
installer_pid=$!
set -e
for _ in {1..100}; do
    [ -f "$MOCK_COMPOSER_READY" ] && break
    kill -0 "$installer_pid" >/dev/null 2>&1 || break
    sleep 0.05
done
[ -f "$MOCK_COMPOSER_READY" ]
kill -TERM "$installer_pid"
set +e
wait "$installer_pid"
interrupt_status=$?
set -e
[ "$interrupt_status" -eq 143 ]
grep -q 'Snapshot restored successfully' "$workspace/verbose-interrupted.log"
sleep 1.2
[ ! -f "$PANEL_DIR/storage/orphaned-child-write" ]
assert_panel_online_and_original

# A panel that was already in maintenance stays there after a successful update.
clear_mocks
reset_panel "$workspace/preexisting-maintenance-panel" "$workspace/preexisting-maintenance-backups"
touch "$PANEL_DIR/storage/framework/down"
run_installer "$workspace/preexisting-maintenance.log" update
[ -f "$PANEL_DIR/storage/framework/down" ]
grep -q 'Preserving existing maintenance mode' "$workspace/preexisting-maintenance.log"

# Install creates the durable original snapshot.
clear_mocks
reset_panel "$workspace/install-panel" "$workspace/install-backups"
run_installer "$workspace/install-success.log" install
[ -f "$ROCK_BACKUP_ROOT/original-panel.tar.gz" ]
"$real_tar" -tzf "$ROCK_BACKUP_ROOT/original-panel.tar.gz" | grep -Eq '^\./original-marker$'

# Restore reinstates the original files while preserving the live environment and storage.
clear_mocks
reset_panel "$workspace/restore-panel" "$workspace/restore-backups"
mkdir -p "$ROCK_BACKUP_ROOT"
"$real_tar" -C "$PANEL_DIR" -czf "$ROCK_BACKUP_ROOT/original-panel.tar.gz" .
(cd "$ROCK_BACKUP_ROOT" && sha256sum original-panel.tar.gz >original-panel.tar.gz.sha256)
rm -f "$PANEL_DIR/original-marker"
printf 'theme\n' >"$PANEL_DIR/theme-only-file"
printf 'APP_KEY=live-value\n' >"$PANEL_DIR/.env"
printf 'live-storage\n' >"$PANEL_DIR/storage/persistent-data"
run_installer "$workspace/restore-success.log" restore
[ -f "$PANEL_DIR/original-marker" ]
[ ! -f "$PANEL_DIR/theme-only-file" ]
grep -q '^APP_KEY=live-value$' "$PANEL_DIR/.env"
grep -q '^live-storage$' "$PANEL_DIR/storage/persistent-data"
[ ! -f "$PANEL_DIR/storage/framework/down" ]
find "$ROCK_BACKUP_ROOT" -maxdepth 1 -name 'before-restore-*.tar.gz' -print -quit | grep -q .

# Release output is clean-tree-only, atomic on failure, and byte reproducible.
release_repo="$workspace/release-repo"
mkdir -p "$release_repo/.rock" "$release_repo/public/assets" "$release_repo/.github" "$release_repo/tests" "$release_repo/scripts"
cp "$root/release.sh" "$release_repo/release.sh"
cp "$root/scripts/package-release.sh" "$release_repo/scripts/package-release.sh"
cp "$root/scripts/copy-compiled-assets.js" "$release_repo/scripts/copy-compiled-assets.js"
cp "$root/scripts/verify-release-assets.sh" "$release_repo/scripts/verify-release-assets.sh"
printf '{"version":"9.9.9"}\n' >"$release_repo/package.json"
printf 'v1.15.1\n' >"$release_repo/.rock/upstream-version"
printf '*\n!.gitignore\n' >"$release_repo/public/assets/.gitignore"
printf 'excluded\n' >"$release_repo/.github/workflow.yml"
printf 'excluded\n' >"$release_repo/tests/example"
printf '/release/\n' >"$release_repo/.gitignore"
(
    cd "$release_repo"
    git init -q
    git config user.name 'Rockdactyl Tests'
    git config user.email 'tests@rock-theme.invalid'
    git add .
    git commit -qm 'fixture'
)
mkdir -p "$release_repo/node_modules"
printf 'compiled\n' >"$release_repo/public/assets/app.js"
printf 'not releasable\n' >"$release_repo/public/assets/planted.php"
fixture_integrity="$(node -e 'const fs=require("fs"),crypto=require("crypto"); process.stdout.write("sha384-"+crypto.createHash("sha384").update(fs.readFileSync(process.argv[1])).digest("base64"));' "$release_repo/public/assets/app.js")"
printf '{"main.js":{"src":"/assets/app.js","integrity":"%s"}}\n' "$fixture_integrity" >"$release_repo/public/assets/manifest.json"

release_path="$release_mock_bin:$PATH"
(cd "$release_repo" && PATH="$release_path" bash ./release.sh) >"$workspace/release-first.log" 2>&1
first_sha="$(sha256sum "$release_repo/release/panel.tar.gz" | cut -d' ' -f1)"
(cd "$release_repo/release" && sha256sum --check --status panel.tar.gz.sha256)
"$real_tar" -tzf "$release_repo/release/panel.tar.gz" | grep -Eq '^\./public/assets/app.js$'
if "$real_tar" -tzf "$release_repo/release/panel.tar.gz" | grep -Eq '^\./public/assets/planted\.php$'; then
    printf 'Release archive unexpectedly contains a non-manifest asset.\n' >&2
    exit 1
fi
if "$real_tar" -tzf "$release_repo/release/panel.tar.gz" | grep -Eq '^\./(\.github|tests)(/|$)'; then
    printf 'Release archive unexpectedly contains CI or test files.\n' >&2
    exit 1
fi
grep -q 'Theme:    9.9.9' "$workspace/release-first.log"
grep -q 'Base:     v1.15.1' "$workspace/release-first.log"
grep -q 'SHA-256:' "$workspace/release-first.log"

(cd "$release_repo" && PATH="$release_path" bash ./release.sh) >"$workspace/release-second.log" 2>&1
second_sha="$(sha256sum "$release_repo/release/panel.tar.gz" | cut -d' ' -f1)"
[ "$first_sha" = "$second_sha" ]

printf '\n' >>"$release_repo/package.json"
set +e
(cd "$release_repo" && PATH="$release_path" bash ./release.sh) >"$workspace/release-dirty.log" 2>&1
dirty_status=$?
set -e
[ "$dirty_status" -ne 0 ]
grep -q 'clean working tree' "$workspace/release-dirty.log"
(cd "$release_repo" && git checkout -q -- package.json)

set +e
(cd "$release_repo" && PATH="$release_path" MOCK_YARN_FAIL=1 bash ./release.sh) >"$workspace/release-build-failure.log" 2>&1
build_status=$?
set -e
[ "$build_status" -ne 0 ]
grep -q 'simulated frontend build failure' "$workspace/release-build-failure.log"
[ "$second_sha" = "$(sha256sum "$release_repo/release/panel.tar.gz" | cut -d' ' -f1)" ]
[ -z "$(find "$release_repo/release" -maxdepth 1 -name '*.tmp.*' -print -quit)" ]

set +e
(cd "$release_repo" && PATH="$release_path" MOCK_YARN_NONDETERMINISTIC=1 MOCK_YARN_COUNTER="$workspace/yarn-build-count" bash ./release.sh) >"$workspace/release-nondeterministic.log" 2>&1
nondeterministic_status=$?
set -e
[ "$nondeterministic_status" -ne 0 ]
grep -q 'Production assets were not reproducible' "$workspace/release-nondeterministic.log"
[ "$second_sha" = "$(sha256sum "$release_repo/release/panel.tar.gz" | cut -d' ' -f1)" ]

printf 'Installer and release integration tests passed.\n'
