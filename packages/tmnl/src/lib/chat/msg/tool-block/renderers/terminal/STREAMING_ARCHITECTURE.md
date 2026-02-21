# Tool Output Streaming Architecture

## Problem

Tool invocations (particularly `bash`) execute commands that may run for seconds or minutes. Currently, the entire output is buffered server-side and delivered as a single blob on tool completion. The user sees nothing until the tool finishes — a dead zone in a system that should feel alive.

## Goal

Stream tool output in real-time from the harness engine through to a GPU-rendered terminal (restty/libghostty). Each chunk of stdout/stderr arrives as it's produced, is written **INTO** the restty WASM VT state machine (which IS the data structure), and accumulates in a parallel SortedMap ledger for replay/reconnection.

## Core Insight: The Renderer IS the Structure

restty's libghostty WASM core is a real VT parser with a real screen buffer. When you call `term.write(chunk)`, the data enters the WASM terminal state machine — it parses ANSI escape sequences, updates cursor position, accumulates screen lines, handles colors/bold/etc. The terminal IS the accumulator. WebGPU renders from this internal state on the next `requestAnimationFrame`.

The SortedMap is NOT the rendering source. It's a parallel ledger — a replay log for:
1. Reconnection (write all missed chunks back into a fresh terminal)
2. Byte counting / progress metrics
3. Gap detection (missing sequence numbers)

## Design: Atoms as Pointers

Atoms are addresses. The streaming pipeline doesn't push content down a prop chain. Instead:

1. `Stream.tap` intercepts `phase: 'stream'` events from the harness
2. The tap **lazily creates** an `Atom.family` entry keyed by `toolCallId`
3. Each chunk is written to the SortedMap ledger (append-only)
4. The React component subscribes to its atom via `toolCallId` (the pointer)
5. On each atom notification, the NEW chunk is `term.write(chunk)` — pushed into restty
6. restty's WASM core accumulates it. WebGPU renders it. Done.

