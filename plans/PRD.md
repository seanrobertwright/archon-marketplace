# Archon Marketplace — Product Requirements Document

**Version:** 0.1 (MVP scope)
**Last updated:** 2026-05-07
**Status:** Draft — based on prototype audit and brainstorm session
**Companion docs:** [`production-roadmap.md`](./production-roadmap.md), [`archon-marketplace.md`](./archon-marketplace.md)

---

## 1. Executive Summary

Archon Marketplace is the discovery, distribution, and security layer for [Archon](https://github.com/coleam00/Archon) — an open-source AI coding harness that wraps Claude Code. The marketplace lets developers publish reusable Archon workflows (YAML definitions describing multi-step AI coding flows) and lets other developers find and install them with a single CLI command (`archon add owner/repo`).

The core problem the marketplace solves is **trust**. Archon workflows are executable code that runs against a developer's project — they can read source, run shell commands, and call AI models. Pulling a workflow from a stranger's GitHub repo is meaningfully riskier than pulling a regular npm package because workflows blend bash execution with prompt injection surface. Without a vetted middle layer, the ecosystem cannot grow.

**MVP goal:** Ship a Dynamous-members-only marketplace where every submitted workflow is automatically run through static analysis and a sandboxed dynamic analysis pipeline (gVisor isolation, stubbed Claude API, full syscall/network/filesystem monitoring). Workflows scoring below threshold are quarantined for admin review or rejected outright. Re-scans fire on every push to the source repo. The path from "Dynamous member submits a repo" to "verified-safe workflow appears on the leaderboard" is fully automated.

---

## 2. Mission

**Mission statement:** Make Archon workflows discoverable and safe to install, so the open agent ecosystem can compound without each developer having to audit every workflow themselves.

**Core principles:**

1. **Zero-trust by default.** Every workflow, every version, gets scanned. Trusted authors don't skip the gate.
2. **Reproducible scans.** Two scans of the same workflow produce the same findings. No live LLM nondeterminism in the pipeline.
3. **Transparent verdicts.** Every quarantine or rejection produces a structured, human-readable report posted back to the author's repo as a GitHub issue.
4. **Member-gated growth.** Submission rights are deliberately scarce in v1. Quality control before scale.
5. **The CLI is the product.** The web marketplace is a discovery surface; the actual install path is `archon add owner/repo` from a developer's terminal.

---

## 3. Target Users

### Primary persona: **Workflow Author** (Dynamous member)

- AI-assisted developer who has built a useful Archon workflow (e.g. issue triage, schema → API generator, codebase audit) and wants to share it.
- Comfortable with GitHub, CLI tools, and YAML.
- Wants: a low-friction submit flow, fast scan turnaround, clear feedback when something's flagged, and credit visible on a leaderboard.
- Pain today: no distribution channel; sharing workflows means linking to a gist in Discord.

### Primary persona: **Workflow Installer** (any Archon CLI user)

- Developer using the Archon CLI who wants to install a vetted workflow into their project.
- Doesn't want to audit untrusted YAML by hand before running it against their repo.
- Wants: searchable catalog, security badges, install command they can copy-paste.
- Pain today: copy-pasting workflows from random repos with no idea whether they're safe.

### Secondary persona: **Marketplace Admin** (Dynamous moderator)

- Manages the allowlist (who can submit), reviews quarantined workflows, handles abuse reports.
- Wants: a low-noise queue of things needing human attention, audit trail of past decisions, ability to yank a published workflow when something turns up later.
- Pain today: this role doesn't exist yet because the marketplace doesn't exist.

### Secondary persona: **Dynamous Community Lead**

- Wants Archon usage to grow within the community before opening to the public.
- Wants visibility into what's being submitted, what's being installed, and any security incidents.

---

## 4. MVP Scope

### ✅ In Scope (Core Functionality)

- ✅ GitHub OAuth signin
- ✅ Admin-managed allowlist of Dynamous member GitHub usernames (single-add + CSV bulk import)
- ✅ Auto-approval of allowlisted users on first login
- ✅ Workflow submission via owner/repo + path
- ✅ Public leaderboard of `PUBLISHED` workflows (rank, name, install count, security badge)
- ✅ Search across workflow name, description, owner, repo
- ✅ Workflow detail page with security report timeline
- ✅ Light/dark theme
- ✅ Admin dashboard: allowlist mgmt, pending review queue, audit log

### ✅ In Scope (Technical)

- ✅ Static analysis (SAST):
  - Strict YAML schema validation
  - Hardcoded secret detection (regex + entropy)
  - Bash AST inspection with taint analysis (track flows from prompt-output → bash-input)
  - Prompt-injection signature library
- ✅ Dynamic sandboxed analysis:
  - gVisor (`runsc`) Docker runtime
  - Stubbed `claude` binary (no live LLM calls during scan)
  - No network egress, read-only rootfs except `/tmp`, memory + CPU + PID + wall-clock limits
  - Captures: syscall trace, filesystem writes, attempted network calls, exit code
- ✅ Scoring + auto-gating: ≥80 PUBLISHED, 50–79 QUARANTINED, <50 REJECTED
- ✅ Re-scan triggers: GitHub App push webhook, hourly periodic re-scan, manual admin button, version field bump in YAML
- ✅ Auto-quarantine on re-scan score regression with author notification

### ✅ In Scope (Integration)

- ✅ GitHub App for sync + webhooks (replaces current PAT)
- ✅ In-app notifications (queue + status badges + per-workflow timeline)
- ✅ GitHub issue auto-posting on scan failure (and auto-resolution on re-scan pass)
- ✅ CLI telemetry endpoint (`POST /telemetry/install`) for incrementing `installCount`

### ✅ In Scope (Deployment)

- ✅ Docker Compose for local development with all services
- ✅ Production-ready Dockerfile and `docker-compose.prod.yml`
- ✅ Caddy reverse proxy for SSL termination
- ✅ Documented `.env` requirements
- ✅ Cloudflared/ngrok instructions for local OAuth + webhook testing

### ❌ Out of Scope (Deferred)

- ❌ Anyone-can-request-access flow (members-only in v1)
- ❌ Multiple workflows per repo / monorepo discovery (schema supports `path`, no UX)
- ❌ Workflow versioning + pinned-version installs (`version` field stored, not enforced)
- ❌ Author profiles, categories, tags, advanced search ranking
- ❌ Stars / comments / community engagement features
- ❌ Programmatic submission API tokens
- ❌ Egress-allowlist deep-scan tier (real LLM calls during scan)
- ❌ Email/SMS notifications (in-app + GitHub issue only)
- ❌ Production hosting target (deferred decision; runs locally for now)
- ❌ Horizontal scaling / Redis-backed queue (Postgres queue is fine for v1 volume)
- ❌ Public abuse reporting flow with non-author reporters

---

## 5. User Stories

### Primary stories

**S1.** As a **Dynamous member with a workflow to share**, I want to sign in with GitHub and submit my repo, so that other Archon users can discover and install my work without me distributing it manually.
> *Example:* `kelsey` has built `kelsey/db-schema-to-api`. She signs in, fills "owner: kelsey, repo: db-schema-to-api, path: archon.yaml", clicks Submit. Within ~60 seconds she sees "Verified Safe — 92/100" on the leaderboard.

**S2.** As an **Archon CLI user**, I want to browse a vetted leaderboard, so that I can find a high-quality workflow for my problem without hand-auditing YAML from strangers.
> *Example:* User searches "code review" on the marketplace, finds a workflow with score 95 and 12k installs, copies `archon add owner/repo`, runs it locally.

**S3.** As a **workflow author**, I want my workflow to be re-scanned automatically when I push updates, so that I don't need to remember to manually trigger a re-evaluation after every change.
> *Example:* `kelsey` pushes a fix to her workflow. The GitHub App webhook fires, scanner picks up the new YAML, re-scores at 90, status stays `PUBLISHED`. She gets a "re-scan complete" entry in her workflow's timeline.

**S4.** As a **workflow author whose update introduced a problem**, I want the marketplace to quarantine the workflow and tell me what's wrong, so that installers aren't exposed and I can fix it.
> *Example:* `kelsey` accidentally introduces an `eval $REMOTE_INPUT` pattern. Re-scan drops score to 35, status flips to `QUARANTINED`. The marketplace opens an issue on her repo titled "[Archon Marketplace] Security scan flagged archon.yaml" with the specific finding and a link to the marketplace timeline.

**S5.** As a **marketplace admin**, I want a single queue of things needing my attention, so that I can review quarantined workflows and pending allowlist requests without clicking through the whole site.
> *Example:* Admin opens `/admin/queue`, sees 3 quarantined workflows and 2 allowlist requests, dispositions each in <2 minutes.

**S6.** As a **Dynamous community lead onboarding new members**, I want to bulk-add 30 GitHub usernames to the allowlist, so that I don't have to type them one at a time.
> *Example:* Lead pastes a newline-separated list of usernames into the bulk import textarea, the system validates each against GitHub, persists them, and the new members are auto-approved on their next login.

**S7.** As an **anonymous visitor (not yet a Dynamous member)**, I want to browse the marketplace and see what workflows exist, so that I can decide whether to ask about Dynamous membership.
> *Example:* Visitor lands on the home page, sees the leaderboard and verified workflows, sees a clear "Submission is currently limited to Dynamous members" message in place of the submit button.

**S8.** As a **marketplace admin**, I want to yank a published workflow when an external report indicates it's malicious, so that I can stop installs in flight even if our automated pipeline missed something.
> *Example:* Admin receives a Discord report about `bad-actor/sneaky-tool`. Opens its detail page, clicks "Yank", enters reason, status flips to `REJECTED`. The CLI telemetry endpoint will warn next install attempt.

### Technical / system stories

**T1.** As **the scanner worker**, I want to claim jobs from the queue using `SELECT FOR UPDATE SKIP LOCKED`, so that multiple worker instances can run safely without double-processing.

**T2.** As **the GitHub App**, I want to verify webhook signatures, so that the re-scan trigger can't be forged by anyone with the endpoint URL.

**T3.** As **the sync worker**, I want to detect a `version` field bump between successive YAML fetches, so that I can enqueue a re-scan even when push webhooks aren't reaching us.

---

## 6. Core Architecture & Patterns

### High-level architecture

```
                    ┌─────────────────┐
                    │   Browser UI    │
                    │  (Vite + React) │
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐         ┌──────────────────┐
                    │   Backend API   │◄────────┤  GitHub OAuth    │
                    │ (Express + Bun) │         │  GitHub App      │
                    └────────┬────────┘         └──────────────────┘
                             │                          ▲
              ┌──────────────┼──────────────┐           │
              │              │              │           │ webhooks
       ┌──────▼─────┐  ┌─────▼─────┐  ┌────▼────┐       │
       │  Postgres  │  │  Sessions │  │ Scan    │       │
       │  (Prisma)  │  │  Postgres │  │ Job     │       │
       │            │  │  store    │  │ queue   │       │
       └──────▲─────┘  └───────────┘  └────┬────┘       │
              │                            │            │
        ┌─────┴─────────┐         ┌────────▼────────┐   │
        │  Sync Worker  │─────────┤  Scanner Worker │───┘
        │  (cron)       │         │  (gVisor host)  │
        └───────────────┘         └────────┬────────┘
                                           │ docker run --runtime=runsc
                                  ┌────────▼────────┐
                                  │ Sandbox image:  │
                                  │ Archon runtime  │
                                  │ + stub claude   │
                                  │ no network      │
                                  │ ro rootfs       │
                                  └─────────────────┘
```

### Directory structure

```
archon-marketplace/
├── apps/
│   ├── frontend/        # Vite + React + Tailwind v4
│   ├── backend/         # Express API, auth, admin, telemetry endpoints
│   ├── sync-worker/     # Cron-based GitHub sync; enqueues re-scans on version bump
│   └── scanner/         # NEW: pulls scan jobs, runs SAST + dynamic, persists reports
├── plans/
│   ├── PRD.md           # this document
│   ├── production-roadmap.md
│   └── archon-marketplace.md  # original v0 plan
├── docker/
│   ├── scanner-sandbox.Dockerfile   # gVisor sandbox image w/ Archon + stub claude
│   └── stub-claude/                 # source for the stubbed `claude` binary
├── docker-compose.yml
├── docker-compose.prod.yml
├── Caddyfile
└── DEPLOYMENT.md
```

### Key design patterns

- **Workspace separation by scaling axis.** `backend` (web, low CPU) and `scanner` (sandboxed, high CPU, isolation-sensitive) are separate workspaces and separate containers from day one. Lets us scale scanners horizontally without scaling the web tier.
- **Postgres-as-queue (until justified otherwise).** `ScanJob` table with `SELECT FOR UPDATE SKIP LOCKED` claim semantics. No Redis until volume justifies the operational cost.
- **Reproducibility via stubbed AI.** The biggest correctness threat to a "real dynamic analysis" claim is LLM nondeterminism. We solve it by replacing `claude` with a deterministic stub inside the sandbox. Re-scanning the same YAML twice produces identical findings.
- **GitHub App over PAT.** Avoids per-repo manual webhook setup, scoped tokens (no admin-of-everything PAT), and natural ergonomic flow ("install the marketplace App on this repo").
- **Audit-everything for admin actions.** Allowlist changes, quarantines, yanks, scan re-runs all written to an audit log table. Soft-delete only.
- **Theme via CSS variables, not Tailwind dark variant gymnastics.** Already in place after the redesign — `--color-foreground` etc. flip on `.dark` class, components use `bg-[var(--color-background)]`.

### Tailwind v4 specifics

- `@import "tailwindcss"` (not the v3 `@tailwind base/components/utilities`)
- `@custom-variant dark (&:where(.dark, .dark *))` for class-based dark mode
- Color tokens live in `@theme` block in `index.css`

---

## 7. Tools / Features

### Feature: Allowlist Management

**Purpose:** Restrict submission to Dynamous members.

**Operations:**
- Add single GitHub username
- Bulk import (CSV / newline-separated)
- Remove username (revokes the user's `APPROVED` status, keeps published workflows live)
- Search + paginated list view
- Audit log of additions/removals

**Key features:**
- GitHub username validation against the API before persistence (catches typos)
- Idempotent adds (re-adding same username doesn't error)
- Bulk import returns per-row success/failure summary

### Feature: Submission Flow

**Purpose:** Take a Dynamous member's GitHub repo and turn it into a scanned, scored, listed workflow.

**Operations:**
- Submit owner/repo (+ optional path, default `archon.yaml`)
- Install GitHub App on the target repo (redirect to GitHub, callback returns `installation_id`)
- Server enqueues initial scan job
- User sees a "Scanning…" state on their workflow detail page
- On completion: status badge updates, leaderboard reflects (if PUBLISHED)

**Key features:**
- Duplicate detection (`@@unique([owner, repo, path])` already in schema)
- Rejects submission if author is not on allowlist (defense-in-depth, beyond UI gate)
- Scan results visible to author even if QUARANTINED or REJECTED

### Feature: Security Scanning Pipeline

**Purpose:** Catch malicious or buggy workflows before they reach installers.

**Stages:**

**Stage 1 — Static Analysis (SAST):**
1. Strict YAML schema validation (must conform to Archon workflow schema)
2. Secret scanning: regex for known patterns + Shannon entropy on string literals
3. Bash AST inspection: parse every `bash` node's command, walk AST, flag dangerous patterns (`rm -rf`, network tools, `eval`, command substitution from prompt outputs)
4. Prompt injection signature scan: known-bad patterns ("ignore previous instructions", role-confusion attacks, exfiltration prompts)
5. Cross-node taint analysis: track if prompt output flows into bash input without sanitization

**Stage 2 — Dynamic Sandboxed Execution:**
1. `docker run --runtime=runsc --network=none --read-only --tmpfs /tmp:rw,size=64m --memory=256m --cpus=0.5 --pids-limit=64 --security-opt=no-new-privileges scanner-sandbox archon scan /workflow.yaml --json`
2. 30s wall-clock timeout (kill on overrun, mark as TIMEOUT finding)
3. Capture: gVisor syscall logs, filesystem writes, network attempts, exit code, structured JSON from runtime
4. Score deductions: CRITICAL = −100, HIGH = −30, MEDIUM = −15
5. Gate: ≥80 PUBLISHED, 50–79 QUARANTINED (admin review), <50 REJECTED

**Re-scan triggers:**
- GitHub App `push` webhook on registered repo
- Sync worker periodic (hourly) sweep
- Admin manual "Re-scan" button
- Detected `version` field bump in YAML

**Key features:**
- Idempotent: same YAML + same scanner version → same findings
- Stub `claude` binary replaces the real one in the sandbox image, returning canned templated responses keyed by node id, exit 0
- On re-scan score regression of a `PUBLISHED` workflow → auto-flip to `QUARANTINED`, fire notifications

### Feature: Notifications

**Purpose:** Authors and admins know what's happening without polling the dashboard.

**In-app:**
- Admin pending-review queue
- Per-workflow timeline (submitted → scanning → published → re-scanned → quarantined → resolved)
- Status badges on leaderboard rows

**GitHub issue auto-posting:**
- On scan failure → `octokit.issues.create` on the author's repo titled `[Archon Marketplace] Security scan flagged archon.yaml`, body has score + findings + link to marketplace
- On scan resolution → `octokit.issues.createComment` closing the issue
- Idempotent: don't re-create if an open Archon-Marketplace issue already exists; comment instead

### Feature: CLI Telemetry

**Purpose:** Track install counts and let CLI users discover quarantined workflows.

**Operations:**
- `POST /telemetry/install` — increments `installCount`, idempotent per `installId`, rate-limited per IP
- `GET /workflows/:owner/:repo` — CLI checks status before installing; returns 200 if PUBLISHED, 451 if REJECTED/QUARANTINED with reason

**Key features:**
- Rate limiting prevents inflation
- Anonymous (no auth required for install ping)

---

## 8. Technology Stack

### Backend

| Component | Choice | Version |
|---|---|---|
| Runtime | Bun | 1.x |
| Language | TypeScript | ~5.x |
| Web framework | Express | ^4.21 |
| ORM | Prisma | 6.19.x |
| DB | PostgreSQL | 15-alpine |
| Auth | passport-github2 | ^0.1.12 |
| Session store | connect-pg-simple | latest (Phase 0) |
| Scheduler | node-cron | (existing) |
| YAML parsing | js-yaml | ^4.1 |
| Bash AST | bash-parser | ^0.5 |
| Container control | dockerode | ^5.0 |
| GitHub App | @octokit/app + @octokit/webhooks | latest (Phase 2) |
| Logging | pino | latest (Phase 5) |
| Rate limiting | express-rate-limit | latest (Phase 5) |
| Security headers | helmet | latest (Phase 5) |

### Frontend

| Component | Choice | Version |
|---|---|---|
| Build tool | Vite | ^8.0 |
| UI library | React | ^19.2 |
| Styling | Tailwind CSS | ^4.2 |
| PostCSS plugin | @tailwindcss/postcss | ^4.2 |
| Forms | react-hook-form + @hookform/resolvers + zod | latest |
| HTTP | axios | ^1.16 |
| Icons | lucide-react | (note: brand icons removed in current version — `Github` no longer exported, use `FolderGit2`) |
| Routing | react-router-dom | ^7.15 |

### Sandbox

| Component | Choice |
|---|---|
| Isolation runtime | gVisor (`runsc`) |
| Base image | alpine or distroless |
| Workflow runtime | Archon (https://github.com/coleam00/Archon) |
| LLM stub | custom binary, deterministic templated responses |

### Infra

| Component | Choice |
|---|---|
| Orchestration | Docker Compose |
| Reverse proxy | Caddy (handles SSL via Let's Encrypt automatically) |
| Hosting target | Deferred (currently local) |
| Public webhook URL during local dev | cloudflared or ngrok |

### Optional / Deferred

- Redis + BullMQ (replace Postgres queue once volume justifies)
- Email provider (Resend / Postmark) — not in v1
- Discord webhooks for community visibility — not in v1

---

## 9. Security & Configuration

### Authentication & authorization

- **Sign-in:** GitHub OAuth via `passport-github2`, scope `user:email`.
- **Session:** Cookie-based, HTTP-only, `SameSite=Strict`, signed with `SESSION_SECRET`. Stored in Postgres via `connect-pg-simple`.
- **Authorization tiers:**
  - **Anonymous:** read public leaderboard, view PUBLISHED workflow detail, install via CLI
  - **Authenticated (logged in):** see own profile, see own submission status
  - **Allowlisted (auto-APPROVED):** submit workflows, see own workflow timelines including QUARANTINED/REJECTED reports
  - **Admin (`isAdmin = true`):** allowlist mgmt, queue review, manual re-scan, yank workflows, audit log access

### Configuration management

All secrets and environment-dependent values via `.env`:

```
# Frontend
VITE_API_URL=http://localhost:3000          # build-time, baked in

# Backend
DATABASE_URL=postgresql://...
SESSION_SECRET=<random 64 chars>
GITHUB_CLIENT_ID=<OAuth App>
GITHUB_CLIENT_SECRET=<OAuth App>
FRONTEND_URL=http://localhost:5175           # for OAuth callback redirect
PORT=4000

# GitHub App (Phase 2+)
GITHUB_APP_ID=<App ID>
GITHUB_APP_PRIVATE_KEY=<PEM, base64 or path>
GITHUB_APP_WEBHOOK_SECRET=<random>

# Sync worker
GITHUB_TOKEN=<PAT, deprecated after Phase 2>

# Scanner
SCANNER_IMAGE=archon-marketplace/scanner-sandbox:latest
SCANNER_TIMEOUT_SECONDS=30
SCANNER_MEMORY_MB=256
```

### Security scope

**In scope (MVP):**
- ✅ HTTPS in production (Caddy auto-provisions certs)
- ✅ HTTP-only, SameSite=Strict cookies; CSRF protection via origin check
- ✅ HMAC verification on all GitHub webhooks
- ✅ Rate limiting on auth, submission, telemetry, webhook endpoints
- ✅ Body size caps (request body 64KB, YAML 64KB)
- ✅ `helmet` headers with CSP allowing only first-party assets
- ✅ Sandbox isolation: gVisor + no network + read-only rootfs + resource limits
- ✅ Stubbed Claude binary inside sandbox (no real LLM calls during scan)
- ✅ Audit log of all admin actions

**Out of scope (deferred):**
- ❌ Multi-factor auth (relies on GitHub's MFA)
- ❌ Bug bounty program
- ❌ SOC2 / formal compliance
- ❌ Role-based access beyond admin/user binary
- ❌ Encrypted-at-rest column-level (relies on DB-level encryption from host)

### Deployment considerations

- gVisor (`runsc`) must be installed on the host running the scanner; document fallback to "SAST-only" mode for hosts where it's unavailable
- GitHub App private key is sensitive; store as Docker secret or mounted file, never an env var in `docker-compose.yml`
- Production DB password rotated from default; not committed
- OAuth callback URL must be publicly reachable — local dev needs `cloudflared` tunnel

---

## 10. API Specification

### Public

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/workflows` | none | List published workflows; query params: `q`, `limit`, `offset` |
| `GET` | `/workflows/:owner/:repo` | none | Detail for a workflow (returns 451 if QUARANTINED/REJECTED with reason) |
| `POST` | `/telemetry/install` | none | Increment install count; rate-limited; body: `{ workflowId, installId }` |

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/github` | none | Initiate OAuth |
| `GET` | `/auth/github/callback` | none | OAuth callback; auto-approves if allowlisted |
| `GET` | `/auth/me` | session | Current user info |
| `POST` | `/auth/logout` | session | End session |

### Authenticated user

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/workflows` | APPROVED | Submit a new workflow; body: `{ owner, repo, path?, version? }` |
| `GET` | `/workflows/mine` | authenticated | Own submissions including QUARANTINED/REJECTED |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/queue` | admin | Pending workflows + allowlist requests |
| `GET` | `/admin/allowlist` | admin | List allowlist; query: `q`, `limit`, `offset` |
| `POST` | `/admin/allowlist` | admin | Add username; body: `{ username, note? }` |
| `POST` | `/admin/allowlist/bulk` | admin | Bulk add; body: `{ usernames: string[], note? }` |
| `DELETE` | `/admin/allowlist/:username` | admin | Remove from allowlist |
| `POST` | `/admin/workflows/:id/rescan` | admin | Manually trigger re-scan |
| `POST` | `/admin/workflows/:id/yank` | admin | Mark as REJECTED with reason |
| `POST` | `/admin/workflows/:id/resolve` | admin | Resolve QUARANTINED → PUBLISHED or REJECTED; body: `{ status, reason? }` |
| `GET` | `/admin/audit-log` | admin | List audit events |

### Webhooks

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/webhooks/github` | HMAC | GitHub App events: `push`, `installation.deleted`, `installation_repositories.removed` |

### Example: Submission

**Request:**
```http
POST /workflows
Cookie: session=<...>
Content-Type: application/json

{
  "owner": "kelsey",
  "repo": "db-schema-to-api",
  "path": "archon.yaml"
}
```

**Response (202 Accepted):**
```json
{
  "id": "9c1e...",
  "owner": "kelsey",
  "repo": "db-schema-to-api",
  "path": "archon.yaml",
  "status": "QUARANTINED",
  "scanJobId": "7ab3...",
  "appInstallUrl": "https://github.com/apps/archon-marketplace/installations/new?state=9c1e...",
  "message": "Submission received. Install the GitHub App to enable push-triggered re-scans, then your initial scan will run."
}
```

### Example: Install gate (CLI side)

**Request:**
```http
GET /workflows/kelsey/db-schema-to-api
```

**Response (PUBLISHED, 200):**
```json
{
  "owner": "kelsey",
  "repo": "db-schema-to-api",
  "version": "1.0.0",
  "status": "PUBLISHED",
  "securityScore": 92,
  "rawYamlUrl": "https://raw.githubusercontent.com/kelsey/db-schema-to-api/main/archon.yaml"
}
```

**Response (REJECTED, 451):**
```json
{
  "owner": "bad-actor",
  "repo": "sneaky-tool",
  "status": "REJECTED",
  "reason": "Yanked by admin: confirmed credential exfiltration",
  "yankedAt": "2026-04-30T14:22:11Z"
}
```

---

## 11. Success Criteria

### MVP success definition

The MVP is successful when **a Dynamous member can submit a workflow, have it scanned by the real pipeline (not the placeholder), see it on the leaderboard within ~2 minutes if clean, and have re-scans fire automatically on push** — with admin tooling sufficient to manage the allowlist and disposition quarantined items.

### Functional requirements (verifiable)

- ✅ Allowlisted user logs in → `submissionStatus = APPROVED` automatically
- ✅ Non-allowlisted user logs in → cannot submit, sees clear messaging
- ✅ Submission triggers a real scan job (not a placeholder); scan completes in <2 minutes for typical workflows
- ✅ Known-malicious test workflow (e.g. `cat /etc/shadow`) reliably gets `securityScore < 50` and `status = REJECTED`
- ✅ Reference clean workflow scores ≥90 and lands `status = PUBLISHED`
- ✅ Push to a registered repo's `archon.yaml` produces a webhook → re-scan job → updated score within minutes
- ✅ Re-scan score regression on a PUBLISHED workflow auto-flips to QUARANTINED and opens an issue on the author's repo
- ✅ Admin can add/remove allowlist entries and bulk-import 50 usernames in one operation
- ✅ Admin can yank a published workflow; CLI install gate returns 451 thereafter
- ✅ Two scans of the same YAML produce identical findings (reproducibility)

### Quality indicators

- Sandbox container correctly fails to access network, write outside `/tmp`, or read sensitive paths during execution
- gVisor `--runtime=runsc` confirmed in `docker info` output and verified at scan time
- All admin actions appear in audit log within 1s
- No secrets in `docker-compose.yml` (all via `.env`)
- Build runs clean (no TS errors, no Tailwind warnings, no PostCSS warnings)
- Postgres backups configured and restorable

### User experience goals

- First-time submitter: "Submit" → "Scanning…" → "Published" with no instruction-reading required
- Admin reviewing queue: any quarantined item dispositionable in <5 clicks with full context visible on the page
- Anonymous browser: page loads in <1s; leaderboard scrollable on mobile; theme toggle survives reload

---

## 12. Implementation Phases

> Detailed task lists live in [`production-roadmap.md`](./production-roadmap.md). This section is the high-level phase plan keyed to deliverables and validation.

### Phase 0 — Stop the bleeding *(1–2 days)*

**Goal:** Eliminate broken behavior in the current prototype before building on top of it.

**Deliverables:**
- ✅ OAuth callback redirect reads from `FRONTEND_URL` env var
- ✅ `GET /workflows` filters to `status=PUBLISHED` for non-admin
- ✅ Frontend leaderboard fetches real API instead of `DUMMY_WORKFLOWS`
- ✅ All secrets moved to `.env` with `.env.example` documented
- ✅ Sessions persisted via `connect-pg-simple`
- ✅ Dead components (`Hero.tsx`, `WorkflowCard.tsx`) removed

**Validation:** Fresh clone → `cp .env.example .env` → `docker compose up` → working marketplace whose leaderboard reflects DB state.

### Phase 1 — Allowlist + auto-approve *(2–3 days)*

**Goal:** Replace open "request access" with admin-managed allowlist.

**Deliverables:**
- ✅ `Allowlist` and `AllowlistAuditLog` Prisma models
- ✅ OAuth callback hook auto-approves allowlisted users
- ✅ Admin UI: list, search, single-add, bulk import, remove
- ✅ Submission UI: clear "members only" messaging for non-allowlisted
- ✅ Removal demotes user's `submissionStatus`

**Validation:** Bulk-import 50 fake usernames in <5s. Manually log in as one of them → submission button is enabled. Remove from allowlist → next login, submission disabled.

### Phase 2 — GitHub App for sync + webhooks *(3–5 days)*

**Goal:** Replace PAT, get push-triggered re-scans, link workflows to App installations.

**Deliverables:**
- ✅ Registered GitHub App; private key stored as secret
- ✅ Submission flow includes "Install GitHub App" step
- ✅ Sync worker uses installation tokens
- ✅ `/webhooks/github` endpoint with HMAC verification
- ✅ Postgres-backed `ScanJob` queue with `SELECT FOR UPDATE SKIP LOCKED`
- ✅ Manual "Re-scan" admin button enqueues a job

**Validation:** Pushing to a registered repo lands a `ScanJob` row within 5s of webhook delivery. App uninstall quarantines affected workflows.

### Phase 3 — Real sandboxed dynamic analysis *(1–2 weeks; blocked on Archon scan-mode)*

**Goal:** Replace placeholder with the real pipeline.

**Deliverables:**
- ✅ gVisor (`runsc`) installed and registered as Docker runtime
- ✅ `scanner-sandbox` Docker image: Archon runtime + stubbed `claude` binary
- ✅ New `apps/scanner` workspace with worker process
- ✅ Stage 1 SAST expanded (taint analysis, entropy-based secret detection, prompt injection signatures)
- ✅ Stage 2 dynamic execution with full resource caps and capture
- ✅ Score-based gating + auto-quarantine on regression
- ✅ Reproducibility verified (two scans → identical findings)

**Open dependency:** Confirm or add `archon scan workflow.yaml --json --stub-ai` non-interactive mode in `coleam00/Archon`.

**Validation:** Test corpus of 5 known-malicious workflows all rejected. Test corpus of 5 known-clean workflows all published. Same YAML scanned twice → identical `securityReport`.

### Phase 4 — Notifications *(2–3 days)*

**Goal:** Authors and admins informed without polling.

**Deliverables:**
- ✅ In-app pending-review queue
- ✅ Per-workflow timeline page
- ✅ GitHub issue auto-post on scan failure (idempotent)
- ✅ Auto-comment-and-close on resolution

**Validation:** Trigger a scan failure on a test repo → issue appears on that repo within 30s. Re-submit a fix → issue closes automatically.

### Phase 5 — Production hardening *(3–5 days)*

**Goal:** Safe to expose publicly.

**Deliverables:**
- ✅ Rate limits on sensitive endpoints
- ✅ CSRF + helmet + body size caps
- ✅ `pino` structured logging with correlation IDs through scan jobs
- ✅ `/healthz` and `/readyz` endpoints
- ✅ Yank flow + CLI gate response (451)
- ✅ TOS / Privacy / Abuse-report static pages
- ✅ `POST /telemetry/install` endpoint
- ✅ Documented backup strategy

**Validation:** Smoke pen-test: CSRF replay rejected; oversized YAML rejected; missing webhook signature rejected; brute-force login rate-limited. All return appropriate errors without crashing.

### Phase 6 — Local-host friendly deployment *(1–2 days)*

**Goal:** Anyone can run + demo locally with a public callback URL.

**Deliverables:**
- ✅ `docker-compose.local.yml` with sane defaults
- ✅ `.env.example` documenting all variables
- ✅ Cloudflared/ngrok setup notes
- ✅ Per-environment config layering (`local`, `staging`, `prod`)
- ✅ "SAST-only" fallback mode documented for hosts without gVisor

**Validation:** A new contributor can clone, `cp .env.example .env`, fill in OAuth + GitHub App secrets, run `docker compose -f docker-compose.local.yml up`, and submit a test workflow within 30 minutes.

---

## 13. Future Considerations

### Post-MVP enhancements

- **Open-public submissions** with manual admin review tier for non-Dynamous applicants
- **Workflow versioning + pinned installs** (`archon add owner/repo@v1.2.0`)
- **Multiple workflows per repo** (the schema already supports `path`; UX for browsing them needs work)
- **Author profiles** with bio, links, list of authored workflows
- **Categories + tags** ("code review", "documentation", "data engineering")
- **Better search ranking** — install velocity, recency, author reputation

### Integration opportunities

- **Discord bot** — push new submissions and quarantine events to a Dynamous channel
- **VS Code extension** — search marketplace + install workflows from inside the editor
- **GitHub Actions integration** — `archon-marketplace/scan-action` lets repos run the same security pipeline in CI before submitting

### Advanced features for later phases

- **Egress-allowlist deep-scan tier** — admin can flag a borderline workflow for "deep scan" with controlled real-LLM-call egress on a budget API key
- **Reputation system** — workflows from authors with N publishedscores ≥X for Y months get a "trusted" badge
- **Diff-aware re-scan** — only re-run dynamic if the YAML semantics changed, not just whitespace
- **Public abuse reporting** — non-author users can flag a published workflow; goes into admin queue
- **Programmatic submission API** with API tokens for CI/CD pipelines
- **Federation / mirror** — multiple marketplaces (per community) with cross-marketplace search

---

## 14. Risks & Mitigations

### Risk 1: gVisor escape or sandbox bypass

**Scenario:** A submitted workflow exploits a kernel bug in gVisor's `runsc` and breaks containment, accessing the host.

**Likelihood:** Low. gVisor is hardened and has had limited published escapes. **Impact:** Catastrophic — host compromise.

**Mitigation:**
- Run scanner workers on dedicated hosts with no other workloads, no DB access, no production secrets
- Outbound network blocked at firewall level, not just at container level
- Treat scanner host as ephemeral; rebuild from image regularly
- Monitor gVisor security advisories; patch promptly
- Phase 5: consider Firecracker-based runner if escape is observed in the wild

### Risk 2: Stubbed Claude misses real-world attack patterns

**Scenario:** A workflow's malicious behavior only manifests when the real Claude API returns a specific completion that triggers a downstream bash injection. The stub returns canned output, the dynamic stage misses it, the workflow gets published.

**Likelihood:** Medium for sophisticated attackers, low for casual ones. **Impact:** High — exactly the kind of attack the marketplace is supposed to catch.

**Mitigation:**
- SAST taint analysis covers prompt-output → bash-input flows even without dynamic execution
- Stub responses are *adversarial* by design — return strings containing common injection payloads (`; rm -rf /`, backtick command substitution, etc.) so any node that pipes prompt output into bash is exercised against attacks
- Phase deferred: egress-allowlist deep-scan tier with real Claude calls available for borderline cases
- Manual admin review of QUARANTINED is mandatory, not optional

### Risk 3: GitHub App + webhook setup complexity blocks MVP

**Scenario:** Phase 2 takes longer than expected because GitHub App registration, key handling, and webhook signature verification have a lot of moving pieces.

**Likelihood:** Medium. **Impact:** Medium — pushes Phase 3 by a week.

**Mitigation:**
- Use `@octokit/app` and `@octokit/webhooks` packages — handle most of the ceremony
- Phase 2 has a clear off-ramp: if it slips, fall back to PAT for sync + manual re-scan button. Push-triggered re-scan moves to v1.1.
- Document App registration end-to-end in `DEPLOYMENT.md` so subsequent installs are smooth

### Risk 4: Allowlist-only flow throttles adoption

**Scenario:** Restricting submissions to Dynamous members means the leaderboard stays sparse, which makes the marketplace look dead and discourages usage.

**Likelihood:** Medium. **Impact:** Medium — UX problem, not security.

**Mitigation:**
- Seed leaderboard with workflows from Dynamous core team / Archon maintainers at launch
- Deferred-but-planned: open-submission tier with manual admin review queue (Phase 1.5 or v1.1)
- Public messaging makes the gating intentional and time-bound ("members only during alpha; opening to public Q4")

### Risk 5: Marketplace is breached and used to distribute malicious workflows

**Scenario:** An admin account is compromised; attacker yanks legitimate workflows, allows malicious ones, or modifies stored YAML.

**Likelihood:** Low (small admin team, GitHub-backed auth). **Impact:** Catastrophic — exactly the trust the marketplace claims to provide is violated.

**Mitigation:**
- Admin accounts must use GitHub MFA (we rely on GitHub's enforcement)
- All admin actions land in append-only audit log
- Yank/quarantine actions require a written reason (caught in audit log)
- Production DB has point-in-time recovery (Postgres WAL backups)
- Deferred: hardware-token requirement for admin role

---

## 15. Appendix

### Related documents

- [`production-roadmap.md`](./production-roadmap.md) — phase-by-phase task list with concrete deliverables
- [`archon-marketplace.md`](./archon-marketplace.md) — original v0 implementation plan (predates the brainstorm; superseded by this PRD where they conflict)
- [`admin-sandbox-registration.md`](./admin-sandbox-registration.md) — earlier doc on admin/sandbox mechanics
- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — VPS deployment guide (will be revised once production target is chosen)
- [`README.md`](../README.md) — project overview

### Key dependencies

- **Archon runtime:** https://github.com/coleam00/Archon
- **gVisor:** https://gvisor.dev
- **Tailwind v4:** https://tailwindcss.com/docs/v4-beta (note: project uses `@tailwindcss/postcss`)
- **Prisma:** https://www.prisma.io/docs
- **Bun:** https://bun.sh/docs
- **passport-github2:** https://www.passportjs.org/packages/passport-github2
- **@octokit/app + webhooks:** https://github.com/octokit/app.js

### Repository / project structure

```
archon-marketplace/
├── apps/
│   ├── frontend/                  # Vite + React + Tailwind v4
│   │   ├── src/
│   │   │   ├── components/        # AsciiLogo, CliCommand, Leaderboard, Header, ...
│   │   │   ├── lib/api.ts         # API_URL from VITE_API_URL build arg
│   │   │   ├── lib/theme.ts       # light/dark toggle hook
│   │   │   └── App.tsx
│   │   └── Dockerfile (legacy; main one in repo root)
│   ├── backend/                   # Express + Prisma
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── config/            # passport, prisma client
│   │       ├── routes/            # auth, workflow, admin, webhooks (Phase 2)
│   │       ├── controllers/
│   │       ├── middleware/        # isAuthenticated, isAdmin
│   │       └── services/security.ts (placeholder; replaced in Phase 3)
│   ├── sync-worker/               # cron-based sync
│   └── scanner/                   # NEW in Phase 3 — pulls jobs, runs gVisor sandbox
├── docker/
│   ├── scanner-sandbox.Dockerfile (Phase 3)
│   └── stub-claude/               (Phase 3) deterministic stub binary
├── plans/
│   ├── PRD.md                     ← this file
│   ├── production-roadmap.md
│   └── archon-marketplace.md
├── docker-compose.yml             # local dev
├── docker-compose.prod.yml        # production
├── docker-compose.local.yml       (Phase 6) opinionated local-with-public-url setup
├── Caddyfile
├── Dockerfile                     # multi-stage: backend, sync-worker, frontend
└── DEPLOYMENT.md
```

### Glossary

- **Dynamous** — the community whose members are the initial allowlisted submitters. Currently a manual concept; mapped to a list of GitHub usernames maintained by admins.
- **Workflow** — an Archon YAML definition (`archon.yaml`) describing a multi-step AI coding flow.
- **Workflow node** — an individual step within a workflow. Types include `bash`, `prompt`, `loop`, etc.
- **SAST** — static application security testing. Stage 1 of the scan pipeline.
- **Quarantine** — workflow temporarily hidden from the public leaderboard pending admin review.
- **Yank** — admin action that permanently rejects a previously-published workflow.
- **gVisor / runsc** — user-space kernel that sandboxes containers by intercepting syscalls. Used as the Docker `--runtime=runsc` to isolate scanner execution.
