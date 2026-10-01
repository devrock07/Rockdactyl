#!/usr/bin/env bash

set -Eeuo pipefail

PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"
BACKUP_ROOT="${ROCK_BACKUP_ROOT:-/var/backups/rock-theme}"
REPOSITORY='devrock07/Rockdactyl'
RELEASE_API="https://api.github.com/repos/${REPOSITORY}/releases/latest"

TEMP_DIR=''
PANEL_WAS_DOWN=false
PANEL_STARTED_DOWN=false
ACTIVE_PID=''
PENDING_BACKUP=''
ROLLBACK_SNAPSHOT=''
RECOVERY_PHASE='idle'
LOCK_HELD=false
LOCK_KIND=''
LOCK_FILE=''
LOCK_DIR=''
LOCK_ROOT="${ROCK_LOCK_ROOT:-/run/lock/rock-theme}"
LOCK_ROOT_RESOLVED=''
BANNER_SHOWN=false
STEP_INDEX=0
STEP_TOTAL=1
ANIMATE=false
ACTION=''

RED=''
CRIMSON=''
GREEN=''
AMBER=''
GRAY=''
WHITE=''
NC=''
ICON_ACTIVE='>'
ICON_OK='OK'
ICON_FAIL='X'
ICON_INFO='i'
SPINNER_FRAMES=('|' '/' '-' '\\')

configure_terminal() {
    local charmap=''

    if [ -t 1 ] && [ "${TERM:-dumb}" != 'dumb' ]; then
        if [ -z "${NO_COLOR+x}" ]; then
            RED=$'\033[0;31m'
            CRIMSON=$'\033[38;2;201;79;89m'
            GREEN=$'\033[38;2;114;214;165m'
            AMBER=$'\033[38;2;233;185;110m'
            GRAY=$'\033[0;90m'
            WHITE=$'\033[1;37m'
            NC=$'\033[0m'
        fi

        if [ "${ROCK_NO_ANIMATION:-0}" != '1' ] && [ "${CI:-false}" != 'true' ]; then
            ANIMATE=true
        fi
    fi

    if [ "${ROCK_FORCE_ANIMATION:-0}" = '1' ]; then
        ANIMATE=true
    fi

    charmap="$(locale charmap 2>/dev/null || true)"
    if [[ "$charmap" =~ ^UTF-?8$ ]]; then
        ICON_ACTIVE='◆'
        ICON_OK='◆'
        ICON_FAIL='✕'
        ICON_INFO='◇'
        SPINNER_FRAMES=('◢' '◣' '◤' '◥')
    fi
}

show_cursor() {
    [ -t 1 ] && printf '\033[?25h' || true
}

hide_cursor() {
    [ -t 1 ] && printf '\033[?25l' || true
}

clear_line() {
    [ -t 1 ] && printf '\r\033[2K' || true
}

ensure_temp_dir() {
    if [ -z "$TEMP_DIR" ]; then
        TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rock-theme.XXXXXX")"
    fi
}

fail() {
    clear_line
    show_cursor
    printf '%b%s ERROR%b  %s\n' "$RED" "$ICON_FAIL" "$NC" "$*" >&2
    exit 1
}

