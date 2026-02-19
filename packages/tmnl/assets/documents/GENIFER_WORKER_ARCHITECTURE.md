# JSON-Render Worker Architecture

> Research conducted 2026-01-17. Follow-up research pending.

## Executive Summary

Effect's `@effect/platform` Worker module can offload CPU-intensive work from the main thread. For json-render, **Parse Worker** is the recommended first implementation - low risk, measurable win.

## Research Findings

### When Workers Help vs Hurt

| Payload Size | Overhead | Recommendation |
|-------------|----------|----------------|
| < 10KB | < 1ms | Skip workers |
| 10KB - 100KB | 1-10ms | Consider workers |
| 100KB+ | 10-300ms | Use workers + Transferables |

### Current json-render Bottlenecks

| Bottleneck | Location | Impact | Worker Solution |
|------------|----------|--------|-----------------|
| `JSON.parse(line)` | streaming.ts:146 | 5-10ms/burst | Parse Worker |
| `{ ...elements, [key]: el }` | schemas.ts:192 | 2-5ms/burst | Tree Worker |
| `structuredClone(obj)` | path.ts:144 | 3-8ms/burst | Tree Worker |
| React reconciliation | renderer.tsx | 10-20ms/frame | Virtualization (not worker) |

**Total main thread time**: 20-40ms/burst
**Target**: <16ms for 60fps

### Effect Worker API

```typescript
import { Worker, WorkerRunner } from "@effect/platform"
import { Schema } from "effect"

// Define request with Schema (enables serialization)
class ParseLines extends Schema.TaggedRequest<ParseLines>()("ParseLines", {
  failure: Schema.String,
  success: JsonPatch,
  payload: { lines: Schema.Array(Schema.String) }
}) {}

// Main thread: Create worker pool
const pool = yield* Worker.makePoolSerialized({
  size: 2,
  spawn: () => new Worker("./parse.worker.ts")
})

// Execute and get stream back (YES, streams work!)
const stream = yield* pool.execute(new ParseLines({ lines }))

// Worker side: Handle requests
const runner = WorkerRunner.layerSerialized(ParseLines, {
  ParseLines: (req) => Effect.gen(function* () {
    return yield* parseLinesEffect(req.lines)
  })
})
```

**Key insight**: Effect Workers fully support `Stream<A>` - chunks transfer via `Mailbox`.

## Implementation Plan

### Phase 1: Parse Worker (Quick Win)

**Effort**: 1-2 days
**Risk**: Low
**Expected gain**: 20-40% main thread reduction

```
NDJSON lines → Worker (JSON.parse + Schema.decode) → JsonPatch[] → Main thread
```

Files:
- `src/lib/json-render/workers/parse.worker.ts`
- `src/lib/json-render/workers/worker-api.ts`
- `src/lib/json-render/workers/__tests__/parse.test.ts`

### Phase 2: Tree Worker (High Impact)

**Effort**: 5-7 days
**Risk**: Medium (requires UITree serialization)
**Expected gain**: 50-60% main thread reduction

```
Batched patches → Worker (applyPatches) → Transferable UITree → Main thread
```

Requires:
- `UITree.toJSON()` / `fromJSON()` methods
- Transferable array buffer for large trees

### Phase 3: Hybrid Streaming

**Effort**: 3-5 days
**Risk**: Medium
**Expected gain**: Near-zero main thread blocking

```
Network Stream → Parse Worker → Tree Worker → Main thread (render only)
```

## Follow-Up Research Required

### Instructions for Future Session

When resuming this work, invoke the workflow-router skill with Research goal and Aggressive allocation:

```
1. User: "Continue json-render worker research"

2. Invoke workflow-router skill

3. Select: Research goal, Aggressive allocation

4. Prompt subagents to invoke grounded-research skill:

   Task(subagent_type="oracle", prompt="""
   Invoke /grounded-research skill first, then research:

   1. Effect Stream + Worker integration patterns
      - Can Stream.fromAsyncIterable work across worker boundary?
      - Backpressure handling in worker streams

   2. Transferable objects with Effect
      - Does @effect/platform support Transferable?
      - Zero-copy patterns for large payloads

   3. React 19 + Workers
      - useTransition + worker results
      - Concurrent rendering coordination
   """)
```

### Open Questions

1. **Backpressure**: How does Effect handle backpressure when worker produces faster than main thread consumes?
2. **Error recovery**: Worker crash recovery patterns
3. **Memory**: Shared memory (SharedArrayBuffer) vs structured clone tradeoffs
4. **Bundle**: Worker bundling strategy (inline vs separate file)

## References

- [Effect Platform Worker API](https://effect-ts.github.io/effect/platform/Worker.ts.html)
- [Using Effect RPC for Workers](https://lucas-barake.github.io/rpc-for-workers-in-typescript/)
- [Is postMessage slow?](https://surma.dev/things/is-postmessage-slow/)
- [Chrome Transferable Objects](https://developer.chrome.com/blog/transferable-objects-lightning-fast)

## Status

| Phase | Status | Issue |
|-------|--------|-------|
| Research | Complete | - |
| Phase 1: Parse Worker | **In Progress** | - |
| Phase 2: Tree Worker | Planned | - |
| Phase 3: Hybrid | Planned | - |
