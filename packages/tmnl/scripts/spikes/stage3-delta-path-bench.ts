#!/usr/bin/env bun
/**
 * Stage 3 Delta Path — Latent Variable Probe
 *
 * Measures the actual cost of each primitive on the delta hot path:
 *   1. Effect.gen overhead (empty generator)
 *   2. Ref.get + HashMap.get (session lookup)
 *   3. PubSub.publish (with an active consumer fiber)
 *   4. Full emitDelta simulation (current architecture)
 *   5. Direct callback baseline (proposed architecture)
 *   6. WS consumer overhead (Effect.withSpan + JSON.stringify)
 *
 * Each probe runs N iterations inside a single Effect program to avoid
 * per-call runtime entry/exit overhead. Reports:
 *   - ops/sec
 *   - µs/op (p50, p95, p99 via histogram)
 *   - GC pause count (via performance.measureUserAgentSpecificMemory or manual)
 *
 * Run: bun run scripts/spikes/stage3-delta-path-bench.ts
 */

import { Effect, Fiber, HashMap, Option, PubSub, Ref, Stream } from 'effect'

// ─── Config ────────────────────────────────────────────────────────────────
const WARMUP = 5_000
const ITERATIONS = 100_000

// ─── Histogram helper ──────────────────────────────────────────────────────
class Histogram {
  private samples: Float64Array
  private pos = 0

  constructor(capacity: number) {
    this.samples = new Float64Array(capacity)
  }

  record(value: number) {
    if (this.pos < this.samples.length) {
      this.samples[this.pos++] = value
    }
  }

  percentile(p: number): number {
    const sorted = this.samples.subarray(0, this.pos).sort()
    const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1)
    return sorted[idx]
  }

  get count() { return this.pos }

  get mean(): number {
    let sum = 0
    for (let i = 0; i < this.pos; i++) sum += this.samples[i]
    return sum / this.pos
  }

  report(label: string) {
    const p50 = this.percentile(0.5)
    const p95 = this.percentile(0.95)
    const p99 = this.percentile(0.99)
    const avg = this.mean
    const opsPerSec = Math.round(1_000_000 / avg)

    console.log(`  ${label}`)
    console.log(`    mean: ${avg.toFixed(3)}µs | p50: ${p50.toFixed(3)}µs | p95: ${p95.toFixed(3)}µs | p99: ${p99.toFixed(3)}µs`)
    console.log(`    throughput: ${opsPerSec.toLocaleString()} ops/sec (${this.count.toLocaleString()} samples)`)
  }
}

// ─── Simulated session record (matches real SessionRecord shape) ───────────
type FakeSession = {
  sessionId: string
  headSeq: number
  events: unknown[]
}

// ─── PROBE 1: Effect.gen overhead ──────────────────────────────────────────
const probe1_effectGen = Effect.gen(function* () {
  const hist = new Histogram(ITERATIONS)

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    yield* Effect.gen(function* () { yield* Effect.void })
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    yield* Effect.gen(function* () { yield* Effect.void })
    hist.record((performance.now() - t0) * 1000) // µs
  }

  hist.report('PROBE 1: Effect.gen(function*() { yield* Effect.void })')
})

// ─── PROBE 2: Ref.get + HashMap.get ────────────────────────────────────────
const probe2_refGet = Effect.gen(function* () {
  const session: FakeSession = { sessionId: 'sess-001', headSeq: 0, events: [] }
  const ref = yield* Ref.make(
    HashMap.make(['sess-001', session] as const)
  )
  const hist = new Histogram(ITERATIONS)

  for (let i = 0; i < WARMUP; i++) {
    const map = yield* Ref.get(ref)
    HashMap.get(map, 'sess-001')
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    const map = yield* Ref.get(ref)
    const result = HashMap.get(map, 'sess-001')
    if (Option.isNone(result)) throw new Error('miss')
    hist.record((performance.now() - t0) * 1000)
  }

  hist.report('PROBE 2: Ref.get(ref) + HashMap.get(map, key)')
})

