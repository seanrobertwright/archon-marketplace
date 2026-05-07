# Use Bun official image
FROM oven/bun:1.1.20-alpine AS base
WORKDIR /app

# --- Stage 1: Build Frontend ---
FROM base AS frontend-builder
COPY package.json bun.lockb ./
COPY apps/frontend/package.json ./apps/frontend/
RUN bun install

COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
RUN bun run build

# --- Stage 2: Backend Runtime ---
FROM base AS backend
COPY package.json bun.lockb ./
COPY apps/backend/package.json ./apps/backend/
RUN bun install --production

COPY apps/backend ./apps/backend
# Copy the prisma schema from backend for generation
RUN cd apps/backend && bun x prisma generate --schema=./prisma/schema.prisma

EXPOSE 4000
CMD ["bun", "apps/backend/src/index.ts"]

# --- Stage 3: Sync Worker Runtime ---
FROM base AS sync-worker
COPY package.json bun.lockb ./
COPY apps/sync-worker/package.json ./apps/sync-worker/
COPY apps/backend/package.json ./apps/backend/
RUN bun install --production

COPY apps/sync-worker ./apps/sync-worker
COPY apps/backend/prisma ./apps/backend/prisma
RUN cd apps/sync-worker && bun x prisma generate --schema=../backend/prisma/schema.prisma

CMD ["bun", "apps/sync-worker/src/index.ts"]

# --- Stage 4: Frontend Static Server (Optional if using Caddy directly) ---
# We'll use a simple static server for the frontend to be served by Caddy
FROM base AS frontend
RUN bun add -g serve
COPY --from=frontend-builder /app/apps/frontend/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
