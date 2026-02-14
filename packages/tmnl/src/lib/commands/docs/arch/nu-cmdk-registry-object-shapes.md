# NuCmdk — Exact Registry Object Shapes + Update Loop

**Status:** Locked proposal (implementation-target)  
**Date:** 2026-02-13

---

## 1) Yes — ranking/categorization-on-update is explicitly designed

When rows stream in, shell-side ranking/categorization is re-run incrementally.

```text
chunk arrives
  -> manifest/variant validation
  -> row decode + assemble
  -> row store patch (add/update/remove)
  -> score recompute (changed rows + affected neighbors)
  -> category/group recompute
  -> top-N visible slice publish
  -> cmdk render update
```

### Incremental policy

- **rowsAdded**: score + categorize new rows, insert into ranked index.
- **rowsUpdated**: re-score row, re-bucket category, re-position.
- **rowIdsRemoved**: remove from row store + ranked index + category bucket.
- publish only delta to atom consumers when possible.

This gives streaming responsiveness without full list re-sort on every event.

---

## 2) ASCII map — registries + runtime

```text
                         ┌─────────────────────────┐
                         │ ProviderManifestRegistry│
                         │ providerId -> manifest  │
                         └────────────┬────────────┘
                                      │ declares variants
                                      v
                         ┌─────────────────────────┐
                         │ VariantRuntimeRegistry  │
                         │ key@version -> handlers │
                         └───────┬─────────┬───────┘
                                 │         │
                                 │         └──────────────┐
                                 v                        v
                     ┌────────────────────┐    ┌────────────────────┐
                     │ Schema decoder      │    │ Assembler          │
                     │ decodeUnknown       │    │ -> CanonicalRow    │
                     └─────────┬───────────┘    └─────────┬──────────┘
                               │                          │
                               └──────────┬───────────────┘
                                          v
                                ┌────────────────────┐
                                │ RendererRegistry   │
                                │ token -> component │
                                └─────────┬──────────┘
                                          v
                                ┌────────────────────┐
                                │ RankedRowStore     │
                                │ rows+scores+buckets│
                                └─────────┬──────────┘
                                          v
                                     NuCmdkShell
```

---

## 3) Exact shapes (TypeScript-style contracts)

## 3.1 Provider manifest

```ts
export type ProviderManifest = {
  providerId: string
  laneId: string
  manifestVersion: number
  capabilities: {
    queryModes: ReadonlyArray<"fuzzy" | "prefix" | "exact" | "alias" | "semantic" | "regex">
    transports: ReadonlyArray<"inprocess" | "rpc" | "http" | "filesystem" | "vector" | "database">
    supportsStreaming: boolean
  }
  variants: ReadonlyArray<VariantManifestEntry>
  defaults?: {
    rendererTokenPrefix?: string
    categoryPolicy?: "provider" | "variant" | "hybrid"
  }
}

export type VariantManifestEntry = {
  variantKey: string              // e.g. "command", "entity", "file"
  variantVersion: number          // per-variant versioning
  schemaId: string                // registry key for schema module
  assemblerId: string             // registry key for assembler function
  rendererToken: string           // token resolved by shell renderer registry
  fallbackRendererToken?: string
  categoryHint?: string           // default group/category lane hint
}
```

## 3.2 Stream chunk envelope (Variant C streaming body)

```ts
export type ProviderChunk = {
  providerId: string
  laneId: string
  queryId: string
  sequence: number
  done: boolean
  status: "ok" | "partial" | "error"

  rowsAdded?: ReadonlyArray<RowEnvelope>
  rowsUpdated?: ReadonlyArray<RowEnvelope>
  rowIdsRemoved?: ReadonlyArray<string>

  diagnostics?: ReadonlyArray<ProviderDiagnostic>
  metrics?: Partial<ProviderMetrics>
}
```

## 3.3 Row envelope (provider -> broker payload)

```ts
export type RowEnvelope = {
  rowId: string
  providerId: string
  laneId: string

  variantKey: string
  variantVersion: number
  rendererToken: string

  baseScore: number
  confidence?: number
  keywords?: ReadonlyArray<string>

  payload: unknown                // decoded by variant schema module

  summary: {
    title: string
    subtitle?: string
    badges?: ReadonlyArray<{ label: string; tone?: string }>
    icon?: { kind: "glyph" | "emoji" | "asset"; value: string }
  }

  preview?: {
    kind: "inline" | "lazy"
    inline?: unknown
    resolverId?: string
  }

  execute: ExecutionResolverSpec
  source?: { kind: string; id?: string; uri?: string }
  timestamps?: { createdAt: number; updatedAt?: number }
}
```

## 3.4 Runtime variant registry entry

```ts
export type VariantRuntimeRegistryEntry = {
  key: string
  version: number
  schemaId: string

  decode: (u: unknown) => DecodedVariantPayload | DecodeError
  assemble: (input: {
    row: RowEnvelope
    decoded: DecodedVariantPayload
    context: RankingContext
  }) => CanonicalRow

  rendererTokenValidator?: (token: string) => boolean
  categoryResolver?: (row: CanonicalRow, ctx: RankingContext) => string
}
```

## 3.5 Renderer registry entry

```ts
export type RendererRegistryEntry = {
  token: string
  component: unknown              // React component type
  supportedVariants?: ReadonlyArray<string>
  version: number
  fallbackToken?: string
}
```

## 3.6 Ranked row store shape

```ts
export type RankedRowStore = {
  byId: ReadonlyMap<string, CanonicalRow>
  rankedIds: ReadonlyArray<string>
  categoryBuckets: ReadonlyMap<string, ReadonlyArray<string>>
  laneBuckets: ReadonlyMap<string, ReadonlyArray<string>>
  topVisibleIds: ReadonlyArray<string>
  lastUpdatedAt: number
}
```

---

## 4) Ranking + categorization recompute contract

```ts
export type RankingContext = {
  query: string
  queryMode: "fuzzy" | "prefix" | "exact" | "alias" | "semantic" | "regex"
  mode: string
  scope: "global" | "editor" | "grid" | "tldraw" | "modal"
  now: number
}

export type ScoreBreakdown = {
  providerBase: number
  queryRelevance: number
  contextBoost: number
  scopeBoost: number
  recencyBoost: number
  frequencyBoost: number
  qualityPenalty: number
  total: number
}
```

- Categorization is computed after score update.
- Category policy default: **hybrid** (lane + variant aware).
- Stable tiebreakers: `total desc -> providerPriority desc -> title asc -> rowId asc`.

---

## 5) Enforcement checks (must-pass)

1. Manifest variant entry exists for every streamed row variant.
2. Schema module exists and decode succeeds.
3. Renderer token is registered or fallback token exists.
4. Assembler exists and returns canonical row.
5. Resolver spec passes capability allow-list.

Failing rows are dropped + diagnostic emitted; lane continues.
