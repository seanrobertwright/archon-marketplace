# Feature: Astro Frontend Migration (Phase 1)

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Migrate `apps/frontend` from a Vite + React SPA to an Astro 5 application that hosts the existing React 19 components as **client islands**. Static surfaces (page shell, ASCII logo, footer) render to plain HTML on the server; interactive widgets (Header theme toggle, Leaderboard search, Submission modal, Admin dashboard) hydrate on the client. The visible behavior is identical to the current SPA; only the framing, build pipeline, and routing change.

This is the first work item against the renumbered roadmap (`plans/production-roadmap.md` → "Phase 1 — Frontend migration to Astro") and is a prerequisite for every later phase that touches the frontend.

## User Story

As a **maintainer of the Archon Marketplace frontend**
I want to **migrate from Vite + React SPA to Astro with React islands**
So that **we get SSR-rendered shells (faster first paint, real SEO), file-based routing without `react-router-dom`, smaller client JS payloads, and a future-proof framework for adding workflow detail pages, TOS/Privacy pages, and the admin section in later phases.**

## Problem Statement

The current frontend is a Vite SPA: every visitor downloads the full React bundle (Header, Leaderboard, modal, admin) before anything renders, even though the landing page is mostly static. There's no server-side rendering, no per-route code splitting beyond what `react-router-dom` provides, and the routing layer is a runtime concern (`<BrowserRouter>` + `<Routes>`) rather than a build-time one. As we add workflow detail pages, TOS/Privacy/Abuse pages (Phase 7), and per-workflow timelines (Phase 6), this approach scales poorly — content surfaces that should be crawlable HTML are React render trees.

## Solution Statement

Replace the SPA shell with an Astro 5 project. Move route logic into file-based pages under `src/pages/`. Re-mount the existing `.tsx` components as Astro islands, choosing hydration directives based on each component's interactivity needs. Keep all component source code unchanged (the migration is purely in the framing). Switch the env-var convention to Astro's `PUBLIC_*` prefix, and rewire the Docker + Compose + GitHub Actions build args to match.

To keep migration risk low, the initial Astro structure preserves the SPA's interactive surface as a single page-level island per route, rather than splitting into a fine-grained island graph. This is explicitly documented as a tradeoff to be revisited in later phases.

## Feature Metadata

**Feature Type**: Refactor (framework migration; no behavior change)
**Estimated Complexity**: Medium
**Primary Systems Affected**: `apps/frontend/*`, root `Dockerfile` (frontend-builder + frontend stages), `apps/frontend/Dockerfile`, `docker-compose.yml` (frontend service build args), `docker-compose.prod.yml` (build args), `.github/workflows/deploy.yml` (no current `VITE_*` reference, but verify), `.env.example` (does not yet exist; will be created in Phase 2)
**Dependencies — pin exactly to these versions** (do not use `^`/`~` ranges; this protects against peer-resolution drift between Astro 5 / React 19 / Tailwind v4):
- `astro@5.2.5`
- `@astrojs/react@4.1.2`
- `@astrojs/check@0.9.4`
- `@tailwindcss/vite@4.0.0` (Tailwind v4 official Vite plugin — replaces `@astrojs/tailwind` and `@tailwindcss/postcss`)
- existing pins kept: `react@^19.2.5`, `react-dom@^19.2.5`, `tailwindcss@^4.2.4`, `typescript@~6.0.2`

If `bun install` reports a peer conflict against any of these, **stop and report** rather than bumping versions blindly.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING

