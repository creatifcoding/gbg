# 02 — Transfer Schema Redesign

**Parent**: [Index](./00-transfer-redesign-index.md)

---

## Current Schema Inventory (15 types)

| Schema | Lines | Used By | Verdict |
|---|---|---|---|
| `TransferReferenceKindSchema` | 1 | Everywhere | **KEEP** — discriminant |
| `TransferInsertModeSchema` | 1 | Droppable, Traits | **KEEP** — but simplify |
| `TransferOriginSchema` | 7 | Token, Factory | **MERGE** into Token |
| `TransferTaskReferenceSchema` | 7 | Token, Row | **KEEP** — core |
| `TransferTaskClusterReferenceSchema` | 7 | Token, ExpandBand | **KEEP** — core |
| `TransferReferenceSchema` | 1 | Token (union) | **KEEP** — union of above |
| `TransferReferenceTokenSchema` | 7 | Everything | **SIMPLIFY** — flatten origin |
| `TransferDropIntentSchema` | 5 | Droppable | **KILL** — inline into target config |
| `TransferDropAcceptSchema` | 4 | Droppable, Guard | **KEEP** — but merge into result |
| `TransferDropRejectSchema` | 4 | Droppable, Guard | **KEEP** — but merge into result |
| `TransferDropDecisionSchema` | 1 | Droppable, Overlay | **REPLACE** — with `TransferResult` union |
| `TransferPointerSchema` | 3 | Session | **KILL** — use `{ x: number, y: number }` inline |
| `TransferDragSessionSchema` | 7 | stx, Overlay | **SIMPLIFY** — scope-local, less fields |
| `TransferClipboardEntrySchema` | 5 | stx, Clipboard hook | **SIMPLIFY** — merge tokens field |
| `TransferRuntimeStateSchema` | 4 | stx | **KILL** — replaced by scope atoms |

**Score**: 15 types → 8 types. ~47% reduction.

---

## Redesigned Schema Surface

### Core Reference Types (unchanged semantics, tighter shape)

```typescript
import { Schema } from 'effect'

// ── Discriminants ────────────────────────────────────────────

export const TransferKind = Schema.Literal('task', 'task-cluster')
export type TransferKind = typeof TransferKind.Type

export const TransferInsertMode = Schema.Literal('inline-chip', 'structured-block')
export type TransferInsertMode = typeof TransferInsertMode.Type

// ── References ───────────────────────────────────────────────

export const TaskRef = Schema.TaggedStruct('TaskRef', {
  kind: Schema.Literal('task'),
  id: Schema.String,
  taskId: Schema.String,
  label: Schema.String,
  status: Schema.optional(Schema.String),
})
export type TaskRef = typeof TaskRef.Type

export const ClusterRef = Schema.TaggedStruct('ClusterRef', {
  kind: Schema.Literal('task-cluster'),
  id: Schema.String,
  clusterId: Schema.String,
  label: Schema.String,
  taskIds: Schema.Array(Schema.String),
})
export type ClusterRef = typeof ClusterRef.Type

export const TransferRef = Schema.Union(TaskRef, ClusterRef)
export type TransferRef = typeof TransferRef.Type
```

**Changes from current**:
- `TransferTaskReferenceSchema` → `TaskRef` (shorter, `referenceId` → `id`)
- `TransferTaskClusterReferenceSchema` → `ClusterRef` (shorter)
- `TransferReferenceSchema` → `TransferRef`
- Dropped `_tag` prefix `Transfer` — the module scope provides namespace

### Token (flattened, origin absorbed)

```typescript
export const TransferToken = Schema.Struct({
  tokenId: Schema.String,
  version: Schema.Literal('2'),

  // Origin fields flattened in (was TransferOriginSchema)
  surfaceId: Schema.String,
  sourceId: Schema.String,
  sourceLabel: Schema.String,
  threadId: Schema.optional(Schema.String),
  agentId: Schema.optional(Schema.String),

  // The reference payload
  ref: TransferRef,

  createdAt: Schema.Number,
})
export type TransferToken = typeof TransferToken.Type
```

