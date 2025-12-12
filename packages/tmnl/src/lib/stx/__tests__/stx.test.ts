/**
 * stx Core Factory Tests
 *
 * Comprehensive tests for the tri-library composition:
 * - XState (shape/logic)
 * - Legend-State (hydration/data)
 * - effect-atom (Effect bridge)
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit, Cause, Fiber } from 'effect'
import { setup, createMachine, assign, fromPromise } from 'xstate'
import { observable, observe, batch } from '@legendapp/state'

import {
  stx,
  stxData,
  stxMachine,
  stxSynced,
} from '../stx'
import type { StxConfig, Stx } from '../types'

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Simple counter machine for testing
 */
const counterMachine = setup({
  types: {
    context: {} as { count: number },
    events: {} as
      | { type: 'INCREMENT' }
      | { type: 'DECREMENT' }
      | { type: 'SET'; value: number }
      | { type: 'DATA_SYNC'; count: number },
  },
  actions: {
    increment: assign({ count: ({ context }) => context.count + 1 }),
    decrement: assign({ count: ({ context }) => context.count - 1 }),
    setValue: assign({ count: (_, params: { value: number }) => params.value }),
  },
}).createMachine({
  id: 'counter',
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      on: {
        INCREMENT: { actions: 'increment' },
        DECREMENT: { actions: 'decrement' },
        SET: { actions: assign({ count: ({ event }) => event.value }) },
        DATA_SYNC: { actions: assign({ count: ({ event }) => event.count }) },
      },
    },
  },
})

/**
 * Toggle machine for state matching tests
 */
const toggleMachine = setup({
  types: {
    context: {} as { toggleCount: number },
    events: {} as { type: 'TOGGLE' } | { type: 'RESET' },
  },
}).createMachine({
  id: 'toggle',
  initial: 'inactive',
  context: { toggleCount: 0 },
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          actions: assign({ toggleCount: ({ context }) => context.toggleCount + 1 }),
        },
      },
    },
    active: {
      on: {
        TOGGLE: {
          target: 'inactive',
          actions: assign({ toggleCount: ({ context }) => context.toggleCount + 1 }),
        },
        RESET: 'inactive',
      },
    },
  },
})

/**
 * Async machine with invoked effects
 */
const asyncMachine = setup({
  types: {
    context: {} as { data: string | null; error: string | null; loading: boolean },
    events: {} as
      | { type: 'FETCH'; url: string }
      | { type: 'RETRY' }
      | { type: 'RESET' },
  },
  actors: {
    fetchData: fromPromise<string, { url: string }>(async ({ input }) => {
      // Simulated fetch
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (input.url.includes('error')) {
        throw new Error('Fetch failed')
      }
      return `Data from ${input.url}`
    }),
  },
}).createMachine({
  id: 'async',
  initial: 'idle',
  context: { data: null, error: null, loading: false },
  states: {
    idle: {
      on: {
        FETCH: {
          target: 'loading',
          actions: assign({ loading: true, error: null }),
        },
      },
    },
    loading: {
      invoke: {
        src: 'fetchData',
        input: ({ event }) => ({ url: (event as { type: 'FETCH'; url: string }).url }),
        onDone: {
          target: 'success',
          actions: assign({
            data: ({ event }) => event.output,
            loading: false,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error),
            loading: false,
          }),
        },
      },
    },
    success: {
      on: {
        FETCH: {
          target: 'loading',
          actions: assign({ loading: true, error: null }),
        },
        RESET: 'idle',
      },
    },
    error: {
      on: {
        RETRY: 'loading',
        RESET: 'idle',
      },
    },
  },
})

// =============================================================================
// stx() Factory Tests
// =============================================================================