// ─── PROBE 3: PubSub.publish (with active consumer) ───────────────────────
const probe3_pubsub = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<unknown>()
  const hist = new Histogram(ITERATIONS)

  // Fork a consumer that just drains
  const consumer = yield* Effect.fork(
    Stream.fromPubSub(pubsub).pipe(
      Stream.runForEach(() => Effect.void),
    ),
  )

  // Give consumer time to start
  yield* Effect.sleep('10 millis')

  for (let i = 0; i < WARMUP; i++) {
    yield* PubSub.publish(pubsub, { seq: i })
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    yield* PubSub.publish(pubsub, { _tag: 'chat:v2/assistant_delta', seq: i, delta: 'x' })
    hist.record((performance.now() - t0) * 1000)
  }

  yield* PubSub.shutdown(pubsub)
  yield* Fiber.await(consumer)

  hist.report('PROBE 3: PubSub.publish(pubsub, event) — with active consumer')
})

// ─── PROBE 4: Full emitDelta simulation (current architecture) ─────────────
const probe4_currentEmitDelta = Effect.gen(function* () {
  const session: FakeSession = { sessionId: 'sess-001', headSeq: 0, events: [] }
  const sessionsRef = yield* Ref.make(
    HashMap.make(['sess-001', session] as const)
  )
  const pubsub = yield* PubSub.unbounded<unknown>()
  const hist = new Histogram(ITERATIONS)

  const consumer = yield* Effect.fork(
    Stream.fromPubSub(pubsub).pipe(
      Stream.runForEach(() => Effect.void),
    ),
  )

  yield* Effect.sleep('10 millis')

  const emitDelta = (delta: string) =>
    Effect.gen(function* () {
      const current = yield* Ref.get(sessionsRef)
      const maybeSession = HashMap.get(current, 'sess-001')
      if (Option.isNone(maybeSession)) return

      const sess = maybeSession.value
      const nextSeq = ++sess.headSeq
      const event = {
        _tag: 'chat:v2/assistant_delta' as const,
        sessionId: sess.sessionId,
        seq: nextSeq,
        at: Date.now(),
        messageId: 'msg-001',
        delta,
      }

      yield* PubSub.publish(pubsub, event)
    })

  for (let i = 0; i < WARMUP; i++) {
    yield* emitDelta('x')
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    yield* emitDelta('x')
    hist.record((performance.now() - t0) * 1000)
  }

  yield* PubSub.shutdown(pubsub)
  yield* Fiber.await(consumer)

  hist.report('PROBE 4: Full emitDelta (Ref.get + HashMap.get + PubSub.publish)')
})

// ─── PROBE 5: Direct callback baseline (proposed architecture) ─────────────
const probe5_directCallback = Effect.gen(function* () {
  const session: FakeSession = { sessionId: 'sess-001', headSeq: 0, events: [] }
  const hist = new Histogram(ITERATIONS)

  // Simulate what the callback would do: count received events
  let received = 0
  const onDelta = (_event: unknown) => { received++ }

  for (let i = 0; i < WARMUP; i++) {
    const seq = ++session.headSeq
    onDelta({
      _tag: 'chat:v2/assistant_delta' as const,
      sessionId: session.sessionId,
      seq,
      at: Date.now(),
      messageId: 'msg-001',
      delta: 'x',
    })
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    const seq = ++session.headSeq
    onDelta({
      _tag: 'chat:v2/assistant_delta' as const,
      sessionId: session.sessionId,
      seq,
      at: Date.now(),
      messageId: 'msg-001',
      delta: 'x',
    })
    hist.record((performance.now() - t0) * 1000)
  }

  console.log(`  (callback received ${received.toLocaleString()} events from warmup)`)
  hist.report('PROBE 5: Direct callback (seq++ → object literal → fn call)')
})