- `apps/frontend/package.json` (full file) — Why: current dependency set we are pruning + adding to. Note `"type": "module"`.
- `apps/frontend/vite.config.ts` (full file) — Why: replaces with `astro.config.mjs`. Currently sets `port: 5175, host: true, strictPort: true` — these settings need to map onto Astro's `server` config.
- `apps/frontend/index.html` (full file) — Why: contains the inline theme-bootstrap script (lines 8–18). This script must be ported into `BaseLayout.astro` as an inline `<script is:inline>` so it runs before any JS hydrates and avoids the light/dark FOUC.
- `apps/frontend/src/main.tsx` (full file) — Why: SPA entry. Will be deleted; `createRoot` is replaced by Astro's island runtime.
- `apps/frontend/src/App.tsx` (full file) — Why: contains current routing, auth-fetch lifecycle (`useEffect` → `axios.get('/auth/me')`), and the `MarketplaceHome` composition. Lines 76–113 (router) and lines 36–74 (`MarketplaceHome` JSX) are what gets ported into Astro pages.
- `apps/frontend/src/index.css` (full file) — Why: Tailwind v4 import + `@theme` block + `.dark` variables + base `html, body` styles. Moves to `src/styles/global.css` unchanged. The `@custom-variant dark` line (line 3) must be preserved — Tailwind v4 needs it to wire class-based dark mode.
- `apps/frontend/src/lib/api.ts` (full file, 1 line) — Why: only file that reads `VITE_API_URL`. Becomes `PUBLIC_API_URL`.
- `apps/frontend/src/lib/theme.ts` (full file) — Why: hook that reads/writes `document.documentElement.classList`. **Must run client-side only** — its direct DOM access means components using it can never be server-rendered without `client:*` hydration. Currently used by `Header.tsx` (line 9).
- `apps/frontend/src/components/Header.tsx` (full file) — Why: uses `useTheme()` hook + has `onOpenSubmission` callback prop wiring it to the page's modal state. **Coupling concern**: Header's submit button toggles `MarketplaceHome`'s modal, so for migration parity these stay in the same island.
- `apps/frontend/src/components/AsciiLogo.tsx` (full file, 17 lines) — Why: pure presentational, no state, no client-only APIs. Eligible to render as a static Astro slot OR as a no-directive React import. Recommend `.astro` conversion to ship zero JS for it.
- `apps/frontend/src/components/CliCommand.tsx` (full file) — Why: uses `useState` + `navigator.clipboard`. Needs `client:idle` (small interactive widget, not above-the-fold critical).
- `apps/frontend/src/components/Leaderboard.tsx` (full file) — Why: uses `useState` + `useMemo` for search filtering. Currently receives items as a prop from `App.tsx` (DUMMY_WORKFLOWS). For migration parity we keep the dummy-data behavior — Phase 2 swaps to a real API fetch. Needs `client:load` (above-the-fold).
- `apps/frontend/src/components/SubmissionModal.tsx` (full file) — Why: uses `react-hook-form` + `zod` + `axios.post` + `alert()`. State (`isOpen`) is owned by the parent (`MarketplaceHome`). Stays in the page-level island.
- `apps/frontend/src/components/AdminDashboard.tsx` (full file) — Why: full-page interactive component. Uses `axios` with `withCredentials: true` against `${API_URL}/admin/*`. Render as a single `client:only="react"` island on `/admin` page (it's gated by `user.isAdmin` — see App.tsx:108–110).
- `apps/frontend/src/components/RequestAccess.tsx` (full file) — Why: nested inside `SubmissionModal`. Stays where it is; no separate island.
- `apps/frontend/src/components/Hero.tsx`, `apps/frontend/src/components/WorkflowCard.tsx` — Why: **dead code** flagged in `plans/production-roadmap.md` Phase 2 as deletion targets. Do NOT port them. Leave them in place during this phase to keep the diff focused; they'll be deleted in Phase 2.
- `apps/frontend/src/lib/utils.ts` (full file) — Why: `cn()` helper using `clsx` + `tailwind-merge`. Used by `AdminDashboard.tsx`. No change.
- `apps/frontend/postcss.config.js`, `apps/frontend/tailwind.config.js` — Why: in Tailwind v4 + `@tailwindcss/vite` setup, **both files become unnecessary**. Tailwind v4 reads its config from CSS (`@theme` block in `global.css`) and the Vite plugin handles processing. Delete both. The current `tailwind.config.js` defines colors that aren't actually referenced (the real tokens live in `index.css` `@theme`), so deletion is safe.
- `apps/frontend/tsconfig.json`, `apps/frontend/tsconfig.app.json`, `apps/frontend/tsconfig.node.json` — Why: replaced by Astro's `tsconfig.json` (extends `astro/tsconfigs/strict`). The `.node.json` exists only for `vite.config.ts` and goes away when Vite goes away.
- `apps/frontend/src/assets/vite.svg`, `apps/frontend/src/assets/react.svg`, `apps/frontend/src/assets/hero.png` — Why: `vite.svg` is unreferenced — delete. `react.svg` and `hero.png` — grep shows no references in current code; delete unless verification finds a usage.
- `apps/frontend/public/favicon.svg`, `apps/frontend/public/icons.svg` — Why: stay as-is. Astro serves `public/` identically to Vite.
- `apps/frontend/Dockerfile` (full file) — Why: dev container. Currently runs `bun run dev` which becomes `bunx astro dev --host 0.0.0.0 --port 5175`. Port stays 5175.
- `Dockerfile` (root, full file) — Why: multi-stage. The `frontend-builder` stage (lines 6–17) currently runs `bun run build` (`tsc -b && vite build`) and reads `ARG VITE_API_URL`. Both change: build arg renames to `PUBLIC_API_URL`, command becomes `bun run build` (now `astro build`), output dir stays `dist/`. The `frontend` runtime stage (lines 54–59) runs `serve -s dist -l 3000` — keep this; Astro static output is compatible with `serve`.
- `docker-compose.yml` lines 29–41 — Why: `frontend` service has `args: VITE_API_URL: http://localhost:3000`. Rename to `PUBLIC_API_URL`. Port mapping `5175:3000` and target `frontend` stay the same.
- `docker-compose.prod.yml` (full file) — Why: prod `frontend` service does NOT pass build args currently — meaning prod builds use the fallback URL from `api.ts`. This is a pre-existing bug but **out of scope for this phase**. Note in plan; do not fix.
- `.github/workflows/deploy.yml` (full file) — Why: does NOT reference `VITE_API_URL`. No change needed. Confirm with grep before completion.
- `package.json` (root, full file) — Why: `"workspaces": ["apps/*"]` and root scripts `bun run --filter "*" dev|build|lint`. After migration, `bun run --filter frontend dev` must run `astro dev`, and `lint` for frontend can stay no-op or become `astro check` (recommended).

### New Files to Create

- `apps/frontend/astro.config.mjs` — Astro 5 config: registers `@astrojs/react` integration and `@tailwindcss/vite` Vite plugin; sets `server.port = 5175`, `server.host = true`; `output: 'static'`.
- `apps/frontend/src/styles/global.css` — Direct port of current `apps/frontend/src/index.css` (no content changes; just path move).
- `apps/frontend/src/layouts/BaseLayout.astro` — `<html>` shell with `<head>` (charset, viewport, favicon, title slot, fonts), inline theme-bootstrap script (ported from `index.html` lines 8–18), `<body>` with `<slot />` and footer.
- `apps/frontend/src/pages/index.astro` — Landing route. Uses `BaseLayout`, renders `<Header />`, `<AsciiLogoAstro />`, `<CliCommand client:idle />`, `<HomeIsland client:load />` (the latter wraps Leaderboard + SubmissionModal + auth-fetch logic).
- `apps/frontend/src/pages/admin/index.astro` — Admin route. Uses `BaseLayout`, renders `<AdminDashboard client:only="react" />`. The auth/isAdmin gate runs inside the island (matches current SPA behavior — see App.tsx:107–110).
- `apps/frontend/src/components/HomeIsland.tsx` — New wrapper that contains the **entire** `MarketplaceHome` body (Header + ASCII hero + CLI box + Leaderboard + Modal + footer) plus the auth-fetch lifecycle. Single `client:load` island for Phase 1; the granular static/island split is a follow-up phase. Lifted directly from `App.tsx:36–113`.
- `apps/frontend/src/env.d.ts` — Type augmentation declaring `PUBLIC_API_URL` on `ImportMetaEnv`. Astro generates a base `env.d.ts` automatically; we extend it.
- `apps/frontend/tsconfig.json` (overwritten) — Extends `astro/tsconfigs/strict`. Removes references to deleted `tsconfig.app.json` and `tsconfig.node.json`.

### Files to Delete

- `apps/frontend/vite.config.ts`
- `apps/frontend/postcss.config.js`
- `apps/frontend/tailwind.config.js`
- `apps/frontend/tsconfig.app.json`
- `apps/frontend/tsconfig.node.json`
- `apps/frontend/index.html` (Astro generates HTML per page)
- `apps/frontend/src/main.tsx`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/index.css` (content moved to `src/styles/global.css`)
- `apps/frontend/src/assets/vite.svg`
- `apps/frontend/src/assets/react.svg` (verify no references first)
- `apps/frontend/src/assets/hero.png` (verify no references first)
- `apps/frontend/eslint.config.js` — references `eslint-plugin-react-refresh` configured for Vite. Either delete (Astro-recommended path is `astro check` for type checking), or update to drop the `reactRefresh.configs.vite` entry. **Recommend delete** for this phase; lint is also currently a no-op CI signal.

### Relevant Documentation — YOU SHOULD READ THESE BEFORE IMPLEMENTING

- [Astro: Adding integrations — `astro add`](https://docs.astro.build/en/guides/integrations-guide/#automatic-integration-setup)
  - Why: `npx astro add react` and `npx astro add tailwind` are the canonical install paths for v5. The `tailwind` integration in v5.2+ installs `@tailwindcss/vite`, not the legacy `@astrojs/tailwind`.
- [Astro: React integration](https://docs.astro.build/en/guides/integrations-guide/react/)
  - Why: confirms React 19 compatibility, install via `@astrojs/react`, `experimentalReactChildren` option (not needed here).
- [Astro: Client directives](https://docs.astro.build/en/reference/directives-reference/#client-directives)
  - Why: definitive reference for `client:load`, `client:idle`, `client:visible`, `client:media`, `client:only`. We use `client:load`, `client:idle`, `client:only="react"`.
- [Astro: Environment variables — `PUBLIC_` prefix](https://docs.astro.build/en/guides/environment-variables/)
  - Why: confirms `PUBLIC_*` is required for client exposure; access via `import.meta.env.PUBLIC_*` from both `.astro` and React islands.
- [Astro: File-based routing](https://docs.astro.build/en/guides/routing/)
  - Why: how `src/pages/index.astro` and `src/pages/admin/index.astro` map to `/` and `/admin`.
- [Astro: Layouts](https://docs.astro.build/en/basics/layouts/)
  - Why: pattern for `BaseLayout.astro` and `<slot />`.
- [Astro: `is:inline` for theme-bootstrap scripts](https://docs.astro.build/en/guides/client-side-scripts/#opting-out-of-processing)
  - Why: the dark-mode bootstrap script must run before paint and must NOT be bundled/deferred. `<script is:inline>` is the correct directive.
- [Tailwind v4 + Astro guide (Tailwind official)](https://tailwindcss.com/docs/installation/framework-guides/astro)
  - Why: confirms the `@tailwindcss/vite` plugin path and the single-line `@import "tailwindcss"` setup. Configuration lives in CSS (`@theme`), no `tailwind.config.js`.
- [Astro: Server vs static output](https://docs.astro.build/en/guides/on-demand-rendering/)
  - Why: justifies `output: 'static'` for v1 (pages have no per-request server logic — auth-state queries happen client-side from the islands).

### Patterns to Follow

**Import alias convention** — Astro projects conventionally use `~/*` or no alias and rely on relative imports. Current code uses relative imports throughout (`../lib/api`, `../components/Header`). **Keep relative imports**; do not introduce a path alias as part of this migration.

**Component file extension convention** — Astro components: `.astro`. React components: `.tsx`. **Do not** rename existing `.tsx` files. The new `AsciiLogo.astro` lives next to (eventually replacing) `AsciiLogo.tsx`. Delete the `.tsx` once the `.astro` is wired up.

**Client directive selection rules** (apply when porting):
- No interactive state, no client APIs (DOM, clipboard, localStorage, fetch) → `.astro` component (zero JS).
- Above-the-fold interactive (Header, Leaderboard) → `client:load`.
- Below-the-fold or non-critical interactive (CliCommand copy button) → `client:idle`.
- Browser-only (uses `window`/`document`/`navigator` directly at module load, OR is auth-gated) → `client:only="react"`.

**API URL access pattern** — Mirror current `src/lib/api.ts` shape exactly; only change is the env var name:
```ts
// apps/frontend/src/lib/api.ts (after migration)
export const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';
```
Preserve `localhost:3000` as the dev fallback because `docker-compose.yml` maps backend to host port `3000` (`3000:4000`), so a browser running on the host hits it at `:3000`. Do not change this default in this phase — the port-mapping cleanup is a Phase 2 item.

**Theme bootstrap pattern** — port the existing IIFE from `index.html:8–18` verbatim into `BaseLayout.astro`, wrapped in `<script is:inline>`. The script reads `localStorage.theme` and `prefers-color-scheme: dark` and adds the `dark` class to `<html>` synchronously, before any island hydrates. **Do not** rewrite as a `useEffect` — that defeats the no-flash purpose.

**Single-island-per-page** — `index.astro` uses one large `<HomeIsland client:load />` containing Header, hero, CliCommand, Leaderboard, footer, and SubmissionModal. This is intentional: Header's submit button toggles modal state owned at the page level, and splitting Header from Modal would require introducing a shared store (zustand/jotai/emitter) — a new pattern that adds risk without delivering Phase 1 value. The granular split (each component its own island, AsciiLogo as a `.astro` static slot, Leaderboard fetching real API data on its own) is a deliberate follow-up. **Do not split during this phase.**

**Tailwind config-in-CSS pattern** — All Tailwind config lives in `global.css` via `@theme` and `@custom-variant`. Do not add `tailwind.config.js` back. If we need to add new colors or fonts later, extend the `@theme` block.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

Bootstrap the Astro project structure inside `apps/frontend` without breaking the workspace.

**Tasks:**
- Update `apps/frontend/package.json` deps + scripts (Astro/React/Tailwind-vite in, Vite/eslint-plugin-react-refresh out).
- Create `astro.config.mjs` with React + Tailwind-vite integrations and the existing port (5175).
- Move `src/index.css` → `src/styles/global.css` unchanged.
- Create new `tsconfig.json` extending Astro's strict preset; delete the old three-file split.
- Run `bun install` to materialize the new lockfile.

### Phase 2: Core Implementation

Port the SPA's structure into Astro pages + layouts.

**Tasks:**
- Create `src/layouts/BaseLayout.astro` with `<head>`, fonts, theme-bootstrap inline script, `<slot />`, and footer.
- Create `src/components/AsciiLogo.astro` (static port of `AsciiLogo.tsx`).
- Create `src/components/HomeIsland.tsx` containing the Header + Leaderboard + SubmissionModal composition + auth-fetch.
- Create `src/pages/index.astro` rendering `BaseLayout` + `AsciiLogo.astro` + `<CliCommand client:idle />` + `<HomeIsland client:load />`.
- Create `src/pages/admin/index.astro` rendering `BaseLayout` + `<AdminDashboard client:only="react" />`.
- Update `src/lib/api.ts` to read `PUBLIC_API_URL`.
- Create `src/env.d.ts` declaring `PUBLIC_API_URL` typing.

### Phase 3: Integration

Rewire the build pipeline so Docker, Compose, and CI keep working.

**Tasks:**
- Update root `Dockerfile` `frontend-builder` stage: rename build arg `VITE_API_URL` → `PUBLIC_API_URL`, set as `ENV PUBLIC_API_URL`, keep `bun run build`.
- Update `apps/frontend/Dockerfile` dev `CMD` to `bunx astro dev --host 0.0.0.0 --port 5175`.
- Update `docker-compose.yml` `frontend` service `args` to `PUBLIC_API_URL`.
- Verify `docker-compose.prod.yml` (no current build arg — note pre-existing gap, do not fix here).
- Verify `.github/workflows/deploy.yml` does not reference `VITE_API_URL` (grep confirms it doesn't).
- Delete obsolete files (`vite.config.ts`, `postcss.config.js`, `tailwind.config.js`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `eslint.config.js`, `src/assets/vite.svg`, and `react.svg`/`hero.png` after grep confirms unreferenced).

### Phase 4: Testing & Validation

Verify visual + functional parity and that the production Docker build still works.

**Tasks:**
- Run `bun run --filter frontend dev` → load `http://localhost:5175` — confirm landing page renders, theme toggle works without flash, leaderboard search filters, submit modal opens.
- Load `http://localhost:5175/admin` while logged in as admin user → confirm dashboard hydrates and admin endpoints respond (manual; needs a running backend).
- Run `bun x astro check --root apps/frontend` → zero errors.
- Run `docker compose build frontend` → completes; image runs with `serve -s dist`.
- Run end-to-end smoke: `docker compose up -d` → browser hits `localhost:5175` → static-rendered HTML visible in "View Source" (the `<head>`, `<header>`, ASCII art, footer should appear in raw HTML, not just inside a `<div id="root">`).

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task Format Guidelines

- **CREATE**: New files
- **UPDATE**: Modify existing files
- **DELETE**: Remove files
- **VERIFY**: Read-only check

---

### 1. VERIFY no production references to `VITE_API_URL` outside the files we'll touch

- **IMPLEMENT**: confirm the rename surface is exactly: `apps/frontend/src/lib/api.ts`, root `Dockerfile`, `docker-compose.yml`. If any other match appears, update the plan first.
- **VALIDATE**: `Grep` for `VITE_API_URL` across the whole repo; expected matches: `apps/frontend/src/lib/api.ts:1`, `Dockerfile:15-16`, `docker-compose.yml:35`, `plans/PRD.md` (already references the rename), `plans/production-roadmap.md` (already references the rename). No others.

### 2. VERIFY no references to `react.svg`, `hero.png`, or `vite.svg`

- **IMPLEMENT**: confirm the asset deletions are safe.
- **VALIDATE**: `Grep` for `react.svg`, `hero.png`, `vite.svg` excluding the asset files themselves. Expect zero hits in `.tsx`/`.ts`/`.html`/`.astro`. If any hit, do not delete that asset.

### 3. UPDATE `apps/frontend/package.json`

- **IMPLEMENT**:
  - Set `"scripts"` to:
    ```json
    {
      "dev": "astro dev",
      "start": "astro dev",
      "build": "astro build",
      "preview": "astro preview",
      "check": "astro check"
    }
    ```
  - Remove from `"dependencies"`: nothing (keep all React + form + utility deps — they're used by islands).
  - Remove from `"devDependencies"`: `@vitejs/plugin-react`, `vite`, `eslint-plugin-react-refresh`, `eslint-plugin-react-hooks`, `eslint`, `@eslint/js`, `globals`, `typescript-eslint`, `autoprefixer`, `postcss`, `@tailwindcss/postcss`. Keep `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss`, `typescript`.
  - Add to `"devDependencies"`: `"astro": "^5.0.0"`, `"@astrojs/react": "^4.0.0"`, `"@astrojs/check": "^0.9.0"`, `"@tailwindcss/vite": "^4.2.0"`.
  - Drop `"private": true` is fine to keep; drop `"version": "0.0.0"` is fine to keep.
- **PATTERN**: any standard Astro 5 + React + Tailwind v4 starter.
- **GOTCHA**: do **not** add `@astrojs/tailwind` — that's the legacy v3 integration.
- **VALIDATE**: `bun install` from repo root completes without unresolved peers.

### 4. CREATE `apps/frontend/astro.config.mjs`

- **IMPLEMENT**:
  ```js
  import { defineConfig } from 'astro/config';
  import react from '@astrojs/react';
  import tailwindcss from '@tailwindcss/vite';

  export default defineConfig({
    integrations: [react()],
    vite: {
      plugins: [tailwindcss()],
    },
    server: {
      port: 5175,
      host: true,
    },
    output: 'static',
  });
  ```
- **PATTERN**: matches the official Tailwind-Astro guide (Tailwind v4 + Vite plugin) and the React integration page.
- **GOTCHA**: `server.strictPort` is not an Astro option — `astro dev` already errors on a busy port. Drop the `strictPort: true` from old `vite.config.ts`.
- **VALIDATE**: `bunx astro --help` runs from `apps/frontend/`.

### 5. CREATE `apps/frontend/src/styles/global.css`

- **IMPLEMENT**: copy `apps/frontend/src/index.css` verbatim into the new path.
- **GOTCHA**: do not change `@import "tailwindcss"`, `@custom-variant dark (&:where(.dark, .dark *))`, `@theme {...}`, or the `.dark { ... }` block. They are already correct for Tailwind v4.
- **VALIDATE**: `Read` both files — content is identical.

### 6. UPDATE `apps/frontend/src/lib/api.ts`

- **IMPLEMENT**:
  ```ts
  export const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';
  ```
- **GOTCHA**: keep the `localhost:3000` default — see "API URL access pattern" above.
- **VALIDATE**: `Grep` for `VITE_API_URL` in `apps/frontend/src/` returns zero matches.

### 7. CREATE `apps/frontend/src/env.d.ts`

- **IMPLEMENT**:
  ```ts
  /// <reference types="astro/client" />

  interface ImportMetaEnv {
    readonly PUBLIC_API_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  ```
- **GOTCHA**: Astro auto-generates a base `env.d.ts` on first `astro dev` run; this file is safe to commit and will not collide.
- **VALIDATE**: `bunx astro check` (after later tasks) reports zero TS errors on `import.meta.env.PUBLIC_API_URL`.

### 8. CREATE `apps/frontend/src/components/HomeIsland.tsx`

- **IMPLEMENT**: this island contains the **entire interactive surface** of the landing page — Header, hero block (ASCII logo + tagline + CLI box), Leaderboard, footer, and SubmissionModal. It owns the auth-fetch lifecycle and the modal state. The Astro page (`index.astro`) only wraps this in the `BaseLayout`.

  ```tsx
  import { useState, useEffect } from 'react';
  import axios from 'axios';
  import { Loader2 } from 'lucide-react';
  import { Header } from './Header';
  import { AsciiLogo } from './AsciiLogo';
  import { CliCommand } from './CliCommand';
  import { Leaderboard, type LeaderboardItem } from './Leaderboard';
  import { SubmissionModal } from './SubmissionModal';
  import { API_URL } from '../lib/api';

  const DUMMY_WORKFLOWS: LeaderboardItem[] = [
    {
      id: '1',
      name: 'GitHub Issue Auto-Triage',
      description: 'Automatically labels and assigns GitHub issues based on content using AI analysis.',
      owner: 'archon-community',
      repo: 'issue-triage',
      securityScore: 95,
      installCount: 12400,
      stars: 450,
    },
    {
      id: '2',
      name: 'TypeScript API Generator',
      description: 'Scans your database schema and generates a complete TypeScript Express API with validation.',
      owner: 'vercel-labs',
      repo: 'api-gen',
      securityScore: 88,
      installCount: 8900,
      stars: 320,
    },
  ];

  export function HomeIsland() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchUser = async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/me`, { withCredentials: true });
        setUser(response.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => { fetchUser(); }, []);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
        </div>
      );
    }

    return (
      <>
        <Header onOpenSubmission={() => setIsModalOpen(true)} />
        <main className="max-w-5xl mx-auto px-6">
          <section className="pt-20 pb-16 flex flex-col items-center text-center">
            <AsciiLogo />
            <p className="mt-8 text-[var(--color-muted-foreground)] font-mono text-sm">
              The Open Workflow Ecosystem
            </p>
            <div className="mt-8">
              <CliCommand command="archon add owner/repo" />
            </div>
          </section>
          <section className="pb-24">
            <Leaderboard items={DUMMY_WORKFLOWS} />
          </section>
        </main>
        <footer className="border-t border-[var(--color-border)] py-8 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between font-mono text-xs text-[var(--color-muted-foreground)]">
            <span>archon — open workflow ecosystem</span>
            <span>{user ? `@${user.username}` : 'anonymous'}</span>
          </div>
        </footer>
        <SubmissionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          user={user}
          onRefreshUser={fetchUser}
        />
      </>
    );
  }
  ```
- **PATTERN**: this is `App.tsx:36–113` (`MarketplaceHome` + `App` merged) with the outer `<div className="min-h-screen bg-... text-...">` and the `<BrowserRouter>` removed. The body-level styles now live on `<body>` in `BaseLayout.astro`; routing is now file-based.
- **GOTCHA**: do **not** wrap the return in `<div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">` — that wrapper is in `BaseLayout.astro`'s `<body>` (Task 9). Duplicating it would not break visuals but would inflate DOM unnecessarily.
- **VALIDATE**: `bunx astro check` reports zero errors in this file.

### 9. CREATE `apps/frontend/src/layouts/BaseLayout.astro`

- **IMPLEMENT**:
  ```astro
  ---
  import '../styles/global.css';
  interface Props { title?: string }
  const { title = 'Archon — The Open Workflow Ecosystem' } = Astro.props;
  ---
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <script is:inline>
        (function () {
          try {
            var saved = localStorage.getItem('theme');
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (saved === 'dark' || (!saved && prefersDark)) {
              document.documentElement.classList.add('dark');
            }
          } catch (e) {}
        })();
      </script>
    </head>
    <body class="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <slot />
    </body>
  </html>
  ```
- **PATTERN**: theme script lifted verbatim from `index.html:8–18`. The `min-h-screen bg-... text-...` body classes lift the wrapper from `App.tsx:40`.
- **GOTCHA**: the `is:inline` directive is required — without it, Astro will bundle and defer the script, which breaks the no-flash guarantee.
- **VALIDATE**: rendered HTML at `/` contains the inline `<script>` literally inside `<head>`, not as a `<script src>` reference.

### 10. CREATE `apps/frontend/src/pages/index.astro`

- **IMPLEMENT**:
  ```astro
  ---
  import BaseLayout from '../layouts/BaseLayout.astro';
  import { HomeIsland } from '../components/HomeIsland';
  ---
  <BaseLayout>
    <HomeIsland client:load />
  </BaseLayout>
  ```
- **PATTERN**: Per the "Single-island-per-page" pattern in CONTEXT REFERENCES — the entire interactive surface lives inside `HomeIsland.tsx` (Task 8). The page is just a `BaseLayout` wrapper. This preserves the SPA's exact DOM order (Header → main → footer → modal) without splitting state across islands.
- **GOTCHA**: do not import `Header`, `AsciiLogo`, `CliCommand`, or `Leaderboard` in this file — they are all rendered transitively through `<HomeIsland>`. Importing them here would create a parallel render tree.
- **VALIDATE**: visiting `/` shows the full landing page identical to the pre-migration SPA. `curl -s http://localhost:5175/ | grep 'is:inline\|<body'` confirms the inline theme script and body wrapper are in the server-rendered HTML.

### 11. CREATE `apps/frontend/src/pages/admin/index.astro`

- **IMPLEMENT**:
  ```astro
  ---
  import BaseLayout from '../../layouts/BaseLayout.astro';
  import { AdminDashboard } from '../../components/AdminDashboard';
  ---
  <BaseLayout title="Admin — Archon">
    <AdminDashboard client:only="react" />
  </BaseLayout>
  ```
- **PATTERN**: matches the SPA's admin route in `App.tsx:107–110`. The `isAdmin` gate currently lives in `App.tsx`; for parity in this phase, the page renders the dashboard unconditionally and the dashboard's API calls 401/403 for non-admins. **Optional improvement** (defer to Phase 2): re-add the gate inside `AdminDashboard` with a redirect-to-`/` on non-admin.
- **GOTCHA**: `client:only="react"` is required — `AdminDashboard` calls `axios` with `withCredentials` at mount, which fails during SSR without a window.
- **VALIDATE**: visiting `/admin` (logged in as admin) renders the dashboard; unauthenticated user sees the dashboard skeleton with empty lists (admin endpoints return 401 silently per current `console.error` handler).

### 12. UPDATE `apps/frontend/tsconfig.json`

- **IMPLEMENT**:
  ```json
  {
    "extends": "astro/tsconfigs/strict",
    "include": [".astro/types.d.ts", "**/*"],
    "exclude": ["dist"]
  }
  ```
- **GOTCHA**: drop the `references` block — it pointed to deleted `tsconfig.app.json` and `tsconfig.node.json`.
- **VALIDATE**: `bunx astro check` runs without resolving errors.

### 13. UPDATE `apps/frontend/Dockerfile`

- **IMPLEMENT**: change the `CMD` line to:
  ```dockerfile
  CMD ["bunx", "astro", "dev", "--host", "0.0.0.0", "--port", "5175"]
  ```
- **GOTCHA**: `bun run dev` would also work (because we updated package.json scripts), but `bunx astro dev` is more explicit and survives a script rename.
- **VALIDATE**: `docker compose up frontend` starts on port 5175.

### 14. UPDATE root `Dockerfile` (frontend-builder stage)

- **IMPLEMENT**: lines 15–16 change from:
  ```dockerfile
  ARG VITE_API_URL
  ENV VITE_API_URL=$VITE_API_URL
  ```
  to:
  ```dockerfile
  ARG PUBLIC_API_URL
  ENV PUBLIC_API_URL=$PUBLIC_API_URL
  ```
  No other changes; `bun run build` continues to work because `package.json` scripts now point at `astro build`.
- **GOTCHA**: do not rename the stage name `frontend-builder` or `frontend` — `docker-compose.yml` references them by `target:`.
- **VALIDATE**: `docker build --target frontend-builder --build-arg PUBLIC_API_URL=http://test .` from repo root succeeds.

