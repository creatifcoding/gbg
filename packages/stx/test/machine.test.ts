/**
 * @tmnl/stx — stxMachine() tests
 *
 * Validates XState actor lifecycle, bidirectional sync,
 * loop prevention, reset, and dispose.
 */

import { describe, it, expect, afterEach } from "vitest"
import { setup, assign } from "xstate"
import { AtomRegistry } from "effect/unstable/reactivity"
import { stxMachine } from "../src/machine.js"

// ─── Test Machine ────────────────────────────────────

const counterMachine = setup({
  types: {
    context: {} as { count: number; label: string },
    events: {} as
      | { type: "INCREMENT" }
      | { type: "DECREMENT" }
      | { type: "SET_LABEL"; label: string }
      | { type: "DATA_SYNC"; count: number },
  },
}).createMachine({
  id: "counter",
  initial: "idle",
  context: { count: 0, label: "default" },
  states: {
    idle: {
      on: {
        INCREMENT: {
          actions: assign({ count: ({ context }) => context.count + 1 }),
        },
        DECREMENT: {
          actions: assign({ count: ({ context }) => context.count - 1 }),
        },
        SET_LABEL: {
          actions: assign({ label: ({ event }) => (event as any).label }),
          target: "active",
        },
        DATA_SYNC: {
          actions: assign({ count: ({ event }) => (event as any).count }),
        },
      },
    },
    active: {
      on: {
        INCREMENT: {
          actions: assign({ count: ({ context }) => context.count + 1 }),
        },
        DECREMENT: {
          actions: assign({ count: ({ context }) => context.count - 1 }),
        },
      },
    },
  },
})

// ─── Test State ──────────────────────────────────────

interface TestState {
  count: number
  label: string
  extra: string
}

const initialState: TestState = {
  count: 0,
  label: "default",
  extra: "untouched",
}

// ─── Cleanup ─────────────────────────────────────────

let instances: Array<{ dispose: () => void }> = []
afterEach(() => {
  instances.forEach((i) => i.dispose())
  instances = []
})

// ─── Tests ───────────────────────────────────────────