```
┌──────────────────────────────────────────────────────────────┐
│  SERVER (PiAiHarnessEngine)                                  │
│                                                              │
│  BashTool.execute(id, args, signal, onUpdate)                │
│       │                                                      │
│       │  onUpdate(chunk)  ← fires per stdout/stderr chunk    │
│       ▼                                                      │
│  PubSub.publish(eventsPubSub, HarnessToolEvent {             │
│    phase: 'stream',                                          │
│    toolCallId,                                               │
│    toolName: 'bash',                                         │
│    payload: { seq, chunk, kind: 'stdout'|'stderr' }          │
│  })                                                          │
│       │                                                      │
│       ▼  (WebSocket)                                         │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  CLIENT (Event Stream Pipeline)                              │
│                                                              │
│  runtime.events.pipe(                                        │
│    Stream.tap((event) =>                                     │
│      event.phase === 'stream'                                │
│        ? toolStreamSink(event)     // ← side-effect          │
│        : Effect.void                                         │
│    ),                                                        │
│  )                                                           │
│                                                              │
│  toolStreamSink:                                             │
│    1. Lazily create Atom.family entry for toolCallId         │
│    2. SortedMap.set(seq, line) into the ledger               │
│    3. Atom updates → React subscriber notified               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  SIDECAR REGISTRY (ToolStreamRegistry)                       │
│                                                              │
│  toolStreamsAtom: Atom<HashMap<ToolCallId, ToolStreamState>>  │
│                                                              │
│  toolStreamFamily: Atom.family((toolCallId) =>               │
│    Atom.make((get) => {                                      │
│      const streams = get(toolStreamsAtom)                     │
│      return HashMap.get(streams, toolCallId)                 │
│        |> Option.getOrElse(() => EMPTY)                      │
│    })                                                        │
│  )                                                           │
│  ↑ lazily created on first access per toolCallId             │
│  ↑ GC'd via WeakRef+FinalizationRegistry on unmount          │
│                                                              │
│  ToolStreamState = {                                         │
│    ledger: SortedMap<Seq, ToolStreamLine>  // replay log     │
│    pendingChunk: string | null             // latest unseen  │
│    totalBytes: number                                        │
│    startedAt / lastChunkAt: number                           │
│    phase: 'streaming' | 'complete' | 'error'                │
│  }                                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  COMPONENT (BashToolRenderer)                                │
│                                                              │
│  const stream = useToolStream(toolCallId)                    │
│  // subscribes to toolStreamFamily(toolCallId)               │
│  // atom lazily created if not already addressed             │
│                                                              │
│  useEffect on stream.pendingChunk:                           │
│    term.write(pendingChunk)  → INTO restty WASM VT parser    │
│                                ↓                             │
│                        libghostty accumulates                │
│                        screen buffer updates                 │
│                                ↓                             │
│                        requestAnimationFrame                 │
│                                ↓                             │
│                        WebGPU renders frame                  │
│                                                              │
│  On mount (reconnection / late-join):                        │
│    replay all ledger entries: SortedMap.values(ledger)        │
│    .forEach(line => term.write(line.chunk))                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Data Structures

### ToolStreamLine (Effect Schema)

```typescript
const ToolStreamLine = Schema.TaggedStruct('ToolStreamLine', {
  seq: Schema.Number,                              // monotonic from server
  chunk: Schema.String,                            // raw text, may include ANSI
  kind: Schema.Literal('stdout', 'stderr'),
  receivedAt: Schema.Number,                       // client timestamp
})
```

### ToolStreamState

```typescript
interface ToolStreamState {
  toolCallId: string
  toolName: string
  ledger: SortedMap.SortedMap<number, ToolStreamLine>  // replay log, keyed by seq
  pendingChunk: string | null                          // latest chunk for term.write()
  totalBytes: number
  startedAt: number
  lastChunkAt: number
  phase: 'streaming' | 'complete' | 'error'
}
```

### Storage: HashMap + SortedMap

- **HashMap<ToolCallId, ToolStreamState>** — O(1) lookup by command block
- **SortedMap<Seq, ToolStreamLine>** — O(log n) insert, ordered iteration for replay

### Why SortedMap for the ledger?

1. **Idempotent upsert**: `SortedMap.set(seq, line)` is safe for replays
2. **Ordered replay**: `SortedMap.values()` yields in seq order
3. **Gap detection**: `SortedMap.keys()` reveals missing seq numbers
4. **Persistent/structural sharing**: New SortedMap shares tree nodes with previous

### Why `pendingChunk` instead of reading from SortedMap?

The component needs to know WHAT CHANGED, not the full history. `pendingChunk` is the latest chunk that needs to be `term.write()`'d into restty. After writing, it's consumed. The ledger is for replay, not for rendering.

## Atom.family: Lazy Creation + Auto-GC

```typescript
// Lazily created per toolCallId — first access creates, subsequent returns same
const toolStreamFamily = Atom.family((toolCallId: string) =>
  Atom.make((get) => {
    const streams = get(toolStreamsAtom)
    return HashMap.get(streams, toolCallId).pipe(
      Option.getOrElse(() => emptyStreamState(toolCallId)),
    )
  }),
)
```

- **First call**: Creates atom, stores in internal MutableHashMap via WeakRef
- **Subsequent calls**: Returns cached atom instance (same reference)
- **Component unmount**: No subscribers → Registry schedules removal → WeakRef cleared → FinalizationRegistry removes from family cache
- **No manual cleanup**: GC handles lifecycle

## Stream.tap: The Side-Channel

The key operator. `Stream.tap` executes an Effect for each event WITHOUT altering the stream. The original event passes through to the existing event processor unchanged. The tap is a side-channel that writes to the sidecar registry.

```typescript
// In the event fiber (useHarnessAdapter)
const enhancedEvents = runtime.events.pipe(
  Stream.tap((event) => {
    if (event._tag === 'HarnessToolEvent' && event.phase === 'stream') {
      return toolStreamSink(event)
    }
    return Effect.void
  }),
)
```

`toolStreamSink` is a pure Effect that:
1. Constructs a `ToolStreamLine` from the event payload
2. Uses `HashMap.modifyAt` to upsert into the master HashMap atom
3. Sets `pendingChunk` to the new chunk text
4. The atom family derivation re-evaluates → subscriber notified

```typescript
const toolStreamSink = (event: HarnessToolEvent) =>
  Effect.sync(() => {
    const { toolCallId, payload } = event
    const { seq, chunk, kind } = payload as ToolStreamPayload

    const line: ToolStreamLine = {
      _tag: 'ToolStreamLine',
      seq,
      chunk,
      kind,
      receivedAt: Date.now(),
    }

    toolStreamRegistry.update(toolStreamsAtom, (streams) =>
      HashMap.modifyAt(streams, toolCallId, (existing) =>
        Option.some(
          Option.match(existing, {
            onNone: () => ({
              toolCallId,
              toolName: event.toolName,
              ledger: SortedMap.make(Order.number)([seq, line]),
              pendingChunk: chunk,
              totalBytes: chunk.length,
              startedAt: Date.now(),
              lastChunkAt: Date.now(),
              phase: 'streaming' as const,
            }),
            onSome: (prev) => ({
              ...prev,
              ledger: SortedMap.set(prev.ledger, seq, line),
              pendingChunk: chunk,
              totalBytes: prev.totalBytes + chunk.length,
              lastChunkAt: Date.now(),
            }),
          }),
        ),
      ),
    )
  })
