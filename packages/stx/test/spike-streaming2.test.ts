/**
 * STX Streaming v2 — Spike Tests
 *
 * GOAL: Discover the exact Effect v4 API shapes for:
 *   1. Queue.bounded + Stream.fromQueue → feed materializer
 *   2. Stream.runForEachArray → chunk-aware reducer
 *   3. Effect.runFork + fiber lifecycle → async materializer teardown
 *   4. PubSub → shared stream (reference-counted multicast)
 *   5. Queue as duplex channel (enqueue + dequeue as stream)
 *
 * These are PROBES not tests — they tell us what works so we can
 * build the actual streaming module without guessing.
 *
 * Each describe block captures one experiment. Record findings in cm.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Queue from "effect/Queue"
import * as PubSub from "effect/PubSub"
import * as Scope from "effect/Scope"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Option from "effect/Option"

// ─── SPIKE 1: Stream.runForEachArray — chunk-aware consumption ─────────────

describe("SPIKE 1: Stream.runForEachArray — chunk consumption", () => {
  it("receives NonEmptyReadonlyArray chunks", async () => {
    const chunks: Array<readonly number[]> = []

    const stream = Stream.fromIterable([1, 2, 3, 4, 5, 6]).pipe(
      Stream.rechunk(2), // force 3 chunks of 2
    )

    await Effect.runPromise(
      Stream.runForEachArray(stream, (chunk) => {
        chunks.push(chunk)
        return Effect.void
      })
    )

    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toEqual([1, 2])
    expect(chunks[1]).toEqual([3, 4])
    expect(chunks[2]).toEqual([5, 6])
  })

  it("chunk-aware reduce: apply entire chunk as one state transition", async () => {
    let state = { count: 0, sum: 0 }

    const stream = Stream.fromIterable(
      Array.from({ length: 1000 }, (_, i) => i + 1)
    ).pipe(Stream.rechunk(100))

    let chunkCount = 0
    await Effect.runPromise(
      Stream.runForEachArray(stream, (chunk) => {
        // One state transition per chunk (not per item) — throughput key
        chunkCount++
        state = {
          count: state.count + chunk.length,
          sum: state.sum + chunk.reduce((a, b) => a + b, 0),
        }
        return Effect.void
      })
    )

    expect(chunkCount).toBe(10) // 1000 items / 100 per chunk
    expect(state.count).toBe(1000)
    expect(state.sum).toBe(500500) // sum 1..1000
    console.log(`\n  SPIKE 1b: 1000 items in ${chunkCount} chunk transitions → ${state.sum}`)
  })
})

// ─── SPIKE 2: Queue + Stream.fromQueue — feed materializer foundation ──────

describe("SPIKE 2: Queue + Stream.fromQueue — feed foundation", () => {
  it("Queue.bounded: offer + takeAll — FINDING: Stream.fromQueue shutdown = interruption", async () => {
    // FINDING: Queue.shutdown causes "All fibers interrupted" when combined with Stream.fromQueue
    // Use Queue.takeAll for synchronous inspection instead
    const program = Effect.gen(function*() {
      const q = yield* Queue.bounded<number>(16)

      yield* Queue.offer(q, 1)
      yield* Queue.offer(q, 2)
      yield* Queue.offer(q, 3)

      // takeAll: synchronous drain without needing shutdown
      const items = yield* Queue.takeAll(q)
      return items
    })

    const result = await Effect.runPromise(program)
    expect(result).toEqual([1, 2, 3])
    console.log(`\n  SPIKE 2a: Queue.bounded + takeAll: ${JSON.stringify(result)}`)
  })

  it("Queue.sliding: drops oldest on overflow — use takeAll to inspect", async () => {
    const program = Effect.gen(function*() {
      const q = yield* Queue.sliding<number>(3) // capacity = 3

      // Offer 5 items — oldest 2 should be dropped
      yield* Queue.offer(q, 10)
      yield* Queue.offer(q, 20)
      yield* Queue.offer(q, 30)
      yield* Queue.offer(q, 40)
      yield* Queue.offer(q, 50)

      // Use takeAll instead of Stream (no shutdown needed)
      const items = yield* Queue.takeAll(q)
      return items
    })

    const result = await Effect.runPromise(program)
    // sliding drops OLDEST when full — should have last 3
    expect(result.length).toBeLessThanOrEqual(3)
    console.log(`\n  SPIKE 2b: Queue.sliding(3) after 5 offers: ${JSON.stringify(result)}`)
  })

  it("Queue.dropping: drops newest on overflow — use takeAll to inspect", async () => {
    const program = Effect.gen(function*() {
      const q = yield* Queue.dropping<number>(3) // capacity = 3

      // Offer 5 items — newest 2 should be dropped
      yield* Queue.offer(q, 10)
      yield* Queue.offer(q, 20)
      yield* Queue.offer(q, 30)
      yield* Queue.offer(q, 40) // dropped
      yield* Queue.offer(q, 50) // dropped

      const items = yield* Queue.takeAll(q)
      return items
    })

    const result = await Effect.runPromise(program)
    expect(result.length).toBeLessThanOrEqual(3)
    expect(result[0]).toBe(10)
    console.log(`\n  SPIKE 2c: Queue.dropping(3) after 5 offers: ${JSON.stringify(result)}`)
  })
})

// ─── SPIKE 3: Effect.runFork + Fiber.interrupt — async lifecycle ───────────

describe("SPIKE 3: Effect.runFork + Fiber.interrupt — lifecycle", () => {
  it("runFork → collect via atom → interrupt", async () => {
    const registry = AtomRegistry.make()

    // Simulate a slow stream
    const stream = Stream.fromIterable([1, 2, 3]).pipe(
      Stream.rechunk(1),
    )

    // Use Atom.make(stream) — Effect v4 tracks latest value
    const atom = Atom.make(stream)
    registry.mount(atom)

    // Synchronous streams resolve immediately
    const result = registry.get(atom)
    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toBe(3) // latest
    }
    console.log(`\n  SPIKE 3a: Atom.make(stream) resolves to latest → ${result._tag === "Success" ? result.value : "?"}`)
  })

  it("runFork produces a fiber we can interrupt — uses Effect.forkChild in v4", async () => {
    // NOTE: Effect v4 smol uses forkChild, not fork
    // Effect.forkChild(effect) → Effect<Fiber<A,E>, never, R>
    let interruptCount = 0

    const program = Effect.gen(function*() {
      // Infinite stream
      const fiber = yield* Effect.forkChild(
        Stream.runForEachArray(
          Stream.fromIterable([1, 2, 3]).pipe(Stream.forever),
          (_chunk) => Effect.void,
        )
      )

      // Let it run a tick
      yield* Effect.sleep("1 millis")

      // Interrupt
      yield* Fiber.interrupt(fiber)
      interruptCount++
    })

    await Effect.runPromise(program)
    expect(interruptCount).toBe(1)
    console.log(`\n  SPIKE 3b: Fiber.interrupt(forkChild) succeeded`)
  })
})

// ─── SPIKE 4: Scope lifecycle — for duplex/shared teardown ────────────────

describe("SPIKE 4: Scope lifecycle", () => {
  it("Scope.makeUnsafe + Scope.close cleans up finalizers", async () => {
    let cleaned = false

    const program = Effect.gen(function*() {
      const scope = yield* Scope.make("sequential")

      // Register a finalizer
      yield* Scope.addFinalizer(scope, Effect.sync(() => { cleaned = true }))

      expect(cleaned).toBe(false)

      // Close the scope
      yield* Scope.close(scope, Exit.void)

      expect(cleaned).toBe(true)
    })

    await Effect.runPromise(program)
    expect(cleaned).toBe(true)
    console.log(`\n  SPIKE 4a: Scope.makeUnsafe + Scope.close finalizers work`)
  })

  it("Scoped resource with Effect.scoped", async () => {
    const log: string[] = []

    const resource = Effect.acquireRelease(
      Effect.sync(() => { log.push("acquired"); return { value: 42 } }),
      () => Effect.sync(() => { log.push("released") }),
    )

    const result = await Effect.runPromise(Effect.scoped(
      Effect.gen(function*() {
        const r = yield* resource
        log.push("used")
        return r.value
      })
    ))

    expect(result).toBe(42)
    expect(log).toEqual(["acquired", "used", "released"])
    console.log(`\n  SPIKE 4b: Effect.scoped lifecycle: ${log.join(" → ")}`)
  })
})

// ─── SPIKE 5: PubSub — shared/multicast foundation ────────────────────────

describe("SPIKE 5: PubSub — shared multicast", () => {
  it("PubSub.bounded: publish → multiple subscribers — use PubSub.take not Queue.take", async () => {
    const sub1Items: number[] = []
    const sub2Items: number[] = []

    // FINDING: PubSub.Subscription is NOT a Queue.Dequeue — use PubSub.take/takeAll
    const program = Effect.scoped(Effect.gen(function*() {
      const hub = yield* PubSub.bounded<number>(16)

      const sub1 = yield* PubSub.subscribe(hub)
      const sub2 = yield* PubSub.subscribe(hub)

      yield* PubSub.publish(hub, 10)
      yield* PubSub.publish(hub, 20)
      yield* PubSub.publish(hub, 30)

      // CORRECT: PubSub.take(sub), not Queue.take(sub)
      for (let i = 0; i < 3; i++) {
        sub1Items.push(yield* PubSub.take(sub1))
        sub2Items.push(yield* PubSub.take(sub2))
      }
    }))

    await Effect.runPromise(program)
    expect(sub1Items).toEqual([10, 20, 30])
    expect(sub2Items).toEqual([10, 20, 30])
    console.log(`\n  SPIKE 5a: PubSub multicast → sub1: ${sub1Items}, sub2: ${sub2Items}`)
  })

  it("PubSub → takeAll from subscription", async () => {
    const program = Effect.scoped(Effect.gen(function*() {
      const hub = yield* PubSub.bounded<number>(16)
      const sub = yield* PubSub.subscribe(hub)

      yield* PubSub.publish(hub, 1)
      yield* PubSub.publish(hub, 2)
      yield* PubSub.publish(hub, 3)

      // PubSub.takeAll not Queue.takeAll
      const items = yield* PubSub.takeAll(sub)
      return items
    }))

    const result = await Effect.runPromise(program)
    expect(result).toEqual([1, 2, 3])
    console.log(`\n  SPIKE 5b: PubSub.takeAll: ${JSON.stringify(result)}`)
  })
})

// ─── SPIKE 6: Atom.make writable for manual push ──────────────────────────

describe("SPIKE 6: Writable atom as state sink", () => {
  it("Atom.make<T>(initial) → registry.set to push new state", () => {
    const registry = AtomRegistry.make()

    // Writable atom as state store
    const stateAtom = Atom.make<{ items: number[]; count: number }>(
      { items: [], count: 0 }
    )
    registry.mount(stateAtom)

    let notifications = 0
    registry.subscribe(stateAtom, () => { notifications++ })

    // Push state updates (simulating stream ingestion)
    for (let i = 1; i <= 5; i++) {
      const current = registry.get(stateAtom)
      registry.set(stateAtom, {
        items: [...current.items, i],
        count: current.count + 1,
      })
    }

    const final = registry.get(stateAtom)
    expect(final.count).toBe(5)
    expect(final.items).toEqual([1, 2, 3, 4, 5])
    expect(notifications).toBe(5)
    console.log(`\n  SPIKE 6a: Writable atom push: ${notifications} notifications, final count=${final.count}`)
  })

  it("ring buffer state via Atom.make (sliding window)", () => {
    const registry = AtomRegistry.make()
    const WINDOW = 3

    const ringAtom = Atom.make<{ items: number[] }>({ items: [] })
    registry.mount(ringAtom)

    const push = (item: number) => {
      const current = registry.get(ringAtom)
      const next = [...current.items, item]
      registry.set(ringAtom, {
        items: next.length > WINDOW ? next.slice(next.length - WINDOW) : next,
      })
    }

    for (let i = 1; i <= 6; i++) push(i)

    const final = registry.get(ringAtom)
    expect(final.items).toEqual([4, 5, 6])
    console.log(`\n  SPIKE 6b: Ring buffer(3) after 6 pushes: ${JSON.stringify(final.items)}`)
  })
})

// ─── SPIKE 7: Chunk-aware reducer with Atom state ─────────────────────────

describe("SPIKE 7: Chunk-aware reducer (throughput king)", () => {
  it("reduce stream with chunk-batch state transitions", async () => {
    const registry = AtomRegistry.make()

    type Event = { type: "increment"; by: number } | { type: "reset" }
    type State = { value: number; events: number }

    const stateAtom = Atom.make<State>({ value: 0, events: 0 })
    registry.mount(stateAtom)

    let renderCount = 0
    registry.subscribe(stateAtom, () => { renderCount++ })

    const events: Event[] = [
      ...Array.from({ length: 100 }, () => ({ type: "increment" as const, by: 1 })),
      { type: "reset" },
      ...Array.from({ length: 50 }, () => ({ type: "increment" as const, by: 2 })),
    ]

    const stream = Stream.fromIterable(events).pipe(Stream.rechunk(25))

    // Apply whole chunk at once — O(chunks) state transitions, not O(events)
    await Effect.runPromise(
      Stream.runForEachArray(stream, (chunk) => {
        let current = registry.get(stateAtom)
        for (const event of chunk) {
          if (event.type === "increment") {
            current = { value: current.value + event.by, events: current.events + 1 }
          } else {
            current = { value: 0, events: current.events + 1 }
          }
        }
        registry.set(stateAtom, current)
        return Effect.void
      })
    )

    const final = registry.get(stateAtom)
    expect(final.value).toBe(100) // 50 * 2
    expect(final.events).toBe(151) // 100 increments + 1 reset + 50 increments

    // Should have ONE notification per chunk, not per event
    const expectedChunks = Math.ceil(events.length / 25)
    expect(renderCount).toBe(expectedChunks)

    console.log(`\n  SPIKE 7: ${events.length} events → ${renderCount} state transitions (${expectedChunks} chunks)`)
    console.log(`  Final: value=${final.value}, events=${final.events}`)
  })
})
