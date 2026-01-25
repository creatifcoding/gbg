# Build Issues Journal

Known build problems and solutions for custom Docker images.

---

## optipng-bin Installation Failure

### Problem

```
npm ERR! optipng-bin@10.0.0 postinstall: node lib/install.js
npm ERR! Exit status 1
```

### Solution

Use `--ignore-scripts` in Dockerfile:

```dockerfile
RUN bun install --ignore-scripts
```

This skips native binary compilation which isn't needed in container context.

### Affected Services

- durable-streams
- search-cluster-coordinator
- search-cluster-sources
- ingestion-cluster

---

## Bun Lock File Mismatch

### Problem

```
error: lockfile out of date
```

### Solution

Regenerate lock file:

```bash
cd packages/tmnl
bun install
```

Then rebuild:

```bash
/infra:rebuild <service> --no-cache
```

---

## TypeScript Compilation Errors

### Problem

```
error: Cannot find module './some-dependency'
```

### Solution

1. Check path mapping in tsconfig.json
2. Ensure all dependencies in package.json
3. Copy full source tree, not just entry file

Bad:
```dockerfile
COPY scripts/server.ts ./
```

Good:
```dockerfile
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY tsconfig.json ./
```

---

## Docker Build Context Too Large

### Problem

```
Sending build context to Docker daemon  2.5GB
```

### Solution

1. Check `.dockerignore` at **monorepo root**:

```
node_modules/
.git/
dist/
*.log
```

2. Use specific context in compose:

```yaml
build:
  context: ../..  # monorepo root
  dockerfile: packages/tmnl/docker/service/Dockerfile
```

---

## Layer Caching Not Working

### Problem

Every build reinstalls dependencies.

### Solution

Order Dockerfile for optimal caching:

```dockerfile
# 1. Base image
FROM oven/bun:latest

# 2. Metadata (rarely changes)
WORKDIR /app

# 3. Dependencies (changes occasionally)
COPY package.json bun.lock ./
RUN bun install --ignore-scripts

# 4. Source code (changes frequently)
COPY src/ ./src/
COPY scripts/ ./scripts/

# 5. Build (depends on source)
RUN bun build ./scripts/server.ts --outdir=dist

# 6. Runtime command
CMD ["bun", "run", "dist/server.js"]
```

---

## Multi-Stage Build Issues

### Problem

Final image missing dependencies.

### Solution

Ensure production dependencies copied:

```dockerfile
# Build stage
FROM oven/bun:latest AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun build --compile ./src/index.ts --outfile=app

# Production stage
FROM debian:bookworm-slim
COPY --from=builder /app/app /usr/local/bin/
# Copy any required runtime files
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
CMD ["app"]
```

---

## Platform Mismatch (ARM vs x86)

### Problem

```
exec format error
```

### Solution

Build for target platform:

```bash
docker compose build --build-arg TARGETPLATFORM=linux/amd64
```

Or in compose:

```yaml
build:
  platforms:
    - linux/amd64
```

---

## Build Secrets

### Problem

Need to access private npm registry or git repos during build.

### Solution

Use Docker secrets (not ENV):

```dockerfile
# syntax=docker/dockerfile:1.4
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) bun install
```

Build with:
```bash
docker compose build --secret id=npm_token,src=.npmrc
```

---

## Clean Rebuild

When all else fails:

```bash
# Remove all containers and images
docker compose down --rmi all

# Clean Docker cache
docker builder prune -a

# Rebuild from scratch
docker compose build --no-cache

# Start fresh
docker compose up -d
```

---

## Quick Reference

| Issue | Command |
|-------|---------|
| Rebuild single service | `/infra:rebuild <service>` |
| Rebuild without cache | `/infra:rebuild <service> --no-cache` |
| Check build logs | `docker compose build <service> 2>&1 \| tee build.log` |
| Inspect image layers | `docker history <image>` |
| Check image size | `docker images \| grep <service>` |
