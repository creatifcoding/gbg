# TMNL Streams

A reactive streaming library built on Effect, providing supervised, interruptible stream sources with lifecycle management.

## Quick Start

```typescript
import { Feed, FeedsManager, FeedsManagerLive, ticker } from "@/lib/streams"
import { Effect, Console } from "effect"

// Simple: stateless ticker
const heartbeat = ticker("1 second")

// Stateful: Feed with lifecycle
const sensorFeed = Feed.make({
  id: "temp-sensor",
  name: "Temperature Sensor",
  interval: "500 millis",
  producer: Effect.succeed({ celsius: 22, timestamp: Date.now() }),
  onConnect: Console.log("Connected"),
  onDisconnect: Console.log("Disconnected"),
})

// Orchestrated: FeedsManager
const program = Effect.gen(function* () {
  const manager = yield* FeedsManager
  yield* manager.register(sensorFeed, { tags: ["sensor"] })
  yield* manager.startAll()
})

Effect.runPromise(program.pipe(Effect.provide(FeedsManagerLive)))
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Channel (Topology)                               │
│                  Inlets · Junctions · Outlets · Protocol                 │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐          │
│   │ Inlet A │────►│ Merge   │────►│Partition│────►│Outlet X │          │
│   └─────────┘     └─────────┘     └────┬────┘     └─────────┘          │
│   ┌─────────┐          ▲               │          ┌─────────┐          │
│   │ Inlet B │──────────┘               └─────────►│Outlet Y │          │
│   └─────────┘                                     └─────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ connects
┌─────────────────────────────┴───────────────────────────────────────────┐
│                    FeedsManager (Orchestration)                          │
│              Registry · Lifecycle · Event Bus                            │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │
│   │  Feed<A>    │  │  Feed<B>    │  │  Feed<C>    │                    │
│   │  (source)   │  │  (source)   │  │  (source)   │                    │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                    │
└──────────┼─────────────────┼─────────────────┼──────────────────────────┘
           │                 │                 │
           ▼                 ▼                 ▼
    ┌──────────────────────────────────────────────────┐
    │           PubSub Command Channel                  │
    │     StartFeed · StopFeed · SignalFeed · ...      │
    └──────────────────────────────────────────────────┘
```

| Layer | Component | Responsibility | BFO Type |
|-------|-----------|----------------|----------|
| **Primitive** | `ticker`, `pulse`, `counter` | Stateless stream factories | — |
| **Feed** | `Feed<A, E, R>` | Single source with lifecycle | Process |
| **FeedsManager** | `FeedsManager` | Orchestration, registry | Service |
| **Channel** | `Channel` | Topological multiplexing protocol | GDC |

## Core Concepts

### Feed Lifecycle

A Feed transitions through these states:

```
idle → running → stopped
         ↓
       paused (future)
```

- **idle**: Created but never started
- **running**: Actively producing events
- **stopped**: Terminated (cleanup complete)

### Branded FeedId

Type-safe heterogeneous storage:

```typescript
const tempId: FeedId<TemperatureReading> = yield* manager.register(tempFeed)
const pressId: FeedId<PressureReading> = yield* manager.register(pressFeed)

// Compiler enforces type safety
const feed = yield* manager.get(tempId)  // Returns Feed<TemperatureReading>
```

### Event-Driven Control

Send commands via PubSub:

```typescript
yield* PubSub.publish(manager.commands, { _tag: "StopFeed", id: "sensor-01" })
yield* PubSub.publish(manager.commands, { _tag: "StartAll" })
```

Subscribe to manager events:

```typescript
const events = yield* manager.subscribeEvents()
// FeedRegistered, FeedStarted, FeedStopped, FeedError
```

## API Summary

### Time Primitives

| Primitive | Signature | Description |
|-----------|-----------|-------------|
| `ticker` | `(interval, options?) → Stream<number>` | Emits timestamps at interval |
| `pulse` | `(effect, interval, options?) → Stream<A>` | Runs effect at interval |
| `counter` | `(interval) → Stream<number>` | Emits incrementing integers |
| `heartbeat` | `Stream<number>` | Alias for `ticker("1 second")` |
| `metronome` | `(bpm) → Stream<number>` | Emits at beats-per-minute rate |
| `elapsed` | `(interval) → Stream<number>` | Emits milliseconds since start |
| `backoff` | `(initial, {factor, max}) → Stream<number>` | Exponential backoff ticker |
| `stopwatch` | `(interval) → {stream, start, stop, lap, reset}` | Controllable timer |

### Stream Operators