cleanup() {
    local status=$?
    local allow_online=true
    set +e

    if [ -n "$ACTIVE_PID" ] && kill -0 "$ACTIVE_PID" >/dev/null 2>&1; then
        kill -TERM -- "-$ACTIVE_PID" >/dev/null 2>&1 || kill -TERM "$ACTIVE_PID" >/dev/null 2>&1 || true
        for _ in {1..40}; do
            kill -0 -- "-$ACTIVE_PID" >/dev/null 2>&1 || break
            sleep 0.05
        done
        kill -KILL -- "-$ACTIVE_PID" >/dev/null 2>&1 || true
        wait "$ACTIVE_PID" >/dev/null 2>&1 || true
    fi
    ACTIVE_PID=''
    clear_line
    show_cursor

    if [ -n "$PENDING_BACKUP" ]; then
        case "$PENDING_BACKUP" in
            "$BACKUP_ROOT"/.rock-theme-backup.*) rm -f -- "$PENDING_BACKUP" ;;
            "$BACKUP_ROOT"/*.tar.gz) rm -f -- "$PENDING_BACKUP" "$PENDING_BACKUP.sha256" ;;
        esac
        PENDING_BACKUP=''
    fi
    if [ -d "$BACKUP_ROOT" ] && command -v find >/dev/null 2>&1; then
        find "$BACKUP_ROOT" -maxdepth 1 -type f -name ".rock-theme-backup.$$.??????" -delete 2>/dev/null || true
        find "$BACKUP_ROOT" -maxdepth 1 -type f -name ".rock-theme-checksum.$$.??????" -delete 2>/dev/null || true
    fi

    if [ "$status" -ne 0 ] && [ "$RECOVERY_PHASE" = files ] && [ -n "$ROLLBACK_SNAPSHOT" ]; then
        printf '%b%s RECOVERY%b  Restoring the pre-operation file snapshot.\n' "$AMBER" "$ICON_INFO" "$NC" >&2
        if restore_rollback_snapshot "$ROLLBACK_SNAPSHOT"; then
            printf '%b%s RECOVERY%b  Snapshot restored successfully.\n' "$GREEN" "$ICON_OK" "$NC" >&2
            RECOVERY_PHASE='idle'
        else
            printf '%b%s RECOVERY FAILED%b  Restore manually from %s\n' "$RED" "$ICON_FAIL" "$NC" "$ROLLBACK_SNAPSHOT" >&2
            allow_online=false
        fi
    elif [ "$status" -ne 0 ] && [ "$RECOVERY_PHASE" = database ] && [ -n "$ROLLBACK_SNAPSHOT" ]; then
        printf '%b%s RECOVERY%b  Database work may have started; automatic file rollback was skipped to avoid a code/schema mismatch.\n' "$AMBER" "$ICON_INFO" "$NC" >&2
        printf '%b%s SNAPSHOT%b  Review files and database state before using %s\n' "$AMBER" "$ICON_INFO" "$NC" "$ROLLBACK_SNAPSHOT" >&2
        allow_online=false
    fi

    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        case "$TEMP_DIR" in
            "${TMPDIR:-/tmp}"/rock-theme.*) rm -rf -- "$TEMP_DIR" ;;
        esac
    fi

    if [ "$PANEL_WAS_DOWN" = true ] && [ "$PANEL_STARTED_DOWN" != true ] && [ -f "$PANEL_DIR/artisan" ]; then
        if [ "$allow_online" = true ]; then
            if (cd "$PANEL_DIR" && php artisan up >/dev/null 2>&1); then
                printf '%b%s RECOVERY%b  Panel returned online after an interrupted operation.\n' "$AMBER" "$ICON_INFO" "$NC" >&2
            else
                printf '%b%s RECOVERY FAILED%b  The panel could not be brought online automatically.\n' "$RED" "$ICON_FAIL" "$NC" >&2
            fi
        else
            printf '%b%s MAINTENANCE%b  The panel remains offline until recovery is reviewed.\n' "$AMBER" "$ICON_INFO" "$NC" >&2
        fi
    elif [ "$allow_online" != true ]; then
        printf '%b%s MAINTENANCE%b  The panel remains offline until recovery is reviewed.\n' "$AMBER" "$ICON_INFO" "$NC" >&2
    fi

    release_manager_lock

    return "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

banner() {
    [ "$BANNER_SHOWN" = false ] || return 0
    BANNER_SHOWN=true

    printf '\n  %bROCKDACTYL%b\n' "$WHITE" "$NC"
    printf '  %bPterodactyl panel manager%b\n' "$GRAY" "$NC"
    printf '  %b----------------------------------------%b\n\n' "$CRIMSON" "$NC"
}

run_step() {
    local label="$1"
    shift

    ensure_temp_dir
    STEP_INDEX=$((STEP_INDEX + 1))

    local log_file="$TEMP_DIR/step-${STEP_INDEX}.log"
    local started=$SECONDS
    local elapsed=0
    local status=0
    local tick=0
    local frame=''

    if [ "${ROCK_VERBOSE:-0}" = '1' ] || [ "$ANIMATE" != true ]; then
        printf '  %b%s%b %b[%02d/%02d]%b %s\n' "$CRIMSON" "$ICON_ACTIVE" "$NC" "$GRAY" "$STEP_INDEX" "$STEP_TOTAL" "$NC" "$label"
    fi

    # Every step runs in its own process group, including non-interactive and
    # verbose runs. This lets INT/TERM stop a mutating child immediately.
    set -m 2>/dev/null || true
    if [ "${ROCK_VERBOSE:-0}" = '1' ] || [ "$ANIMATE" != true ]; then
        "$@" > >(tee "$log_file") 2>&1 &
    else
        "$@" >"$log_file" 2>&1 &
    fi
    ACTIVE_PID=$!
    set +m 2>/dev/null || true

    if [ "$ANIMATE" = true ] && [ "${ROCK_VERBOSE:-0}" != '1' ]; then
        hide_cursor

        while kill -0 "$ACTIVE_PID" >/dev/null 2>&1; do
            elapsed=$((SECONDS - started))
            frame="${SPINNER_FRAMES[$((tick % ${#SPINNER_FRAMES[@]}))]}"
            printf '\r\033[2K  %b%s%b %b[%02d/%02d]%b %-42s %b%02ds%b' \
                "$CRIMSON" "$frame" "$NC" "$GRAY" "$STEP_INDEX" "$STEP_TOTAL" "$NC" "$label" "$GRAY" "$elapsed" "$NC"
            tick=$((tick + 1))
            sleep 0.12
        done

        wait "$ACTIVE_PID" || status=$?
        ACTIVE_PID=''
        clear_line
        show_cursor
    else
        wait "$ACTIVE_PID" || status=$?
        ACTIVE_PID=''
    fi

    elapsed=$((SECONDS - started))
    if [ "$status" -ne 0 ]; then
        printf '  %b%s FAIL%b %s %b(%ss)%b\n' "$RED" "$ICON_FAIL" "$NC" "$label" "$GRAY" "$elapsed" "$NC" >&2
        if [ -s "$log_file" ]; then
            printf '\n%b--- last installer output ---%b\n' "$GRAY" "$NC" >&2
            tail -n 80 "$log_file" >&2
            printf '%b-----------------------------%b\n\n' "$GRAY" "$NC" >&2
        fi
        fail "$label failed with exit code $status."
    fi

    if [ "${ROCK_VERBOSE:-0}" = '1' ] || [ "$ANIMATE" != true ]; then
        printf '  %b%s DONE%b %s %b(%ss)%b\n' "$GREEN" "$ICON_OK" "$NC" "$label" "$GRAY" "$elapsed" "$NC"
    else
        printf '  %b%s%b %b[%02d/%02d]%b %-42s %b%02ds%b\n' \
            "$GREEN" "$ICON_OK" "$NC" "$GRAY" "$STEP_INDEX" "$STEP_TOTAL" "$NC" "$label" "$GRAY" "$elapsed" "$NC"
    fi
}

run_synchronous_step() {
    local label="$1"
    shift
    local started=$SECONDS
    local elapsed=0

    STEP_INDEX=$((STEP_INDEX + 1))
    printf '  %b%s%b %b[%02d/%02d]%b %s\n' "$CRIMSON" "$ICON_ACTIVE" "$NC" "$GRAY" "$STEP_INDEX" "$STEP_TOTAL" "$NC" "$label"
    if ! "$@"; then
        elapsed=$((SECONDS - started))
        printf '  %b%s FAIL%b %s %b(%ss)%b\n' "$RED" "$ICON_FAIL" "$NC" "$label" "$GRAY" "$elapsed" "$NC" >&2
        fail "$label failed."
    fi
    elapsed=$((SECONDS - started))
    printf '  %b%s DONE%b %s %b(%ss)%b\n' "$GREEN" "$ICON_OK" "$NC" "$label" "$GRAY" "$elapsed" "$NC"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        printf 'Required command not found: %s\n' "$1" >&2
        return 1
    fi
}

path_has_symlink_component() {
    local candidate="$1"

    case "$candidate" in
        /*) ;;
        *) candidate="$(pwd -P)/$candidate" ;;
    esac
    candidate="${candidate%/}"
    [ -n "$candidate" ] || candidate='/'
    while [ "$candidate" != '/' ] && [ -n "$candidate" ]; do
        [ ! -L "$candidate" ] || return 0
        candidate="${candidate%/*}"
        [ -n "$candidate" ] || candidate='/'
    done
    return 1
}

validate_trusted_root() {
    local directory="$1"
    local label="$2"
    local owner=''

    [ -d "$directory" ] || {
        printf '%s is not a directory: %s\n' "$label" "$directory" >&2
        return 1
    }
    if path_has_symlink_component "$directory"; then
        printf '%s must not contain symbolic-link path components: %s\n' "$label" "$directory" >&2
        return 1
    fi
    owner="$(stat -c '%u' -- "$directory")" || return 1
    if [ "$owner" != '0' ]; then
        printf '%s must be owned by root: %s\n' "$label" "$directory" >&2
        return 1
    fi
    if [ -n "$(find "$directory" -maxdepth 0 -perm /022 -print -quit 2>/dev/null)" ]; then
        printf '%s must not be writable by group or other users: %s\n' "$label" "$directory" >&2
        return 1
    fi
}

preflight_checks() {
    local panel_resolved=''
    local backup_resolved=''
    local panel_kib=''
    local available_kib=''
    local required_kib=''

    [ "$(id -u)" -eq 0 ] || {
        printf 'Run this manager as root or with sudo.\n' >&2
        return 1
    }

    case "$PANEL_DIR" in
        ''|'/'|'/var'|'/var/www')
            printf 'Unsafe PANEL_DIR: %s\n' "$PANEL_DIR" >&2
            return 1
            ;;
    esac

    [ -d "$PANEL_DIR" ] || {
        printf 'Panel directory not found: %s\n' "$PANEL_DIR" >&2
        return 1
    }
    [ -f "$PANEL_DIR/artisan" ] || {
        printf 'No Pterodactyl installation found in: %s\n' "$PANEL_DIR" >&2
        return 1
    }

    require_command curl || return 1
    require_command tar || return 1
    require_command sha256sum || return 1
    require_command grep || return 1
    require_command find || return 1
    require_command cp || return 1
    require_command mv || return 1
    require_command tr || return 1
    require_command sort || return 1
    require_command uniq || return 1
    require_command wc || return 1
    require_command sed || return 1
    require_command awk || return 1
    require_command df || return 1
    require_command du || return 1
    require_command mktemp || return 1
    require_command stat || return 1
    require_command tee || return 1
    require_command php || return 1
    require_command composer || return 1
    (umask 077 && mkdir -p -- "$BACKUP_ROOT") || return 1
    panel_resolved="$(cd "$PANEL_DIR" && pwd -P)" || return 1
    backup_resolved="$(cd "$BACKUP_ROOT" && pwd -P)" || return 1

    case "$panel_resolved" in
        ''|'/'|'/var'|'/var/www')
            printf 'Unsafe resolved PANEL_DIR: %s\n' "$panel_resolved" >&2
            return 1
            ;;
    esac
    case "$backup_resolved" in
        ''|'/')
            printf 'Unsafe ROCK_BACKUP_ROOT: %s\n' "$backup_resolved" >&2
            return 1
            ;;
    esac
    case "$backup_resolved/" in
        "$panel_resolved/"*)
            printf 'ROCK_BACKUP_ROOT must not be inside PANEL_DIR.\n' >&2
            return 1
            ;;
    esac
    validate_trusted_root "$BACKUP_ROOT" 'ROCK_BACKUP_ROOT' || return 1

    panel_kib="$(du -sk -- "$PANEL_DIR" | awk 'NR == 1 { print $1 }')" || return 1
    available_kib="$(df -Pk -- "$BACKUP_ROOT" | awk 'NR == 2 { print $4 }')" || return 1
    [[ "$panel_kib" =~ ^[0-9]+$ ]] && [[ "$available_kib" =~ ^[0-9]+$ ]] || return 1
    required_kib=$((panel_kib * 2))
    if [ "$available_kib" -lt "$required_kib" ]; then
        printf 'Insufficient backup space: need at least %s KiB, have %s KiB.\n' "$required_kib" "$available_kib" >&2
        return 1
    fi
}

detect_initial_maintenance() {
    if [ -f "$PANEL_DIR/storage/framework/down" ]; then
        PANEL_STARTED_DOWN=true
    else
        PANEL_STARTED_DOWN=false
    fi
}

process_start_token() {
    local pid="$1"
    local stat=''
    local remainder=''
    local -a fields=()

    if [ -r "/proc/$pid/stat" ]; then
        stat="$(<"/proc/$pid/stat")" || return 1
        remainder="${stat##*) }"
        read -r -a fields <<<"$remainder"
        [ "${#fields[@]}" -ge 20 ] || return 1
        printf '%s' "${fields[19]}"
        return 0
    fi

    printf '-'
}

lock_owner_active() {
    local owner_file="$1"
    local owner_pid=''
    local owner_start=''
    local current_start=''

    [ -r "$owner_file" ] || return 1
    read -r owner_pid owner_start <"$owner_file" || return 1
    [[ "$owner_pid" =~ ^[0-9]+$ ]] || return 1
    kill -0 "$owner_pid" >/dev/null 2>&1 || return 1
    current_start="$(process_start_token "$owner_pid")" || return 1
    [ "$owner_start" = '-' ] || [ "$owner_start" = "$current_start" ]
}

lock_owner_recent() {
    local owner_file="$1"
    [ -e "$owner_file" ] || return 1
    [ -n "$(find "$owner_file" -mmin -5 -print -quit 2>/dev/null)" ]
}

acquire_manager_lock() {
    local panel_resolved=''
    local lock_root_resolved=''
    local lock_key=''
    local owner_start=''
    local stale=''
    local attempt=0
    local command_name=''

    panel_resolved="$(cd "$PANEL_DIR" && pwd -P)" || return 1
    for command_name in sha256sum mkdir find stat; do
        if ! command -v "$command_name" >/dev/null 2>&1; then
            printf 'Required command not found: %s\n' "$command_name" >&2
            return 1
        fi
    done
    (umask 077 && mkdir -p -- "$LOCK_ROOT") || return 1
    lock_root_resolved="$(cd "$LOCK_ROOT" && pwd -P)" || return 1
    case "$lock_root_resolved" in
        ''|'/'|'/bin'|'/boot'|'/dev'|'/etc'|'/home'|'/lib'|'/lib64'|'/media'|'/mnt'|'/opt'|'/proc'|'/root'|'/run'|'/run/lock'|'/sbin'|'/srv'|'/sys'|'/tmp'|'/usr'|'/var'|'/var/backups'|'/var/lib'|'/var/log'|'/var/tmp'|'/var/www')
            printf 'Unsafe ROCK_LOCK_ROOT: %s\n' "$lock_root_resolved" >&2
            return 1
            ;;
    esac
    case "$lock_root_resolved/" in
        "$panel_resolved/"*)
            printf 'ROCK_LOCK_ROOT must not be inside PANEL_DIR.\n' >&2
            return 1
            ;;
    esac
    validate_trusted_root "$LOCK_ROOT" 'ROCK_LOCK_ROOT' || return 1
    LOCK_ROOT_RESOLVED="$lock_root_resolved"
    lock_key="$(printf '%s' "$panel_resolved" | sha256sum)" || return 1
    lock_key="${lock_key%% *}"
    LOCK_FILE="$LOCK_ROOT_RESOLVED/rock-theme-manager-${lock_key}.lock"
    owner_start="$(process_start_token "$$")" || owner_start='-'

    for command_name in mv rm find; do
        if ! command -v "$command_name" >/dev/null 2>&1; then
            printf 'Required command not found: %s\n' "$command_name" >&2
            return 1
        fi
    done

    LOCK_DIR="${LOCK_FILE}.d"
    while [ "$attempt" -lt 3 ]; do
        attempt=$((attempt + 1))
        if (umask 077 && mkdir -- "$LOCK_DIR") 2>/dev/null; then
            printf '%s %s %s\n' "$$" "$owner_start" "$panel_resolved" >"$LOCK_DIR/owner"
            LOCK_KIND='directory'
            LOCK_HELD=true
            return 0
        fi

        if lock_owner_active "$LOCK_DIR/owner" || lock_owner_recent "$LOCK_DIR/owner"; then
            printf 'Another Rockdactyl manager is already operating on %s.\n' "$panel_resolved" >&2
            return 1
        fi

        if [ ! -f "$LOCK_DIR/owner" ]; then
            sleep 0.05
            if lock_owner_active "$LOCK_DIR/owner" ||
                lock_owner_recent "$LOCK_DIR/owner" ||
                lock_owner_recent "$LOCK_DIR"; then
                printf 'Another Rockdactyl manager is already operating on %s.\n' "$panel_resolved" >&2
                return 1
            fi
        fi

        stale="${LOCK_DIR}.stale.$$.$attempt"
        if mv -- "$LOCK_DIR" "$stale" 2>/dev/null; then
            rm -rf -- "$stale"
        fi
    done

    printf 'Unable to acquire the Rockdactyl manager lock for %s.\n' "$panel_resolved" >&2
    return 1
}

release_manager_lock() {
    local owner_pid=''

    [ "$LOCK_HELD" = true ] || return 0

    if [ "$LOCK_KIND" = 'flock' ]; then
        flock -u 9 >/dev/null 2>&1 || true
        exec 9>&- || true
    elif [ "$LOCK_KIND" = 'directory' ] && [ -n "$LOCK_DIR" ]; then
        case "$LOCK_DIR" in
            "$LOCK_ROOT_RESOLVED"/rock-theme-manager-*.lock.d)
                if [ -f "$LOCK_DIR/owner" ]; then
                    read -r owner_pid _ <"$LOCK_DIR/owner" || true
                fi
                if [ "$owner_pid" = "$$" ]; then
                    rm -rf -- "$LOCK_DIR"
                fi
                ;;
        esac
    fi

    LOCK_HELD=false
    LOCK_KIND=''
}

web_user() {
    local candidate
    for candidate in www-data nginx apache; do
        if id "$candidate" >/dev/null 2>&1; then
            printf '%s' "$candidate"
            return 0
        fi
    done

    return 1
}

resolve_latest_release() {
    curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error "$RELEASE_API" |
        php -r '$data = json_decode(stream_get_contents(STDIN), true); if (!isset($data["tag_name"])) { exit(1); } echo $data["tag_name"];' \
            >"$TEMP_DIR/latest-tag" || return 1
    [ -s "$TEMP_DIR/latest-tag" ] || return 1
    grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$' "$TEMP_DIR/latest-tag"
}

download_release() {
    local release="$1"
    local release_base="https://github.com/${REPOSITORY}/releases/download/${release}"

    curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error "$release_base/panel.tar.gz" --output "$TEMP_DIR/panel.tar.gz" || return 1
    curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error "$release_base/panel.tar.gz.sha256" --output "$TEMP_DIR/panel.tar.gz.sha256"
}

verify_release_checksum() {
    local checksum_file="$TEMP_DIR/panel.tar.gz.sha256"
    local expected_checksum=''
    local actual_checksum=''

    expected_checksum="$(php -r '
        $contents = file_get_contents($argv[1]);
        if ($contents === false || preg_match("~\\A([0-9A-Fa-f]{64})  panel\\.tar\\.gz\\n?\\z~D", $contents, $matches) !== 1) {
            exit(1);
        }
        echo strtolower($matches[1]);
    ' "$checksum_file")" || {
        printf 'The release checksum must contain exactly one entry for panel.tar.gz.\n' >&2
        return 1
    }

    actual_checksum="$(sha256sum "$TEMP_DIR/panel.tar.gz")" || return 1
    actual_checksum="${actual_checksum%% *}"

    if [ "$actual_checksum" != "$expected_checksum" ]; then
        printf 'The release archive checksum does not match panel.tar.gz.sha256.\n' >&2
        return 1
    fi
}

validate_release_archive() {
    local provenance
    local release=''
    local declared_base=''
    local declared_source=''
    local archived_base=''
    local archived_config_base=''
    local tag_source=''
    tar --list --gzip --file="$TEMP_DIR/panel.tar.gz" --quoting-style=escape >"$TEMP_DIR/archive-list" || return 1
    LC_ALL=C tar --list --verbose --gzip --file="$TEMP_DIR/panel.tar.gz" --quoting-style=escape >"$TEMP_DIR/archive-details" || return 1
    if grep -Eq '(^|/)\.\.(/|$)|^/|\\' "$TEMP_DIR/archive-list"; then
        printf 'The release archive contains an unsafe path.\n' >&2
        return 1
    fi
    if grep -Eq '^[^-d]' "$TEMP_DIR/archive-details"; then
        printf 'The release archive contains a symbolic link, hard link, or special file.\n' >&2
        return 1
    fi
    if grep -Eq '^(\./)?\.env$|^(\./)?storage(/|$)' "$TEMP_DIR/archive-list"; then
        printf 'The release archive contains a protected live-data path.\n' >&2
        return 1
    fi
    if sed 's|^\./||' "$TEMP_DIR/archive-list" | sort | uniq -d | grep -q .; then
        printf 'The release archive contains duplicate member names.\n' >&2
        return 1
    fi
    if [ "$(grep -Ec '^(\./)?artisan$' "$TEMP_DIR/archive-list")" -ne 1 ]; then
        printf 'The release archive does not contain the panel entrypoint.\n' >&2
        return 1
    fi
    if [ "$(grep -Ec '^(\./)?\.rock/release\.json$' "$TEMP_DIR/archive-list")" -ne 1 ]; then
        printf 'The release archive must contain exactly one provenance record.\n' >&2
        return 1
    fi
    if ! provenance="$(tar -xOf "$TEMP_DIR/panel.tar.gz" ./.rock/release.json 2>/dev/null)"; then
        printf 'The release archive does not contain valid provenance metadata.\n' >&2
        return 1
    fi
    printf '%s' "$provenance" | php -r '
        $data = json_decode(stream_get_contents(STDIN), true);
        $tag = trim(file_get_contents($argv[1]));
        if (($data["schema"] ?? null) !== 1 ||
            ($data["theme_version"] ?? null) !== ltrim($tag, "v") ||
            !preg_match("/^v[0-9]+\\.[0-9]+\\.[0-9]+$/", $data["pterodactyl_version"] ?? "") ||
            !preg_match("/^[0-9a-f]{40}$/", $data["source_commit"] ?? "")) {
            exit(1);
        }
        file_put_contents($argv[2], $data["pterodactyl_version"] . "\n");
        file_put_contents($argv[3], $data["source_commit"] . "\n");
    ' "$TEMP_DIR/latest-tag" "$TEMP_DIR/release-base" "$TEMP_DIR/release-source" || return 1

    release="$(tr -d '[:space:]' <"$TEMP_DIR/latest-tag")"
    declared_base="$(tr -d '[:space:]' <"$TEMP_DIR/release-base")"
    declared_source="$(tr -d '[:space:]' <"$TEMP_DIR/release-source")"
    archived_base="$(tar -xOf "$TEMP_DIR/panel.tar.gz" ./.rock/upstream-version 2>/dev/null | tr -d '[:space:]')" || return 1
    archived_config_base="$(tar -xOf "$TEMP_DIR/panel.tar.gz" ./config/app.php 2>/dev/null | php -r '
        $contents = stream_get_contents(STDIN);
        if (!preg_match("~^\\h*[\\x27\"]version[\\x27\"]\\h*=>\\h*[\\x27\"]([^\\x27\"]+)[\\x27\"]~m", $contents, $matches)) {
            exit(1);
        }
        echo "v" . ltrim($matches[1], "v");
    ')" || return 1
    if [ "$declared_base" != "$archived_base" ] || [ "$declared_base" != "$archived_config_base" ]; then
        printf 'The release archive contains conflicting Pterodactyl base metadata.\n' >&2
        return 1
    fi

    curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error \
        "https://api.github.com/repos/${REPOSITORY}/commits/${release}" |
        php -r '$data = json_decode(stream_get_contents(STDIN), true); if (!preg_match("/^[0-9a-f]{40}$/", $data["sha"] ?? "")) { exit(1); } echo $data["sha"];' \
            >"$TEMP_DIR/release-tag-source" || return 1
    tag_source="$(tr -d '[:space:]' <"$TEMP_DIR/release-tag-source")"
    if [ "$declared_source" != "$tag_source" ]; then
        printf 'The release archive source commit does not match its Git tag.\n' >&2
        return 1
    fi
}

resolve_installed_base() {
    local marker_base=''
    local config_base=''
    local git_base=''
    local git_root=''
    local git_tags=''
    local panel_resolved=''
    local canary_base=false
    local declared_base="${ROCK_PANEL_VERSION:-}"
    local base=''

    if [ -f "$PANEL_DIR/.rock/upstream-version" ]; then
        marker_base="$(tr -d '[:space:]' <"$PANEL_DIR/.rock/upstream-version")"
    fi
    if [ -f "$PANEL_DIR/config/app.php" ]; then
        config_base="$(php -r '
            $contents = file_get_contents($argv[1]);
            if ($contents === false || !preg_match("~^\\h*[\\x27\"]version[\\x27\"]\\h*=>\\h*[\\x27\"]([^\\x27\"]+)[\\x27\"]~m", $contents, $matches)) {
                exit(1);
            }
            echo $matches[1];
        ' "$PANEL_DIR/config/app.php")" || return 1
        case "$config_base" in
            v*) ;;
            *) config_base="v$config_base" ;;
        esac
    fi

    # Upstream source tags keep the canary label; release archives stamp a
    # numeric version. A canary label alone does not identify a compatible base.
    if [ "$config_base" = 'vcanary' ]; then
        canary_base=true
        config_base=''
        if [ -z "$marker_base" ] && command -v git >/dev/null 2>&1 && [ -d "$PANEL_DIR/.git" ]; then
            git_root="$(git -C "$PANEL_DIR" rev-parse --show-toplevel 2>/dev/null)" || git_root=''
            git_tags="$(git -C "$PANEL_DIR" tag --points-at HEAD 2>/dev/null | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | sort -u)" || git_tags=''
            # Multiple release tags are ambiguous; do not choose one implicitly.
            panel_resolved="$(cd "$PANEL_DIR" && pwd -P)" || return 1
            if [ -n "$git_root" ]; then
                git_root="$(cd "$git_root" && pwd -P)" || git_root=''
            fi
            if [ "$git_root" = "$panel_resolved" ] && [ -n "$git_tags" ] && [[ "$git_tags" != *$'\n'* ]]; then
                git_base="$git_tags"
            fi
            case "$git_base" in
                v*) ;;
                '') ;;
                *) git_base="v$git_base" ;;
            esac
            if ! [[ "$git_base" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
                ! git -C "$PANEL_DIR" diff --quiet HEAD -- config/app.php; then
                git_base=''
            fi
        fi
        config_base="$git_base"
        if [ -n "$git_base" ]; then
            printf 'Pterodactyl source base resolved from exact Git tag: %s.\n' "$git_base" >&2
        fi
        if [ -z "$marker_base$config_base$declared_base" ]; then
            printf 'Pterodactyl reports canary; its numeric base cannot be determined.\n' >&2
            printf 'Use an official release archive, or set ROCK_PANEL_VERSION to the verified base version of this source installation.\n' >&2
            return 1
        fi
    fi

    if [ -n "$marker_base" ] && [ -n "$config_base" ] && [ "$marker_base" != "$config_base" ]; then
        printf 'Installed Pterodactyl metadata conflicts: marker is %s, config is %s.\n' "$marker_base" "$config_base" >&2
        return 1
    fi

    base="${marker_base:-$config_base}"
    if [ -n "$declared_base" ]; then
        case "$declared_base" in
            v*) ;;
            *) declared_base="v$declared_base" ;;
        esac
        if ! [[ "$declared_base" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            printf 'Invalid ROCK_PANEL_VERSION: %s\n' "$declared_base" >&2
            return 1
        fi
        if [ -n "$base" ] && [ "$base" != "$declared_base" ]; then
            printf 'Declared Pterodactyl version conflicts with installed metadata: declared %s, detected %s.\n' "$declared_base" "$base" >&2
            return 1
        fi
        if [ -z "$base" ]; then
            if [ "$canary_base" != true ]; then
                printf 'Unable to determine the installed Pterodactyl version; ROCK_PANEL_VERSION is only a fallback for a canary source installation.\n' >&2
                return 1
            fi
            printf 'Using operator-declared Pterodactyl base: %s.\n' "$declared_base" >&2
            base="$declared_base"
        fi
    fi
    if [ -z "$base" ]; then
        printf 'Unable to determine the installed Pterodactyl version.\n' >&2
        return 1
    fi

    if ! [[ "$base" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        printf 'Invalid installed Pterodactyl version: %s\n' "$base" >&2
        return 1
    fi
    printf '%s' "$base"
}

verify_base_compatibility() {
    local installed_base=''
    local release_base=''
    local installed_major=''
    local release_major=''

    [ -s "$TEMP_DIR/release-base" ] || {
        printf 'The release did not declare a compatible Pterodactyl base.\n' >&2
        return 1
    }
    release_base="$(tr -d '[:space:]' <"$TEMP_DIR/release-base")"
    installed_base="$(resolve_installed_base)" || return 1

    if [ "$installed_base" = "$release_base" ]; then
        return 0
    fi

    installed_major="${installed_base#v}"
    installed_major="${installed_major%%.*}"
    release_major="${release_base#v}"
    release_major="${release_major%%.*}"
    if [ "$installed_major" != "$release_major" ] ||
        ! php -r 'exit(version_compare($argv[1], $argv[2], "<=") ? 0 : 1);' "${installed_base#v}" "${release_base#v}"; then
        printf 'Pterodactyl base downgrade or major-version jump refused: panel is %s, release is %s.\n' "$installed_base" "$release_base" >&2
        return 1
    fi

    printf 'Pterodactyl base upgrade verified: %s -> %s.\n' "$installed_base" "$release_base"
}

backup_panel_to() {
    local target="$1"
    local partial=''
    local checksum_partial=''
    local archive_sha=''
    local target_name=''

    partial="$(mktemp "$BACKUP_ROOT/.rock-theme-backup.$$.XXXXXX")" || return 1
    PENDING_BACKUP="$partial"
    if ! tar -C "$PANEL_DIR" -czf "$partial" .; then
        rm -f -- "$partial"
        PENDING_BACKUP=''
        return 1
    fi
    tar -tzf "$partial" >/dev/null || {
        rm -f -- "$partial"
        PENDING_BACKUP=''
        return 1
    }
    mv -f -- "$partial" "$target"
    target_name="${target##*/}"
    archive_sha="$(sha256sum "$target")" || {
        rm -f -- "$target"
        PENDING_BACKUP=''
        return 1
    }
    archive_sha="${archive_sha%% *}"
    checksum_partial="$(mktemp "$BACKUP_ROOT/.rock-theme-checksum.$$.XXXXXX")" || {
        rm -f -- "$target"
        PENDING_BACKUP=''
        return 1
    }
    printf '%s  %s\n' "$archive_sha" "$target_name" >"$checksum_partial"
    mv -f -- "$checksum_partial" "$target.sha256" || {
        rm -f -- "$checksum_partial" "$target"
        PENDING_BACKUP=''
        return 1
    }
    if ! validate_backup_archive "$target" 'new rollback snapshot'; then
        rm -f -- "$target" "$target.sha256"
        PENDING_BACKUP=''
        return 1
    fi
    PENDING_BACKUP=''
}

