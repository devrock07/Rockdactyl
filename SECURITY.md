# Security Policy

## Supported versions

Security fixes are provided for the latest tagged Rockdactyl release on
Pterodactyl Panel `1.15.1`. Older Rockdactyl releases and unsupported
Pterodactyl bases may be asked to upgrade before a report is investigated.

| Rockdactyl           | Pterodactyl base | Security support |
| -------------------- | ---------------- | ---------------- |
| Latest `3.x` release | `1.15.1`         | Supported        |
| Older releases       | Any              | Upgrade required |

Rockdactyl maintains the interface and branding layer. Vulnerabilities in the
Pterodactyl core or Wings should also be reported through the
[Pterodactyl security policy](https://github.com/pterodactyl/panel/security/policy).

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use
[GitHub private vulnerability reporting](https://github.com/devrock07/Rockdactyl/security/advisories/new)
and include:

-   The affected Rockdactyl and Pterodactyl versions
-   The affected route or component
-   Reproduction steps and impact
-   Relevant logs or screenshots with credentials and personal data removed

Do not include live credentials, session cookies, API keys, database dumps, or
production `.env` files. Use redacted examples and the minimum data necessary
to reproduce the issue.

## What to expect

-   An initial acknowledgement is targeted within 72 hours.
-   The report is validated and scoped before a disclosure date is discussed.
-   Confirmed issues receive a fix or mitigation in a supported release.
-   Public disclosure should wait until users have a reasonable opportunity to
    install the fix.

These are response targets rather than a paid support guarantee.

## Deployment hardening

Rockdactyl inherits Pterodactyl's operational security requirements. Keep the
panel, Wings, PHP, the database, and the host operating system patched; use
HTTPS; restrict administrative access; protect backups; and never expose
application secrets in screenshots or issue reports.