| Operator | Signature | Description |
|----------|-----------|-------------|
| `delay` | `(duration) → Stream<A> → Stream<A>` | Delays each emission |
| `debounce` | `(duration) → Stream<A> → Stream<A>` | Emits after silence |
| `throttle` | `(duration) → Stream<A> → Stream<A>` | Rate-limits emissions |
| `sample` | `(interval) → Stream<A> → Stream<Option<A>>` | Samples at intervals |
| `buffer` | `(duration) → Stream<A> → Stream<Chunk<A>>` | Batches into time windows |
| `timeout` | `(duration) → Stream<A> → Stream<A>` | Fails on timeout |

### Feed Class

```typescript
class Feed<A, E = never, R = never> {
  static make<A, E, R>(config: FeedConfig<A, E, R>): Feed<A, E, R>

  // Lifecycle
  start(): Effect<void, E, R>
  stop(): Effect<void>
  signal(sig: FeedSignal): Effect<void, E, R>

  // State
  get status(): Effect<FeedStatus>
  get state(): Effect<FeedState<A, E>>
  get isRunning(): Effect<boolean>

  // Stream access
  get stream(): Stream<A, E, R>
  subscribe(): Effect<Queue.Dequeue<A>, never, Scope>

  // Managed execution
  run(handler, options?): Effect<void, E, R | Scope>
}
```

### FeedsManager Service

```typescript
interface FeedsManagerService {
  // Registration
  register<A, E, R>(feed, options?): Effect<FeedId<A>>
  unregister(id): Effect<void>

  // Retrieval
  get<A>(id: FeedId<A>): Effect<Option<Feed<A>>>
  getById(id: string): Effect<Option<Feed<unknown>>>
  getByTag(tag: string): Effect<Feed<unknown>[]>
  listIds(): Effect<string[]>
  getStatuses(): Effect<HashMap<string, FeedStatus>>

  // Lifecycle
  start(id): Effect<void>
  stop(id): Effect<void>
  startAll(): Effect<void>
  stopAll(): Effect<void>
  signal(id, sig): Effect<void>

  // Event bus
  commands: PubSub<FeedCommand>
  events: PubSub<FeedManagerEvent>
  subscribeEvents(): Effect<Queue.Dequeue<FeedManagerEvent>, never, Scope>
}
```

## Documentation

| Document | Purpose |
|----------|---------|
| [API Reference](./docs/API.md) | Complete API signatures and types |
| [Tutorial](./docs/TUTORIAL.md) | Step-by-step learning guide |
| [Patterns](./docs/PATTERNS.md) | Problem → Solution catalog |

## File Structure

```
src/lib/streams/
├── index.ts              # Public exports
├── primitives/
│   ├── index.ts          # Primitive exports
│   └── time.ts           # Time-based primitives
├── constructs/
│   ├── index.ts          # Construct exports
│   ├── Feed.ts           # Feed class (single source lifecycle)
│   ├── FeedsManager.ts   # FeedsManager service (orchestration)
│   └── Channel.ts        # Channel schemas (topology protocol)
├── challenges/
│   ├── playground.ts     # Interactive runner
│   ├── 01-heartbeat.ts   # Challenge 1: Basic ticker
│   ├── 02-cancellable-feed.ts # Challenge 2: Stream.unwrap
│   ├── 03-feed-demo.ts   # Challenge 3: Feed lifecycle
│   ├── 04-manager-demo.ts # Challenge 4: FeedsManager
│   ├── 05-primitives-demo.ts # Challenge 5: Time primitives
│   └── 06-multi-source-merge.ts # Challenge 6: Merge/broadcast
├── docs/
│   ├── API.md            # Technical reference
│   ├── TUTORIAL.md       # Narrative guide
│   └── PATTERNS.md       # Pattern catalog
├── factories.ts          # Legacy (use primitives)
├── README.md             # This file
└── __tests__/
    └── factories.test.ts # Vitest specs
```

## Running Examples

```bash
# Run all challenges
bun run src/lib/streams/challenges/playground.ts

# Run specific challenge
bun run src/lib/streams/challenges/playground.ts 1  # Heartbeat
bun run src/lib/streams/challenges/playground.ts 2  # Cancellable Feed
bun run src/lib/streams/challenges/playground.ts 3  # Feed Class Demo
bun run src/lib/streams/challenges/playground.ts 4  # FeedsManager Demo
bun run src/lib/streams/challenges/playground.ts 5  # Primitives Demo
bun run src/lib/streams/challenges/playground.ts 6  # Multi-Source Merge

# Run tests
bun vitest run src/lib/streams/__tests__/
```
