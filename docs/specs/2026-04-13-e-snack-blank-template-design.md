# e-Snack Blank Template — Design Spec

**Date:** 2026-04-13
**Scope:** Chunk 1 — standalone deployable food-ordering template
**Source:** Beldys Club codebase, stripped and rebranded

---

## Context

Beldys Club is a food-ordering platform (delivery, pickup, dine-in) built for the Monaco market. The owner wants to resell it as a turnkey solution to other restaurateurs. This spec covers "Chunk 1": a blank, deployable template repo at `github.com/klinkragency/e-snack.git` with all Beldys branding removed and env-driven configuration.

Future chunks (not in scope):
- Chunk 2: Klinkragency admin control plane
- Chunk 3: Automated deployment orchestration (k8s or docker-compose multi-client)
- Chunk 4: Plugin / add-on system

## Architecture

### Repo layout

```
e-snack/
  api/                  Go backend (gRPC + REST gateway)
  www/                  Next.js 16 BFF (was frontendmvp/www/ in Beldys)
  docker-compose.yml    Single production compose file
  Caddyfile             Reverse proxy, TLS via Let's Encrypt, uses {$DOMAIN}
  .env.example          Full env var inventory with comments
  README.md             Step-by-step deployment guide
  .gitignore
```

### Deployment topology (per client)

Each client gets a fully isolated stack: Postgres, Redis, MinIO, Go API, Next.js frontend, Caddy — all in one docker-compose on a single VPS (or a directory on a shared VPS). No shared state between client deploys.

```
Client VPS
  docker-compose up -d
    ├── postgres:16-alpine
    ├── redis:7-alpine
    ├── minio (image uploads)
    ├── migrate (one-shot, applies SQL migrations)
    ├── api (Go binary, gRPC :50051, REST :8080)
    ├── frontend (Next.js, port 3000)
    └── caddy (TLS on {$DOMAIN}, reverse proxy)
```

### Deploy flow

```bash
git clone github.com/klinkragency/e-snack.git chez-mario
cd chez-mario
cp .env.example .env    # fill in DOMAIN, secrets, INITIAL_* vars
docker compose up -d    # Caddy gets TLS cert, API seeds admin + restaurant
# Admin logs in at https://{DOMAIN}/admin
```

## Mono-restaurant model

The DB schema remains multi-restaurant (no FK changes), but the admin UI is simplified for the single-restaurant case:

- `/admin/restaurants` page: if only 1 restaurant exists, auto-redirect to `/admin/restaurants/[id]/menu`
- Admin nav: "Restaurants" link replaced by direct "Menu" / "Mon restaurant" links when count = 1
- Order filters: auto-select the only restaurant, hide the dropdown
- Detection is runtime (fetch restaurant count on mount), not build-time. If someone adds a second restaurant, the multi-restaurant UI reappears naturally.

## Env vars

### Tier 1 — Required (stack won't start without)

