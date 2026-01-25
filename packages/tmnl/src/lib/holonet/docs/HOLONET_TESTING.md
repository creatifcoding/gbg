# Holonet Testing Guide

## Agent Frontmatter

- **Audience**: Agents + maintainers
- **Reading Order**: Prereqs → Runtimes → Commands → Suite Map → Rationale
- **High‑Signal**: Runtime split (Node vs Bun), NATS container dependency
- **Related**: `docs/INDEX.md`, `docs/HOLONET_AUDIT_OVERVIEW.md`

## Prerequisites

- **Containers**: `tmnl_nats` and `tmnl_durable_streams` running.
  - Start: `docker compose -f docker/docker-compose.yml up -d nats durable-streams`
- **Environment**:
  - `NATS_SERVERS` (defaults to `ws://localhost:9222` in tests)

## Runtime Split (Why two runners)

- **Node/Vitest**: wide ecosystem support for HTTP API tests + standard Vitest
- **Bun**: required for `@effect/platform-bun` and BunHttpServer layer

**Rationale**

- `BunHttpServer.layerTest` requires Bun runtime globals.
- Most Holonet tests are runtime‑agnostic and run under `bunx vitest`.
- Bun‑specific tests are isolated to `*.bun.test.ts`.

## Command Reference (with pueue)

- **Full Holonet suite (Vitest)**:
  - `pueue add -- "bunx vitest run src/lib/holonet"`
- **Durable‑streams API (Node)**:
  - `pueue add -- "bunx vitest run src/lib/holonet/durable-streams/__tests__/api.test.ts"`
- **Durable‑streams API (Bun runtime)**:
  - `pueue add -- "bun test src/lib/holonet/durable-streams/__tests__/api.bun.test.ts"`

## Suite Map

### Vitest (Node runtime)

- `src/lib/holonet/durable-streams/__tests__/api.test.ts`
  - Uses `NodeHttpServer.layerTest`
  - Exercises HTTP API handlers without external server
- `src/lib/holonet/nats/__tests__/*.test.ts`
- `src/lib/holonet/subject/__tests__/*.test.ts`
- `src/lib/holonet/core/*/__tests__/*.test.ts`
- `src/lib/holonet/integration/spike/__tests__/*.test.ts`

### Bun Test (Bun runtime)

- `src/lib/holonet/durable-streams/__tests__/api.bun.test.ts`
  - Uses `BunHttpServer.layerTest`
  - Mirrors the Node API test suite for Bun runtime coverage

## Test Rationale

- **API tests** validate URL‑exposed durable‑streams gateway behavior (CRUD + long‑poll).
- **NATS tests** validate core publish/subscribe/request semantics + JetStream behaviors.
- **Integration spikes** validate schema headers + SSE bridging.
- **Bun parity** confirms Bun runtime compatibility for the HTTP layer.

## Notes

- LSP may report missing `bun:test` typings in editor contexts.
- Use Bun runtime for `*.bun.test.ts` to avoid `Bun is not defined` errors.
