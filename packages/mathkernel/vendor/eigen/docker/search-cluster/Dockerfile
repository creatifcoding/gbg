# ==============================================================================
# GEOINT Search Cluster Node - Dockerfile
#
# Multi-stage build for Effect Cluster node with:
# - Bun runtime for TypeScript execution
# - PostgreSQL client for SQL storage
# - Minimal production image
#
# Build from packages/tmnl directory:
#   docker build -t geoint-search-cluster -f docker/search-cluster/Dockerfile ../..
#
# Run:
#   docker run -e DATABASE_URL=postgres://... -e RUNNER_PORT=8000 geoint-search-cluster
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build stage
# ------------------------------------------------------------------------------
FROM oven/bun:1.1-alpine AS builder

WORKDIR /monorepo

# Install build dependencies
RUN apk add --no-cache git

# Copy monorepo root package files
COPY package.json bun.lock* ./

# Copy workspace package files
COPY packages/tmnl/package.json packages/tmnl/

# Install all dependencies (uses workspace resolution)
# --ignore-scripts to skip optipng-bin and other binary postinstall scripts
RUN bun install --frozen-lockfile --ignore-scripts || bun install --ignore-scripts

# Copy source code for tmnl package
COPY packages/tmnl/ packages/tmnl/

# Build the cluster node entry point
WORKDIR /monorepo/packages/tmnl

RUN bun build src/lib/geoint/cluster/cluster-node.ts \
    --outdir dist/cluster \
    --target bun \
    --sourcemap=external

# ------------------------------------------------------------------------------
# Stage 2: Production stage
# ------------------------------------------------------------------------------
FROM oven/bun:1.1-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    tini

# Copy monorepo node_modules (for workspace dependencies)
COPY --from=builder /monorepo/node_modules ./node_modules

# Copy tmnl package node_modules (if separate)
COPY --from=builder /monorepo/packages/tmnl/node_modules ./packages/tmnl/node_modules 2>/dev/null || true

# Copy built application
COPY --from=builder /monorepo/packages/tmnl/dist/cluster ./dist

# Copy package.json for runtime
COPY --from=builder /monorepo/packages/tmnl/package.json ./

# Environment variables with defaults
ENV RUNNER_HOST=0.0.0.0 \
    RUNNER_PORT=8000 \
    SHARD_GROUPS=search-default \
    LOG_LEVEL=info \
    NODE_ENV=production

# Expose cluster communication port
EXPOSE 8000

# Health check - ping the HTTP runner endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${RUNNER_PORT}/health || exit 1

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Run the cluster node
CMD ["bun", "run", "dist/cluster-node.js"]