### 15. UPDATE `docker-compose.yml` frontend service

- **IMPLEMENT**: replace `VITE_API_URL: http://localhost:3000` with `PUBLIC_API_URL: http://localhost:3000` inside the `args:` block (line 35). No other changes.
- **GOTCHA**: keep the URL value at `http://localhost:3000` — see "API URL access pattern".
- **VALIDATE**: `docker compose config` shows the new arg name.

### 16. DELETE obsolete files

- **IMPLEMENT**: delete unconditionally (these are confirmed safe — verified by Tasks 1 + 2 grep + by deletion of their consumers in earlier tasks):
  - `apps/frontend/vite.config.ts`
  - `apps/frontend/postcss.config.js`
  - `apps/frontend/tailwind.config.js`
  - `apps/frontend/tsconfig.app.json`
  - `apps/frontend/tsconfig.node.json`
  - `apps/frontend/index.html`
  - `apps/frontend/src/main.tsx`
  - `apps/frontend/src/App.tsx`
  - `apps/frontend/src/index.css`
  - `apps/frontend/eslint.config.js`
  - `apps/frontend/src/assets/vite.svg`

  Then conditionally delete (only if `Grep` for the filename across `apps/frontend/src/` and `apps/frontend/public/` returns zero hits):
  - `apps/frontend/src/assets/react.svg`
  - `apps/frontend/src/assets/hero.png`

