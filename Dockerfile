# Use Debian-based Bun image for better compatibility with native modules
FROM oven/bun:1 AS base
WORKDIR /app

# --- Stage 1: Build Frontend (Not used by compose currently, but kept for consistency) ---
FROM base AS frontend-builder
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY apps/sync-worker/package.json ./apps/sync-worker/
RUN bun install

COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL
RUN bun run build

# --- Stage 2: Backend Runtime ---
FROM base AS backend
# Copy all package files for workspace resolution
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/sync-worker/package.json ./apps/sync-worker/

# Install all dependencies (prisma CLI is a devDependency needed for `prisma generate`)
RUN bun install

COPY apps/backend ./apps/backend

# Generate Prisma Client
RUN cd apps/backend && bun x prisma generate

EXPOSE 4000
CMD ["bun", "apps/backend/src/index.ts"]

# --- Stage 3: Sync Worker Runtime ---
FROM base AS sync-worker
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/sync-worker/package.json ./apps/sync-worker/
RUN bun install

COPY apps/sync-worker ./apps/sync-worker
COPY apps/backend/prisma ./apps/backend/prisma

# Generate Prisma Client (using schema from backend)
RUN cd apps/sync-worker && bun x prisma generate --schema=../backend/prisma/schema.prisma

CMD ["bun", "apps/sync-worker/src/index.ts"]

# --- Stage 4: Frontend (Dist server) ---
FROM base AS frontend
RUN bun add -g serve
COPY --from=frontend-builder /app/apps/frontend/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
