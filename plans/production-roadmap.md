# Production Roadmap — Archon Marketplace

Last updated: 2026-05-08

## Goal

Turn the current prototype into a production-ready marketplace, gated initially to **Dynamous members**, with full security scanning of every submission and re-scan on every workflow update.

## Decisions locked in

| Topic | Decision |
|---|---|
| Member gate | Manual admin allowlist of GitHub usernames (one-by-one + CSV bulk import) |
| Approval flow | Allowlisted users auto-approved on OAuth login |
| Auth | GitHub OAuth (existing) |
| GitHub access for sync/webhooks | GitHub App (replaces current PAT) |
| Security pipeline | SAST + real sandboxed dynamic analysis |
| Sandbox isolation | gVisor (`runsc` Docker runtime) |
| Re-scan triggers | (a) GitHub webhook on push, (b) periodic via sync worker, (c) manual admin button, (d) version field bump |
| Notifications | In-app + GitHub issue auto-posted on scan failure |
| Hosting (initial) | Local; production target deferred |
| Archon runtime | https://github.com/coleam00/Archon — wraps Claude Code |
| Dynamic analysis vs Claude API | **Stub Claude in sandbox** (no network egress). Bash/file/control-flow get real execution monitoring; prompt nodes get static analysis only. |

## Open questions parked for resolution

1. **Does the Archon runtime have a non-interactive scan mode?** (`archon run --headless --json workflow.yaml` or similar.) If not, we upstream a PR adding `--scan-mode`. Blocks Phase 5 only.
2. **Does the existing `archon` CLI have an `add owner/repo` subcommand?** If not, this becomes a separate upstream workstream. The marketplace can ship its CLI-facing API regardless.

## What's already built (do not redo)

- Monorepo (bun workspaces): `apps/frontend`, `apps/backend`, `apps/sync-worker`
- Postgres schema with all needed columns: `User.submissionStatus`, `Workflow.securityScore`, `Workflow.status`, `Workflow.securityReport`
- GitHub OAuth via passport-github2
- Admin endpoints to resolve users + workflows
- SAST scanner skeleton (secret regex, bash AST inspection, prompt inspection, score calculation)
- Sync worker container (hourly cron + initial sync); currently only updates timestamps, doesn't re-scan
- Frontend: skills.sh-inspired hero (ASCII logo + CLI box + leaderboard), light/dark toggle, Tailwind v4 (currently Vite + React SPA — migrating to Astro in Phase 1)

## Known gaps blocking real use

- OAuth callback redirect hardcoded to `http://localhost:5173` (frontend lives on `5175`)
- `GET /workflows` doesn't filter `status=PUBLISHED` — quarantined/rejected leak to public
- Frontend leaderboard renders `DUMMY_WORKFLOWS`, not real API data
- Secrets hardcoded in `docker-compose.yml` (`SESSION_SECRET`, DB password)
- Sessions are in-memory; lost on restart, can't horizontally scale
- Dynamic analysis stage is a placeholder (`alpine: echo "complete"`)
- No notifications anywhere
- No re-scan logic — sync worker only ingests
- No rate limiting, CSRF protection, input size caps, or security headers
- No CLI telemetry endpoint to increment `installCount`
- `Hero.tsx` and `WorkflowCard.tsx` exist but are no longer referenced after the redesign

---

## Phase 1 — Frontend migration to Astro *(2–3 days)*

**Goal:** Move `apps/frontend` from Vite + React SPA to Astro with React islands. Preserve current visuals + behavior; gain SSR-rendered shells, smaller JS payloads, and file-based routing.

- [ ] `bun create astro@latest` inside a temp dir, then port: copy `index.css`, `tailwind.config.js` content, and component tree into the new structure
- [ ] Add integrations: `@astrojs/react`, `@astrojs/tailwind` (or `@tailwindcss/vite` for Tailwind v4), TypeScript paths
- [ ] Convert `App.tsx` route map into Astro pages under `src/pages/`:
  - `index.astro` (landing + leaderboard island)
  - `submit.astro` (auth-gated submission form island)
  - `admin/index.astro`, `admin/allowlist.astro`, `admin/queue.astro`
  - `workflows/[owner]/[repo].astro` (detail page; static shell + interactive island for timeline)