**Changes from current**:
- `TransferReferenceTokenSchema` → `TransferToken`
- `origin` nested object → flattened fields (no reason for nesting — it's always read field-by-field)
- `reference` → `ref` (shorter)
- `version: '1'` → `version: '2'` (breaking change marker)
- Dropped `messageAnchorId` from origin (unused in practice — threadId suffices)

### Transfer Result (replaces DropDecision / DropIntent)

```typescript
export const TransferAccept = Schema.TaggedStruct('TransferAccept', {
  targetId: Schema.String,
  insertMode: TransferInsertMode,
})
export type TransferAccept = typeof TransferAccept.Type

export const TransferReject = Schema.TaggedStruct('TransferReject', {
  targetId: Schema.String,
  reason: Schema.String,
})
export type TransferReject = typeof TransferReject.Type

export const TransferResult = Schema.Union(TransferAccept, TransferReject)
export type TransferResult = typeof TransferResult.Type
```

**Changes from current**:
- `TransferDropAcceptSchema` → `TransferAccept`
- `TransferDropRejectSchema` → `TransferReject`
- `TransferDropDecisionSchema` → `TransferResult`
- `TransferDropIntentSchema` — **killed**. Intent is now part of target config, not a runtime schema.

### Session (scope-local, minimal)

```typescript
export const TransferSession = Schema.Struct({
  id: Schema.String,
  tokens: Schema.Array(TransferToken),
  pointer: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  hoverTargetId: Schema.optional(Schema.String),
  result: Schema.optional(TransferResult),
  startedAt: Schema.Number,
})
export type TransferSession = typeof TransferSession.Type
```

**Changes from current**:
- `TransferDragSessionSchema` → `TransferSession`
- `token` (singular) + `tokens` (optional array) → just `tokens` array (always)
- `TransferPointerSchema` — **killed**, inlined as struct field
- Added `result` for post-resolution state

### Clipboard Entry (simplified)

```typescript
export const TransferClipboardEntry = Schema.Struct({
  tokens: Schema.Array(TransferToken),
  copiedAt: Schema.Number,
})
export type TransferClipboardEntry = typeof TransferClipboardEntry.Type
```

**Changes from current**:
- `token` (singular) + `tokens` (optional) → just `tokens` (always array)
- Dropped `sourceSelectionIds` — selection state lives in the scope, not the clipboard entry

---

## Killed Types

| Type | Reason |
|---|---|
| `TransferOriginSchema` | Flattened into `TransferToken` |
| `TransferDropIntentSchema` | Absorbed into target config (not a runtime value) |
| `TransferPointerSchema` | Inlined as `{ x: number, y: number }` |
| `TransferRuntimeStateSchema` | Replaced by scope-local atoms |
| `TransferGuard` type alias | Replaced by Effect service method signature |

---

## Migration Notes

### Version Field

Tokens carry `version: '2'`. The codec layer can detect v1 vs v2 tokens and either:
- **Upgrade**: Transform v1 tokens to v2 shape on decode
- **Reject**: Fail with clear error on v1 tokens

Recommendation: **Upgrade** for backward compat during migration. Add `decodeTransferTokenV1` that maps old shape to new.

### Codec Changes

The codec (`encode`/`decode`) stays but operates on `TransferToken` v2. The base64 clipboard text format (`@ref:`, `@refset:`) is unchanged — only the payload shape inside changes.

### Schema Naming Convention

All schemas drop the `Schema` suffix and the `Transfer` prefix where the module provides namespace:
- Import: `import { TaskRef, ClusterRef, TransferToken } from '@/lib/transfer'`
- Not: `import { TransferTaskReferenceSchema } from '@/lib/transfer'`

The barrel export uses the short names. Full-qualified names available for disambiguation.
