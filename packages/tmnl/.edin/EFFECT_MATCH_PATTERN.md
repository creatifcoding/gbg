# Effect.Match Pattern for AVA v2 Discriminated Unions

> **Status**: Pattern Documentation
> **Date**: 2026-01-08
> **Author**: Val (Prime's Architectural Conscience)

## Overview

Effect.Match provides type-safe pattern matching for discriminated unions. In AVA v2, we have three key union types that benefit from pattern matching:

1. **ViewDeltaPayload** - Incremental view artifact updates
2. **ReconcilerEventPayload** - View lifecycle events
3. **FiberActionPayload** - Low-level fiber actions

All three follow the Effect convention of using `_tag` as the discriminator field.

## Quick Reference

```typescript
import { Match } from "effect"

// Match.type<T>() - Create matcher for a type
// Match.tag("TagName", handler) - Match by _tag field
// Match.exhaustive - Ensure all cases covered (compile error if missing)
// Match.orElse - Provide fallback for unmatched cases
```

## ViewDeltaPayload Matching

```typescript
import { Match, pipe } from "effect"
import type { ViewDeltaPayload } from "@/lib/ava/schemas/v2"

/**
 * Handle all ViewDelta types exhaustively
 */
const handleDelta = Match.type<ViewDeltaPayload>().pipe(
  Match.tag("ChannelUpdated", (delta) => ({
    type: "data" as const,
    message: `Channel ${delta.channelId} updated with ${delta.rowCount} rows`,
    isFullRefresh: delta.isFullRefresh,
  })),
  Match.tag("ChannelActivated", (delta) => ({
    type: "lifecycle" as const,
    message: `Channel ${delta.channelId} activated as ${delta.role}`,
  })),
  Match.tag("ChannelDeactivated", (delta) => ({
    type: "lifecycle" as const,
    message: `Channel ${delta.channelId} deactivated: ${delta.reason}`,
  })),
  Match.tag("ChannelCleared", (delta) => ({
    type: "lifecycle" as const,
    message: `Channel ${delta.channelId} cleared: ${delta.reason}`,
  })),
  Match.tag("ArtifactReplaced", (delta) => ({
    type: "snapshot" as const,
    message: `Artifact replaced (reason: ${delta.reason})`,
    newVersion: delta.newArtifact.version,
  })),
  Match.tag("StateChanged", (delta) => ({
    type: "state" as const,
    message: `State: ${delta.previousState} -> ${delta.newState}`,
  })),
  Match.tag("MetadataUpdated", (delta) => ({
    type: "metadata" as const,
    message: `Metadata updated: ${Object.keys(delta.updated).length} keys`,
  })),
  Match.exhaustive // TypeScript error if any case is missing
)

// Usage
const result = handleDelta(viewDelta.delta)
```

## ReconcilerEventPayload Matching

```typescript
import { Match } from "effect"
import type { ReconcilerEventPayload } from "@/lib/ava/schemas/v2"

/**
 * Categorize reconciler events by lifecycle phase
 */
const categorizeEvent = Match.type<ReconcilerEventPayload>().pipe(
  // Request phase
  Match.tag("ViewRequested", (e) => ({
    phase: "request" as const,
    viewId: e.viewId,
    detail: `Requested with priority ${e.priority}`,
  })),

  // Compilation phase
  Match.tag("ViewCompiling", (e) => ({
    phase: "compilation" as const,
    viewId: e.viewId,
    detail: `Compiling ${e.channelCount} channels`,
  })),
  Match.tag("ViewCompilationFailed", (e) => ({
    phase: "compilation" as const,
    viewId: e.viewId,
    detail: `Failed: ${e.errorMessage}${e.willRetry ? " (will retry)" : ""}`,
  })),

  // Active phase
  Match.tag("ViewMounted", (e) => ({
    phase: "active" as const,
    viewId: e.viewId,
    detail: `Mounted in ${e.compileTimeMs}ms`,
  })),
  Match.tag("ViewUpdated", (e) => ({
    phase: "active" as const,
    viewId: e.viewId,
    detail: `Updated to version ${e.version}`,
  })),

  // Suspension/Resume
  Match.tag("ViewSuspended", (e) => ({
    phase: "suspended" as const,
    viewId: e.viewId,
    detail: `Suspended: ${e.reason}`,
  })),
  Match.tag("ViewResumed", (e) => ({
    phase: "active" as const,
    viewId: e.viewId,
    detail: `Resumed after ${e.suspendedDurationMs}ms`,
  })),

  // Invalidation
  Match.tag("ViewInvalidated", (e) => ({
    phase: "invalidated" as const,
    viewId: e.viewId,
    detail: `Invalidated (${e.scope})`,
  })),
  Match.tag("ViewSpecUpdated", (e) => ({
    phase: "invalidated" as const,
    viewId: e.viewId,
    detail: `Spec updated${e.requiresRecompile ? " (recompile needed)" : ""}`,
  })),

  // Termination
  Match.tag("ViewUnmounted", (e) => ({
    phase: "terminated" as const,
    viewId: e.viewId,
    detail: `Unmounted: ${e.reason} (lived ${e.lifetimeMs}ms)`,
  })),

  Match.exhaustive
)
```

## FiberActionPayload Matching

```typescript
import { Match } from "effect"
import type { FiberActionPayload } from "@/lib/ava/schemas/v2"

/**
 * Track fiber lifecycle for debugging
 */
const describeFiberAction = Match.type<FiberActionPayload>().pipe(
  Match.tag("FiberSpawned", (a) =>
    `Spawned with priority ${a.priority}${a.parentFiberId ? ` (parent: ${a.parentFiberId})` : ""}`
  ),
  Match.tag("FiberYielded", (a) =>
    `Yielded: ${a.reason}${a.yieldDurationMs ? ` for ${a.yieldDurationMs}ms` : ""}`
  ),
  Match.tag("FiberResumed", (a) =>
    `Resumed after ${a.suspendedDurationMs}ms suspension`
  ),
  Match.tag("FiberCompleted", (a) =>
    `Completed in ${a.durationMs}ms (${a.workUnits} work units)`
  ),
  Match.tag("FiberFailed", (a) =>
    `Failed: ${a.errorMessage}${a.retryable ? ` (retry in ${a.retryAfterMs}ms)` : " (not retryable)"}`
  ),
  Match.tag("FiberCancelled", (a) =>
    `Cancelled: ${a.reason}${a.detail ? ` - ${a.detail}` : ""}`
  ),
  Match.exhaustive
)
```

## Advanced Patterns

### Matching Multiple Tags

```typescript
// Match several tags with the same handler
const isChannelEvent = Match.type<ViewDeltaPayload>().pipe(
  Match.tag("ChannelUpdated", "ChannelActivated", "ChannelDeactivated", "ChannelCleared",
    (delta) => true
  ),
  Match.orElse(() => false)
)
```

### With Return Type Enforcement

```typescript
// Ensure all branches return the same type
const toLogLevel = Match.type<ReconcilerEventPayload>().pipe(
  Match.withReturnType<"info" | "warn" | "error">(),
  Match.tag("ViewMounted", "ViewResumed", () => "info"),
  Match.tag("ViewSuspended", "ViewInvalidated", () => "warn"),
  Match.tag("ViewCompilationFailed", "ViewUnmounted", () => "error"),
  // Other events default to info
  Match.orElse(() => "info")
)
```

### Option/Either Wrapping

```typescript
// Wrap result in Option (Some if matched, None otherwise)
const extractError = Match.type<ReconcilerEventPayload>().pipe(
  Match.tag("ViewCompilationFailed", (e) => e.errorMessage),
  Match.option // Returns Option<string>
)

// Wrap in Either (Right if matched, Left with original value otherwise)
const extractArtifact = Match.type<ReconcilerEventPayload>().pipe(
  Match.tag("ViewMounted", (e) => e.artifact),
  Match.either // Returns Either<ReconcilerEventPayload, ViewArtifact>
)
```

### In Effect Streams

```typescript
import { Stream, Match } from "effect"
import type { ViewDelta } from "@/lib/ava/schemas/v2"

const processDeltaStream = (deltas: Stream.Stream<ViewDelta>) =>
  deltas.pipe(
    Stream.map((delta) => ({
      viewId: delta.viewId,
      sequence: delta.sequence,
      processed: handleDelta(delta.delta),
    })),
    // Filter to only data updates
    Stream.filter(({ processed }) => processed.type === "data")
  )
```

## Integration with Atoms

```typescript
import { Atom } from "@effect-atom/atom"
import { Match, HashMap } from "effect"

// Atom that applies deltas to current artifact state
export const applyDeltaReducer = (
  artifact: ViewArtifact,
  delta: ViewDeltaPayload
): ViewArtifact => {
  return Match.value(delta).pipe(
    Match.tag("ChannelUpdated", (d) => ({
      ...artifact,
      channelBindings: artifact.channelBindings.map((b) =>
        b.channelId === d.channelId
          ? { ...b, rowCount: d.rowCount, lastUpdatedMs: d.timestampMs }
          : b
      ),
      updatedAtMs: d.timestampMs,
    })),
    Match.tag("StateChanged", (d) => ({
      ...artifact,
      state: d.newState,
    })),
    Match.tag("ArtifactReplaced", (d) => d.newArtifact),
    Match.orElse(() => artifact) // Ignore other deltas for now
  )
}
```

## Testing Patterns

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Match } from "effect"

