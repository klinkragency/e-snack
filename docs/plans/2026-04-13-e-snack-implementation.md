# e-Snack Blank Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a deployable, Beldys-free food-ordering template at `/Users/moneyprinter/Documents/bara/e-snack/` and push it to `github.com/klinkragency/e-snack.git`.

**Architecture:** Copy `api/` and `frontendmvp/www/` from the Beldys repo (read-only — never modify Beldys), strip all branding, rename the Go module, add first-boot seed logic, simplify the admin for mono-restaurant, gate optional features by env var presence.

**Tech Stack:** Go 1.25, Next.js 16, React 19, PostgreSQL 16, Redis 7, Caddy 2, Docker Compose, protobuf/grpc-gateway.

**Critical constraint:** The Beldys codebase at `/Users/moneyprinter/Documents/bara/beldys/club/` is READ-ONLY. Never write, edit, or commit anything there.

---

## File Structure

```
e-snack/
├── api/
│   ├── cmd/server/main.go              # Entry point + seed logic (modified)
│   ├── internal/config/config.go       # Env parsing (modified: add INITIAL_* + MINIO_BUCKET)
│   ├── internal/server/grpc.go         # gRPC setup (strip beldys names)
│   ├── internal/server/gateway.go      # REST gateway (strip beldys names)
│   ├── internal/service/email/templates.go  # Dynamic restaurant name in emails
│   ├── internal/service/payment/service.go  # Dynamic payment description
│   ├── internal/service/upload/service.go   # Bucket from env
│   ├── proto/*/                        # Updated go_package paths
│   ├── gen/*/                          # Regenerated from proto (committed)
│   ├── go.mod                          # New module path
│   ├── Makefile                        # Kept as-is (paths unchanged)
│   ├── Dockerfile                      # Kept as-is
│   ├── migrations/                     # All kept as-is
│   └── docs/openapi.yaml              # Rebranded title
├── www/
│   ├── app/layout.tsx                  # Dynamic metadata from restaurant DB
│   ├── app/(app)/restaurant/[slug]/page.tsx  # Empty menu placeholder
│   ├── app/admin/restaurants/page.tsx  # Mono-restaurant redirect
│   ├── components/admin/              # Feature-gated buttons
│   ├── lib/                           # Stripped branding strings
│   ├── package.json                   # Kept as-is
│   └── next.config.ts                 # Image domains cleaned
├── docker-compose.yml                 # Single prod-ready compose
├── Caddyfile                          # {$DOMAIN} parameterized
├── .env.example                       # Full tiered inventory
├── .gitignore                         # Tracks gen/, ignores .env, node_modules, .next
└── README.md                          # Deployment guide
```

---

## Task 1: Scaffold repo from Beldys source

**Files:**
- Create: entire `e-snack/api/`, `e-snack/www/`, `e-snack/.gitignore`
- Source (read-only): `/Users/moneyprinter/Documents/bara/beldys/club/`

- [ ] **Step 1: Copy api/ and www/ with exclusions**

```bash
cd /Users/moneyprinter/Documents/bara

# Copy api/ excluding dev artifacts
rsync -a --exclude='node_modules' --exclude='.git' \
  --exclude='start.sh' --exclude='stop.sh' \
  --exclude='docker-compose.yml' \
  --exclude='roadmap.md' --exclude='CHANGELOG_OTP.md' \
  --exclude='OTP_IMPLEMENTATION_SUMMARY.md' \
  --exclude='2026-02-07-implement-the-following-plan.txt' \
  --exclude='.clauderules' --exclude='CLAUDE.md' \
  --exclude='QUICK_START.md' \
  beldys/club/api/ e-snack/api/

# Copy frontend as www/
rsync -a --exclude='node_modules' --exclude='.next' \
  --exclude='CLAUDE.md' \
  beldys/club/frontendmvp/www/ e-snack/www/

# Copy infra files
cp beldys/club/docker-compose.prod.yml e-snack/docker-compose.yml
cp beldys/club/Caddyfile e-snack/Caddyfile
```