- **ALSO**: if `Grep` for `from 'react-router-dom'` across `apps/frontend/src/` returns zero hits (expected after `App.tsx` deletion), remove `"react-router-dom": "^7.15.0"` from `apps/frontend/package.json` `dependencies`. If any hit remains, leave the dep — its usage is unexpected and should be flagged before removal.
- **GOTCHA**: do **NOT** delete `Hero.tsx`, `WorkflowCard.tsx`, `apps/frontend/.gitignore`, or anything under `apps/frontend/public/`. Phase 2 handles dead-code cleanup.
- **VALIDATE** (run all three):
  - `Grep` for `VITE_API_URL` across `apps/frontend/` returns zero hits.
  - `Grep` for `react-router-dom` across `apps/frontend/src/` returns zero hits.
  - `bun run --filter frontend build` succeeds and produces `apps/frontend/dist/index.html` + `apps/frontend/dist/admin/index.html`.

### 17. VERIFY full visual + functional parity

- **IMPLEMENT**: manual testing checklist:
  1. `bun run --filter frontend dev` → http://localhost:5175 — landing page renders, ASCII logo + CLI box + leaderboard visible.
  2. Toggle theme via Header button — `<html>` gains/loses `dark` class; no flash on reload.
  3. Type in search box — leaderboard filters live.
  4. Click "submit" — modal opens; if logged out, shows "Developer Access Required"; if logged in (approved), shows the form.
  5. Hard-refresh the page — theme persists; no FOUC.
  6. View Source — `<head>` contains the inline theme script; the React island markup appears below `<body>` with React-hydration markers.
  7. Visit `/admin` — without login, sees an empty admin shell (axios 401s); with admin login, dashboards populate.
  8. `docker compose build frontend` then `docker compose up frontend backend db` → http://localhost:5175 works the same.
