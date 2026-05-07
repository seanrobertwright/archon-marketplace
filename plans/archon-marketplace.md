# Implementation Plan - Archon Workflow Marketplace

## 1. 🔍 Analysis & Context
*   **Objective:** Create a fullstack marketplace for Archon Workflows and Node Types, modeled structurally after skills.sh, featuring a modern/clean Vercel-like aesthetic with robust security evaluation.
*   **Tech Stack:** React (Vite) frontend, Node.js/Express backend, Postgres database.
*   **Key Dependencies:**
    *   Frontend: React, Vite, Tailwind CSS, Framer Motion, React Router, Lucide Icons.
    *   Backend: Node.js, Express, Prisma ORM, Passport/OAuth.
    *   Security: AST parsers for bash/YAML, Sandboxing solution (e.g., Docker/gVisor) for dynamic analysis.
*   **Risks/Unknowns:** Safely executing untrusted AI/bash workflows in a sandbox without exposing the host. Reliably detecting prompt injection attacks.

## 2. 🏗️ Architectural Strategy
**Unified Database Sync Architecture & Security Pipeline:**
*   **Postgres:** Central source of truth. Includes fields for `security_score` and `quarantine_status`.
*   **Background Sync Worker:** Periodically fetches registered GitHub repositories and static sources.
*   **Security Evaluation Engine:** Intercepts incoming workflows before saving to DB. Runs Stage 1 (Static Analysis) and Stage 2 (Dynamic Sandboxed Analysis). Assigns a security score (0-100).
*   **API Layer:** Express backend serves search/leaderboard queries, only returning workflows with `security_score >= 80` (or exposing quarantined workflows only to admins).

## 3. 📝 Phased Implementation Plan

### Phase 1: Foundation & Database Setup
*   **Goal:** Initialize the monorepo structure and Postgres database schema.
*   **Action:**
    *   Set up monorepo (`apps/frontend`, `apps/backend`).
    *   Design Postgres schema (`Workflows`, `Users`, `Stars`). Add critical security columns: `security_score` (int), `status` (enum: published, quarantined, rejected), and `security_report` (json).

### Phase 2: Backend API & Sync Engine
*   **Goal:** Build the core API and the synchronization worker.
*   **Action:**
    *   Implement GitHub OAuth.
    *   Create REST endpoints (`GET /api/workflows`, `POST /api/workflows`).
    *   Build the Sync Service to ingest workflow definitions.

### Phase 3: Frontend Design & Core UI
*   **Goal:** Implement the "Modern & Clean" Vercel-like aesthetic.
*   **Action:**
    *   Configure Tailwind CSS (high-contrast monochrome, subtle gradients).
    *   Build the Hero Section with CLI installation command (`archon add <owner/workflow>`).
    *   Build Leaderboard layout with security badges ("Verified Safe").

### Phase 4: Submission Portal & Security Evaluation Pipeline
*   **Goal:** Connect submissions to a rigorous multi-stage security pipeline.
*   **Action:**
    *   **Submission UI:** Build authenticated portal for submitting workflow sources.
    *   **Stage 1 - Static Analysis (SAST):** Implement schema validation, secret scanning, and AST inspection on `bash` nodes (flagging `rm -rf`, `curl`, etc.) and AI nodes.
    *   **Stage 2 - Dynamic Analysis:** Build ephemeral sandbox execution (e.g., restricted Docker container) to test payload injections and monitor behavioral network/filesystem egress.
    *   **Scoring Logic:** Implement ruleset (Start at 100. Critical finding = -100, High = -30, Medium = -15).
    *   **Marketplace Gate:** Auto-publish (>= 80), Quarantine for manual admin review (50 - 79), Auto-reject (< 50). Provide detailed vulnerability reports to authors.

## 4. 🧪 Verification & Testing
*   **Unit Tests:** Test the SAST parsers against known malicious YAML files and hardcoded secrets.
*   **Integration Tests:** Verify the sandboxed execution environment isolates network and filesystem access. Check that a score < 50 prevents the workflow from appearing in the public API.
*   **Manual Verification:** Submit a dummy workflow with a benign command injection to verify the quarantine workflow triggers correctly.

## 5. ✅ Success Criteria
*   Users can browse, search, and sort workflows in a visually stunning interface.
*   The backend unifies and serves workflow data via Postgres.
*   **Zero-Trust Pipeline:** All submitted workflows automatically undergo static and dynamic security analysis.
*   **Automated Gating:** Malicious workflows (score < 50) are automatically rejected, and risky ones are quarantined, protecting end-users from command injection and hardcoded secrets.