# ──────────────────────────────────────────────────────────────
# GritIQ — Multi-stage Dockerfile
# Stage 1: build the Vite frontend + bundle the Express server
# Stage 2: lean production image (no dev dependencies)
# ──────────────────────────────────────────────────────────────

# ── Stage 1: Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDeps needed for the build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend (Vite) + bundle server (esbuild → dist/index.cjs)
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# SQLite data directory — mount a volume here for persistence
# docker run -v /your/host/path:/data gritiq-app
RUN mkdir -p /data
ENV DATABASE_PATH=/data/data.db

# Expose port (override with PORT env var)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-5000}/api/health || exit 1

# Start server
ENV NODE_ENV=production
CMD ["node", "dist/index.cjs"]