// ─── PROBE 6: WS consumer overhead (Effect.withSpan + JSON.stringify) ──────
const probe6_wsConsumer = Effect.gen(function* () {
  const hist = new Histogram(ITERATIONS)

  // Simulate what the WS server does per-event:
  // 1. makeEventEnvelope (object wrapping)
  // 2. JSON.stringify
  // 3. Effect.withSpan (tracing)
  // We can't measure the actual ws.send, but we measure the preparation

  const makeEventEnvelope = (event: unknown) => ({
    _tag: 'remote:ws_event',
    event: {
      _tag: 'remote:chat_v2_event',
      event,
    },
  })

  const sampleEvent = {
    _tag: 'chat:v2/assistant_delta' as const,
    sessionId: 'sess-001',
    seq: 1,
    at: Date.now(),
    messageId: 'msg-001',
    delta: 'Hello world this is a sample delta token',
  }

  // Measure just the serialization + envelope wrapping
  for (let i = 0; i < WARMUP; i++) {
    const envelope = makeEventEnvelope(sampleEvent)
    JSON.stringify(envelope)
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    const envelope = makeEventEnvelope(sampleEvent)
    JSON.stringify(envelope)
    hist.record((performance.now() - t0) * 1000)
  }

  hist.report('PROBE 6: WS envelope (makeEventEnvelope + JSON.stringify)')

  // Now measure Effect.withSpan wrapping cost
  const histSpan = new Histogram(ITERATIONS)

  for (let i = 0; i < WARMUP; i++) {
    yield* Effect.withSpan(Effect.void, 'harness.ws.runtime-events-send')
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    yield* Effect.withSpan(Effect.void, 'harness.ws.runtime-events-send')
    histSpan.record((performance.now() - t0) * 1000)
  }

  histSpan.report('PROBE 6b: Effect.withSpan(Effect.void, name) — tracing overhead')
})

// ─── PROBE 7: GC pressure comparison ──────────────────────────────────────
const probe7_gcPressure = Effect.gen(function* () {
  const session: FakeSession = { sessionId: 'sess-001', headSeq: 0, events: [] }
  const sessionsRef = yield* Ref.make(
    HashMap.make(['sess-001', session] as const)
  )
  const pubsub = yield* PubSub.unbounded<unknown>()

  const consumer = yield* Effect.fork(
    Stream.fromPubSub(pubsub).pipe(
      Stream.runForEach(() => Effect.void),
    ),
  )

  yield* Effect.sleep('10 millis')

  // Measure memory before
  const BURST = 50_000
  const heapBefore = process.memoryUsage().heapUsed

  // Burst: current architecture
  for (let i = 0; i < BURST; i++) {
    yield* Effect.gen(function* () {
      const current = yield* Ref.get(sessionsRef)
      const maybeSession = HashMap.get(current, 'sess-001')
      if (Option.isNone(maybeSession)) return
      const sess = maybeSession.value
      ++sess.headSeq
      yield* PubSub.publish(pubsub, {
        _tag: 'chat:v2/assistant_delta',
        sessionId: sess.sessionId,
        seq: sess.headSeq,
        at: Date.now(),
        delta: 'x',
      })
    })
  }

  const heapAfterCurrent = process.memoryUsage().heapUsed

  yield* PubSub.shutdown(pubsub)
  yield* Fiber.await(consumer)

  // Now burst: callback architecture
  let callbackReceived = 0
  const onDelta = (_e: unknown) => { callbackReceived++ }
  const session2: FakeSession = { sessionId: 'sess-002', headSeq: 0, events: [] }

  // Force GC if available
  if (global.gc) global.gc()
  const heapBeforeCallback = process.memoryUsage().heapUsed

  for (let i = 0; i < BURST; i++) {
    ++session2.headSeq
    onDelta({
      _tag: 'chat:v2/assistant_delta',
      sessionId: session2.sessionId,
      seq: session2.headSeq,
      at: Date.now(),
      delta: 'x',
    })
  }

  const heapAfterCallback = process.memoryUsage().heapUsed

  const currentDelta = ((heapAfterCurrent - heapBefore) / 1024 / 1024).toFixed(2)
  const callbackDelta = ((heapAfterCallback - heapBeforeCallback) / 1024 / 1024).toFixed(2)

  console.log(`  PROBE 7: GC pressure (${BURST.toLocaleString()} events)`)
  console.log(`    Current arch (Ref+PubSub): heap grew ${currentDelta} MB`)
  console.log(`    Callback arch (direct):    heap grew ${callbackDelta} MB`)
  console.log(`    (callback received ${callbackReceived.toLocaleString()} events)`)
})

