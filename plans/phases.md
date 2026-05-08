# Archon Marketplace — Phase Summary

**Last updated:** 2026-05-08
**Companion docs:** [`PRD.md`](./PRD.md), [`production-roadmap.md`](./production-roadmap.md)

A flat, scannable index of every feature to plan, grouped by phase. For full context, rationale, and validation criteria see the PRD and roadmap.

---

## Phase 1 — Astro frontend migration *(2–3 days)*

- Astro project scaffold with `@astrojs/react` + Tailwind v4
- Port pages to file-based routing (`index`, `submit`, `admin/*`, `workflows/[owner]/[repo]`)
- React components as hydrated islands with correct `client:*` directives
- `BaseLayout.astro` with inline theme bootstrap (no light/dark flash)
- `VITE_API_URL` → `PUBLIC_API_URL` rename across code, compose, Dockerfile, CI
- Build pipeline swap (Vite → Astro) in root `Dockerfile` and `apps/frontend/Dockerfile`

## Phase 2 — Stop the bleeding *(1–2 days)*

- OAuth callback redirect via env var (no hardcoded `localhost:5173`)
- `GET /workflows` filters to `PUBLISHED` for non-admins
- Leaderboard fetches real API (drop `DUMMY_WORKFLOWS`)
- Secrets moved to `.env` + `.env.example`
- Postgres-backed sessions via `connect-pg-simple`
- Delete dead components (`Hero.tsx`, `WorkflowCard.tsx`)

## Phase 3 — Allowlist + auto-approve *(2–3 days)*

- `Allowlist` + `AllowlistAuditLog` Prisma models
- OAuth post-login hook: auto-set `submissionStatus=APPROVED` if allowlisted
- Removal reconciler: demote `submissionStatus` when removed
- Admin allowlist UI: search, paginated list, single-add, CSV/newline bulk import, remove
- GitHub username validation against API before persist
- Submission UI: "members only" messaging for non-allowlisted users

## Phase 4 — GitHub App for sync + webhooks *(3–5 days)*

- Register GitHub App; private key as secret
- Add `installation_id` to `Workflow`
- Submission flow: redirect to App install → callback links installation
- Sync worker uses installation tokens (replace PAT)
- `POST /webhooks/github` with HMAC verification
  - `push` → enqueue re-scan
  - `installation.deleted` / `installation_repositories.removed` → quarantine
- Sync worker detects YAML `version` bump → enqueue re-scan
- Admin "Re-scan" button per workflow
- Postgres `ScanJob` queue with `SELECT FOR UPDATE SKIP LOCKED`

## Phase 5 — Real sandboxed dynamic analysis *(1–2 weeks; blocked on Archon scan-mode)*

- gVisor (`runsc`) host install + Docker runtime registration
- `scanner-sandbox` image: Archon runtime + stubbed `claude` binary + no network tools + non-root + read-only rootfs
- New `apps/scanner` workspace
- **Stage 1 SAST (expanded):**
  - Strict YAML schema validation
  - Secret detection (regex + Shannon entropy)
  - Bash AST taint analysis (prompt-output → bash-input flows)
  - Prompt-injection signature library
- **Stage 2 dynamic execution:**
  - `docker run --runtime=runsc --network=none --read-only --tmpfs /tmp ...`
  - 30s wall-clock timeout
  - Capture: syscall trace, fs writes, network attempts, exit code, structured findings
- Score-based gating: ≥80 PUBLISHED, 50–79 QUARANTINED, <50 REJECTED
- Auto-quarantine on re-scan score regression
- Reproducibility verification (same YAML → identical findings)

## Phase 6 — Notifications *(2–3 days)*

- Admin pending-review queue (`/admin/queue`)
- Per-workflow timeline page (submitted → scanning → published → re-scanned → quarantined → resolved)
- Status badges on leaderboard rows
- GitHub issue auto-post on scan failure (idempotent — comment if already open)
- Auto-comment-and-close on resolution

## Phase 7 — Production hardening *(3–5 days)*

- `express-rate-limit` on auth, submission, webhook, telemetry endpoints
- CSRF (origin check + `SameSite=Strict`)
- `helmet` security headers + CSP
- Body size caps (request 64KB, YAML 64KB)
- `pino` structured logging with correlation IDs through scan jobs
- `/healthz` + `/readyz` endpoints
- Yank flow (admin): `status=REJECTED` + `yankedReason`
- TOS / Privacy / Abuse-report static pages
- `POST /telemetry/install` endpoint (rate-limited, idempotent per `installId`)
- `GET /workflows/:owner/:repo` returns **451** if QUARANTINED/REJECTED (CLI install gate)
- Postgres backup strategy documented

## Phase 8 — Local-host friendly deployment *(1–2 days)*

- `docker-compose.local.yml` with sane defaults
- `.env.example` documenting every variable
- Cloudflared/ngrok setup notes for OAuth + webhook callbacks
- Per-environment config layering (`local` / `staging` / `prod`)
- "SAST-only" fallback mode for hosts without gVisor

---

## Cross-cutting

Items not tied to a single phase but worth tracking:

- Audit log infrastructure (used by allowlist, yank, re-scan, resolve)
- Submission API contract: `POST /workflows` returns `appInstallUrl` (Phase 3 + 4 boundary)
- CLI-side `archon add owner/repo` subcommand — open question, may be an upstream workstream against `coleam00/Archon`
