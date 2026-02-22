# ADR-004: @effect/platform for HTTP, WebSocket, FileSystem Adapters

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaires `tsingou-adapter-http` (ID: `9CntbYm3RnO1d6p-WkSO4`), `tsingou-adapter-ws` (ID: `6zYDs--TgzjAycp-HdSvl`), `tsingou-adapter-filewatch` (ID: `6rMCVK6Zsg46R-BlarCa4`)

---

## Context

Three adapter families need low-level I/O primitives: HTTP (polling, SSE, webhooks), WebSocket (bidirectional streams), and FileSystem (file watching, reading). The choice is between raw browser APIs (`fetch`, `WebSocket`, `fs`) and `@effect/platform` wrappers.

## Decision

**Use `@effect/platform` fully** — `HttpClient`, `Socket`, `FileSystem`. No raw `fetch()`, no hand-rolled WebSocket, no Node `fs`.

### Per-Adapter Decisions

#### HTTP Adapter (Questionnaire: `tsingou-adapter-http`)

| Question | Decision | Rationale |
|----------|----------|-----------|
| HTTP modes | 4 modes: poll, SSE, webhook, long-poll | Cover all OSINT feed patterns |
| HTTP client | `@effect/platform HttpClient` | Fiber cancellation replaces AbortController |
| Response parsing | Configurable pipeline: extract → transform → validate | `HttpClientResponse.schemaBodyJson` for typed decode |
| Polling schedule | Adaptive (hash response, speed up on change) | `Effect.Ref`-based interval adjustment |
| Auth | Config-driven (bearer, basic, apiKey, custom headers) | HttpClient middleware injection |
| SSE | `HttpClientResponse.stream` → `Sse.makeChannel()` | No `EventSource` API needed |
| Webhook | `HttpApi` + `HttpApiEndpoint.post` + `HttpApiBuilder` | Schema-validated typed server |

#### WebSocket Adapter (Questionnaire: `tsingou-adapter-ws`)

| Question | Decision | Rationale |
|----------|----------|-----------|
| WS framing | Pluggable decoders (json, ndjson, binary, msgpack, protobuf) | Config-driven per source |
| Reconnection | Config-driven `Schedule` | `Schedule.exponential` + `Schedule.union(Schedule.spaced)` |
| Bidirectional | Yes — receive + send | `Socket.makeWebSocket` + `socket.writer` |
| Error types | Socket already has tagged errors | `SocketGenericError`, `SocketCloseError` |

#### FileSystem / File Watch (Questionnaire: `tsingou-adapter-filewatch`)

| Question | Decision | Rationale |
|----------|----------|-----------|
| File access API | `@effect/platform FileSystem` (sidecar) | `fs.watch(path)` → `Stream<WatchEvent>` |
| Tauri context | Holonet bridge (sidecar → NATS) | FileSystem needs Node/Bun runtime, not webview |
| Parse formats | JSON, NDJSON, CSV, lines, raw, XML | XML via fast-xml-parser wrapper |
| Watch mode | Config-selectable: full re-read OR tail | Both needed for different file types |

## Consequences

### Positive
- **Zero manual AbortController** — fiber interruption handles cancellation
- **Typed responses** — `HttpClientResponse.schemaBodyJson(Schema)` decodes at boundary
- **Retry built-in** — `HttpClient.retryTransient` for 429/5xx with exponential backoff
- **SSE as stream** — `Sse.makeChannel()` from `@effect/experimental` — no EventSource polyfill
- **WebSocket as Channel** — `Socket.toChannelString` provides typed bidirectional pipe
- **Socket errors already tagged** — `SocketGenericError`, `SocketCloseError` — no custom wrappers needed

### Negative
- `@effect/platform` is at `0.94.x` — pre-1.0, API may shift
- SSE via `Sse.makeChannel()` is in `@effect/experimental` — less stable
- Webhook server requires Node/Bun (uses `HttpApiBuilder`) — Tauri webview uses Holonet bridge

## Implementation

| Adapter | File | Size | Key @effect/platform APIs |
|---------|------|------|--------------------------|
| HTTP | `adapters/HttpAdapter.ts` | 17,590 bytes | `HttpClient`, `HttpClientResponse.schemaBodyJson`, `Sse.makeChannel`, `HttpApi`, `HttpApiEndpoint` |
| WebSocket | `adapters/WebSocketAdapter.ts` | 11,330 bytes | `Socket.makeWebSocket`, `Socket.toChannelString`, `socket.writer`, `Socket.layerWebSocketConstructorGlobal` |
| FileWatch | `adapters/HolonetBridgeAdapter.ts` | 9,846 bytes | Sidecar uses `FileSystem.watch` → NATS; adapter subscribes via Holonet |
