# Feature: Phase 2 — Stop the Bleeding

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files etc.

## Feature Description

Eliminate the broken or unsafe behavior that landed in the prototype before any further phases (allowlist, GitHub App, real sandbox) build on top of it. This is a "make the prototype honest" pass: hardcoded URLs become configuration, secrets exit the repo, sessions persist across restarts, the leaderboard reflects database state, and dead components from the redesign get cleaned up.

This phase is intentionally narrow. It is not a feature; it's the gate that makes the rest of the roadmap safe to execute.

## User Story

As a **developer cloning this repo for the first time**
I want to **`cp .env.example .env`, `docker compose up`, and have a fully working marketplace whose leaderboard reflects real DB state, sessions survive a restart, and no secrets are baked into source**
So that **the prototype is honest about what it is, and Phase 3+ work can build on a non-broken foundation**.

## Problem Statement

The prototype has six concrete defects that block real use of even the existing functionality:

1. **OAuth + CORS hardcoded to wrong port.** `apps/backend/src/index.ts:16` allows `http://localhost:5173`. `apps/backend/src/routes/auth.ts:15` redirects to `http://localhost:5173`. The frontend now lives on `:5175` (Astro). OAuth login is broken end-to-end.
2. **Public API can leak quarantined/rejected workflows.** `getWorkflows` in `apps/backend/src/controllers/workflow.ts:19` defaults to `status=PUBLISHED` only when the request omits `?status=`. Anyone (including anonymous) can query `?status=QUARANTINED` and see hidden workflows. The status filter is admin territory and must be gated.
3. **Leaderboard renders fake data.** `apps/frontend/src/components/HomeIsland.tsx:11` ships a `DUMMY_WORKFLOWS` array. The `Leaderboard` component never sees real submissions even after the Astro migration.
4. **Secrets in source / weak defaults.** `docker-compose.yml` hardcodes `POSTGRES_PASSWORD: password` and the DB URL with that password (lines 9, 52, 63). `apps/backend/src/index.ts:21` falls back to `'archon-secret'` when `SESSION_SECRET` is missing. There is no `.env.example`. `passport.ts:24-25` also falls back to `'dummy'` for OAuth client.
5. **In-memory session store.** Default `express-session` MemoryStore loses every session on restart and prevents horizontal scaling. Phase 4+ workers and the eventual scanner will exacerbate this.
6. **Dead components from the redesign.** `Hero.tsx` and `WorkflowCard.tsx` exist under `apps/frontend/src/components/` but have no importers after the skills.sh-style redesign. They confuse readers and risk being re-imported by mistake.

## Solution Statement

Six small, scoped changes — each independently verifiable, each behind a single PR's worth of work:

1. **Configure cross-origin and OAuth via env.** Read `FRONTEND_URL` (single source of truth) for both the CORS allowlist and the OAuth callback redirect. Read `BACKEND_URL` for the `callbackURL` in `passport.ts` so dev and prod don't diverge.
2. **Gate the `status` filter on `GET /workflows`.** Anonymous and non-admin authenticated users always get `status=PUBLISHED`. Admins (`req.user.isAdmin === true`) may pass `?status=PUBLISHED|QUARANTINED|REJECTED`. Reject unknown values.
3. **Wire the leaderboard to the real API.** Delete `DUMMY_WORKFLOWS`, fetch `/workflows` on island mount, map API rows to `LeaderboardItem`, render loading + empty + error states.
4. **`.env.example` + remove fallbacks.** Add a single root `.env.example` documenting every variable; have `docker-compose.yml` reference `${VAR}` only; remove the `'archon-secret'` and `'dummy'` fallbacks so missing config fails loud at startup.
5. **`connect-pg-simple` session store.** Reuse the existing Postgres connection. Run a one-time `CREATE TABLE` for `session` via the package's table SQL (run through Prisma migration to keep all schema in one place).
6. **Delete `Hero.tsx` and `WorkflowCard.tsx`.** Confirm zero importers, then remove.

## Feature Metadata

**Feature Type**: Bug Fix / Refactor (defensive cleanup before further capability work)
**Estimated Complexity**: Low (mechanical changes; no new architecture)
**Primary Systems Affected**: `apps/backend` (auth, CORS, sessions, workflow controller), `apps/frontend` (HomeIsland), Docker Compose, env scaffolding
**Dependencies**:
- Add: `connect-pg-simple` (+ `@types/connect-pg-simple`) to `apps/backend`
- Already present: `express-session`, `pg` (via Prisma), `dotenv`

