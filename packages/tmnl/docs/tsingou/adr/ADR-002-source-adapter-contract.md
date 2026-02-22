# ADR-002: Source Adapter Contract — Effect.Service with Push API

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaire `tsingou-source-adapters` (ID: `N7spd-gJKMEbB0CKoKH4E`)

---

## Context

Every signal source — NATS, HTTP, WebSocket, RSS, serial, MIDI, OSC, file-watch — must normalize its data into `BaseSignal` and deliver it to the d2ts pipeline. The contract must handle connection lifecycle, backpressure, typed errors, and hot-plug addition/removal.

Four options were evaluated: `Effect.Stream<Signal>`, `Effect.Service with push API`, `Effect.Channel`, `@effect/platform native adapters`.

## Decision

**Effect.Service with `push(signal)` callback**, building on the existing `src/lib/streams` library in TMNL.

### Contract Shape

```typescript
interface SourceAdapterShape {
  readonly adapterId: string
  readonly sourceId: string
  readonly kind: string
  readonly healthAtom: Atom<AdapterHealth>
  readonly signalCountAtom: Atom<number>
  readonly pause: Effect.Effect<void>
  readonly resume: Effect.Effect<void>
}
```

Each adapter is an `Effect.Service` with **scoped lifecycle** — constructing the service connects to the source; closing the scope disconnects and runs cleanup via `Effect.addFinalizer`.

### Specific Choices

| Question | Decision | Rationale |
|----------|----------|-----------|
| Adapter contract | `Effect.Service` with `push()` callback | Imperative push is natural for protocol-specific adapters |
| Signal schema | Base + source extensions (`Schema.extend`) + KV schema registry | Typed core + dynamic extensions for runtime-registered types |
| NATS role | ALL FIVE: direct source, bus, bridge, fan-out, JetStream replay | NATS is the universal signal fabric |
| Serial/hardware | Hybrid: sidecar always, in-process for dev | Sidecar is deployment-safe; in-process for near-realtime |
| Adapter lifecycle | Hot-plug (runtime add/remove) | Live analysis scenario — sources appear/disappear |
| Push mechanism | `Queue.offer(signalQueue, signal)` — bounded(4096) | Backpressure via bounded queue suspension |

### Signal Schema

```typescript
const BaseSignal = Schema.Struct({
  id: SignalId,           // Branded string
  sourceId: SourceId,     // Branded string  
  timestamp: Schema.DateFromSelf,
  version: SignalVersion, // [tick, source_seq]
  kind: SignalKind,       // "midi" | "osc" | "nats" | ... | string
  payload: Schema.Unknown,
  metadata: Schema.optional(SignalMetadata),
})
```

Source-specific extensions: `MidiSignal`, `OscSignal`, `HttpSignal`, `RssSignal`, `WebSocketSignal`, `FileWatchSignal`, `SerialSignal`, `NatsSignal` — each via `Schema.extend(BaseSignal, {...})`.

## Consequences

### Positive
- Uniform contract — d2ts doesn't care where data comes from
- Hot-plug — `AdapterManager.register()` at runtime
- Typed errors — `Data.TaggedError` hierarchy (17 error classes)
- Atom-as-State — React subscribes directly to health/count atoms
- Scoped cleanup — `Effect.addFinalizer` ensures resource release

### Negative
- Push-based adapters require manual stream composition (vs. pure `Stream` return)
- `Queue.bounded(4096)` is a fixed capacity — may need tuning per deployment

## Implementation

- **8 adapters built**: NATS, HTTP (4 modes), WebSocket (bidirectional), RSS (+FeedManager), FileWatch (Holonet bridge), Serial (Holonet bridge), MIDI (stub), OSC (stub)
- **17 tagged errors**: `adapters/errors.ts`
- **XML parser**: `adapters/xml.ts` — effectual fast-xml-parser wrapper
- **AdapterManager**: `services/AdapterManager.ts` — scoped lifecycle via `Scope.fork`/`Scope.close`