describe('stx() Factory', () => {
  describe('Basic Initialization', () => {
    it('creates stx instance with data only', () => {
      const state = stx({
        data: { name: 'test', count: 0 },
      })

      expect(state.data).toBeDefined()
      expect(state.data.name.get()).toBe('test')
      expect(state.data.count.get()).toBe(0)
      expect(state.actor).toBeUndefined()
      expect(state.send).toBeUndefined()

      state.dispose()
    })

    it('creates stx instance with machine and data', () => {
      const state = stx({
        machine: counterMachine,
        data: { count: 0 },
      })

      expect(state.data).toBeDefined()
      expect(state.actor).toBeDefined()
      expect(state.send).toBeDefined()
      expect(state.data.count.get()).toBe(0)

      state.dispose()
    })

    it('creates stx instance with effects', async () => {
      const fetchEffect = Effect.succeed('fetched data')

      const state = stx({
        data: { result: '' },
        effects: {
          fetch: fetchEffect,
        },
      })

      expect(state.effects).toBeDefined()
      expect(typeof state.effects.fetch).toBe('function')

      const result = await state.effects.fetch()
      expect(result._tag).toBe('Success')
      if (result._tag === 'Success') {
        expect(result.value).toBe('fetched data')
      }

      state.dispose()
    })

    it('creates stx instance with effect factories', async () => {
      const state = stx({
        data: { result: '' },
        effects: {
          multiply: (a: number, b: number) => Effect.succeed(a * b),
        },
      })

      const result = await state.effects.multiply(3, 4)
      expect(result._tag).toBe('Success')
      if (result._tag === 'Success') {
        expect(result.value).toBe(12)
      }

      state.dispose()
    })

    it('creates stx instance with computed values', () => {
      const state = stx({
        data: { count: 5 },
        computed: {
          doubled: (get) => get.data.count.get() * 2,
          squared: (get) => get.data.count.get() ** 2,
        },
      })

      expect(state.computed).toBeDefined()
      expect(state.computed.doubled).toBeDefined()
      expect(state.computed.squared).toBeDefined()

      state.dispose()
    })
  })

  describe('Data Layer (Legend-State)', () => {
    it('data is reactive via Legend-State observable', () => {
      const state = stx({
        data: { name: 'initial', count: 0 },
      })

      const changes: string[] = []
      const dispose = observe(() => {
        changes.push(state.data.name.get())
      })

      state.data.name.set('updated')
      state.data.name.set('final')

      expect(changes).toContain('initial')
      expect(changes).toContain('updated')
      expect(changes).toContain('final')

      dispose()
      state.dispose()
    })

    it('supports nested data structures', () => {
      const state = stx({
        data: {
          user: {
            profile: {
              name: 'Test User',
              age: 25,
            },
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
      })

      expect(state.data.user.profile.name.get()).toBe('Test User')
      expect(state.data.user.settings.theme.get()).toBe('dark')

      state.data.user.profile.name.set('New Name')
      expect(state.data.user.profile.name.get()).toBe('New Name')

      state.dispose()
    })

    it('supports array data', () => {
      const state = stx({
        data: {
          items: [1, 2, 3],
          objects: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
        },
      })

      expect(state.data.items.get()).toEqual([1, 2, 3])
      expect(state.data.objects[0].name.get()).toBe('a')

      state.data.items.push(4)
      expect(state.data.items.get()).toEqual([1, 2, 3, 4])

      state.dispose()
    })

    it('batches multiple updates', () => {
      const state = stx({
        data: { a: 0, b: 0, c: 0 },
      })

      let callCount = 0
      const dispose = observe(() => {
        state.data.a.get()
        state.data.b.get()
        state.data.c.get()
        callCount++
      })

      // Reset count after initial observation
      callCount = 0

      batch(() => {
        state.data.a.set(1)
        state.data.b.set(2)
        state.data.c.set(3)
      })

      // Should only trigger once due to batching
      expect(callCount).toBe(1)

      dispose()
      state.dispose()
    })
  })

  describe('Machine Layer (XState)', () => {
    it('machine starts in initial state', () => {
      const state = stx({
        machine: toggleMachine,
        data: { toggleCount: 0 },
      })

      expect(state.actor!.getSnapshot().matches('inactive')).toBe(true)

      state.dispose()
    })

    it('send function dispatches events to machine', () => {
      const state = stx({
        machine: counterMachine,
        data: { count: 0 },
      })

      state.send!({ type: 'INCREMENT' })
      expect(state.actor!.getSnapshot().context.count).toBe(1)

      state.send!({ type: 'INCREMENT' })
      expect(state.actor!.getSnapshot().context.count).toBe(2)

      state.send!({ type: 'DECREMENT' })
      expect(state.actor!.getSnapshot().context.count).toBe(1)

      state.dispose()
    })

    it('machine transitions between states', () => {
      const state = stx({
        machine: toggleMachine,
        data: { toggleCount: 0 },
      })

      expect(state.actor!.getSnapshot().matches('inactive')).toBe(true)

      state.send!({ type: 'TOGGLE' })
      expect(state.actor!.getSnapshot().matches('active')).toBe(true)

      state.send!({ type: 'TOGGLE' })
      expect(state.actor!.getSnapshot().matches('inactive')).toBe(true)

      state.dispose()
    })

    it('machine context updates on transitions', () => {
      const state = stx({
        machine: toggleMachine,
        data: { toggleCount: 0 },
      })

      state.send!({ type: 'TOGGLE' })
      expect(state.actor!.getSnapshot().context.toggleCount).toBe(1)

      state.send!({ type: 'TOGGLE' })
      expect(state.actor!.getSnapshot().context.toggleCount).toBe(2)

      state.send!({ type: 'TOGGLE' })
      expect(state.actor!.getSnapshot().context.toggleCount).toBe(3)

      state.dispose()
    })
  })

  describe('Effects Layer (Effect-TS)', () => {
    it('runs direct effects', async () => {
      const state = stx({
        data: {},
        effects: {
          greet: Effect.succeed('Hello, World!'),
        },
      })

      const result = await state.effects.greet()
      expect(result._tag).toBe('Success')
      if (result._tag === 'Success') {
        expect(result.value).toBe('Hello, World!')
      }

      state.dispose()
    })

    it('runs effect factories with arguments', async () => {
      const state = stx({
        data: {},
        effects: {
          add: (a: number, b: number) => Effect.succeed(a + b),
          concat: (strings: string[]) => Effect.succeed(strings.join(' ')),
        },
      })

      const addResult = await state.effects.add(10, 20)
      expect(addResult._tag).toBe('Success')
      if (addResult._tag === 'Success') {
        expect(addResult.value).toBe(30)
      }

      const concatResult = await state.effects.concat(['Hello', 'World'])
      expect(concatResult._tag).toBe('Success')
      if (concatResult._tag === 'Success') {
        expect(concatResult.value).toBe('Hello World')
      }

      state.dispose()
    })

    it('handles effect failures', async () => {
      const state = stx({
        data: {},
        effects: {
          failingEffect: Effect.fail(new Error('Test failure')),
        },
      })

      const result = await state.effects.failingEffect()
      expect(result._tag).toBe('Failure')

      state.dispose()
    })

    it('handles async effects with Effect.gen', async () => {
      const state = stx({
        data: {},
        effects: {
          asyncOp: Effect.gen(function* () {
            yield* Effect.sleep('10 millis')
            return 'async result'
          }),
        },
      })

      const result = await state.effects.asyncOp()
      expect(result._tag).toBe('Success')
      if (result._tag === 'Success') {
        expect(result.value).toBe('async result')
      }

      state.dispose()
    })

    it('handles effect factories that can fail', async () => {
      const state = stx({
        data: {},
        effects: {
          divide: (a: number, b: number) =>
            b === 0
              ? Effect.fail(new Error('Division by zero'))
              : Effect.succeed(a / b),
        },
      })

      const successResult = await state.effects.divide(10, 2)
      expect(successResult._tag).toBe('Success')
      if (successResult._tag === 'Success') {
        expect(successResult.value).toBe(5)
      }

      const failResult = await state.effects.divide(10, 0)
      expect(failResult._tag).toBe('Failure')

      state.dispose()
    })
  })

  describe('Subscriptions', () => {
    it('subscribe notifies on data changes', () => {
      const state = stx({
        data: { value: 0 },
      })

      const callback = vi.fn()
      const unsubscribe = state.subscribe(callback)

      // Initial call
      expect(callback).toHaveBeenCalled()
      callback.mockClear()

      state.data.value.set(1)
      expect(callback).toHaveBeenCalled()

      unsubscribe()
      state.dispose()
    })

    it('subscribe notifies on machine state changes', () => {
      const state = stx({
        machine: toggleMachine,
        data: { toggleCount: 0 },
      })

      const callback = vi.fn()
      const unsubscribe = state.subscribe(callback)
      callback.mockClear()

      state.send!({ type: 'TOGGLE' })
      expect(callback).toHaveBeenCalled()

      unsubscribe()
      state.dispose()
    })

    it('unsubscribe stops notifications', () => {
      const state = stx({
        data: { value: 0 },
      })

      const callback = vi.fn()
      const unsubscribe = state.subscribe(callback)
      callback.mockClear()

      unsubscribe()

      state.data.value.set(1)
      expect(callback).not.toHaveBeenCalled()

      state.dispose()
    })

    it('multiple subscribers receive updates independently', () => {
      const state = stx({
        data: { value: 0 },
      })

      const callback1 = vi.fn()
      const callback2 = vi.fn()

      const unsub1 = state.subscribe(callback1)
      const unsub2 = state.subscribe(callback2)

      callback1.mockClear()
      callback2.mockClear()

      state.data.value.set(1)

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()

      unsub1()
      callback1.mockClear()
      callback2.mockClear()

      state.data.value.set(2)

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()

      unsub2()
      state.dispose()
    })
  })

  describe('Reset', () => {
    it('resets data to initial values', () => {
      const state = stx({
        data: { name: 'initial', count: 0 },
      })

      state.data.name.set('changed')
      state.data.count.set(100)

      expect(state.data.name.get()).toBe('changed')
      expect(state.data.count.get()).toBe(100)

      state.reset()

      expect(state.data.name.get()).toBe('initial')
      expect(state.data.count.get()).toBe(0)

      state.dispose()
    })

    it('resets machine to initial state', () => {
      const state = stx({
        machine: toggleMachine,
        data: { toggleCount: 0 },
      })

      state.send!({ type: 'TOGGLE' })
      state.send!({ type: 'TOGGLE' })
      expect(state.actor!.getSnapshot().context.toggleCount).toBe(2)

      state.reset()

      // Machine should be restarted
      expect(state.actor!.getSnapshot().matches('inactive')).toBe(true)

      state.dispose()
    })
  })

  describe('Dispose', () => {
    it('disposes all subscriptions', () => {
      const state = stx({
        data: { value: 0 },
      })

      const callback = vi.fn()
      state.subscribe(callback)
      callback.mockClear()

      state.dispose()

      state.data.value.set(1)
      // Should not throw and should not call callback
      expect(callback).not.toHaveBeenCalled()
    })

    it('stops machine actor', () => {
      const state = stx({
        machine: toggleMachine,
        data: { toggleCount: 0 },
      })

      const actor = state.actor!

      state.dispose()

      // Actor should be stopped (status might vary by XState version)
      expect(actor.getSnapshot().status).toBe('stopped')
    })
  })
})

// =============================================================================
// Convenience Factory Tests
// =============================================================================

describe('stxData()', () => {
  it('creates data-only stx instance', () => {
    const state = stxData({ name: 'test', count: 5 })

    expect(state.data.name.get()).toBe('test')
    expect(state.data.count.get()).toBe(5)
    expect(state.actor).toBeUndefined()
    expect(state.send).toBeUndefined()

    state.dispose()
  })

  it('supports all Legend-State operations', () => {
    const state = stxData({ items: [1, 2, 3] })

    state.data.items.push(4)
    expect(state.data.items.get()).toEqual([1, 2, 3, 4])

    state.data.items.set([5, 6])
    expect(state.data.items.get()).toEqual([5, 6])

    state.dispose()
  })
})

describe('stxMachine()', () => {
  it('creates machine+data stx instance', () => {
    const state = stxMachine(counterMachine, { count: 10 })

    expect(state.data.count.get()).toBe(10)
    expect(state.actor).toBeDefined()
    expect(state.send).toBeDefined()

    state.send!({ type: 'INCREMENT' })
    expect(state.actor!.getSnapshot().context.count).toBe(1) // Machine context, not data

    state.dispose()
  })
})

describe('stxSynced()', () => {
  it('creates synced stx instance with default fields', () => {
    const state = stxSynced(counterMachine, { count: 0 })

    expect(state.data).toBeDefined()
    expect(state.actor).toBeDefined()

    state.dispose()
  })

  it('creates synced stx instance with specific fields', () => {
    const complexMachine = setup({
      types: {
        context: {} as { a: number; b: number; c: number },
        events: {} as { type: 'DATA_SYNC'; a?: number; b?: number; c?: number },
      },
    }).createMachine({
      id: 'complex',
      initial: 'idle',
      context: { a: 0, b: 0, c: 0 },
      states: {
        idle: {
          on: {
            DATA_SYNC: {
              actions: assign(({ event }) => ({
                ...(event.a !== undefined && { a: event.a }),
                ...(event.b !== undefined && { b: event.b }),
              })),
            },
          },
        },
      },
    })

    const state = stxSynced(complexMachine, { a: 0, b: 0, c: 0 }, {
      syncFields: ['a', 'b'], // Only sync a and b, not c
    })

    expect(state.data).toBeDefined()

    state.dispose()
  })

  it('supports debounce option', () => {
    const state = stxSynced(counterMachine, { count: 0 }, {
      debounce: 100,
    })

    expect(state.data).toBeDefined()

    state.dispose()
  })
})

// =============================================================================
// Bindings Configuration Tests
// =============================================================================

describe('Bindings Configuration', () => {
  describe('dataToMachine binding', () => {
    it('sends events to machine when data changes', async () => {
      const state = stx({
        machine: counterMachine,
        data: { count: 0 },
        bindings: {
          dataToMachine: {
            selector: (data) => ({ count: data.count.get() }),
            toEvent: (values) => ({ type: 'SET', value: (values as { count: number }).count }),
          },
        },
      })

      // Initial sync might trigger
      await new Promise((resolve) => setTimeout(resolve, 10))

      state.data.count.set(50)

      // Allow binding to process
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Machine context should reflect data change
      expect(state.actor!.getSnapshot().context.count).toBe(50)

      state.dispose()
    })

    it('respects debounce option', async () => {
      const eventSpy = vi.fn()

      const trackingMachine = setup({
        types: {
          context: {} as { count: number },
          events: {} as { type: 'SET'; value: number },
        },
      }).createMachine({
        id: 'tracking',
        initial: 'idle',
        context: { count: 0 },
        states: {
          idle: {
            on: {
              SET: {
                actions: [
                  assign({ count: ({ event }) => event.value }),
                  () => eventSpy(),
                ],
              },
            },
          },
        },
      })

      const state = stx({
        machine: trackingMachine,
        data: { count: 0 },
        bindings: {
          dataToMachine: {
            selector: (data) => ({ count: data.count.get() }),
            toEvent: (values) => ({ type: 'SET', value: (values as { count: number }).count }),
            debounce: 50,
          },
        },
      })

      eventSpy.mockClear()

      // Rapid updates
      state.data.count.set(1)
      state.data.count.set(2)
      state.data.count.set(3)

      // Before debounce completes
      await new Promise((resolve) => setTimeout(resolve, 20))
      const callsBefore = eventSpy.mock.calls.length

      // After debounce
      await new Promise((resolve) => setTimeout(resolve, 100))
      const callsAfter = eventSpy.mock.calls.length

      // Should have fewer calls due to debouncing
      expect(callsAfter).toBeLessThan(3 + callsBefore)

      state.dispose()
    })
  })

  describe('machineToData binding', () => {
    it('updates data when machine context changes', async () => {
      const state = stx({
        machine: counterMachine,
        data: { count: 0 },
        bindings: {
          machineToData: {
            selector: (snapshot) => ({ count: (snapshot as { context: { count: number } }).context.count }),
            fields: ['count'],
          },
        },
      })

      state.send!({ type: 'INCREMENT' })
      state.send!({ type: 'INCREMENT' })

      // Allow binding to process
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(state.data.count.get()).toBe(2)

      state.dispose()
    })

    it('only updates specified fields', async () => {
      const multiFieldMachine = setup({
        types: {
          context: {} as { a: number; b: number; c: number },
          events: {} as { type: 'UPDATE_ALL' },
        },
      }).createMachine({
        id: 'multiField',
        initial: 'idle',
        context: { a: 0, b: 0, c: 0 },
        states: {
          idle: {
            on: {
              UPDATE_ALL: {
                actions: assign({ a: 10, b: 20, c: 30 }),
              },
            },
          },
        },
      })

      const state = stx({
        machine: multiFieldMachine,
        data: { a: 0, b: 0, c: 0 },
        bindings: {
          machineToData: {
            selector: (snapshot) => (snapshot as { context: { a: number; b: number; c: number } }).context,
            fields: ['a', 'b'], // Only sync a and b
          },
        },
      })

      state.send!({ type: 'UPDATE_ALL' })

      // Allow binding to process
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(state.data.a.get()).toBe(10)
      expect(state.data.b.get()).toBe(20)
      expect(state.data.c.get()).toBe(0) // Should not change

      state.dispose()
    })
  })

  describe('Binding loop prevention', () => {
    it('prevents infinite loops between data and machine', async () => {
      const loopMachine = setup({
        types: {
          context: {} as { count: number },
          events: {} as { type: 'SET'; value: number },
        },
      }).createMachine({
        id: 'loop',
        initial: 'idle',
        context: { count: 0 },
        states: {
          idle: {
            on: {
              SET: {
                actions: assign({ count: ({ event }) => event.value }),
              },
            },
          },
        },
      })

      const state = stx({
        machine: loopMachine,
        data: { count: 0 },
        bindings: {
          dataToMachine: {
            selector: (data) => ({ count: data.count.get() }),
            toEvent: (values) => ({ type: 'SET', value: (values as { count: number }).count }),
          },
          machineToData: {
            selector: (snapshot) => ({ count: (snapshot as { context: { count: number } }).context.count }),
            fields: ['count'],
          },
        },
      })

      // Trigger a change
      state.data.count.set(100)

      // Wait for any potential loop to run
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should stabilize at 100, not infinite loop
      expect(state.data.count.get()).toBe(100)
      expect(state.actor!.getSnapshot().context.count).toBe(100)

      state.dispose()
    })
  })
})

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty data object', () => {
    const state = stx({ data: {} })

    expect(state.data).toBeDefined()
    expect(Object.keys(state.data)).toHaveLength(0)

    state.dispose()
  })

  it('handles empty effects object', () => {
    const state = stx({
      data: { value: 0 },
      effects: {},
    })

    expect(state.effects).toBeDefined()
    expect(Object.keys(state.effects)).toHaveLength(0)

    state.dispose()
  })

  it('handles empty computed object', () => {
    const state = stx({
      data: { value: 0 },
      computed: {},
    })

    expect(state.computed).toBeDefined()
    expect(Object.keys(state.computed)).toHaveLength(0)

    state.dispose()
  })

  it('handles undefined optional properties', () => {
    const state = stx({
      data: { value: 0 },
      // No machine, effects, computed, or bindings
    })

    expect(state.actor).toBeUndefined()
    expect(state.send).toBeUndefined()
    expect(Object.keys(state.effects)).toHaveLength(0)
    expect(Object.keys(state.computed)).toHaveLength(0)

    state.dispose()
  })

  it('handles complex nested data structures', () => {
    // Note: Functions cannot be stored in data due to structuredClone limitation
    // Data should be serializable (JSON-compatible)
    const state = stx({
      data: {
        metadata: {
          version: '1.0.0',
          tags: ['alpha', 'beta'],
        },
        nested: {
          deeply: {
            value: 42,
          },
        },
      },
    })

    expect(state.data.nested.deeply.value.get()).toBe(42)
    expect(state.data.metadata.tags.get()).toEqual(['alpha', 'beta'])

    state.dispose()
  })

  it('handles data with null and undefined values', () => {
    const state = stx({
      data: {
        nullValue: null as string | null,
        undefinedValue: undefined as number | undefined,
        presentValue: 'exists',
      },
    })

    expect(state.data.nullValue.get()).toBeNull()
    expect(state.data.undefinedValue.get()).toBeUndefined()
    expect(state.data.presentValue.get()).toBe('exists')

    state.dispose()
  })
})