- [ ] Wrap React components as islands with appropriate hydration directives:
  - `client:load` for header/theme toggle
  - `client:visible` for leaderboard, submission modal trigger
  - `client:idle` for admin widgets
- [ ] `BaseLayout.astro` with `<head>`, fonts, Tailwind import, and an inline theme-bootstrap script (read `localStorage.theme` before paint to avoid flash)
- [ ] Rename `VITE_API_URL` → `PUBLIC_API_URL` everywhere: `apps/frontend/src/lib/api.ts`, `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, root `Dockerfile` (build arg + ENV), `.github/workflows/deploy.yml`
- [ ] Update `apps/frontend/package.json`: replace `vite`/`@vitejs/plugin-react` with `astro` + `@astrojs/react` + `@astrojs/tailwind`; scripts become `astro dev` / `astro build` / `astro preview`
- [ ] Update `apps/frontend/Dockerfile` dev command to `bunx astro dev --host 0.0.0.0 --port 5175`
- [ ] Update root `Dockerfile`'s `frontend-builder` stage — output dir stays `dist/` so the `frontend` runtime stage continues to serve correctly
- [ ] Delete `vite.config.ts`, `tsconfig.node.json` (Astro provides its own `env.d.ts`), and `assets/vite.svg`
- [ ] Verify: visual parity light + dark; leaderboard fetches and renders; submission modal opens and POSTs; admin pages load; CORS still works (frontend origin unchanged on `:5175`)

**Done when:** `bun dev` brings up Astro on port 5175, all current pages render with parity, and the production Docker build succeeds end-to-end.

## Phase 2 — Stop the bleeding *(1–2 days)*

**Goal:** Fix everything currently broken or unsafe so the prototype is at least honest.

- [ ] OAuth callback redirect: read frontend URL from env var; remove `localhost:5173`
- [ ] `GET /workflows` filters to `status=PUBLISHED` for non-admin requests
- [ ] Frontend leaderboard fetches `/workflows` instead of dummy data
- [ ] Move all secrets to `.env`; reference via `${VAR}` in compose; document in `.env.example`
- [ ] Replace in-memory session store with `connect-pg-simple` against the existing Postgres
- [ ] Delete `apps/frontend/src/components/Hero.tsx` and `WorkflowCard.tsx` (unused after redesign)

**Done when:** A fresh clone + `docker compose up` produces a working marketplace where the leaderboard reflects DB state and only published workflows are visible to anonymous users.

## Phase 3 — Dynamous allowlist + auto-approve *(2–3 days)*

**Goal:** Only Dynamous members (per admin allowlist) can submit. Everyone else can browse but not submit.

- [ ] New Prisma model `Allowlist { githubUsername (unique), addedBy, addedAt, note? }`
- [ ] New Prisma model `AllowlistAuditLog { actorId, action (ADDED|REMOVED), targetUsername, at }`
- [ ] OAuth callback hook: on successful login, if `user.username` ∈ allowlist → set `submissionStatus = APPROVED`
- [ ] Cron-style reconciler: if a user is removed from allowlist, demote their `submissionStatus` back to `NONE`. Keeps existing published workflows live unless yanked.
- [ ] Admin UI under `/admin/allowlist`:
  - Search + paginated list with remove
  - Add single GitHub username
  - Bulk import textarea (newline/CSV separated; validate against GitHub user existence via App token before persisting)
- [ ] Drop "Request Access" UI from `SubmissionModal.tsx` — replace with a clear "Submission is currently limited to Dynamous members" message for non-allowlisted users

**Done when:** A non-allowlisted GitHub login sees a clear "members only" message; an allowlisted login sees the submit form immediately on first login. CSV import of 50 usernames takes seconds.

## Phase 4 — GitHub App for sync, webhooks, and re-scan *(3–5 days)*

**Goal:** Ditch the PAT. Get push-triggered re-scans for free. Make sync resilient to single-user PAT expiry.

- [ ] Register `Archon Marketplace` GitHub App (web UI step, manual)
- [ ] Store App private key as secret; add `installation_id` field to `Workflow`
- [ ] Submission flow: after metadata entered, redirect user to install the App on the target repo; on callback, link `installation_id` to the new `Workflow` row
- [ ] Replace `axios.get(raw.githubusercontent.com, {Authorization: PAT})` in sync service with installation-token-authenticated `octokit.rest.repos.getContent`
- [ ] New `POST /webhooks/github` endpoint:
  - HMAC verification using App webhook secret
  - On `push` affecting the workflow's `path` → enqueue re-scan job
  - On `installation.deleted` / `installation_repositories.removed` → quarantine affected workflows
- [ ] Sync worker: detect `version` field bump in `archon.yaml` between scans → enqueue re-scan
- [ ] Admin "Re-scan" button per workflow → enqueue re-scan job
- [ ] Postgres-backed job queue: new `ScanJob` table with `status (PENDING|RUNNING|DONE|FAILED)`, claim-via-`SELECT FOR UPDATE SKIP LOCKED` worker

**Done when:** Pushing a commit to a registered repo's `archon.yaml` triggers a webhook → re-scan job lands in queue → scan worker picks it up. (Even though the actual scan logic is still placeholder until Phase 5.)

## Phase 5 — Real sandboxed dynamic analysis *(1–2 weeks; blocked on Q1 above)*

**Goal:** Every submission and re-scan runs through real, isolated, deterministic dynamic analysis. Malicious bash/file/network behavior is caught and gated before publish.

**Blocker:** Need to confirm whether `archon` runtime has a non-interactive scan mode. If not, upstream PR to `coleam00/Archon` adding `archon scan workflow.yaml --json --stub-ai` (or equivalent).

### Host setup
- [ ] Install `runsc` (gVisor) on host
- [ ] Register as Docker runtime in `/etc/docker/daemon.json`
- [ ] Verify with `docker run --runtime=runsc alpine uname -a` shows gVisor signature

### Sandbox image
- [ ] Build `archon-marketplace/scanner-sandbox:latest`:
  - Minimal base (`alpine` or `distroless`)
  - Archon runtime CLI installed (`curl -fsSL https://archon.diy/install | bash`)
  - **Stubbed `claude` binary** in `$PATH` ahead of real one — returns canned/templated responses keyed by node id, deterministic, exits 0
  - No network tools (`curl`, `wget`, `nc` removed or never installed)
  - Non-root user, read-only rootfs except `/tmp`