- [ ] **Step 2: Create .gitignore**

```gitignore
# Environment
.env
.env.local
*.local.env

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Node
node_modules/

# Next.js
.next/

# Go
/api/bin/

# Claude / AI
.claude/
.mcp.json
CLAUDE.md
```

Note: `api/gen/` is NOT ignored — it must be committed since the Dockerfile doesn't regenerate proto.

- [ ] **Step 3: Verify copy is complete**

```bash
ls e-snack/api/cmd/server/main.go
ls e-snack/www/app/layout.tsx
ls e-snack/docker-compose.yml
ls e-snack/Caddyfile
```

- [ ] **Step 4: Commit**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack
git add -A
git commit -m "chore: scaffold e-snack from base codebase"
```

---

## Task 2: Rename Go module path

**Files:**
- Modify: `api/go.mod`, all `*.go` files, all `*.proto` files
- Regenerate: `api/gen/`

- [ ] **Step 1: Update go.mod module path**

In `api/go.mod`, change:
```
module github.com/beldys/api
```
to:
```
module github.com/klinkragency/e-snack
```

- [ ] **Step 2: Replace all Go import paths**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/api
# Replace in all .go files
find . -name '*.go' -exec sed -i '' 's|github.com/beldys/api|github.com/klinkragency/e-snack|g' {} +
```

- [ ] **Step 3: Update proto go_package options**

```bash
find . -name '*.proto' -exec sed -i '' 's|github.com/beldys/api|github.com/klinkragency/e-snack|g' {} +
```

- [ ] **Step 4: Regenerate proto**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/api
PATH="$HOME/go/bin:$PATH" make proto
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/api
go build ./...
```
Expected: EXIT 0

- [ ] **Step 6: Commit**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack
git add -A
git commit -m "chore: rename Go module to github.com/klinkragency/e-snack"
```

---

## Task 3: Strip Beldys branding — Go backend

**Files:**
- Modify: `api/cmd/server/main.go`, `api/internal/server/grpc.go`, `api/internal/server/gateway.go`, `api/internal/config/config.go`, `api/internal/service/upload/service.go`, `api/internal/service/payment/service.go`, `api/internal/service/promo/service.go`, `api/internal/service/email/templates.go`, `api/docs/openapi.yaml`, `api/.env.example`

- [ ] **Step 1: Grep for remaining "beldys" / "Beldys" occurrences**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/api
grep -ri "beldys" --include='*.go' --include='*.yaml' --include='*.env*' -l
```

- [ ] **Step 2: Replace branding strings in Go files**

Use targeted sed replacements (case-sensitive) across all Go files:
- `"Beldys"` → `"e-Snack"` (in log/banner strings)
- `"beldys"` → `"esnack"` (in identifiers like bucket names)
- `beldys.fr` → remove or parameterize (should already be via PUBLIC_URL env)

For `payment/service.go`: replace `"Beldys Commande #%s"` with a dynamic format that reads the restaurant name from the order's restaurant.

For `email/templates.go`: replace hardcoded "Beldys" in email subject/body with a `restaurantName` parameter passed from the service layer.

For `upload/service.go`: replace hardcoded bucket name with `os.Getenv("MINIO_BUCKET")` with fallback `"uploads"`.

- [ ] **Step 3: Update openapi.yaml title**

Replace `"Beldys Club API"` with `"e-Snack API"` in the `info:` block.

- [ ] **Step 4: Clean up .env.example**

Delete the Beldys-specific `.env.example` — it will be replaced by the root-level `.env.example` in Task 6.

- [ ] **Step 5: Verify**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/api
grep -ri "beldys" --include='*.go' --include='*.yaml' --include='*.proto'
# Expected: 0 matches
go build ./...
# Expected: EXIT 0
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: strip Beldys branding from Go backend"
```

---

## Task 4: Strip Beldys branding — Frontend

