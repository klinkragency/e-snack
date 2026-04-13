# e-Snack

A white-label food ordering platform (delivery, click & collect, dine-in) that you deploy as a single Docker Compose stack behind your own domain. One admin manages restaurants, menus, orders, and drivers from a built-in dashboard.

## Prerequisites

- A VPS (or any server) with **Docker** and **Docker Compose v2.x** installed.
- A **domain name** with an A record pointing to the server's IP address.

## Quick start

```bash
git clone <your-repo-url> e-snack && cd e-snack

# Configure
cp .env.example .env
# Edit .env — at minimum fill in TIER 1 and TIER 2 values:
#   DOMAIN, PUBLIC_URL, POSTGRES_PASSWORD, JWT_SECRET,
#   INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, etc.

# Launch
docker compose up -d
```

The stack is ready once all services are healthy:

```bash
docker compose ps
```

## What happens on first boot

1. **Caddy** automatically obtains a TLS certificate from Let's Encrypt for your `DOMAIN`.
2. The **migrate** container runs all database migrations.
3. The **API** checks whether an admin user exists. If none is found, it creates one from the `INITIAL_*` env vars — seeding the admin account, a default restaurant, and its customization record.
4. The **frontend** starts serving at `https://<DOMAIN>`.

Once the seed has run, the `INITIAL_*` vars are no longer read and can be removed from `.env`.

## Post-deploy setup

1. Open `https://<DOMAIN>/admin` and log in with `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`.
2. Go to **Restaurants > Edit** — upload a logo and banner image, set brand colors and font.
3. Go to **Menu** — add categories and products (or use the JSON import if `OPENAI_API_KEY` is set).
4. If you want online payments, add your `MOLLIE_API_KEY` in `.env` and restart the API.
5. Optionally configure email (Resend or SMTP), OAuth providers, and analytics via the corresponding env vars.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend API | Go (gRPC + REST gateway) |
| Frontend | Next.js (App Router, BFF pattern) |
| Database | PostgreSQL 16 |
| Cache / PubSub | Redis 7 |
| Reverse proxy | Caddy 2 (automatic HTTPS) |
| Payments | Mollie |
| Object storage | MinIO |
| Migrations | golang-migrate |

## Environment variables

See [`.env.example`](.env.example) for the full inventory, organized in four tiers:

- **Tier 1 — Required:** domain, database, secrets, backend URL.
- **Tier 2 — First-boot seed:** admin credentials and initial restaurant (read once on first start).
- **Tier 3 — Highly recommended:** email, payments, image uploads.
- **Tier 4 — Optional:** AI import, OAuth, analytics, Telegram, feature flags.

## Project structure

```
api/          Go backend (gRPC + REST)
www/          Next.js frontend (BFF)
Caddyfile     Reverse proxy configuration
docker-compose.yml
.env.example
```