next_backup_path() {
    local prefix="$1"
    local stamp=''
    local candidate=''
    local counter=0

    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    candidate="$BACKUP_ROOT/${prefix}-${stamp}.tar.gz"
    while [ -e "$candidate" ]; do
        counter=$((counter + 1))
        candidate="$BACKUP_ROOT/${prefix}-${stamp}-${counter}.tar.gz"
    done

    printf '%s' "$candidate"
}

restore_rollback_snapshot() {
    local snapshot="$1"
    local extracted=''

    [ -f "$snapshot" ] || return 1
    validate_backup_archive "$snapshot" 'rollback snapshot' || return 1
    ensure_temp_dir
    extracted="$TEMP_DIR/rollback-files"
    rm -rf -- "$extracted"
    mkdir -p "$extracted"
    tar --extract --gzip --file="$snapshot" --directory="$extracted" --no-same-owner --no-same-permissions || return 1
    [ -f "$extracted/artisan" ] || return 1

    rm -rf -- "$extracted/.env" "$extracted/storage"
    remove_current_panel_files || return 1
    cp -a "$extracted/." "$PANEL_DIR/"
}

artisan_command() {
    (
        cd "$PANEL_DIR" || exit 1
        php artisan "$@"
    )
}

composer_install() {
    (
        cd "$PANEL_DIR" || exit 1
        composer install --no-dev --optimize-autoloader --no-interaction
    )
}