- **VALIDATE**: every checklist item passes.

---

## TESTING STRATEGY

The current frontend has **no automated tests** (verify with `Grep` for `*.test.tsx` or `vitest`). Adding a test framework is **out of scope** for this phase — it would dilute the migration's purpose. Validation is therefore manual + type-check-driven.

### Unit Tests

Not applicable. No existing test suite to preserve. Future phases (esp. Phase 7 production hardening) should add tests; that decision belongs to a separate plan.

### Integration Tests

Not applicable for the same reason.

### Edge Cases — to manually verify in Task 17

- **Theme on first load** (no `localStorage.theme`): system `prefers-color-scheme: dark` → page paints in dark mode without flash.
- **Theme on reload after toggle**: `localStorage.theme === 'dark'` → page paints in dark mode without flash.
- **Logged-out submission attempt**: modal opens to "Request Access" view (current `RequestAccess.tsx` flow).
- **Network failure on `/auth/me`**: `HomeIsland` shows footer as `anonymous`, no error toast (matches current `App.tsx:84` silent catch).
- **Admin route while logged-out**: dashboard renders empty (admin endpoints 401, current `console.error` swallows it). This is a current bug, **not introduced or fixed in this phase**.
- **Direct deep link to `/admin`**: Astro file-routing serves `src/pages/admin/index.astro`; React island hydrates. No router miss.