**Files:**
- Modify: `www/app/layout.tsx`, `www/next.config.ts`, any component/page/lib file containing "Beldys"

- [ ] **Step 1: Find all occurrences**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/www
grep -ri "beldys" --include='*.ts' --include='*.tsx' --include='*.json' -l
```

- [ ] **Step 2: Replace branding strings**

- Layout metadata: replace hardcoded "Beldys" title with a dynamic fetch of the restaurant name (server component) or a neutral fallback `"e-Snack"`.
- `next.config.ts`: review image domains whitelist — keep only what's needed (MinIO/uploads domain).
- Components/pages: replace any "Beldys" text with generic equivalents or `restaurant.name` references.
- `package.json`: if `"name"` field says `"beldys"`, change to `"e-snack"`.

- [ ] **Step 3: Verify**

```bash
grep -ri "beldys" --include='*.ts' --include='*.tsx' --include='*.json'
# Expected: 0 matches
cd /Users/moneyprinter/Documents/bara/e-snack/www
npm install
npx tsc --noEmit
# Expected: EXIT 0
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: strip Beldys branding from frontend"
```

---

## Task 5: Strip Beldys branding — Infra files

**Files:**
- Modify: `docker-compose.yml`, `Caddyfile`

- [ ] **Step 1: Parameterize docker-compose.yml**

- Replace all `beldys-` container/volume/network names with `esnack-`
- Ensure env vars reference `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB}` etc.
- Remove any hardcoded Beldys-specific values
- Make sure the `migrate` service uses the correct image paths

- [ ] **Step 2: Parameterize Caddyfile**

Replace `beldys.fr` with `{$DOMAIN}` (Caddy's native env var syntax). Keep all routing rules (`/uploads/*` → minio, `/ws/*` and `/api/v1/*` → api, `*` → frontend) identical.

- [ ] **Step 3: Verify no remaining "beldys" in infra**

```bash
grep -i "beldys" docker-compose.yml Caddyfile
# Expected: 0 matches
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: parameterize infra files, strip Beldys references"
```

---

## Task 6: Create .env.example + README.md

**Files:**
- Create: `.env.example`, `README.md`

- [ ] **Step 1: Write .env.example**

Full tiered inventory as specified in the design spec Section 2. Include comments explaining each tier and which vars are optional.

- [ ] **Step 2: Write README.md**

Deployment guide covering:
1. Prerequisites (VPS with Docker + Docker Compose, domain pointing to VPS IP)
2. Clone repo
3. Copy and fill `.env`
4. `docker compose up -d`
5. DNS setup + Caddy auto-TLS
6. First admin login at `https://{DOMAIN}/admin`
7. Post-deploy: upload logo, fill menu, configure Mollie

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add .env.example and deployment README"
```

---

## Task 7: First-boot seed logic

**Files:**
- Modify: `api/cmd/server/main.go`, `api/internal/config/config.go`

- [ ] **Step 1: Add INITIAL_* vars to config**

In `config.go`, add fields:
```go
InitialAdminEmail    string `envconfig:"INITIAL_ADMIN_EMAIL"`
InitialAdminPassword string `envconfig:"INITIAL_ADMIN_PASSWORD"`
InitialAdminName     string `envconfig:"INITIAL_ADMIN_NAME"`
InitialRestaurantName string `envconfig:"INITIAL_RESTAURANT_NAME"`
InitialRestaurantSlug string `envconfig:"INITIAL_RESTAURANT_SLUG"`
MinioBucket          string `envconfig:"MINIO_BUCKET" default:"uploads"`
```

- [ ] **Step 2: Add seed function**

In `main.go` (or a new `internal/seed/seed.go`), after migrations run:
```go
func seedInitialData(db *sql.DB, cfg *config.Config) {
    var count int
    db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count)
    if count > 0 || cfg.InitialAdminEmail == "" {
        return
    }
    // Hash password
    // INSERT user (admin, email_verified=true)
    // INSERT restaurant (name, slug, is_active=true, position=0)
    // INSERT customization (defaults)
    log.Println("✅ Initial admin and restaurant seeded")
}
```

- [ ] **Step 3: Call seed after migrations in main.go**

Add `seedInitialData(db, cfg)` right after the migration runner completes.

- [ ] **Step 4: Verify**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/api
go build ./...
# Expected: EXIT 0
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: auto-seed admin + restaurant on first boot from env vars"
```

---

## Task 8: Mono-restaurant admin UI

**Files:**
- Modify: `www/app/admin/restaurants/page.tsx`, `www/app/admin/orders/page.tsx` (or layout)

- [ ] **Step 1: Auto-redirect on /admin/restaurants**

In `www/app/admin/restaurants/page.tsx`, add a `useEffect`: if the fetched restaurants list has exactly 1 entry, `router.replace(/admin/restaurants/${id}/menu)`.

- [ ] **Step 2: Auto-select restaurant in orders filter**

In `www/app/admin/orders/page.tsx`, if only 1 restaurant, auto-select it and hide the restaurant dropdown filter.

- [ ] **Step 3: Verify**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/www
npx tsc --noEmit
# Expected: EXIT 0
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: mono-restaurant admin — auto-redirect and auto-select"
```

---

## Task 9: Feature gating for optional env vars

**Files:**
- Modify: `www/app/admin/restaurants/[id]/menu/page.tsx` (AI import button), `www/app/authentification/page.tsx` (OAuth buttons), frontend PostHog/Sentry init files

- [ ] **Step 1: Gate AI import behind OPENAI key**

The AI import button in the admin menu page should only render if a `NEXT_PUBLIC_OPENAI_ENABLED=true` env var is set (we don't expose the actual key to the frontend — just a boolean flag).

- [ ] **Step 2: Gate OAuth buttons behind provider keys**

The login/register page's Google/Apple buttons should only render if `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` / `NEXT_PUBLIC_APPLE_OAUTH_ENABLED=true`.

- [ ] **Step 3: Conditional PostHog / Sentry init**

PostHog and Sentry client-side init should check for `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_SENTRY_DSN` before initializing. If empty, skip silently.

- [ ] **Step 4: Verify**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/www
npx tsc --noEmit
# Expected: EXIT 0
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: gate optional features by env var presence"
```

---

## Task 10: Empty menu placeholder UX

**Files:**
- Modify: `www/app/(app)/restaurant/[slug]/page.tsx`

- [ ] **Step 1: Add empty-state when no categories**

After the categories are loaded, if `categories.length === 0`, render a placeholder message instead of a blank products section:

```tsx
{categories.length === 0 && (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <p className="text-lg font-medium" style={{ color: "var(--restaurant-text)" }}>
      Menu en cours de preparation
    </p>
    <p className="mt-2 text-sm" style={{ color: "var(--restaurant-muted)" }}>
      Revenez bientot !
    </p>
  </div>
)}
```

- [ ] **Step 2: Verify**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/www
npx tsc --noEmit
# Expected: EXIT 0
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: show placeholder message when menu is empty"
```

---

## Task 11: Final validation

- [ ] **Step 1: Full grep for any remaining "beldys" references**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack
grep -ri "beldys" --include='*.go' --include='*.ts' --include='*.tsx' --include='*.yaml' --include='*.yml' --include='*.json' --include='*.proto' --include='Caddyfile' --include='Dockerfile'
# Expected: 0 matches
```

- [ ] **Step 2: Go build + vet**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/api
go build ./...
go vet ./...
# Expected: both EXIT 0
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack/www
npx tsc --noEmit
# Expected: EXIT 0
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve validation issues" --allow-empty
```

---

## Task 12: Push to GitHub

- [ ] **Step 1: Add remote and push**

```bash
cd /Users/moneyprinter/Documents/bara/e-snack
git remote add origin https://github.com/klinkragency/e-snack.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Verify on GitHub**

Confirm the repo is populated at `https://github.com/klinkragency/e-snack`.