describe("ViewDelta matching", () => {
  it("handles ChannelUpdated", () => {
    const delta: ViewDeltaPayload = {
      _tag: "ChannelUpdated",
      channelId: "ch-1" as ChannelId,
      rowCount: 100,
      timestampMs: Date.now(),
      isFullRefresh: true,
    }

    const result = handleDelta(delta)
    expect(result.type).toBe("data")
    expect(result.isFullRefresh).toBe(true)
  })

  it("is exhaustive at compile time", () => {
    // This test verifies that Match.exhaustive catches missing cases
    // If you add a new variant to ViewDeltaPayload, TypeScript will
    // error on the handleDelta function until you add a handler
  })
})
```

## Key Points

1. **Always use `Match.exhaustive`** for domain types - ensures compile-time safety when adding new variants
2. **Use `Match.orElse`** only for fallback scenarios where you intentionally want to ignore some cases
3. **The `_tag` convention** is mandatory for `Match.tag` - all AVA schemas follow this
4. **Multiple tags** can share a handler: `Match.tag("A", "B", "C", handler)`
5. **Type narrowing** works within handlers - TypeScript knows the exact type
6. **Consider `Match.withReturnType<T>()`** when you need consistent return types across branches

## References

- [Effect Match Documentation](https://effect.website/docs/code-style/pattern-matching/)
- [ViewDeltaPayload Schema](../src/lib/ava/schemas/v2/artifacts.ts)
- [ReconcilerEventPayload Schema](../src/lib/ava/schemas/v2/events.ts)
- [AVA v2 Implementation Strategy](../src-ava/docs/AVA_V2_IMPLEMENTATION_STRATEGY.md)