stage_release() {
    local extracted="$TEMP_DIR/release-files"

    rm -rf -- "$extracted"
    mkdir -p "$extracted"
    tar --extract --gzip --file="$TEMP_DIR/panel.tar.gz" --directory="$extracted" \
        --no-same-owner --no-same-permissions \
        --exclude='./.env' --exclude='.env' \
        --exclude='./storage' --exclude='./storage/*' \
        --exclude='storage' --exclude='storage/*' || return 1
    [ -f "$extracted/artisan" ] || return 1
    if [ -n "$(find "$extracted" -mindepth 1 ! -type f ! -type d -print -quit)" ]; then
        printf 'The extracted release contains an unsupported file type.\n' >&2
        return 1
    fi
}

deploy_staged_release() {
    local extracted="$TEMP_DIR/release-files"

    [ -f "$extracted/artisan" ] || return 1
    cp -a "$extracted/." "$PANEL_DIR/"
}

restart_queue() {
    artisan_command queue:restart
}

set_panel_permissions() {
    local owner="$1"
    chown -R "$owner:$owner" "$PANEL_DIR" || return 1
    find "$PANEL_DIR/storage" "$PANEL_DIR/bootstrap/cache" -type d -exec chmod 755 {} + || return 1
    find "$PANEL_DIR/storage" "$PANEL_DIR/bootstrap/cache" -type f -exec chmod 644 {} +
}

