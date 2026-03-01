# d2ts Streaming JSON Parser — Implementation Plan

```
Feature:    F437 (Streaming JSON Parser) + F447 (d2ts Streaming Theory)
Author:     Val (architectural conscience)
Date:       2026-02-19
Status:     READY FOR IMPLEMENTATION
Depends On: research-d2ts-streaming-json.md (theory)
```

---

## Phase 1: Foundation (Tasks #1603–#1605)

### 1.1 JSON Tokenizer

**File**: `src/lib/genifer/streaming/tokenizer.ts`

```typescript
// Effect.Schema for JSON tokens
const JSONToken = Schema.Union(
  Schema.TaggedStruct('ObjectStart', {}),
  Schema.TaggedStruct('ObjectEnd', {}),
  Schema.TaggedStruct('ArrayStart', {}),
  Schema.TaggedStruct('ArrayEnd', {}),
  Schema.TaggedStruct('Key', { value: Schema.String }),
  Schema.TaggedStruct('String', { value: Schema.String, partial: Schema.Boolean }),
  Schema.TaggedStruct('Number', { value: Schema.Number }),
  Schema.TaggedStruct('Boolean', { value: Schema.Boolean }),
  Schema.TaggedStruct('Null', {}),
)

// Tokenizer: string chunks → JSONToken stream
// Handles partial tokens across chunk boundaries
```

**Tests**: Tokenize complete JSON, chunked JSON (split mid-string, mid-number), malformed JSON (graceful error).

### 1.2 d2ts Graph Construction

**File**: `src/lib/genifer/streaming/graph.ts`

Build the 5-stage d2ts pipeline from the theory document:
1. Tokenize input
2. Match brackets (stateful reduce with stack)
3. Assemble partial objects (join tokens with bracket pairs)
4. Discriminate component type (filter on `_tag`/`type` field)
5. Stream partial props

**Dependencies**: `@electric-sql/d2ts@0.1.8`

### 1.3 Effect Integration

**File**: `src/lib/genifer/streaming/StreamingParseService.ts`

```typescript
class StreamingParseService extends Effect.Service<StreamingParseService>()(
  'genifer/StreamingParseService',
  {
    effect: Effect.gen(function* () {
      return {
        parse: (llmStream: Stream.Stream<string>) =>
          Effect.gen(function* () {
            const queue = yield* Queue.bounded<PartialComponentProps>(16)
            // Build d2ts graph, feed stream, output to queue
            // Return: Stream.fromQueue(queue)
          }),
      }
    }),
  }
) {}
```

### 1.4 Atom Bridge

**File**: `src/lib/genifer/streaming/atoms.ts`

```typescript
// Partial tree state — updated incrementally as tokens arrive
export const partialTreeAtom = Atom.make<UITree>(UITree.empty())

// Streaming status
export const streamStatusAtom = Atom.make<'idle' | 'streaming' | 'complete' | 'error'>('idle')

// Component identification events
export const identifiedComponentsAtom = Atom.make<ComponentIdentification[]>([])
```

## Phase 2: Schema Annotations

**File**: `src/lib/genifer/streaming/annotations.ts`

Add streaming annotations to Effect.Schema:
- `StreamingString` — progressive rendering
- `StreamingArray` — incremental rendering
- Annotation reader for renderer integration

## Phase 3: Renderer Integration

**File**: `src/lib/genifer/react/StreamingRenderer.tsx`

React component that subscribes to `partialTreeAtom` and renders:
- Identified components with partial props
- Shimmer/skeleton for pending props
- Progressive text for `StreamingString` annotated props

## Testing Strategy

| Test Level | What | Where |
|---|---|---|
| Unit | Tokenizer edge cases | `__tests__/streaming/tokenizer.test.ts` |
| Unit | Bracket matcher correctness | `__tests__/streaming/bracket-matcher.test.ts` |
| Unit | Discriminator fires on `_tag` | `__tests__/streaming/discriminator.test.ts` |
| Integration | Full pipeline: string → partial tree | `__tests__/streaming/pipeline.test.ts` |
| Property | Convergence: partial trees monotonically increase | `__tests__/streaming/convergence.test.ts` |
| Property | Valid prefix: every partial state is renderable | `__tests__/streaming/prefix.test.ts` |

## File Inventory

```
src/lib/genifer/streaming/
├── index.ts                      # Public exports
├── tokenizer.ts                  # JSON tokenizer (chunk-aware)
├── graph.ts                      # d2ts 5-stage pipeline
├── annotations.ts                # Streaming Schema annotations
├── StreamingParseService.ts      # Effect.Service wrapper
├── atoms.ts                      # Atom state (partialTree, status)
└── __tests__/
    ├── tokenizer.test.ts
    ├── bracket-matcher.test.ts
    ├── discriminator.test.ts
    ├── pipeline.test.ts
    ├── convergence.test.ts
    └── prefix.test.ts
```

## Acceptance Criteria

- [ ] Tokenizer handles chunked input (split at any byte boundary)
- [ ] Discriminator identifies component type within first 50 bytes of each object
- [ ] Partial tree atom updates monotonically (never loses information)
- [ ] Complete tree matches full JSON.parse() result
- [ ] Backpressure works (slow consumer doesn't drop data)
- [ ] All 225 existing genifer tests continue to pass
- [ ] Property tests pass for convergence and valid-prefix laws