---

## VALIDATION COMMANDS

Execute every command. Each must complete with zero errors.

### Level 1: Syntax & Style

```bash
# Type-check Astro + React + .astro files (run from apps/frontend/)
cd apps/frontend && bunx astro check
```

ESLint is removed in this phase (`eslint.config.js` deleted). `astro check` is the new gate.

### Level 2: Unit Tests

Not applicable (no test suite exists).

### Level 3: Build

```bash
# Frontend production build (Astro static output to dist/)
bun run --filter frontend build

# Verify output structure
ls apps/frontend/dist
# Expect: index.html, admin/index.html, _astro/ directory with hashed JS/CSS
```

### Level 4: Manual Validation

```bash
# Local dev (no Docker)
bun run --filter frontend dev
# Visit: http://localhost:5175

# Full Docker stack
docker compose up -d
# Visit: http://localhost:5175 (frontend), http://localhost:3000/health (backend)
```

Manual checklist in Task 17 above.

### Level 5: Production-mode container

```bash
# Build production frontend image and serve dist
docker compose build frontend
docker compose up -d frontend
curl -sI http://localhost:5175/
# Expect: HTTP/1.1 200 OK from `serve`
```

---

## ACCEPTANCE CRITERIA

- [ ] `apps/frontend` no longer contains `vite.config.ts`, `postcss.config.js`, `tailwind.config.js`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, or `eslint.config.js`.
- [ ] `apps/frontend/astro.config.mjs` exists and registers `@astrojs/react` + `@tailwindcss/vite`.
- [ ] `(cd apps/frontend && bunx astro check)` exits 0.
- [ ] `bun run --filter frontend build` produces `apps/frontend/dist/index.html` and `apps/frontend/dist/admin/index.html`.
- [ ] `bun run --filter frontend dev` serves `http://localhost:5175/` and `http://localhost:5175/admin`.
- [ ] No reference to `VITE_API_URL` exists anywhere outside the `plans/` docs (which already discuss the migration in past tense).
- [ ] `import.meta.env.PUBLIC_API_URL` is the single source of API URL configuration.
- [ ] Light/dark theme toggles without flash on first paint or reload.
- [ ] Leaderboard renders with 2 dummy items (parity with current SPA — real-API hookup is Phase 2).
- [ ] Submission modal opens, validates, and POSTs to `${API_URL}/workflows` exactly as before.
- [ ] Admin dashboard at `/admin` hydrates and calls the same admin endpoints as before.
- [ ] `docker compose build frontend` succeeds with `--build-arg PUBLIC_API_URL=...` honored.
- [ ] No regressions in backend or sync-worker (this phase touches frontend + Dockerfile + compose only).