enter_maintenance() {
    if [ "$PANEL_STARTED_DOWN" = true ]; then
        return 0
    fi
    artisan_command down
}

leave_maintenance() {
    if [ "$PANEL_STARTED_DOWN" = true ]; then
        run_step 'Preserving existing maintenance mode' true
    else
        run_step 'Bringing the panel online' artisan_command up
    fi
    PANEL_WAS_DOWN=false
    RECOVERY_PHASE='idle'
    ROLLBACK_SNAPSHOT=''
}

print_operation() {
    local action="$1"
    local release="$2"

    printf '\n%b  %s%b\n' "$WHITE" "$action" "$NC"
    printf '  %bTARGET%b   %s\n' "$GRAY" "$NC" "$PANEL_DIR"
    if [ -n "$release" ]; then
        printf '  %bRELEASE%b  %s\n' "$GRAY" "$NC" "$release"
    fi
    printf '  %bBACKUPS%b  %s\n\n' "$GRAY" "$NC" "$BACKUP_ROOT"
}

print_success() {
    local message="$1"

    printf '\n%b' "$CRIMSON"
    printf '  +--------------------------------------------------------------+\n'
    printf '  |  %b%s DEPLOYMENT COMPLETE%b                                   |\n' "$GREEN" "$ICON_OK" "$CRIMSON"
    printf '  |  %b%-58s%b  |\n' "$WHITE" "$message" "$CRIMSON"
    printf '  +--------------------------------------------------------------+\n'
    printf '%b\n' "$NC"
}

