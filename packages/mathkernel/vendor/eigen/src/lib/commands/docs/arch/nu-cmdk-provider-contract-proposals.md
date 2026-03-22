# Provider Contract Proposals — `NuCmdk` Federation

**Status:** Proposed for alignment review  
**Date:** 2026-02-13

---

## Context from alignment

Locked inputs from your answers:

- Pluggable variant registry (dynamic schema modules)
- Per-variant schema versioning
- Drop invalid rows + telemetry
- Dedicated search broker service
- Atoms + service-side cache
- Hybrid rendering ownership: provider declares renderer token, shell resolves
- Execution contract: row carries executable resolver
- Mixed transport lanes (in-process, RPC, HTTP, FS, vector, DB)

---

## Proposal A — Snapshot Envelope (simple, less streaming-native)

```ts
{
  providerId: string
  laneId: string
  queryId: string
  mode: string
  status: "ok" | "partial" | "error"
  rows: ReadonlyArray<RowEnvelope>
  diagnostics: ReadonlyArray<ProviderDiagnostic>
  metrics: ProviderMetrics
  cache: CacheMetadata
}
```

### Pros
- Easy to reason about.
- Easy test fixtures.

### Cons
- Weak for per-provider progressive streaming.
- Large payload churn per update.

---

## Proposal B — Stream Chunk Envelope (**Recommended**)

```ts
{
  providerId: string
  laneId: string
  queryId: string
  sequence: number
  done: boolean
  status: "ok" | "partial" | "error"

  // delta-style updates
  rowsAdded?: ReadonlyArray<RowEnvelope>
  rowsUpdated?: ReadonlyArray<RowEnvelope>
  rowIdsRemoved?: ReadonlyArray<string>

  diagnostics?: ReadonlyArray<ProviderDiagnostic>
  metrics?: Partial<ProviderMetrics>
  cache?: CacheMetadata
}
```

### Pros
- Native fit for "streaming per provider".
- Reduces rerender churn.
- Lane isolation is explicit.

### Cons
- Merge logic more complex.

---

## Proposal C — Manifest + Stream Hybrid

1. Initial manifest (capabilities, renderer tokens, schema versions)
2. Then stream chunks (Proposal B)

### Pros
- Great for dynamic plugin ecosystems.
- Strong capability introspection.

### Cons
- More boot complexity.

---

## Recommended path

- Use **Proposal C internally**, but expose **Proposal B** as canonical broker event shape.
- Keep manifest optional for v1 lanes that are static.

### D18 addendum (2026-02-14)

Provider envelope decisions now run under the LayerRouter parity lock:

- provider/adapter dispatch and middleware composition mirror `HttpLayerRouter` architecture,
- middleware split is global + adapter-local,
- N+1 efficiency policy requires parse-once + bounded scheduling.

See: `nu-cmdk-provider-adapter-layer-router-decision.md`.

---

## Canonical `RowEnvelope` (proposed)

```ts
{
  rowId: string
  providerId: string
  laneId: string

  // pluggable schema registry
  variantKey: string            // e.g. "command", "entity", "file"
  variantVersion: number        // per-variant versioning

  // ranking
  baseScore: number
  confidence?: number
  keywords?: ReadonlyArray<string>

  // shell rendering
  rendererToken: string         // provider declares token
  summary: {
    title: string
    subtitle?: string
    badges?: ReadonlyArray<{ label: string; tone?: string }>
    icon?: { kind: "glyph" | "emoji" | "asset"; value: string }
  }

  // lazy deep details
  preview?: {
    kind: "inline" | "lazy"
    inline?: unknown
    resolverId?: string
  }

  // execution contract
  execute: ExecutionResolverSpec

  // traceability
  source?: { kind: string; id?: string; uri?: string }
  timestamps?: { createdAt: number; updatedAt?: number }
}
```

---

## `ExecutionResolverSpec` variants

Because selection uses "row carries executable resolver", we model resolver as data (safe + serializable), not raw closures crossing lane boundaries.

```ts
| { _tag: "CommandResolver"; commandId: string; args?: unknown }
| { _tag: "RpcResolver"; service: string; method: string; payload?: unknown }
| { _tag: "HttpResolver"; endpointId: string; method?: string; body?: unknown }
| { _tag: "FileResolver"; action: "open" | "reveal" | "diff"; path: string }
| { _tag: "NavigationResolver"; route: string; params?: Record<string, string> }
| { _tag: "ProviderCustomResolver"; resolverId: string; payload?: unknown }
```

---

## Renderer ownership (hybrid) proposal

- Provider emits `rendererToken` (declarative intent).
- Shell maintains registry `rendererToken -> component`.
- If token missing/unregistered, shell uses generic fallback renderer based on `variantKey`.

This gives provider flexibility without allowing arbitrary component injection at runtime.

---

## Invalid payload policy

Per your decision: **drop invalid rows + telemetry**.

Add hierarchical diagnostics:

1. row-level parse errors
2. lane-level error rollups
3. query-level observability summary

No fatal crash for single malformed row.
