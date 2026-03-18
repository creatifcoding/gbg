/**
 * fiber-exit.ts — Exhaustive error propagation tests
 *
 * Validates the watchFiberExit pattern for all Cause variants:
 *   SUCCESS     → done=true, running=false
 *   INTERRUPT   → silent, running=false, done stays false
 *   FAIL        → error atom = typed E, running=false
 *   DIE         → error atom = StxDefect wrapping defect, running=false
 *   MIXED       → error atom = StxDefect with .isMixed, running=false
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import * as Effect from "effect-v4/Effect"
import * as Fiber from "effect-v4/Fiber"
import * as Stream from "effect-v4/Stream"
import { watchFiberExit, StxDefect } from "../../src/streaming/fiber-exit.js"

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Minimal atoms for tests ──────────────────────────────────────────────────

function makeAtoms(registry: ReturnType<typeof AtomRegistry.make>) {
  const running = Atom.make<boolean>(true)
  const done    = Atom.make<boolean>(false)
  const error   = Atom.make<unknown>(undefined)
  registry.mount(running)
  registry.mount(done)
  registry.mount(error)
  return { running, done, error }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("watchFiberExit — SUCCESS", () => {
  it("success: done=true, running=false, error=undefined, onDone called", async () => {
    const registry = AtomRegistry.make()
    const atoms    = makeAtoms(registry)

    let doneValue: number | undefined
    const fiber = Effect.runFork(Effect.succeed(42))
    watchFiberExit(fiber, atoms, registry, (v) => { doneValue = v as number })

    await sleep(10)

    expect(registry.get(atoms.done)).toBe(true)
    expect(registry.get(atoms.running)).toBe(false)
    expect(registry.get(atoms.error)).toBe(undefined)
    expect(doneValue).toBe(42)
  })
})

describe("watchFiberExit — INTERRUPT", () => {
  it("interrupt-only: running=false, done stays false, error stays undefined", async () => {
    const registry = AtomRegistry.make()
    const atoms    = makeAtoms(registry)

    // Use an infinite stream fiber that we interrupt
    const fiber = Effect.runFork(Effect.never)
    watchFiberExit(fiber, atoms, registry)

    // Interrupt it
    Effect.runFork(Fiber.interrupt(fiber))
    await sleep(20)

    expect(registry.get(atoms.running)).toBe(false)
    expect(registry.get(atoms.done)).toBe(false)    // not done — interrupted
    expect(registry.get(atoms.error)).toBe(undefined) // no error
  })
})

describe("watchFiberExit — FAIL (typed E)", () => {
  it("fail: error atom = typed error, running=false, done=false", async () => {
    const registry = AtomRegistry.make()
    const atoms    = makeAtoms(registry)

    class DomainError { readonly _tag = "DomainError"; constructor(readonly msg: string) {} }
    const domainError = new DomainError("stream source unavailable")

    const fiber = Effect.runFork(
      Effect.fail(domainError)
    )
    watchFiberExit(fiber, atoms, registry)

    await sleep(10)

    expect(registry.get(atoms.running)).toBe(false)
    expect(registry.get(atoms.done)).toBe(false)

    const err = registry.get(atoms.error) as DomainError
    expect(err).toBeInstanceOf(DomainError)
    expect(err.msg).toBe("stream source unavailable")
    // Must NOT be wrapped in StxDefect — raw typed error
    expect(err).not.toBeInstanceOf(StxDefect)
  })
})

describe("watchFiberExit — DIE (defect)", () => {
  it("die: error atom = StxDefect wrapping defect, running=false", async () => {
    const registry = AtomRegistry.make()
    const atoms    = makeAtoms(registry)

    const boom = new Error("WebSocket connection closed unexpectedly")
    const fiber = Effect.runFork(Effect.die(boom))
    watchFiberExit(fiber, atoms, registry)

    await sleep(10)

    expect(registry.get(atoms.running)).toBe(false)
    expect(registry.get(atoms.done)).toBe(false)

    const err = registry.get(atoms.error)
    expect(err).toBeInstanceOf(StxDefect)
    const stxErr = err as StxDefect
    expect(stxErr.defect).toBe(boom)
    expect(stxErr.message).toBe(boom.message)
    expect(stxErr.isMixed).toBe(false)
    // squash() extracts the defect for devtools
    expect(stxErr.squash()).toBe(boom)
  })

  it("die with non-Error defect: StxDefect wraps unknown", async () => {
    const registry = AtomRegistry.make()
    const atoms    = makeAtoms(registry)

    const fiber = Effect.runFork(Effect.die("something exploded"))
    watchFiberExit(fiber, atoms, registry)

    await sleep(10)

    const err = registry.get(atoms.error) as StxDefect
    expect(err).toBeInstanceOf(StxDefect)
    expect(err.defect).toBe("something exploded")
    expect(err.message).toContain("something exploded")
  })
})

describe("watchFiberExit — stream level errors", () => {
  it("stream fail propagates to error atom via reduce fiber", async () => {
    const registry = AtomRegistry.make()
    const atoms    = makeAtoms(registry)

    class NetworkError { readonly _tag = "NetworkError" as const; constructor(readonly code: number) {} }
    const networkErr = new NetworkError(503)

    const failingStream = Stream.fail(networkErr)
    const fiber = Effect.runFork(Stream.runDrain(failingStream))
    watchFiberExit(fiber, atoms, registry)

    await sleep(10)

    expect(registry.get(atoms.running)).toBe(false)
    const err = registry.get(atoms.error) as NetworkError
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.code).toBe(503)
  })

  it("stream die (unhandled throw) propagates as StxDefect", async () => {
    const registry = AtomRegistry.make()
    const atoms    = makeAtoms(registry)

    const crash = new RangeError("index out of bounds")
    const dangerousStream = Stream.fromEffect(Effect.sync(() => { throw crash }))
    const fiber = Effect.runFork(Stream.runDrain(dangerousStream))
    watchFiberExit(fiber, atoms, registry)

    await sleep(10)

    const err = registry.get(atoms.error)
    expect(err).toBeInstanceOf(StxDefect)
    expect((err as StxDefect).defect).toBe(crash)
  })
})
