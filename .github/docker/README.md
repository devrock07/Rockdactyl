# Rockdactyl container image

Rockdactyl publishes a production panel image to
`ghcr.io/devrock07/rock-theme` for `linux/amd64` and `linux/arm64`. The image
contains the complete Pterodactyl application, compiled Rockdactyl assets,
nginx, PHP-FPM, the scheduler, and a queue worker. Wings is deployed separately.

## Image tags

| Tag      | Use                                           |
| -------- | --------------------------------------------- |
| `3.0.0`  | Immutable release; recommended for production |
| `3.0`    | Latest compatible patch in a release line     |
| `latest` | Latest stable Rockdactyl release              |
| `edge`   | Current `main`; testing only                  |

Pin a full release version in production. Pulling `latest` or `edge` can change
the application the next time the container is recreated.

## Requirements

-   A MySQL or MariaDB database
-   Redis for cache, sessions, and queues
-   Persistent storage for `/app/var`, certificates, nginx configuration, and
    application logs
-   An existing Wings deployment and the normal Pterodactyl DNS/firewall setup

The repository's [Compose example](../../docker-compose.example.yml) provides a
starting point. Before starting it, change both database passwords, `APP_URL`,
`APP_SERVICE_AUTHOR`, mail settings, host volume paths, and the network subnet.
Do not commit real secrets.

```bash
docker compose -f docker-compose.example.yml pull
docker compose -f docker-compose.example.yml up -d
docker compose -f docker-compose.example.yml logs -f panel
```

The panel waits for the database, creates its persistent environment file,
runs database migrations, starts scheduled jobs, and then launches nginx and
PHP-FPM. Initial startup can take longer while migrations complete.

## Create the first administrator

```bash
docker compose -f docker-compose.example.yml exec panel php artisan p:user:make
```

Without Compose:

```bash
docker exec -it <panel-container> php artisan p:user:make
```

## Configuration

You can mount an existing environment file at `/app/var/.env` or provide
environment variables to the container. The most important values are:

| Variable                                                   | Purpose                                            | Required          |
| ---------------------------------------------------------- | -------------------------------------------------- | ----------------- |
| `APP_URL`                                                  | Public panel URL including `http://` or `https://` | Yes               |
| `APP_TIMEZONE`                                             | PHP timezone, such as `UTC`                        | Yes               |
| `APP_SERVICE_AUTHOR`                                       | Service-author email used by Pterodactyl           | Yes               |
| `APP_KEY`                                                  | Existing Laravel key when migrating a panel        | Existing installs |
| `DB_HOST`, `DB_PORT`                                       | Database endpoint                                  | Yes               |
| `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`                | Database credentials                               | Yes               |
| `CACHE_DRIVER`, `SESSION_DRIVER`, `QUEUE_DRIVER`           | Normally `redis`                                   | Yes               |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`               | Redis connection                                   | Yes               |
| `MAIL_MAILER`                                              | Mail transport, commonly `smtp`                    | Recommended       |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`                      | Sender identity                                    | Recommended       |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP connection                                    | When using SMTP   |
| `LE_EMAIL`                                                 | Enables built-in Let's Encrypt provisioning        | Optional          |

All Rockdactyl environment defaults are documented in
[`.env.example`](../../.env.example) and the
[configuration reference](../../docs/CONFIGURATION.md).
Settings saved in **Admin → Settings** take precedence over branding defaults.

## TLS and reverse proxies

Set `LE_EMAIL` only when the container itself should obtain and serve a
Let's Encrypt certificate. When TLS terminates at a reverse proxy, omit
`LE_EMAIL`, expose the HTTP port to that proxy, and configure trusted proxies
and forwarding headers according to the Pterodactyl documentation.

## Updating safely

Back up the database and persistent volumes, change the image to a verified
release tag, then recreate the panel container:

```bash
docker compose -f docker-compose.example.yml pull panel
docker compose -f docker-compose.example.yml up -d panel
docker compose -f docker-compose.example.yml logs -f panel
```

Confirm the login page, one server view, the queue worker, and the scheduler
after every update. Do not mix a Rockdactyl application image with a different
Pterodactyl database compatibility level.

## Troubleshooting

```bash
docker compose -f docker-compose.example.yml ps
docker compose -f docker-compose.example.yml logs --tail=200 panel
docker compose -f docker-compose.example.yml exec panel php artisan about
docker compose -f docker-compose.example.yml exec panel php artisan migrate:status
```

Redact credentials, tokens, public IP addresses, and personal information
before attaching output to an issue. For a complete diagnostic checklist, see
the [troubleshooting guide](../../docs/TROUBLESHOOTING.md).