**Pre-flight findings (verified before plan finalization):**
- `apps/backend/src/middleware/auth.ts` already exports `isAdmin` (lines 10–15) and is already imported by `routes/admin.ts`. **Do not create a new one.**
- No `.env` files are tracked in git (`git ls-files apps/backend/.env apps/sync-worker/.env .env` returns empty; root `.gitignore` line 14 covers `.env`). **No destructive history cleanup is required.**
- `apps/backend/prisma/migrations/` is gitignored (root `.gitignore` last line). **Do not use Prisma migrations to ship the `session` table** — they wouldn't make it into the repo. Use `connect-pg-simple`'s `createTableIfMissing: true` instead.
- `apps/backend/src/` contains tracked compiled `.js` and `.d.ts` outputs (e.g. `routes/auth.js` still has the `localhost:5173` redirect). Runtime uses `bun --watch src/index.ts` directly so these don't affect behavior. **Edit only `.ts` files**; treat compiled artifacts as out-of-scope build cruft for this phase. When grepping for removed strings, exclude `*.js` and `*.d.ts` to avoid false positives.
- `docker-compose.yml:50` maps host `3000 → container 4000` for backend. The browser hits backend at `http://localhost:3000` in compose-based dev, so `BACKEND_URL=http://localhost:3000` (not `:4000`) for that flow. For non-Docker `bun run dev`, backend listens on host `:4000` directly, so `BACKEND_URL=http://localhost:4000`. The `.env.example` documents the Compose values; the per-app `apps/backend/.env` keeps the non-Docker values.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: YOU MUST READ THESE BEFORE IMPLEMENTING