### Scanner worker
- [ ] New `apps/scanner` workspace (separate container, separate scaling axis)
- [ ] Pulls jobs from `ScanJob` queue
- [ ] **Stage 1 (SAST, expanded):**
  - Bash AST taint analysis (track flows from prompt-output → bash-input)
  - Better secret detection (Shannon entropy + known-pattern checks)
  - Prompt-injection signature library (curated list of known-bad patterns)
  - Strict YAML schema validation
- [ ] **Stage 2 (Dynamic, real):**
  - `docker run --runtime=runsc --network=none --read-only --tmpfs /tmp:rw,size=64m --memory=256m --cpus=0.5 --pids-limit=64 --security-opt=no-new-privileges scanner-sandbox archon scan /workflow.yaml --json`
  - 30s wall-clock timeout (kill on overrun, mark TIMEOUT finding)
  - Captures: gVisor syscall logs, filesystem writes under `/tmp`, network-call attempts (gVisor sees these even with `--network=none`), exit code, structured findings from runtime
  - Findings if: tries to read `/etc/shadow`, `~/.ssh`, `/proc/*/environ`; writes outside `/tmp`; attempts DNS; fork bomb; runs more than `pids-limit`
- [ ] Persists `securityReport` JSON; updates `securityScore`; sets `status` per gate (≥80 PUBLISHED, 50–79 QUARANTINED, <50 REJECTED)
- [ ] On re-scan of a previously-PUBLISHED workflow: if new score < 80 → flip to QUARANTINED, fire notifications (Phase 6)