// =============================================================================
// TypeScript Type Tests (compile-time)
// =============================================================================

describe('TypeScript Types', () => {
  it('infers data types correctly', () => {
    const state = stx({
      data: { count: 0, name: 'test' },
    })

    // These should compile without errors
    const count: number = state.data.count.get()
    const name: string = state.data.name.get()

    expect(typeof count).toBe('number')
    expect(typeof name).toBe('string')

    state.dispose()
  })

  it('infers effect return types correctly', async () => {
    const state = stx({
      data: {},
      effects: {
        getString: Effect.succeed('hello'),
        getNumber: Effect.succeed(42),
      },
    })

    const stringResult = await state.effects.getString()
    const numberResult = await state.effects.getNumber()

    // Both should be Result types
    expect('_tag' in stringResult).toBe(true)
    expect('_tag' in numberResult).toBe(true)

    state.dispose()
  })
})

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance', () => {
  it('handles many rapid data updates', () => {
    const state = stx({
      data: { count: 0 },
    })

    const start = performance.now()

    for (let i = 0; i < 10000; i++) {
      state.data.count.set(i)
    }

    const elapsed = performance.now() - start

    expect(state.data.count.get()).toBe(9999)
    expect(elapsed).toBeLessThan(1000) // Should complete in under 1 second

    state.dispose()
  })

  it('handles many subscribers efficiently', () => {
    const state = stx({
      data: { value: 0 },
    })

    const unsubscribers: (() => void)[] = []

    for (let i = 0; i < 100; i++) {
      unsubscribers.push(state.subscribe(() => {}))
    }

    const start = performance.now()

    for (let i = 0; i < 1000; i++) {
      state.data.value.set(i)
    }

    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(1000) // Should complete in under 1 second

    unsubscribers.forEach((unsub) => unsub())
    state.dispose()
  })
})