install_or_update() {
    local mode="$1"
    local release=''
    local owner=''
    local backup_target=''

    banner
    STEP_INDEX=0
    STEP_TOTAL=19

    run_synchronous_step 'Acquiring exclusive manager lock' acquire_manager_lock
    run_step 'Running safety preflight' preflight_checks
    detect_initial_maintenance
    owner="$(web_user)" || fail 'Unable to detect the web-server user (www-data, nginx, or apache).'
    run_step 'Resolving the latest release' resolve_latest_release
    release="$(<"$TEMP_DIR/latest-tag")"
    print_operation "${mode^^} ROCKDACTYL" "$release"
    run_step 'Downloading release and checksum' download_release "$release"
    run_step 'Verifying SHA-256 checksum' verify_release_checksum
    run_step 'Inspecting release archive' validate_release_archive
    run_step 'Checking Pterodactyl compatibility' verify_base_compatibility

    if [ "$mode" = 'install' ]; then
        if [ ! -f "$BACKUP_ROOT/original-panel.tar.gz" ] && [ ! -d "$PANEL_DIR/.rock" ]; then
            backup_target="$BACKUP_ROOT/original-panel.tar.gz"
        else
            backup_target="$(next_backup_path before-install)"
        fi
    else
        backup_target="$(next_backup_path before-update)"
    fi
    PENDING_BACKUP="$backup_target"
    run_step 'Saving a rollback snapshot' backup_panel_to "$backup_target"
    PENDING_BACKUP=''
    ROLLBACK_SNAPSHOT="$backup_target"
    run_step 'Staging Rockdactyl files' stage_release

    if [ "$PANEL_STARTED_DOWN" != true ]; then
        PANEL_WAS_DOWN=true
    fi
    run_step 'Entering maintenance mode' enter_maintenance
    RECOVERY_PHASE='files'
    run_step 'Preparing a clean application tree' remove_current_panel_files
    run_step 'Deploying Rockdactyl files' deploy_staged_release
    run_step 'Installing PHP dependencies' composer_install
    run_step 'Clearing pre-migration caches' artisan_command optimize:clear
    RECOVERY_PHASE='database'
    run_step 'Applying database migrations' artisan_command migrate --seed --force
    run_step 'Clearing optimized caches' artisan_command optimize:clear
    run_step 'Restarting background workers' restart_queue
    run_step 'Repairing file permissions' set_panel_permissions "$owner"
    leave_maintenance

    if [ "$PANEL_STARTED_DOWN" = true ]; then
        print_success "Rockdactyl ${release} installed; maintenance mode preserved."
    else
        print_success "Rockdactyl ${release} is installed and online."
    fi
}

