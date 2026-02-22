# Phase 1 Lifecycle — Tool Mutation Safety Model

## Objective
Define deterministic lifecycle for runtime tool mutations so hot-add/remove/update is safe while the agent is streaming.

---

## State Model

```txt
Idle
  ├─ add/remove/update -> ApplyingNow -> Idle
  └─ stream starts      -> Streaming

Streaming
  ├─ add/remove/update -> QueuedDuringStream (append mutation)
  └─ stream ends       -> FlushingQueue

FlushingQueue
  ├─ apply all queued atomically -> Idle
  └─ failure on one op -> PartialRollbackOrSkip (policy) -> Idle
```

---

## Mutation Envelope

Each queued mutation is normalized into:

```ts
{
  id: string
  op: "add" | "remove" | "update"
  toolName: string
  payload?: ToolDefinition
  options?: Record<string, unknown>
  queuedAt: string
  source: "mcp-bridge" | "extension" | "sdk"
}
```

---

## Queue Rules

1. FIFO by default.
2. Coalesce by tool name before flush:
   - `add + update` => `add(latest payload)`
   - `add + remove` => drop both (net no-op)
   - `remove + add` => `update/add` depending on existence policy
3. Flush at idle boundary (post-turn).

---

## Apply Algorithm (Flush)

1. Snapshot pre-state:
   - `_toolRegistry`
   - active tool names
   - base prompt seed
2. Apply normalized mutations in order.
3. Rebuild active tool instances and set on agent.
4. Rebuild base system prompt with updated tool names.
5. Commit snapshot replacement.

If apply fails:

- **Default policy**: rollback entire batch to pre-state.
- Log failing mutation with reason.
- Continue session with previous consistent state.

---

## Failure Taxonomy

- `NameConflict`
- `InvalidSchema`
- `MissingToolForUpdate`
- `MutationWhileReloading`
- `InternalRegistryError`

All failures should produce machine-readable reason strings.

---

## UX/Telemetry Signals

For each mutation/batch:

- queued count
- applied count
- failed count
- mode (`immediate` or `queued`)
- latency (queued→applied)

Recommended log line:

```txt
[mcp-bridge] refresh apply: immediate +3 ~1 -0 (failed 0)
[mcp-bridge] refresh apply: queued +2 ~0 -1 (flush pending)
```

---

## Safety Guarantees

1. No partial registry visible to agent mid-apply.
2. System prompt and tool registry remain aligned.
3. Streaming turns are never interrupted solely by mutation events.
4. Mutation queue survives transient discovery errors in mcp-bridge.

---

## Integration Notes for mcp-bridge

- Discovery may run every session start.
- Diff result applies through mutation API.
- If runtime reports `queued`, mcp-bridge should surface that in `/mcp-refresh` output.
- Fallback mode can remain available when dynamic mutation flag is disabled.
