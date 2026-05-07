# Implementation Plan - Administration, Sandboxing, & Registration

## 1. 🔍 Analysis & Context
*   **Objective:** Enhance the Archon Marketplace with a restricted submission registration flow, a comprehensive Administrator dashboard, and a Docker-based dynamic sandboxing pipeline.
*   **Context:** The user wants to reduce the attack surface by requiring approval before users can submit workflows. Admins need full control over users and content. Sandboxing needs to be practical for a standard VPS deployment.
*   **Affected Files:**
    *   `apps/backend/prisma/schema.prisma` (Add `isAdmin`, `submissionStatus`)
    *   `apps/backend/src/routes/*` (New admin routes, updated auth/workflow routes)
    *   `apps/frontend/src/App.tsx` (Add routing for Admin Dashboard)
    *   `apps/frontend/src/components/*` (New Admin Dashboard UI, Request Access UI)
    *   `apps/backend/src/services/security.ts` (Integrate Docker sandbox execution)
*   **Key Dependencies:** `dockerode` (for orchestrating Docker containers from Node.js).
*   **Risks/Unknowns:** Managing the lifecycle of temporary Docker containers reliably. Ensuring the Admin dashboard maintains the "Modern & Clean" aesthetic while presenting complex data.

## 2. 🏗️ Architectural Strategy

### A. Restricted Registration Flow
*   **Database:** Add `submissionStatus` (`NONE`, `PENDING`, `APPROVED`, `REJECTED`) to the `User` model.
*   **Flow:**
    1. User logs in via GitHub.
    2. Instead of "Submit", they see "Request Developer Access".
    3. They submit a brief justification. Status becomes `PENDING`.
    4. Admin reviews and sets status to `APPROVED`.
    5. Only then does the "Submit Workflow" button become active.

### B. Administration
*   **Database:** Add `isAdmin` (Boolean, default false) to the `User` model.
*   **Backend:** Create an `isAdmin` middleware. Build `/api/admin/users`, `/api/admin/workflows` (to fetch quarantined items), and endpoints to approve/reject items.
*   **Frontend:** Create an `/admin` route (protected) with tabs for:
    *   **Workflow Moderation:** Review quarantined workflows, view security reports, approve/reject.
    *   **User Management:** Review developer access requests, ban users.
    *   **Content:** Edit workflow metadata or forcefully remove published items.

### C. Dynamic Sandboxing (Stage 2 Security)
*   **Mechanism:** Use the `dockerode` library in the Node.js backend.
*   **Process:**
    1. During the security evaluation pipeline, after Static Analysis (Stage 1) completes...
    2. Create a temporary, restricted Docker container (e.g., using a lightweight Alpine or Debian image).
    3. Configuration: `--network none` (disable internet access), `--read-only` (prevent filesystem modifications outside a specific temporary mount).
    4. Mount the workflow YAML and execute a test run.
    5. Capture stdout/stderr and exit codes. If it attempts to use `curl` or access forbidden paths, the execution will fail or timeout, flagging the workflow.
    6. Destroy the container immediately after evaluation.

## 3. 📝 Phased Implementation Plan

### Phase 1: Database Updates & Registration Flow
*   **Goal:** Implement the "Request & Approval" flow for developers.
*   **Action:**
    *   Update Prisma schema: `submissionStatus` Enum and `isAdmin` Boolean on `User`.
    *   Run Prisma migration.
    *   Backend: Add endpoint `POST /api/users/request-access`.
    *   Frontend: Update `Header.tsx` and `SubmissionModal.tsx` to handle the request flow instead of immediate submission for unapproved users.

### Phase 2: Administrator Dashboard Backend
*   **Goal:** Secure admin endpoints.
*   **Action:**
    *   Create `isAdmin` middleware.
    *   Build Admin REST API:
        *   `GET /api/admin/pending-users`
        *   `POST /api/admin/users/:id/approve`
        *   `GET /api/admin/quarantined-workflows`
        *   `POST /api/admin/workflows/:id/resolve` (Approve/Reject)

### Phase 3: Administrator Dashboard Frontend
*   **Goal:** Build a sleek, data-rich management interface.
*   **Action:**
    *   Set up React Router for the `/admin` path.
    *   Build a sidebar navigation (Workflows, Users, Settings).
    *   Build data tables to review Pending Users and Quarantined Workflows.
    *   Build a detailed "Security Report View" component to show SAST findings clearly to the admin.

### Phase 4: Docker Sandboxing Integration
*   **Goal:** Implement Stage 2 Dynamic Analysis.
*   **Action:**
    *   Install `dockerode`.
    *   Update `security.ts` to include a `runDynamicAnalysis` method.
    *   Implement the logic to spin up an isolated container, run the workflow, capture output, and teardown.
    *   Update the scoring logic to deduct points or automatically reject if the sandbox execution detects malicious intent or crashes unexpectedly.

## 4. 🧪 Verification & Testing
*   **Unit Tests:** Mock `dockerode` to test the dynamic analysis scoring logic without needing actual Docker daemon access during CI.
*   **Integration Tests:** Verify that a standard user cannot access `/api/admin/*` routes.
*   **Manual Verification:**
    1. Log in as a new user -> Verify "Submit" is blocked.
    2. Request access -> Login as Admin -> Approve user.
    3. Login as user -> Submit workflow containing a network request.
    4. Verify dynamic sandbox catches the network request (due to `--network none`) and quarantines the workflow.

## 5. ✅ Success Criteria
*   The attack surface is reduced: only Admin-approved users can submit workflows.
*   Admins have a dedicated, functional UI to manage the marketplace content and users.
*   Untrusted workflows are executed in a network-isolated Docker container before publication.