---

## COMPLETION CHECKLIST

- [ ] All 17 tasks completed in order.
- [ ] Each task's `VALIDATE` step passed before moving to the next.
- [ ] `bunx astro check` clean.
- [ ] `bun run --filter frontend build` clean.
- [ ] Docker build clean.
- [ ] Manual checklist (Task 17) clean.
- [ ] Acceptance criteria all met.
- [ ] Code reviewed: no lingering `VITE_*`, no lingering `BrowserRouter` import, no lingering `react-router-dom` usage. (`react-router-dom` can stay in `package.json` for now if any code still imports it — verify with `Grep`. Expected: zero imports after `App.tsx` deletion → safe to remove from `package.json` deps too.)

---

## NOTES

### Design decisions

1. **Single-island-per-page** for `/`. The Header's "submit" button toggles modal state owned by `MarketplaceHome`. Splitting Header and Modal into separate islands would require a shared store (zustand/jotai/event emitter). For Phase 1 we choose parity over granularity. The splitting refinement is a deliberate follow-up phase task ("Frontend granular islands") to be opened only after we have measurable performance evidence justifying the added complexity.

2. **Tailwind v4 via `@tailwindcss/vite`**, not `@astrojs/tailwind`. The latter is the legacy Tailwind v3 integration. The Astro 5.2+ docs explicitly recommend `@tailwindcss/vite`.