- `apps/backend/src/index.ts` (full file, 45 lines) — Why: top of the change list. CORS origin (line 16), session config (lines 20–28), `SESSION_SECRET` fallback (line 21).
- `apps/backend/src/routes/auth.ts` (lines 10–17) — Why: OAuth callback redirect to `http://localhost:5173`. Replace with `process.env.FRONTEND_URL`.
- `apps/backend/src/config/passport.ts` (lines 22–27) — Why: `callbackURL` is hardcoded `http://localhost:4000/...`; `'dummy'` fallback for OAuth credentials. Read from env, fail loud.
- `apps/backend/src/controllers/workflow.ts` (lines 6–39) — Why: `getWorkflows` accepts `?status=` from any caller. Add `req.user?.isAdmin` gate before honoring the param.
- `apps/backend/src/middleware/auth.ts` (full file, 16 lines) — Why: already exports `isAuthenticated` (lines 3–8) and `isAdmin` (lines 10–15). **Reuse — do not duplicate or modify.** `isAdmin` already checks `req.isAuthenticated() && req.user.isAdmin`.
- `apps/backend/src/routes/admin.ts` (lines 1–7) — Why: confirms the import pattern (`import { isAdmin } from '../middleware/auth';`) for reuse in the workflow controller.
- `apps/backend/prisma/schema.prisma` — Why: `User.isAdmin` already exists (line 31). Add a `session` table model (or run raw migration) for `connect-pg-simple`.
- `apps/backend/.env` — Why: current contents (`DATABASE_URL`, `PORT`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`). Use as basis for `.env.example`. Note this file lives under `apps/backend/` today; we will introduce a single repo-root `.env.example` consumed by Docker Compose.
- `apps/backend/package.json` — Why: dependency add target.
- `apps/frontend/src/components/HomeIsland.tsx` (full file, 92 lines) — Why: contains `DUMMY_WORKFLOWS` (lines 11–32) and renders `<Leaderboard items={DUMMY_WORKFLOWS} />` (line 74). Already imports `axios` and `API_URL`. Mirror the existing `fetchUser` pattern (lines 39–48) for the workflows fetch.
- `apps/frontend/src/components/Leaderboard.tsx` (full file, 102 lines) — Why: shape of `LeaderboardItem` (lines 4–13). API rows must be mapped to this exactly.
- `apps/frontend/src/lib/api.ts` (1 line) — Why: `API_URL` source. Already correctly reads `import.meta.env.PUBLIC_API_URL`. No change.
- `apps/frontend/src/components/Hero.tsx` — Why: candidate for deletion. Confirm zero importers.
- `apps/frontend/src/components/WorkflowCard.tsx` — Why: candidate for deletion. Confirm zero importers.
- `docker-compose.yml` (full file, 69 lines) — Why: hardcoded `POSTGRES_PASSWORD: password` (line 10); `DATABASE_URL` literal in services (lines 52, 63). Replace with `${VAR}` from `.env`.
- `docker-compose.prod.yml` (full file, 49 lines) — Why: already uses `${VAR}` indirection for backend env. Mirror its style in `docker-compose.yml`. Add `FRONTEND_URL` and `BACKEND_URL` passthrough.
- `apps/sync-worker/.env` — Why: separate worker env; ensure it doesn't shadow root.

### New Files to Create

- `.env.example` (repo root) — Single canonical example consumed by Compose. Documents `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`, `SESSION_SECRET`, `FRONTEND_URL`, `BACKEND_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN`, `PUBLIC_API_URL`, `PORT`. Each var has a one-line comment + sensible local default where safe.

(No Prisma migration file — see "Pre-flight findings" above. The `session` table is created by `connect-pg-simple` at startup via `createTableIfMissing: true`.)

### Relevant Documentation — YOU SHOULD READ THESE BEFORE IMPLEMENTING

- [`connect-pg-simple` README](https://github.com/voxpelli/node-connect-pg-simple#readme)
  - Section: "Usage" + "Quick start" + "Express 4.x and 5.x"
  - Why: shows `pgSession = require('connect-pg-simple')(session)` pattern, `conString` vs `pool` options, and the canonical `session` table SQL we must run as a migration.
- [`connect-pg-simple` `table.sql`](https://github.com/voxpelli/node-connect-pg-simple/blob/main/table.sql)
  - Why: exact DDL to put inside the Prisma migration. Do not paraphrase.
- [Express Session — Production warning](https://github.com/expressjs/session#warning)
  - Why: documents that the default MemoryStore is dev-only; aligns with the rationale in the PRD.
- [Astro env vars (`PUBLIC_*`)](https://docs.astro.build/en/guides/environment-variables/)
  - Why: confirms that any client-side env var must be prefixed `PUBLIC_`. Already in use; cross-reference if you touch the frontend env.
- [Passport `callbackURL` field](http://www.passportjs.org/packages/passport-github2/)
  - Why: confirms `callbackURL` is read at strategy construction and supports absolute URLs only.
- [`docker-compose.yml` env_file + `${VAR}` interpolation](https://docs.docker.com/compose/environment-variables/env-file/)
  - Why: how Compose reads `.env` from the same directory as the `docker-compose.yml` automatically.

### Patterns to Follow

**Naming Conventions:**
- TypeScript: camelCase for vars/functions, PascalCase for types/components.
- Env vars: `SCREAMING_SNAKE_CASE`. Browser-exposed: `PUBLIC_*` (Astro). Server-only: unprefixed.
- Files: backend uses lowercase (`workflow.ts`, `auth.ts`); frontend components use PascalCase (`HomeIsland.tsx`).

**Error Handling (existing — mirror):**
- Backend controllers wrap in `try/catch`, log via `console.error`, respond with `res.status(500).json({ error: '...' })`. See `workflow.ts:122-125`.
- Frontend islands use a local `error` state and render an inline error block; see `SubmissionModal.tsx:29` for pattern.

**Logging Pattern:**
- `console.log` / `console.error` only at this stage. Pino comes in Phase 7. Don't over-engineer logging here.

**Config Read Pattern:**
- `dotenv.config()` is called once in `apps/backend/src/index.ts:10` and `apps/backend/src/config/passport.ts:6`. Reads must happen *after* this.
- Convention going forward: read `process.env.X` once at module top, throw a clear error if absent (no fallbacks for security-sensitive vars: `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`).

**API Fetch Pattern (frontend):**
- Use `axios` with `withCredentials: true`. See `HomeIsland.tsx:41` and `SubmissionModal.tsx:42`. `API_URL` is imported from `../lib/api`.

**CORS Pattern (existing):**
```ts
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
```
Becomes:
```ts
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```
Single origin string (not array) to keep it simple — production puts everything behind Caddy, so same-origin solves it there.

**Admin Gate Pattern:**
- `isAdmin` already exists in `apps/backend/src/middleware/auth.ts:10-15`. It is a route-level guard (returns 403 if not admin). For `getWorkflows` we cannot use it as a guard — anonymous users must reach the endpoint — so check `(req.user as any)?.isAdmin === true` inline inside the controller. Same predicate as the middleware, different placement.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation — env scaffolding

Before changing any code that reads env, lay down the example file and Compose passthrough so the rest of the changes can rely on a known set of variables.

**Tasks:**
- Create `.env.example` at repo root with every variable Phase 2 introduces or formalizes.
- Add `.env` to root `.gitignore` if not already present (verify; existing `apps/backend/.env` is currently tracked, which is also a leak — confirm before removing).
- Update `docker-compose.yml` to drop literal passwords/URLs and read `${VAR}` instead.

### Phase 2: Backend wiring

**Tasks:**
- Replace hardcoded `localhost:5173` and OAuth credential fallbacks with env reads.
- Move OAuth `callbackURL` to env.
- Add an admin gate to the `status` query parameter on `GET /workflows`.
- Install and wire `connect-pg-simple` for sessions.

### Phase 3: Frontend wiring

**Tasks:**
- Fetch `/workflows` on `HomeIsland` mount; remove `DUMMY_WORKFLOWS`.
- Map API rows → `LeaderboardItem`.
- Loading + empty + error states.

### Phase 4: Cleanup

**Tasks:**
- Delete `Hero.tsx` and `WorkflowCard.tsx` after grep confirms zero importers.
- Verify build, run, and OAuth round-trip.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### CREATE `.env.example`

- **IMPLEMENT**: Single repo-root file with the full set of variables, sensible local defaults where it's safe (Postgres user/db, ports), and `<replace-me>` placeholders for secrets. Group by service. Each var has a one-line `#` comment.
- **PATTERN**: existing `apps/backend/.env` (5 lines, 1 var per line). Extend that style.
- **CONTENT**:
  ```dotenv
  # ─── Postgres ───────────────────────────────────────────────
  POSTGRES_USER=archon
  POSTGRES_PASSWORD=<replace-me>
  POSTGRES_DB=archon_marketplace

  # Backend + sync-worker connection string (uses the values above + service hostname `db` inside compose).
  # NOTE: when running `bun run dev` directly on the host (no Docker), use `localhost:5432` instead of `db:5432`.
  # Keep that variant in `apps/backend/.env` for non-Docker dev.
  DATABASE_URL=postgresql://archon:<replace-me>@db:5432/archon_marketplace?schema=public

  # ─── pgAdmin (local dev only) ───────────────────────────────
  PGADMIN_DEFAULT_EMAIL=admin@archon.local
  PGADMIN_DEFAULT_PASSWORD=<replace-me>

  # ─── Backend ────────────────────────────────────────────────
  PORT=4000
  # 64+ random chars; used to sign session cookies
  SESSION_SECRET=<replace-me>
  # Public origin of the Astro frontend; used for CORS + OAuth redirect.
  # In Compose dev the Astro container is mapped to host :5175.
  FRONTEND_URL=http://localhost:5175
  # Public origin of the backend; used for OAuth callbackURL.
  # In Compose dev the backend container's :4000 is mapped to host :3000 (see docker-compose.yml).
  # GitHub redirects the BROWSER here, so this must be the host-facing port: :3000.
  # For non-Docker `bun run dev`, change to http://localhost:4000.
  BACKEND_URL=http://localhost:3000

  # GitHub OAuth App credentials (https://github.com/settings/developers)
  GITHUB_CLIENT_ID=<replace-me>
  GITHUB_CLIENT_SECRET=<replace-me>

  # Sync-worker PAT (deprecated in Phase 4 when GitHub App lands)
  GITHUB_TOKEN=<replace-me>

  # ─── Frontend (build-time) ──────────────────────────────────
  PUBLIC_API_URL=http://localhost:4000
  ```
- **GOTCHA**: Do not commit the resulting `.env`. Verify `.gitignore` has `.env` (root) and `apps/*/.env`.
- **VALIDATE**: `Glob` for `.env.example` returns the new file. `Grep` for `<replace-me>` shows only inside `.env.example`.

### VERIFY `.gitignore` (root) — already correct

- **IMPLEMENT**: No edit needed. Pre-flight check confirmed:
  - Line 14: `.env` (matches `.env` anywhere, including `apps/*/.env`)
  - Lines 15–18: `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`
  - `git ls-files apps/backend/.env apps/sync-worker/.env .env` returns empty.
- **VALIDATE**: `git check-ignore .env apps/backend/.env apps/sync-worker/.env` prints all three. `git ls-files | Select-String '\.env$'` returns nothing.

### UPDATE `docker-compose.yml`

- **IMPLEMENT**:
  - Replace `POSTGRES_PASSWORD: password` (line 10) with `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}`. Likewise `POSTGRES_USER: ${POSTGRES_USER}` and `POSTGRES_DB: ${POSTGRES_DB}`.
  - Replace pgAdmin literal email/password with `${PGADMIN_DEFAULT_EMAIL}` / `${PGADMIN_DEFAULT_PASSWORD}`.
  - Replace `DATABASE_URL=postgresql://archon:password@db:5432/archon_marketplace` (lines 52, 63) with `DATABASE_URL=${DATABASE_URL}`.
  - Add `SESSION_SECRET`, `FRONTEND_URL`, `BACKEND_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` to the `backend` service `environment:` block (passthrough).
  - Add `GITHUB_TOKEN` passthrough to `sync-worker` service.
  - Frontend `args.PUBLIC_API_URL` stays; passthrough from `${PUBLIC_API_URL}` so `.env` controls it: `PUBLIC_API_URL: ${PUBLIC_API_URL}`.
- **PATTERN**: `docker-compose.prod.yml:31-36` already uses `${VAR}` — mirror exactly.
- **GOTCHA**: Compose loads `.env` from the same directory as the compose file at parse time. Variables referenced as `${VAR}` are interpolated at parse time; variables under `environment:` are passed to the container. Do both as needed.
- **GOTCHA**: `version: '3.8'` is obsolete in modern Compose but harmless. Leave it; out of scope to remove.
- **VALIDATE**: `docker compose --env-file .env config` prints the rendered config with no `${...}` placeholders remaining and no warnings about missing variables.

### UPDATE `apps/backend/src/index.ts` — env-driven CORS

- **IMPLEMENT**:
  - Replace `origin: 'http://localhost:5173'` (line 16) with `origin: process.env.FRONTEND_URL`.
  - Add a startup guard near the top of the file (after `dotenv.config()`): if `!process.env.FRONTEND_URL || !process.env.SESSION_SECRET`, `console.error` and `process.exit(1)`.
  - Remove the `'archon-secret'` fallback on line 21: `secret: process.env.SESSION_SECRET!` (the guard above makes this safe).
- **PATTERN**: existing structure — keep all middleware in this file.
- **IMPORTS**: no new imports yet; session store change is its own task below.
- **GOTCHA**: `cors`'s `origin` rejects requests from any other origin when set to a single string — that is exactly what we want. Do not pass `true` (would echo any origin), and do not pass an array unless multiple origins are explicitly required.
- **VALIDATE**: With `.env` set, `bun run dev` in `apps/backend` starts cleanly. `curl -i http://localhost:4000/health -H 'Origin: http://localhost:5175'` returns `Access-Control-Allow-Origin: http://localhost:5175`. `curl -i http://localhost:4000/health -H 'Origin: http://evil.example'` does not include that header.

### UPDATE `apps/backend/src/routes/auth.ts` — env-driven OAuth redirect

- **IMPLEMENT**: Replace `res.redirect('http://localhost:5173')` (line 15) with `res.redirect(process.env.FRONTEND_URL!)`.
- **PATTERN**: Use the same env var as CORS — single source of truth for "where the frontend lives".
- **GOTCHA**: Don't introduce a `?? 'http://localhost:5173'` fallback. The startup guard in `index.ts` makes the env var presence a precondition.
- **VALIDATE**: Read the file post-edit; `Grep` for `localhost:5173` in `apps/backend/` returns zero matches in `.ts` files (compiled `.js` will still have it until rebuild — that's fine, ignore generated output).

### UPDATE `apps/backend/src/config/passport.ts` — env-driven OAuth credentials

- **IMPLEMENT**:
  - Replace `process.env.GITHUB_CLIENT_ID || 'dummy'` (line 24) with `process.env.GITHUB_CLIENT_ID!`.
  - Replace `process.env.GITHUB_CLIENT_SECRET || 'dummy'` (line 25) with `process.env.GITHUB_CLIENT_SECRET!`.
  - Replace `callbackURL: 'http://localhost:4000/auth/github/callback'` (line 26) with `callbackURL: \`${process.env.BACKEND_URL}/auth/github/callback\``.
  - Add a fail-fast check at the top of this module (after `dotenv.config()`): throw if any of the three vars are missing.
- **GOTCHA**: `passport-github2` constructs the strategy at module-load time, before the `index.ts` guard runs. Validate here as well.
- **VALIDATE**: Start backend with one of the three vars unset → process exits with a clear error message. Start with all set → no error. `Grep` for `'dummy'` in `apps/backend/src/` returns zero matches.

### UPDATE `apps/backend/src/controllers/workflow.ts` — gate `status` filter

- **IMPLEMENT**:
  - In `getWorkflows`, replace the current `status ? { status: status as any } : { status: 'PUBLISHED' }` (line 19) with:
    ```ts
    const isAdmin = (req.user as any)?.isAdmin === true;
    const allowedStatuses = ['PUBLISHED', 'QUARANTINED', 'REJECTED'] as const;
    const requestedStatus =
      isAdmin && typeof status === 'string' && allowedStatuses.includes(status as any)
        ? (status as typeof allowedStatuses[number])
        : 'PUBLISHED';
    // ...
    { status: requestedStatus }
    ```
  - Non-admin requests with `?status=` are silently coerced to `PUBLISHED` (don't 403 — anonymous browsing should keep working; just ignore the param).
- **PATTERN**: existing controller error-handling style (`try/catch`, `console.error`, `res.status(500)`).
- **GOTCHA**: Do not gate the *endpoint* behind auth — anonymous browsing of published workflows is required (PRD §10 "Public" table). Only the `status` *parameter* is admin-gated.
- **VALIDATE**: Without auth: `curl 'http://localhost:4000/workflows?status=QUARANTINED'` returns only `PUBLISHED` rows. With admin session cookie: the same request returns `QUARANTINED` rows.

### ADD dependency `connect-pg-simple` to `apps/backend`

- **IMPLEMENT**: From `apps/backend/`: `bun add connect-pg-simple` and `bun add -D @types/connect-pg-simple`.
- **VALIDATE**: `apps/backend/package.json` lists both. `bun install` is clean.

### UPDATE `apps/backend/src/index.ts` — wire `connect-pg-simple`

- **IMPLEMENT**:
  ```ts
  import connectPgSimple from 'connect-pg-simple';

  const PgSession = connectPgSimple(session);

  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true, // package creates the table on first start; migrations dir is gitignored
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }) as any);
  ```
- **PATTERN**: existing `session(...)` block at lines 20–28; preserve the `as any` cast (it's there because of an Express type mismatch with the upstream `express-session` types).
- **GOTCHA**: `connect-pg-simple` will use its own pg pool when `conString` is provided. That's fine for v1; Phase 4+ may want to share Prisma's pool — out of scope now.
- **GOTCHA**: `httpOnly` and `sameSite: 'strict'` are also a Phase 7 concern, but adding them now is free and prevents regression.
- **GOTCHA**: `createTableIfMissing: true` requires the DB user to have `CREATE` on the schema. The default `archon` user from `docker-compose.yml` is the DB owner, so this works locally. Document for Phase 8 production deploys that the runtime user must have schema-create privileges *or* the table must be pre-created out-of-band.
- **VALIDATE**:
  - First boot: `SELECT to_regclass('public.session');` returns `session` (table auto-created).
  - Log in via OAuth, restart backend (`Ctrl-C`, `bun run dev` again), refresh `/auth/me` → still authenticated. Confirms persistence.
  - `SELECT count(*) FROM "session";` increments after login.

### UPDATE `apps/frontend/src/components/HomeIsland.tsx` — fetch real workflows

- **IMPLEMENT**:
  - Remove the `DUMMY_WORKFLOWS` constant (lines 11–32).
  - Add state: `const [workflows, setWorkflows] = useState<LeaderboardItem[]>([]); const [workflowsLoading, setWorkflowsLoading] = useState(true); const [workflowsError, setWorkflowsError] = useState<string | null>(null);`
  - Add fetch alongside `fetchUser`:
    ```ts
    const fetchWorkflows = async () => {
      try {
        const res = await axios.get(`${API_URL}/workflows`);
        const items: LeaderboardItem[] = res.data.map((w: any) => ({
          id: w.id,
          name: w.name,
          description: w.description ?? '',
          owner: w.owner,
          repo: w.repo,
          installCount: w.installCount,
          stars: w._count?.stars,
          securityScore: w.securityScore,
        }));
        setWorkflows(items);
      } catch (err) {
        setWorkflowsError('Failed to load workflows');
      } finally {
        setWorkflowsLoading(false);
      }
    };

    useEffect(() => { fetchUser(); fetchWorkflows(); }, []);
    ```
  - Replace `<Leaderboard items={DUMMY_WORKFLOWS} />` with a small switcher: spinner while `workflowsLoading`, error block if `workflowsError`, otherwise `<Leaderboard items={workflows} />`. The `Leaderboard` component already renders an empty state — no need to special-case zero rows here.
- **PATTERN**: existing `fetchUser` (lines 39–48) — same style, no `withCredentials` needed since `/workflows` is public.
- **GOTCHA**: API returns `description: string | null`; `LeaderboardItem.description` is required `string`. Coerce with `?? ''`.
- **GOTCHA**: API returns `_count.stars` (Prisma include), not `stars`. Map it.
- **VALIDATE**: With backend running and DB seeded with at least one PUBLISHED workflow, the leaderboard renders that row. With DB empty, the empty state shows. With backend down, the error state shows.

### REMOVE `apps/frontend/src/components/Hero.tsx`

- **IMPLEMENT**: Delete the file.
- **PRECONDITION**: `Grep` for `from.*Hero['"]` and `import.*Hero` across `apps/frontend/src/` returns zero hits in non-deleted files.
- **VALIDATE**: `Grep` for `Hero` returns no source references after deletion. `bun run build` in `apps/frontend/` succeeds.

### REMOVE `apps/frontend/src/components/WorkflowCard.tsx`

- **IMPLEMENT**: Delete the file.
- **PRECONDITION**: `Grep` for `WorkflowCard` across `apps/frontend/src/` returns zero hits.
- **VALIDATE**: `Grep` for `WorkflowCard` returns no source references. `bun run build` succeeds.

### UPDATE `apps/backend/.env` (local dev)

- **IMPLEMENT**: After confirming `.env.example` is right, sync `apps/backend/.env` (or root `.env` if Compose flow is preferred) with the new variables: `FRONTEND_URL`, `BACKEND_URL`. Existing values stay.
- **GOTCHA**: This file should be in `.gitignore`. If it's currently tracked, that's a separate cleanup discussed above.
- **VALIDATE**: `bun run dev` starts cleanly with no missing-var crash.

### VERIFY end-to-end

- **IMPLEMENT**: Run the full stack and walk the OAuth flow.
- **VALIDATE**:
  1. `docker compose --env-file .env up -d db pgadmin`
  2. `cd apps/backend && bun run dev` — clean start, no fallback warnings
  3. `cd apps/frontend && bun run dev` — Astro on `:5175`
  4. Visit `http://localhost:5175` → leaderboard shows real DB rows (or empty state)
  5. Click "Sign in with GitHub" → completes; redirects to `http://localhost:5175`; `/auth/me` returns user
  6. Restart backend; refresh page; still logged in (session persistence)
  7. `curl 'http://localhost:4000/workflows?status=QUARANTINED'` (anonymous) → only PUBLISHED rows
  8. As an admin user (`UPDATE "User" SET "isAdmin"=true WHERE username='you'`), same request → QUARANTINED rows visible

---

## TESTING STRATEGY

This codebase has no test runner wired up yet (no `test` script in `apps/backend/package.json`). Phase 2 does not introduce one — that's a separate decision. Validation here is **manual + curl-based**, with the understanding that Phase 7 will add proper test infrastructure.

### Unit Tests

Out of scope for Phase 2. Tracked as deferred work for whichever phase introduces a test framework (likely Phase 7 alongside `pino`/`helmet`).

### Integration Tests

Manual validation per the "VERIFY end-to-end" task above. Each backend change has a `curl` or browser step that proves the behavior end-to-end against a running stack.

### Edge Cases

- **Missing `FRONTEND_URL` / `SESSION_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `BACKEND_URL`** — backend exits at startup with a clear error.
- **`?status=` from anonymous user** — silently returns PUBLISHED rows, never QUARANTINED/REJECTED.
- **`?status=BOGUS` from admin** — coerced to PUBLISHED (whitelist, not blacklist).
- **Backend restart with active session** — user remains authenticated (Postgres-backed session).
- **Backend down on page load** — leaderboard shows error state, doesn't crash the island.
- **Empty DB** — leaderboard shows the existing empty-state copy from `Leaderboard.tsx:55-57`.
- **Workflow with `description: null`** — coerced to empty string; row renders without crashing the truncate.

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

There is no project-wide lint/format runner today. The closest signals:

```powershell
# Backend type-check
cd apps/backend; bun x tsc --noEmit

# Frontend type-check (Astro)
cd apps/frontend; bun run check

# Frontend production build
cd apps/frontend; bun run build
```

### Level 2: Unit Tests

N/A — see "Testing Strategy" above.

### Level 3: Integration Tests

```powershell
# 1. Compose config renders fully
docker compose --env-file .env config | Out-Null

# 2. DB up, migration applied
docker compose --env-file .env up -d db
cd apps/backend; bun x prisma migrate deploy

# 3. Backend boot
cd apps/backend; bun run dev
# (separate terminal)

# 4. Public endpoint reachable
curl -i http://localhost:4000/health

# 5. Status gating
curl -s "http://localhost:4000/workflows?status=QUARANTINED" | python -m json.tool
# expect: only PUBLISHED rows (or empty array)
```

### Level 4: Manual Validation

Walk the steps in "VERIFY end-to-end" above. Pay special attention to:

- OAuth round-trip lands back on `:5175`, not `:5173`.
- After backend restart, `GET /auth/me` still returns the user (session persistence).
- Leaderboard reflects real DB state (insert a row via psql to confirm).

### Level 5: Additional Validation (Optional)

```powershell
# Confirm no leaks of removed strings (exclude compiled artifacts and plan docs)
# Use the Grep tool. Restrict with `--glob '!**/*.js' --glob '!**/*.d.ts' --glob '!plans/**' --glob '!.agents/**'`.
# Expected: zero hits in `apps/` *.ts source for each of these:
# - "localhost:5173"
# - "DUMMY_WORKFLOWS"
# - "archon-secret"
# - "'dummy'" (the OAuth credential fallback in passport.ts)
# Note: `apps/backend/src/**/*.js` and `*.d.ts` are tracked stale build outputs and will still
# contain these strings — that's expected and out of scope for Phase 2.
```

---

## ACCEPTANCE CRITERIA

- [ ] `apps/backend/src/index.ts` reads `FRONTEND_URL` for CORS; backend exits at startup if it's missing.
- [ ] `apps/backend/src/routes/auth.ts` redirects OAuth callback to `process.env.FRONTEND_URL`.
- [ ] `apps/backend/src/config/passport.ts` reads `BACKEND_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` from env with no fallbacks; throws if any are missing.
- [ ] `GET /workflows?status=...` honors the param only when `req.user.isAdmin === true`; otherwise returns PUBLISHED rows.
- [ ] `apps/frontend/src/components/HomeIsland.tsx` no longer references `DUMMY_WORKFLOWS`; leaderboard renders rows fetched from `/workflows`.
- [ ] Loading, empty, and error states all visibly work.
- [ ] `docker-compose.yml` contains no literal passwords or DB URLs; all values come from `.env`.
- [ ] `.env.example` exists at repo root and documents every variable used in compose / backend / frontend.
- [ ] Sessions persist across backend restarts (`connect-pg-simple` wired and table migrated).
- [ ] `apps/frontend/src/components/Hero.tsx` and `WorkflowCard.tsx` are deleted with zero remaining importers.
- [ ] Backend type-check (`bun x tsc --noEmit`) passes.
- [ ] Frontend `bun run check` and `bun run build` pass.
- [ ] OAuth login round-trip works against the running stack and lands on `:5175`.
- [ ] No regressions in the existing admin or submission flows.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All Level 1 + Level 3 + Level 4 validation commands executed successfully
- [ ] No type errors in either workspace
- [ ] Manual OAuth round-trip confirmed
- [ ] Acceptance criteria all met
- [ ] Removed-strings audit (`localhost:5173`, `DUMMY_WORKFLOWS`, `archon-secret`, `'dummy'`) clean across `apps/`
- [ ] `git status` shows the expected file changes; nothing rogue
- [ ] One commit per logical sub-task is acceptable; squash before PR

---

## NOTES

**Why a single `FRONTEND_URL` instead of a CORS allowlist array?** The deployment topology (PRD §6) puts everything behind Caddy in production, so cross-origin only ever happens in local dev. A single string keeps config trivially correct and removes the foot-gun of a wildcard or echo-origin CORS setup.

**Why fail-loud on missing env vars instead of dev-friendly fallbacks?** Phases 4–7 will add real secrets (GitHub App private key, webhook HMAC, etc.). Building the muscle of "missing env = process.exit(1)" now means we don't ship a half-configured production. Local dev pays a tiny one-time cost (`cp .env.example .env`); production gets correctness.

**Why not put session table into `schema.prisma`?** `connect-pg-simple` owns its schema; mixing ownership causes drift warnings and surprising behavior on future migrations. The migration file is the canonical source. If a future phase wants Prisma to manage it, that's a separate, deliberate refactor.

**Why migrate `apps/backend/.env` to root `.env`?** Compose reads `.env` from the directory containing the compose file. Keeping a single root `.env` matches `docker-compose.prod.yml`'s convention and avoids the `apps/backend/.env` vs `apps/sync-worker/.env` split confusing future contributors. Backend dev outside Compose can still read it via `dotenv` by symlinking or by `dotenv-cli`. Decision: keep `apps/backend/.env` for local non-Docker dev *and* add root `.env` for Compose; both reference `.env.example`. (Alternative: drop the per-app `.env` files entirely once Phase 8 lands.)

**Tracked-secret cleanup.** Pre-flight confirmed `.env` files are NOT tracked (`.gitignore` line 14 + `git ls-files` empty). No history rewrite needed.

**Compiled-artifact noise.** `apps/backend/src/**/*.js` and `*.d.ts` are tracked legacy build output that still contain `localhost:5173`. Runtime uses `bun --watch src/index.ts` so they don't affect behavior. Out of scope; flagged for a future cleanup phase.

**Confidence Score: 9.5/10** for one-pass implementation.

Resolved risks (from prior 8/10 draft):
- ✅ `isAdmin` middleware existence verified — already present, just import.
- ✅ `.env` tracking status verified — not tracked; no destructive cleanup needed.
- ✅ `connect-pg-simple` migration approach replaced by `createTableIfMissing: true` — eliminates the entire Prisma-migration uncertainty (and the `migrations/` gitignore that would have silently dropped it).
- ✅ Compose port mapping (`3000:4000`) verified, `BACKEND_URL` value pinned correctly.
- ✅ Compiled `.js`/`.d.ts` noise documented with exclusion pattern for grep audits.

Remaining residual risk:
- Schema-create privilege for `createTableIfMissing` on a future production deploy — flagged in the GOTCHA, not a Phase 2 blocker.
