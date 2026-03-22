# 12 — Runtime Boundary Contract (Browser Agent UX, Server Spawn Ownership)

## Purpose

Make browser agent UX seamless **without** allowing browser runtime to own process spawning.

This contract formalizes the split:

- **Browser**: remote orchestrator client + UI state projection
- **Bun control plane**: process spawn, session lifecycle, event fanout
- **Shared**: schemas, protocol envelopes, and typed service contracts

---

## Research Basis

1. **Effect multi-runtime architecture**: runtime-specific implementations should be selected at layer composition boundaries.
   - DeepWiki: `Effect-TS/effect/5.1-multi-runtime-platform-architecture`
2. **Effect Layer DI**: service tags + layer composition are the canonical boundary for runtime-specific behavior.
   - DeepWiki: `Effect-TS/effect/2.3-layer-and-dependency-injection`
3. **Effect RPC**: typed remote command/event transport is first-class and stream-friendly.
   - DeepWiki: `Effect-TS/effect/6.1-rpc-framework`
4. **Vite browser externalization**: Node built-ins in client graph are invalid (`node:child_process`, etc).
   - https://vite.dev/guide/troubleshooting
5. **Pi RPC extension UI protocol**: `extension_ui_request` / `extension_ui_response` bidirectional contract.
   - `docs/rpc.md` in pi package
6. **Bun process management**: `Bun.spawn` is runtime-side process primitive.
   - https://bun.com/docs/runtime/child-process

---

## Non-Negotiable Boundary Rules

1. Browser bundles must not import process-spawn modules (Node or Bun process APIs).
2. Spawn/lifecycle ownership lives in Bun control plane service only.
3. Browser gets agent capability through typed remote transport.
4. Session ownership is **node-scoped** (`nodeId`) for COP continuity.
5. Extension UI protocol remains fully bidirectional.

---

## Module Surface Contract

## Shared (`src/lib/pi-orchestrator/schemas/*`)
- Config schemas
- Event schemas
- Spawn/process error schemas
- Extension UI request/response schemas

## Client (`src/lib/pi-orchestrator/client/*`) — planned
- `PiRemoteOrchestrator` implementing orchestrator shape over transport
- transport adapter (Effect RPC / WS + stream)
- reconnect + rejoin by nodeId

## Server (`src/lib/pi-orchestrator/server/*`) — planned
- BunSpawn strategy
- process/session orchestration
- node-scoped pool + event multiplexing

---

## Composition Rules

- Browser composition root provides **remote orchestrator layer**.
- Bun/server composition root provides **spawn-capable orchestrator layer**.
- Shared business/UI code depends only on service tags and shared schemas.

---

## UX Continuity Requirements

- Optimistic chat send path
- Stream-first rendering for deltas/tools
- Inline + breakout extension UI rendering
- Pending interactive extension UI requests remain pending until explicit user action
- Reconnect restores node-scoped continuity without visible context break

---

## Immediate Implementation Implications

- Default orchestrator config must be runtime-aware and browser-safe.
- Browser default path should fail-fast with actionable state when remote orchestrator unavailable.
- Any spawn-capable layer should be explicitly provided by server/Bun entrypoint.