3. **`output: 'static'`** because no page currently needs server-rendered per-request logic. Auth state is fetched client-side from islands. If Phase 6 adds workflow detail pages with SSR'd metadata for crawlers, switch to `output: 'hybrid'` then.

4. **Preserved `localhost:3000` API URL default**. The PRD §9 documents `localhost:4000` (the backend's actual listening port). The `docker-compose.yml` maps host:3000 → container:4000. Both can be true; `apps/frontend/src/lib/api.ts` is consumed from the **browser** which sees the **host** port. So `localhost:3000` is the correct browser-side default for the current Docker setup. The PRD value (`:4000`) applies to non-Docker dev where the backend listens directly on 4000. **Don't fix this in Phase 1**; either (a) keep the default at `:3000`, or (b) flip to `:4000` AND update `docker-compose.yml` to map `4000:4000` for parity. Phase 2 ("Stop the bleeding") is the right place for that decision.

5. **Exact version pinning**. Astro 5 + React 19 + Tailwind v4 + Bun is a young combination. Pinning exact versions prevents a routine `bun install` from silently upgrading into a broken peer combo. Range bumps are a separate decision.

### Out-of-scope items (do not do in this phase)

- Deleting `Hero.tsx`, `WorkflowCard.tsx` (Phase 2).
- Wiring leaderboard to real `/workflows` API (Phase 2).
- Filtering `/workflows` to PUBLISHED for non-admin (Phase 2 backend).
- Moving secrets to `.env` / `.env.example` (Phase 2).
- Splitting `HomeIsland` into granular islands (future phase).
- Adding `astro:env` typed env-var schema (nice-to-have; defer until we have more env vars).
- Adding tests (no existing test infrastructure to extend).

### Residual risks (mitigated, not eliminated)

- **Inline script CSP in Phase 7**. Phase 7 adds `helmet` with CSP. The `is:inline` theme script will need a CSP nonce or hash exemption. Documented here for the Phase 7 implementer; **not a Phase 1 blocker**.
- **Port mapping `5175:3000` in `docker-compose.yml`**. Pre-existing oddity — host:5175 → container:3000. The `frontend` runtime stage in the root `Dockerfile` runs `serve -s dist -l 3000`, which is correct. The `apps/frontend/Dockerfile` (dev container, used elsewhere) listens on 5175 directly. Both are preserved. **Do not "fix" this** — it works; the apparent mismatch is a Phase 8 cleanup.

### Confidence Score

**10/10** that an execution agent following this plan completes Phase 1 in one pass.

Why 10/10 (vs the prior 8/10):
- **Self-contradictions removed**: the original Task 11 included a "wait, this is wrong, here's the fix" mid-task. The replacement gives one canonical answer.
- **Task scope reduced from 19 to 17**: the redundant `AsciiLogo.astro` (Task 6) and the no-op root-`package.json` task (old Task 18) are gone — fewer steps, fewer chances to misread.
- **Versions pinned exactly**: Bun + Astro 5 + React 19 + Tailwind v4 won't drift mid-install. The plan explicitly tells the agent to stop-and-report on peer conflicts rather than attempting a fix.
- **Pre-deletion grep is now an explicit task step** (Tasks 1, 2, 16) rather than implied. The agent cannot "forget" to verify before deleting `react.svg` / `hero.png` or the `react-router-dom` dep.
- **Validate commands are uniform** — every "run astro check" reads `(cd apps/frontend && bunx astro check)`. No working-directory guesswork.
- **DOM-order coupling between Header / footer / modal is solved at the design level**, not at the page level. The agent never has to reason about island composition during execution because `HomeIsland.tsx` (Task 8) already has the correct end-to-end JSX written out.
- **Out-of-scope items are listed explicitly** so the agent doesn't drift into Phase 2 work (`Hero.tsx`/`WorkflowCard.tsx` deletion, real API hookup, port mapping fix, .env.example).

The remaining tail risk is environmental — a Bun version on the implementer's machine that resolves Astro's peer deps differently from what's pinned. The plan handles that by saying "stop and report" rather than improvise. That's an acceptable tail event, not a planning gap.