remove_current_panel_files() {
    find "$PANEL_DIR" -mindepth 1 -maxdepth 1 ! -name '.env' ! -name 'storage' -exec rm -rf -- {} +
}

extract_original_backup() {
    local original="$1"
    local extracted="$TEMP_DIR/original-files"

    rm -rf -- "$extracted"
    mkdir -p "$extracted"
    tar --extract --gzip --file="$original" --directory="$extracted" \
        --no-same-owner --no-same-permissions \
        --exclude='./.env' --exclude='.env' \
        --exclude='./storage' --exclude='./storage/*' \
        --exclude='storage' --exclude='storage/*' || return 1
    [ -f "$extracted/artisan" ] || return 1
    cp -a "$extracted/." "$PANEL_DIR/"
}

validate_backup_archive() {
    local archive="$1"
    local label="$2"
    local checksum_file="$archive.sha256"
    local checksum_line=''
    local expected=''
    local filename=''
    local actual=''
    local list="$TEMP_DIR/backup-list"
    local details="$TEMP_DIR/backup-details"

    [ -f "$archive" ] || return 1
    if [ ! -f "$checksum_file" ]; then
        actual="$(sha256sum "$archive")" || return 1
        actual="${actual%% *}"
        printf '%s  %s\n' "$actual" "${archive##*/}" >"$checksum_file" || return 1
    fi
    [ "$(wc -l <"$checksum_file" | tr -d '[:space:]')" = '1' ] || {
        printf 'The %s checksum record is invalid.\n' "$label" >&2
        return 1
    }
    checksum_line="$(<"$checksum_file")"
    if [[ ! "$checksum_line" =~ ^([0-9A-Fa-f]{64})\ \ (.+)$ ]]; then
        printf 'The %s checksum record is invalid.\n' "$label" >&2
        return 1
    fi
    expected="${BASH_REMATCH[1],,}"
    filename="${BASH_REMATCH[2]}"
    if [ "$filename" != "${archive##*/}" ]; then
        printf 'The %s checksum filename is invalid.\n' "$label" >&2
        return 1
    fi
    actual="$(sha256sum "$archive")" || return 1
    actual="${actual%% *}"
    if [ "$actual" != "$expected" ]; then
        printf 'The %s checksum does not match.\n' "$label" >&2
        return 1
    fi

    tar --list --gzip --file="$archive" --quoting-style=escape >"$list" || return 1
    LC_ALL=C tar --list --verbose --gzip --file="$archive" --quoting-style=escape >"$details" || return 1
    if grep -Eq '(^|/)\.\.(/|$)|^/|\\' "$list" || grep -Eq '^[^-d]' "$details"; then
        printf 'The %s contains an unsafe member.\n' "$label" >&2
        return 1
    fi
    if sed 's|^\./||' "$list" | sort | uniq -d | grep -q .; then
        printf 'The %s contains duplicate member names.\n' "$label" >&2
        return 1
    fi
    if [ "$(grep -Ec '^(\./)?artisan$' "$list")" -ne 1 ]; then
        printf 'The %s does not contain exactly one panel entrypoint.\n' "$label" >&2
        return 1
    fi
}