```

## Server Changes

### 1. Extend PiAiToolRuntime.execute signature

```typescript
execute: (
  toolCall: PiAiToolCall,
  onStreamChunk?: (chunk: ToolStreamChunk) => Effect.Effect<void>,
) => Effect.Effect<PiAiToolResultMessage, PiAiToolRuntimeError>
```

### 2. Wire onUpdate in PiAiToolRuntimeBuiltins

The SDK's `agentTool.execute(id, args, signal?, onUpdate?)` already streams. We bridge `onUpdate` → `onStreamChunk`:

```typescript
let seq = 0
const sdkOnUpdate = onStreamChunk
  ? (partial: { content: Array<{ type: string; text: string }> }) => {
      const text = partial.content.map(c => c.text).join('')
      seq++
      // SDK callback is sync — fire and forget into Effect
      Effect.runSync(onStreamChunk({
        toolCallId: toolCall.id,
        seq,
        chunk: text,
        kind: 'stdout',
      }))
    }
  : undefined

const result = yield* Effect.tryPromise({
  try: () => agentTool.execute(toolCall.id, toolCall.arguments, undefined, sdkOnUpdate),
  ...
})
```

### 3. Engine emits `phase: 'stream'` events

```typescript
const onStreamChunk = (chunk: ToolStreamChunk) =>
  appendEvent(sessionId, (seq, s) =>
    HarnessToolEvent.make({
      sessionId: s.sessionId,
      seq,
      at: Date.now(),
      toolCallId: chunk.toolCallId,
      toolName: toolCall.name,
      phase: 'stream',
      payload: {
        seq: chunk.seq,
        chunk: chunk.chunk,
        kind: chunk.kind,
      },
    }),
  )

const result = yield* toolRuntime.execute(toolCall, onStreamChunk)
```

### 4. HarnessToolEvent schema update

Add `'stream'` to the phase literal union. Payload shape for `phase: 'stream'`:

```typescript
{ seq: number, chunk: string, kind: 'stdout' | 'stderr' }
```

## Component Integration

### useToolStream hook

```typescript
export function useToolStream(toolCallId: string) {
  const streamAtom = toolStreamFamily(toolCallId)
  const state = useAtomValue(streamAtom, { registry: toolStreamRegistry })

  return {
    pendingChunk: state.pendingChunk,
    isStreaming: state.phase === 'streaming',
    totalBytes: state.totalBytes,
    elapsedMs: state.lastChunkAt - state.startedAt,
    lineCount: SortedMap.size(state.ledger),
    ledger: state.ledger,   // for replay on mount
    phase: state.phase,
  }
}
```

### TerminalOutput: chunk-by-chunk write

```tsx
// Inside BashToolRenderer
const stream = useToolStream(toolCallId)
const termRef = useRef<Terminal | null>(null)
const writtenSeqRef = useRef(0)  // track what we've already written

// Write new chunks incrementally
useEffect(() => {
  if (!stream.pendingChunk || !termRef.current) return
  termRef.current.write(stream.pendingChunk)
}, [stream.pendingChunk])

// On mount: replay ledger for late-join / reconnection
useEffect(() => {
  if (!termRef.current || SortedMap.isEmpty(stream.ledger)) return
  for (const [_seq, line] of SortedMap.entries(stream.ledger)) {
    termRef.current.write(line.chunk)
  }
  writtenSeqRef.current = SortedMap.size(stream.ledger)
}, []) // only on mount
```

## Performance

1. **Sidecar registry isolates churn**: High-frequency chunks (~100ms) only notify `toolStreamFamily(id)` subscribers — not the entire morphChatRegistry

2. **restty batches renders**: Multiple `term.write()` calls within one frame are batched by `requestAnimationFrame`. No per-chunk WebGPU draw calls

3. **SortedMap is persistent**: Structural sharing — each `SortedMap.set` shares tree nodes with previous version. O(log n) insert

4. **Atom.family auto-GC**: WeakRef + FinalizationRegistry. Component unmount → no subscribers → atom disposed → family entry cleared

5. **pendingChunk avoids full ledger scan**: Component only processes the latest chunk, not the entire history

6. **HashMap.modifyAt for atomic upsert**: Insert-or-update in one operation, no race conditions

## File Structure

```
src/lib/chat/msg/tool-block/renderers/terminal/
├── STREAMING_ARCHITECTURE.md      ← this file
├── terminal-output.tsx            ← restty React wrapper (read-only)
├── index.ts                       ← barrel
├── schemas.ts                     ← ToolStreamLine, ToolStreamState schemas
├── tool-stream-registry.ts        ← sidecar Registry + atoms + family
└── use-tool-stream.ts             ← useToolStream hook

src/lib/harness/
├── PiAiToolRuntime.ts             ← execute signature + onStreamChunk
├── PiAiToolRuntimeBuiltins.ts     ← SDK onUpdate → onStreamChunk bridge
├── PiAiHarnessEngine.ts           ← phase:'stream' events emitted
└── schemas.ts                     ← HarnessToolEvent phase union updated

src/lib/morphchat/
├── adapters/harness-event-processor.ts  ← Stream.tap for stream events
└── hooks/useHarnessAdapter.ts           ← enhanced event stream pipeline
```