**Done when:** Submitting a known-malicious test workflow (e.g. one that tries `cat /etc/shadow`) reliably catches it and rejects with a structured finding. A clean reference workflow scores ≥90.

## Phase 6 — Notifications *(2–3 days)*

**Goal:** Authors and admins are kept in the loop without checking the dashboard.

- [ ] In-app:
  - Admin "Pending Review" queue at `/admin/queue` (combines pending users + quarantined workflows)
  - Per-workflow detail page showing full timeline (submitted → scanning → published → re-scanned → quarantined → …)
  - Status badges visible on leaderboard rows for verified / quarantined / pending
- [ ] GitHub issue auto-posting via the App:
  - On scan failure → `octokit.issues.create` on `owner/repo` titled `[Archon Marketplace] Security scan flagged archon.yaml`
  - Body includes: score, findings list with severity, link back to the marketplace submission detail page
  - On scan resolution → `octokit.issues.createComment` closing the issue
  - Idempotent: don't re-create if an open Archon-Marketplace issue already exists; comment instead

**Done when:** A test scan failure produces an issue on the author's repo within seconds. Resolving the scan auto-closes that issue.

## Phase 7 — Production hardening *(3–5 days)*

**Goal:** Safe to expose to the internet and let strangers POST things at it.

- [ ] `express-rate-limit` on `/auth/*`, `/workflows` POST, `/webhooks/github`, telemetry
- [ ] CSRF: `SameSite=Strict` session cookies + origin check on all state-changing endpoints (drop the `csurf` package — abandoned)
- [ ] `helmet` for security headers; CSP allowing only the bundled assets + Anthropic if needed in admin tools
- [ ] Body size limits: `express.json({ limit: '64kb' })`; YAML uploads capped at 64KB
- [ ] Structured logging with `pino`; correlation IDs propagated through scan jobs
- [ ] Health endpoints: `/healthz` (liveness, no deps), `/readyz` (DB + queue connectivity)
- [ ] Postgres backup strategy (depends on host; document for whoever picks the platform)
- [ ] "Yank" flow: admin button → `status = REJECTED` + `yankedReason`; surfaces "withdrawn by maintainer/security" to the CLI on next install attempt
- [ ] TOS, Privacy, and Abuse-report pages — required when accepting third-party code
- [ ] `POST /telemetry/install` endpoint for the CLI to ping; increments `installCount`; rate-limited per IP, idempotent per install ID

**Done when:** Penetration-test smoke (CSRF replay, oversized YAML, missing webhook signature, brute-force login) all return appropriate errors without crashing.

## Phase 8 — Local-host friendly dev/demo deployment *(1–2 days)*

**Goal:** Until a hosting target is picked, anyone can run the marketplace locally and demo it externally.

- [ ] `docker-compose.local.yml` with sane defaults + `.env.example` documenting every required variable
- [ ] `cloudflared` or `ngrok` setup notes — GitHub OAuth + GitHub App webhooks need a public callback URL even in local mode
- [ ] Per-environment config layering (`local`, `staging`, `prod`) so picking a host later is a config swap, not a rewrite
- [ ] Document the gVisor host requirement and how to skip dynamic analysis when running on a host without `runsc` installed (mark scans as `SAST_ONLY` and surface that in admin UI)

## Deferred past v1

These are good ideas but not blockers for "production-ready Dynamous-only marketplace":

- Multiple workflows per repo / monorepo (`path` field already supports it; needs UX)
- Workflow versioning + pinned-version installs
- Author profiles, categories, tags, search ranking
- Stars / comments
- Public API tokens for programmatic submission
- Egress-allowlist deep-scan tier (Option B/C from the AI-call decision)
- Migration from Postgres queue to Redis/BullMQ once scan volume justifies it