validate_original_backup() {
    local original="$1"

    validate_backup_archive "$original" 'original backup'
}

restore_original() {
    local original="$BACKUP_ROOT/original-panel.tar.gz"
    local before_restore=''
    local owner=''

    banner
    STEP_INDEX=0
    STEP_TOTAL=12

    run_synchronous_step 'Acquiring exclusive manager lock' acquire_manager_lock
    run_step 'Running safety preflight' preflight_checks
    detect_initial_maintenance
    owner="$(web_user)" || fail 'Unable to detect the web-server user (www-data, nginx, or apache).'
    [ -f "$original" ] || fail "No manager-created pre-theme backup exists at $original."
    before_restore="$(next_backup_path before-restore)"
    print_operation 'RESTORE ORIGINAL PANEL' ''
    run_step 'Validating the original backup' validate_original_backup "$original"
    PENDING_BACKUP="$before_restore"
    run_step 'Backing up the current panel' backup_panel_to "$before_restore"
    PENDING_BACKUP=''
    ROLLBACK_SNAPSHOT="$before_restore"
    if [ "$PANEL_STARTED_DOWN" != true ]; then
        PANEL_WAS_DOWN=true
    fi
    run_step 'Entering maintenance mode' enter_maintenance
    RECOVERY_PHASE='files'
    run_step 'Preserving environment and storage' remove_current_panel_files
    run_step 'Restoring original panel files' extract_original_backup "$original"
    run_step 'Installing PHP dependencies' composer_install
    run_step 'Clearing optimized caches' artisan_command optimize:clear
    run_step 'Restarting background workers' restart_queue
    run_step 'Repairing file permissions' set_panel_permissions "$owner"
    leave_maintenance

    print_success 'Original panel restored; database changes were preserved.'
}

show_menu() {
    banner
    printf '  %bACTION%b\n\n' "$WHITE" "$NC"
    printf '  %b01%b  Install latest release\n' "$CRIMSON" "$NC"
    printf '  %b02%b  Update with rollback snapshot\n' "$CRIMSON" "$NC"
    printf '  %b03%b  Restore original panel\n' "$CRIMSON" "$NC"
    printf '  %b04%b  Exit\n\n' "$CRIMSON" "$NC"
    printf '  %bSelect [1-4]:%b ' "$GRAY" "$NC"
    read -r choice

    case "$choice" in
        1) install_or_update install ;;
        2) install_or_update update ;;
        3) restore_original ;;
        4) exit 0 ;;
        *) fail 'Invalid option. Choose 1, 2, 3, or 4.' ;;
    esac
}

usage() {
    cat <<'EOF'
Rockdactyl installer

Usage:
  install.sh [install|update|restore] [--no-animation] [--verbose]

Options:
  --no-animation   Disable animated terminal output.
  --verbose        Stream full command output instead of the progress renderer.
  -h, --help       Show this help message.

Environment:
  PANEL_DIR=/var/www/pterodactyl
  ROCK_BACKUP_ROOT=/var/backups/rock-theme
  ROCK_LOCK_ROOT=/run/lock/rock-theme
  ROCK_PANEL_VERSION=<verified numeric base for a canary source installation>
  ROCK_NO_ANIMATION=1
  ROCK_VERBOSE=1
  NO_COLOR=1
EOF
}

parse_arguments() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            install|--install) ACTION='install' ;;
            update|--update) ACTION='update' ;;
            restore|--restore|remove|--remove) ACTION='restore' ;;
            --no-animation) ROCK_NO_ANIMATION=1 ;;
            --verbose) ROCK_VERBOSE=1 ;;
            -h|--help) ACTION='help' ;;
            *)
                printf 'Unknown argument: %s\n\n' "$1" >&2
                usage >&2
                exit 2
                ;;
        esac
        shift
    done
}

parse_arguments "$@"
configure_terminal

case "$ACTION" in
    install) install_or_update install ;;
    update) install_or_update update ;;
    restore) restore_original ;;
    help) usage ;;
    '') show_menu ;;
esac