// ─── PROBE 8: Session reference stability test ─────────────────────────────
const probe8_sessionStability = Effect.gen(function* () {
  // Hypothesis: the session record reference is stable during streaming.
  // Test: fork a "streaming" fiber that reads session.headSeq,
  //       and a "mutator" fiber that simulates abort/context update.
  //       Check if the reference ever changes out from under us.

  const session: FakeSession = { sessionId: 'sess-001', headSeq: 0, events: [] }
  const sessionsRef = yield* Ref.make(
    HashMap.make(['sess-001', session] as const)
  )

  let referenceChanged = false
  const capturedRef = session // Direct reference captured at "stream start"

  // Simulate streaming: 10,000 seq bumps with periodic yields
  const streamer = yield* Effect.fork(
    Effect.gen(function* () {
      for (let i = 0; i < 10_000; i++) {
        // Check if our captured reference is still the one in the HashMap
        const current = yield* Ref.get(sessionsRef)
        const live = HashMap.get(current, 'sess-001')
        if (Option.isSome(live) && live.value !== capturedRef) {
          referenceChanged = true
        }
        capturedRef.headSeq++

        // Yield occasionally to let mutator run
        if (i % 100 === 0) yield* Effect.yieldNow()
      }
    }),
  )

  // Simulate abort: replace the session record in the HashMap
  const mutator = yield* Effect.fork(
    Effect.gen(function* () {
      yield* Effect.sleep('1 millis')
      // This is what abort/context update might do:
      yield* Ref.update(sessionsRef, (map) =>
        HashMap.set(map, 'sess-001', {
          ...session, // Note: spreads the CURRENT values, but creates a NEW object
          sessionId: 'sess-001',
          headSeq: session.headSeq,
          events: session.events,
        }),
      )
    }),
  )

  yield* Fiber.await(streamer)
  yield* Fiber.await(mutator)

  console.log(`  PROBE 8: Session reference stability during concurrent streaming`)
  console.log(`    Reference changed during stream: ${referenceChanged ? 'YES ⚠️' : 'NO ✓'}`)
  console.log(`    Final headSeq: ${capturedRef.headSeq}`)
  console.log(`    Implication: ${referenceChanged
    ? 'Hoisting session ref is UNSAFE — HashMap.set replaces the object'
    : 'Hoisting session ref is safe — same object persists through streaming'}`)
})


// ─── Main ──────────────────────────────────────────────────────────────────
const main = Effect.gen(function* () {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Stage 3 Delta Path — Latent Variable Probe')
  console.log(`  ${ITERATIONS.toLocaleString()} iterations per probe, ${WARMUP.toLocaleString()} warmup`)
  console.log(`  Runtime: Bun ${Bun.version}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log('── Primitives ──────────────────────────────────────────────\n')
  yield* probe1_effectGen
  console.log()
  yield* probe2_refGet
  console.log()
  yield* probe3_pubsub
  console.log()

  console.log('── Composite: Current vs Proposed ──────────────────────────\n')
  yield* probe4_currentEmitDelta
  console.log()
  yield* probe5_directCallback
  console.log()

  console.log('── Consumer Overhead ───────────────────────────────────────\n')
  yield* probe6_wsConsumer
  console.log()

  console.log('── Allocation Pressure ────────────────────────────────────\n')
  yield* probe7_gcPressure
  console.log()

  console.log('── Safety: Reference Stability ─────────────────────────────\n')
  yield* probe8_sessionStability
  console.log()

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Probe complete. Compare PROBE 4 vs PROBE 5 for the headline.')
  console.log('  Compare PROBE 4 vs PROBE 6 to see if Stage 3 or WS is dominant.')
  console.log('  PROBE 8 determines if hoisting the session ref is safe.')
  console.log('═══════════════════════════════════════════════════════════════')
})

Effect.runPromise(main).catch(console.error)