| Var | Purpose |
|-----|---------|
| `DOMAIN` | Public domain for Caddy TLS |
| `PUBLIC_URL` | Full public URL (https://{DOMAIN}) |
| `POSTGRES_USER/PASSWORD/DB` | Database credentials |
| `JWT_SECRET` | JWT signing key |
| `COOKIE_SECRET` | Next.js cookie encryption |
| `BACKEND_URL` | Internal API URL for Next.js SSR (http://api:8080) |

### Tier 2 — Seed (required on first boot only)

| Var | Purpose |
|-----|---------|
| `INITIAL_ADMIN_EMAIL` | First admin account email |
| `INITIAL_ADMIN_PASSWORD` | First admin password (hashed at creation) |
| `INITIAL_ADMIN_NAME` | Display name |
| `INITIAL_RESTAURANT_NAME` | Restaurant name |
| `INITIAL_RESTAURANT_SLUG` | URL slug |

### Tier 3 — Highly recommended

| Var | Purpose |
|-----|---------|
| `MOLLIE_API_KEY` | Online payments (without: on-site only) |
| `RESEND_API_KEY` or `SMTP_*` | Email (OTP, confirmations) |
| `MINIO_ROOT_USER/PASSWORD` | Image uploads |

### Tier 4 — Optional (feature-gated by presence)

| Var | Feature unlocked |
|-----|-----------------|
| `OPENAI_API_KEY` | AI menu import button in admin |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET` | "Sign in with Google" |
| `APPLE_OAUTH_CLIENT_ID` | "Sign in with Apple" |
| `TELEGRAM_BOT_TOKEN` | Driver Telegram notifications |
| `POSTHOG_KEY/HOST` | Analytics dashboard |
| `SENTRY_DSN` | Error tracking |

**No `APP_NAME` env var.** The app-level branding (browser title, favicon, email from-name, OG tags) is derived from the `restaurants` row in DB — single source of truth, editable via admin UI.

## First-boot seed logic

Location: `api/cmd/server/main.go`, runs after migrations.

```
if COUNT(users WHERE role='admin') == 0 AND INITIAL_ADMIN_EMAIL is set:
  1. Create admin user (email, hashed password, name, role=admin, email_verified=true)
  2. Create restaurant (name, slug, is_active=true, position=0)
  3. Create default customization (colors=#000/#FFF, font=Inter, theme=light)
  4. Log "Admin + restaurant seeded"
else:
  skip silently
```

Idempotent. Safe to leave INITIAL_* vars in .env permanently.

## Strip list

### Files excluded from copy

- `mobile/` — out of scope
- All `CLAUDE.md`, `.clauderules`, `.claude/`, `.mcp.json` — IDE/AI config
- `.github/copilot-instructions.md` — Beldys-specific
- Dev artifacts: `api/roadmap.md`, `api/CHANGELOG_OTP.md`, `api/OTP_IMPLEMENTATION_SUMMARY.md`, `api/docs/OTP_SYSTEM_GUIDE.md`, `api/2026-02-07-*.txt`, `api/scripts/test_otp_system.sh`, `api/start.sh`, `api/stop.sh`
- `api/docker-compose.yml` — dev-only compose (template has single file)

### Text replacements

| Location | From | To |
|----------|------|----|
| Container names | `beldys-*` | `esnack-*` |
| Caddyfile host | `beldys.fr` | `{$DOMAIN}` |
| Go logs/banner | "Beldys" | "e-Snack" or neutral |
| Upload bucket | hardcoded `beldys` | `{MINIO_BUCKET}` env var |
| Payment description | `"Beldys Commande #"` | `"{restaurant.name} Commande #"` |
| Email templates | "Beldys" in subject/body | `{restaurant.name}` dynamic |
| OpenAPI title | "Beldys Club API" | "e-Snack API" |
| Next.js metadata | "Beldys" | derived from restaurant DB row |
| Promo service texts | "Beldys" | `{restaurant.name}` |

### New files

| File | Content |
|------|---------|
| `README.md` | Deployment guide (prereqs, clone, .env, compose up, DNS, first login) |
| `.env.example` | Full tier 1-4 inventory with comments |
| Seed logic in `main.go` | Auto-create admin + restaurant on first boot |

### UI additions

- Restaurant page (`/restaurant/[slug]`): if `categories.length === 0`, show "Menu en cours de preparation" placeholder instead of blank
- Admin nav: runtime mono-restaurant detection and link simplification

## Feature gating strategy

All features from Beldys are preserved. Optional features degrade gracefully:

| Missing env var | UI behavior |
|----------------|-------------|
| `OPENAI_API_KEY` | "Importer JSON via IA" button hidden in admin |
| `GOOGLE_OAUTH_CLIENT_ID` | Google login button hidden |
| `APPLE_OAUTH_CLIENT_ID` | Apple login button hidden |
| `TELEGRAM_BOT_TOKEN` | Telegram module hidden |
| `POSTHOG_KEY` | No analytics events sent |
| `SENTRY_DSN` | No error tracking |
| `MOLLIE_API_KEY` | Only "paiement sur place" available at checkout |

No code removed, no features stripped. Each feature's visibility is conditional on its key being present.

## Success criteria

1. Repo clonable + deployable in <5 min on a fresh VPS with Docker
2. Zero mentions of "Beldys" anywhere in code, emails, logs, UI, meta tags
3. `.env.example` is self-sufficient for a developer who hasn't seen the project
4. First-boot seed works: admin + restaurant exist after initial `docker compose up`
5. Mono-restaurant admin flow is seamless: auto-redirect, no empty list page
6. All features work: orders (delivery/pickup/dine-in), Mollie, OTP email, uploads, admin CRUD, organizer modal, promo codes, driver tracking
7. Optional features degrade without errors when their env var is empty
8. `go build ./...` and `npx tsc --noEmit` pass cleanly
9. Empty menu shows "Menu en cours de preparation" to visitors

## Non-goals

- Control plane, k8s orchestration, plugin system (Chunks 2-4)
- Mobile app (Expo) — future upsell
- Guided onboarding wizard for restaurateurs
- Multi-language support
- New test suite (existing tests are copied as-is)
- Auto-update mechanism for client deploys
- End-user documentation
