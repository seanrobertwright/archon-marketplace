FROM oven/bun:1 AS base
WORKDIR /app/apps/frontend

# Copy ONLY frontend files to treat it as standalone
COPY apps/frontend/package.json ./
# We need the lockfile from root but we'll let bun regenerate/handle it locally
# for maximum compatibility in this standalone mode
RUN bun install

# Copy source
COPY apps/frontend/ ./

# Expose port
EXPOSE 5175

# Run dev with host/port
CMD ["bunx", "astro", "dev", "--host", "0.0.0.0", "--port", "5175"]
