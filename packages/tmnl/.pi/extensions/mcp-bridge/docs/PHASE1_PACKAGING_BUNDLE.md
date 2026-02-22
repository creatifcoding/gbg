# Phase 1 Packaging Bundle — Runtime MCP Hot Mutation

## Scope
Package contains only runtime-tool-mutation path, extension typing parity, and mcp-bridge live-diff/accounting changes.

---

## Diff Shape (Constrained)

### Project (tmnl)
- `.pi/extensions/mcp-bridge/index.ts`
  - Runtime name normalization (`buildToolRuntimeName`) to prevent double-prefix names
  - Diff engine (`computeToolCacheDiff`) for added/removed/updated tools
  - Live apply path (`applyToolCacheDiffLive`) using `addTool/removeTool/updateTool`
  - Result-aware accounting: `applied/queued/skipped/failed`
  - Startup + manual refresh path uses fresh `.pi/mcp.json` load each refresh
  - `/mcp` + `/mcp-refresh` UX updated with dynamic API availability and full counters

### Local pi core runtime patch (installed dist, for feasibility proof)
- `/home/getbygenius/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/loader.js`
  - Runtime stubs + API delegates for `addTool/removeTool/updateTool`
- `/home/getbygenius/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/runner.js`
  - `bindCore` wiring for dynamic mutation handlers
- `/home/getbygenius/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/dist/core/agent-session.js`
  - `_pendingRuntimeToolMutations` queue
  - `_mutateRuntimeTool`, `_applyRuntimeToolMutationNow`, `_flushRuntimeToolMutations`
  - Wrapper parity fix: `wrapRegisteredTools` + `wrapToolsWithExtensions`
  - `onConflict` / `onMissing` semantics in mutation path
  - idle-boundary flush hardening (`turn_end`/`agent_end`) + per-item flush isolation
- `/home/getbygenius/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts`
  - `ToolMutationResult` + `addTool/removeTool/updateTool` API typing
  - `ExtensionActions` parity for dynamic mutation handlers
- `/home/getbygenius/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/index.d.ts`
  - Re-export typing additions

---

## Must-Fix Mapping (Closed)

1. Wrapper consistency parity — ✅
2. Option semantics (`onConflict` / `onMissing`) — ✅
3. API typing parity for dynamic methods — ✅
4. mcp-bridge accounting not optimistic — ✅

---

## Validation Evidence

## Type safety
- `bunx tsc --noEmit --pretty false` ✅

## Live mutation smoke
Observed in `.pi/extensions.log`:
- `[refresh/session_start] ... | live applied=12 queued=0 skipped=0 failed=0`
- `[refresh/manual] ... | live applied=12 queued=0 skipped=0 failed=0`

## Deterministic queued-path gate (final)
Probe artifact lines:
1. `...[probe] addTool call idle=false result={"queued":true,"applied":false,"reason":"Queued during streaming"}`
2. `...[probe] post-flush phase=agent_end exists=true`
3. `...[probe] cleanup remove result={"queued":false,"applied":true,"op":"remove","name":"mcp_probe_queue_tool"}`

These three lines establish queue-at-stream + flush-at-idle semantics.

---

## Changelog Notes (proposed)

- Added runtime dynamic tool mutation API for extensions: `addTool`, `removeTool`, `updateTool` (+ `ToolMutationResult` typing).
- Fixed runtime tool wrapper parity for hot-mutated tools to preserve extension interception hooks.
- Implemented mutation conflict/missing semantics (`onConflict`, `onMissing`) in runtime mutation path.
- Upgraded mcp-bridge to diff-and-apply live MCP tool changes in-session with normalized naming and result-aware telemetry (`applied/queued/skipped/failed`).
- Hardened mutation deferral/flush behavior at idle boundaries with per-item error isolation.

---

## Packaging Note

Core changes above are currently proven via local installed dist patch for feasibility. Upstream cut should apply equivalent edits in source-of-truth TS files and regenerate dist/types from build pipeline.