describe("stxMachine", () => {
  describe("basic lifecycle", () => {
    it("creates instance with stx + machine APIs", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      // stx APIs
      expect(store.atom).toBeDefined()
      expect(store.lens).toBeDefined()
      expect(store.get).toBeTypeOf("function")
      expect(store.set).toBeTypeOf("function")
      expect(store.setAt).toBeTypeOf("function")
      expect(store.focus).toBeTypeOf("function")

      // Machine APIs
      expect(store.actor).toBeDefined()
      expect(store.send).toBeTypeOf("function")
      expect(store.machineSnapshot).toBeTypeOf("function")
      expect(store.snapshotAtom).toBeDefined()
      expect(store.matches).toBeTypeOf("function")
      expect(store.dispose).toBeTypeOf("function")
      expect(store.reset).toBeTypeOf("function")
    })

    it("reads initial state via stx", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      expect(store.get()).toEqual(initialState)
      expect(store.getAt(store.lens.count)).toBe(0)
      expect(store.getAt(store.lens.label)).toBe("default")
      expect(store.getAt(store.lens.extra)).toBe("untouched")
    })

    it("machine starts in initial state", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      expect(store.matches("idle")).toBe(true)
      expect(store.matches("active")).toBe(false)
      const snap = store.machineSnapshot()
      expect(snap.context.count).toBe(0)
    })
  })

  describe("machine events", () => {
    it("send() dispatches events to machine", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      store.send({ type: "INCREMENT" })
      expect(store.machineSnapshot().context.count).toBe(1)

      store.send({ type: "INCREMENT" })
      store.send({ type: "INCREMENT" })
      expect(store.machineSnapshot().context.count).toBe(3)
    })

    it("send() transitions machine state", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      expect(store.matches("idle")).toBe(true)
      store.send({ type: "SET_LABEL", label: "updated" } as any)
      expect(store.matches("active")).toBe(true)
    })
  })

  describe("stx mutations (independent of machine)", () => {
    it("setAt updates atom state without affecting machine", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      store.setAt(store.lens.extra, "modified")
      expect(store.getAt(store.lens.extra)).toBe("modified")

      // Machine context unaffected
      expect(store.machineSnapshot().context.count).toBe(0)
    })

    it("modify updates atom state", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      store.modify(store.lens.count, (n) => n + 10)
      expect(store.getAt(store.lens.count)).toBe(10)
    })
  })

  describe("contextToState sync (machine → atom)", () => {
    it("syncs machine context changes to atom state", () => {
      const store = stxMachine(counterMachine, { ...initialState }, {
        contextToState: (ctx) => ({
          count: ctx.count,
          label: ctx.label,
        }),
      })
      instances.push(store)

      // Machine event updates context
      store.send({ type: "INCREMENT" })

      // Atom state should be updated
      expect(store.getAt(store.lens.count)).toBe(1)

      store.send({ type: "INCREMENT" })
      store.send({ type: "INCREMENT" })
      expect(store.getAt(store.lens.count)).toBe(3)

      // Extra field untouched
      expect(store.getAt(store.lens.extra)).toBe("untouched")
    })
  })

  describe("stateToEvent sync (atom → machine)", () => {
    it("sends machine events when atom state changes", () => {
      const store = stxMachine(counterMachine, { ...initialState }, {
        stateToEvent: (state, prev) =>
          state.count !== prev.count
            ? { type: "DATA_SYNC", count: state.count }
            : undefined,
      })
      instances.push(store)

      // Update atom state directly
      store.setAt(store.lens.count, 42)

      // Machine context should reflect the sync
      expect(store.machineSnapshot().context.count).toBe(42)
    })
  })

  describe("bidirectional sync (no infinite loops)", () => {
    it("does not loop when both syncs active", () => {
      let contextToStateCalls = 0
      let stateToEventCalls = 0

      const store = stxMachine(counterMachine, { ...initialState }, {
        contextToState: (ctx) => {
          contextToStateCalls++
          return { count: ctx.count }
        },
        stateToEvent: (state, prev) => {
          stateToEventCalls++
          return state.count !== prev.count
            ? { type: "DATA_SYNC", count: state.count }
            : undefined
        },
      })
      instances.push(store)

      // Trigger from machine side
      store.send({ type: "INCREMENT" })

      // contextToState should fire (machine → atom)
      // stateToEvent should NOT cascade back infinitely
      expect(contextToStateCalls).toBeGreaterThan(0)
      expect(stateToEventCalls).toBeLessThan(10) // Bounded, not infinite
      expect(store.getAt(store.lens.count)).toBe(1)
    })
  })

  describe("snapshot atom (reactive)", () => {
    it("snapshotAtom updates when machine transitions", () => {
      const reg = AtomRegistry.make()
      const store = stxMachine(counterMachine, { ...initialState }, { registry: reg })
      instances.push(store)

      const initial = reg.get(store.snapshotAtom)
      expect((initial as any).value).toBe("idle")

      store.send({ type: "SET_LABEL", label: "test" } as any)

      const updated = reg.get(store.snapshotAtom)
      expect((updated as any).value).toBe("active")
    })
  })

  describe("reset", () => {
    it("restores state and restarts machine", () => {
      const store = stxMachine(counterMachine, { ...initialState }, {
        contextToState: (ctx) => ({ count: ctx.count }),
      })
      instances.push(store)

      // Mutate
      store.send({ type: "INCREMENT" })
      store.send({ type: "INCREMENT" })
      store.setAt(store.lens.extra, "changed")
      expect(store.getAt(store.lens.count)).toBe(2)
      expect(store.getAt(store.lens.extra)).toBe("changed")

      // Reset
      store.reset()

      expect(store.getAt(store.lens.count)).toBe(0)
      expect(store.getAt(store.lens.extra)).toBe("untouched")
      expect(store.matches("idle")).toBe(true)
    })
  })

  describe("dispose", () => {
    it("stops actor and cleans up", () => {
      const store = stxMachine(counterMachine, { ...initialState })
      instances.push(store)

      store.dispose()

      // Should not throw, just no-op after dispose
      // (XState actors are stopped)
    })
  })

  describe("actor ref liveness after reset", () => {
    it("instance.actor returns fresh actor after reset (not stale)", () => {
      const store = stxMachine(counterMachine, { ...initialState }, {
        contextToState: (ctx) => ({ count: ctx.count }),
      })
      instances.push(store)

      const actorBefore = store.actor

      store.send({ type: "INCREMENT" })
      expect(store.machineSnapshot().context.count).toBe(1)

      // Reset — internal actor is recreated
      store.reset()

      const actorAfter = store.actor

      // Actor ref should be DIFFERENT (new actor)
      expect(actorAfter).not.toBe(actorBefore)

      // New actor should be functional
      expect(store.matches("idle")).toBe(true)
      expect(store.actor.getSnapshot().context.count).toBe(0)

      // Can still send to the new actor via instance.actor
      store.send({ type: "INCREMENT" })
      expect(store.actor.getSnapshot().context.count).toBe(1)
    })
  })

  describe("shared registry", () => {
    it("uses provided registry", () => {
      const reg = AtomRegistry.make()
      const store = stxMachine(counterMachine, { ...initialState }, { registry: reg })
      instances.push(store)

      expect(store.registry).toBe(reg)

      // Can read via registry
      const value = reg.get(store.atom)
      expect(value).toEqual(initialState)
    })
  })

  describe("focus atoms", () => {
    it("creates memoized focus atoms that react to changes", () => {
      const reg = AtomRegistry.make()
      const store = stxMachine(counterMachine, { ...initialState }, {
        registry: reg,
        contextToState: (ctx) => ({ count: ctx.count }),
      })
      instances.push(store)

      const countAtom = store.focus(store.lens.count)

      expect(reg.get(countAtom)).toBe(0)

      store.send({ type: "INCREMENT" })
      expect(reg.get(countAtom)).toBe(1)
    })
  })
})
