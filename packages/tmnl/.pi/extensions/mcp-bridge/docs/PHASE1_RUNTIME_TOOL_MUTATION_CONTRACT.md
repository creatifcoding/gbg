# Phase 1 Contract — Runtime Tool Mutation (Hot Add/Remove/Update)

## Goal
Enable MCP-discovered tools to become callable in the **current pi session** without `/reload` or restart.

## Scope
This contract defines the minimum runtime APIs and semantics required across:

- Extension API surface (`pi.*` methods)
- Extension runtime plumbing (loader/runner/action bindings)
- Agent session registry + model prompt sync
- mcp-bridge diff/apply behavior

---

## Existing Constraint (Current)

`pi.registerTool()` mutates extension-local tool maps, but `AgentSession` builds `_toolRegistry` once during runtime initialization. New names are not promoted into active runtime state after startup.

Result: cache refresh can discover tools, but named tools are only available next session/reload.

---

## New Runtime API (Phase 1)

### Extension API additions

```ts
pi.addTool(tool: ToolDefinition, options?: {
  activate?: boolean // default true
  onConflict?: "replace" | "skip" | "error" // default replace
}): { applied: boolean; reason?: string }

pi.removeTool(name: string): { applied: boolean; reason?: string }

pi.updateTool(tool: ToolDefinition, options?: {
  preserveActive?: boolean // default true
  onMissing?: "add" | "skip" | "error" // default add
}): { applied: boolean; reason?: string }
```

### Optional query helper

```ts
pi.getToolMutationStatus(): {
  queued: number
  applying: boolean
  lastAppliedAt?: string
}
```

---

## Semantics

### 1) Idempotency

- `addTool(name)` where same schema+impl already present => no-op success.
- `removeTool(name)` when missing => no-op success.
- `updateTool(name)` with no effective diff => no-op success.

### 2) Conflict policy

- Default `replace`: extension or built-in tool with same name is replaced in registry.
- `skip`: keep existing tool unchanged.
- `error`: reject mutation with explicit reason.

### 3) Active tools + prompt consistency

On applied mutation, runtime must keep all three in sync:

1. `_toolRegistry`
2. active tool list (`agent.setTools(...)`)
3. system prompt tool section (`_baseSystemPrompt`)

### 4) Turn safety

- If agent idle: apply mutation immediately.
- If streaming/in tool execution: enqueue mutation and apply atomically at idle boundary.

### 5) Observability

Emit structured mutation events (internal log/event bus):

```ts
{
  _tag: "ToolMutationApplied" | "ToolMutationQueued" | "ToolMutationFailed",
  op: "add" | "remove" | "update",
  name: string,
  reason?: string,
  queuedAt?: string,
  appliedAt?: string
}
```

---

## mcp-bridge Apply Contract

mcp-bridge computes a diff per refresh:

- `added[]`
- `removed[]`
- `updated[]`

Then applies via runtime mutation API:

- `added` => `pi.addTool(...)`
- `removed` => `pi.removeTool(name)`
- `updated` => `pi.updateTool(...)`

Output summary (for `/mcp`, `/mcp-refresh`, logs):

```txt
agentation: +2 ~1 -0 (applied: 3, queued: 0, failed: 0)
```

---

## Naming Policy

Canonical runtime name:

```txt
<server>_<tool>
```

If upstream tool already starts with `<server>_`, bridge should avoid doubling prefix.

Example:

- upstream: `agentation_list_sessions`
- server: `agentation`
- final: `agentation_list_sessions` (not `agentation_agentation_list_sessions`)

---

## Backward Compatibility

- `registerTool()` behavior remains unchanged.
- New mutation methods are additive.
- Existing extensions require no changes.
- mcp-bridge can gate Phase 1 path behind feature flag:
  - `MCP_BRIDGE_DYNAMIC_MUTATIONS=1`

---

## Acceptance Signals

- New MCP tool appears in same session after refresh and is callable.
- Removed MCP tool is unavailable without reload.
- Tool list (`getAllTools`) and system prompt stay consistent.
- No runtime crash or partial registry state during streaming mutations.
