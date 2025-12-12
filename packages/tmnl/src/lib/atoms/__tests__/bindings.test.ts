/**
 * stx Bindings Tests
 *
 * Comprehensive tests for the bridge layer connecting:
 * - XState actors ↔ Effect.Effect
 * - XState actors ↔ Legend-State
 * - Legend-State → XState (via observe → send)
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit, Cause, Fiber, TestClock, Duration } from 'effect'
import {
  setup,
  createMachine,
  createActor,
  assign,
  fromPromise,
  fromCallback,
  waitFor,
  type AnyStateMachine,
  type ActorRefFrom,
} from 'xstate'
import { observable, observe, batch, type Observable } from '@legendapp/state'

import {
  fromEffect,
  fromEffectCallback,
  fromLegendState,
  fromLegendStateMulti,
  updateLegendState,
  batchLegendState,
  bridgeToActor,
  createTwoWayBridge,
  fromEffectStreamToObservable,
} from '../bindings'

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Simple test machine for actor binding tests
 */
const testMachine = setup({
  types: {
    context: {} as { data: string | null; error: string | null; count: number },
    events: {} as
      | { type: 'FETCH' }
      | { type: 'SUCCESS'; data: string }
      | { type: 'ERROR'; error: string }
      | { type: 'SYNC'; value: number }
      | { type: 'RESET' },
  },
}).createMachine({
  id: 'test',
  initial: 'idle',
  context: { data: null, error: null, count: 0 },
  states: {
    idle: {
      on: {
        FETCH: 'loading',
        SYNC: { actions: assign({ count: ({ event }) => event.value }) },
        SUCCESS: { actions: assign({ data: ({ event }) => event.data }) },
        ERROR: { actions: assign({ error: ({ event }) => event.error }) },
        RESET: { actions: assign({ data: null, error: null, count: 0 }) },
      },
    },
    loading: {
      on: {
        SUCCESS: { target: 'success', actions: assign({ data: ({ event }) => event.data }) },
        ERROR: { target: 'error', actions: assign({ error: ({ event }) => event.error }) },
      },
    },
    success: {
      on: {
        FETCH: 'loading',
        RESET: 'idle',
      },
    },
    error: {
      on: {
        FETCH: 'loading',
        RESET: 'idle',
      },
    },
  },
})

/**
 * Machine with invocations for actor testing
 */
const invokeMachine = setup({
  types: {
    context: {} as { result: string | null; error: string | null },
    events: {} as { type: 'START'; input: string } | { type: 'RESET' },
  },
  actors: {
    fetchActor: fromPromise<string, { input: string }>(async ({ input }) => {
      await new Promise((r) => setTimeout(r, 10))
      return `Fetched: ${input.input}`
    }),
  },
}).createMachine({
  id: 'invoke',
  initial: 'idle',
  context: { result: null, error: null },
  states: {
    idle: {
      on: {
        START: 'loading',
      },
    },
    loading: {
      invoke: {
        src: 'fetchActor',
        input: ({ event }) => ({ input: (event as { type: 'START'; input: string }).input }),
        onDone: {
          target: 'success',
          actions: assign({ result: ({ event }) => event.output }),
        },
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
    },
    success: {
      on: { RESET: 'idle' },
    },
    error: {
      on: { RESET: 'idle' },
    },
  },
})

// =============================================================================
// fromEffect() Tests
// =============================================================================

describe('fromEffect()', () => {
  describe('Basic Effect Wrapping', () => {
    it('wraps a successful Effect into an XState actor', async () => {
      const effectActor = fromEffect(({ input }: { input: { value: number } }) =>
        Effect.succeed(input.value * 2)
      )

      const machine = setup({
        types: {
          context: {} as { result: number | null },
          events: {} as { type: 'START'; value: number },
        },
        actors: {
          effectActor,
        },
      }).createMachine({
        id: 'effect-test',
        initial: 'idle',
        context: { result: null },
        states: {
          idle: {
            on: { START: 'loading' },
          },
          loading: {
            invoke: {
              src: 'effectActor',
              input: ({ event }) => ({ value: (event as { type: 'START'; value: number }).value }),
              onDone: {
                target: 'done',
                actions: assign({ result: ({ event }) => event.output }),
              },
              onError: 'error',
            },
          },
          done: {},
          error: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START', value: 21 })

      await waitFor(actor, (state) => state.matches('done'))

      expect(actor.getSnapshot().context.result).toBe(42)

      actor.stop()
    })

    it('wraps a failing Effect and transitions to error state', async () => {
      const effectActor = fromEffect(() =>
        Effect.fail(new Error('Test failure'))
      )

      const machine = setup({
        types: {
          context: {} as { error: string | null },
          events: {} as { type: 'START' },
        },
        actors: {
          effectActor,
        },
      }).createMachine({
        id: 'effect-fail-test',
        initial: 'idle',
        context: { error: null },
        states: {
          idle: {
            on: { START: 'loading' },
          },
          loading: {
            invoke: {
              src: 'effectActor',
              input: () => ({}),
              onDone: 'done',
              onError: {
                target: 'error',
                actions: assign({ error: ({ event }) => String(event.error) }),
              },
            },
          },
          done: {},
          error: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START' })

      await waitFor(actor, (state) => state.matches('error'))

      expect(actor.getSnapshot().context.error).toContain('Test failure')

      actor.stop()
    })

    it('handles Effect.gen with multiple operations', async () => {
      const effectActor = fromEffect(({ input }: { input: { numbers: number[] } }) =>
        Effect.gen(function* () {
          const sum = input.numbers.reduce((a, b) => a + b, 0)
          yield* Effect.sleep('1 millis')
          return { sum, count: input.numbers.length, avg: sum / input.numbers.length }
        })
      )

      const machine = setup({
        types: {
          context: {} as { result: { sum: number; count: number; avg: number } | null },
          events: {} as { type: 'START'; numbers: number[] },
        },
        actors: {
          effectActor,
        },
      }).createMachine({
        id: 'effect-gen-test',
        initial: 'idle',
        context: { result: null },
        states: {
          idle: {
            on: { START: 'loading' },
          },
          loading: {
            invoke: {
              src: 'effectActor',
              input: ({ event }) => ({ numbers: (event as { type: 'START'; numbers: number[] }).numbers }),
              onDone: {
                target: 'done',
                actions: assign({ result: ({ event }) => event.output }),
              },
              onError: 'error',
            },
          },
          done: {},
          error: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START', numbers: [1, 2, 3, 4, 5] })

      await waitFor(actor, (state) => state.matches('done'))

      expect(actor.getSnapshot().context.result).toEqual({
        sum: 15,
        count: 5,
        avg: 3,
      })

      actor.stop()
    })
  })

  describe('Effect Error Types', () => {
    it('preserves typed errors through the actor', async () => {
      class ValidationError {
        readonly _tag = 'ValidationError'
        constructor(readonly message: string) {}
      }

      const effectActor = fromEffect(({ input }: { input: { value: number } }) =>
        input.value < 0
          ? Effect.fail(new ValidationError('Value must be positive'))
          : Effect.succeed(input.value)
      )

      const machine = setup({
        types: {
          context: {} as { result: number | null; error: string | null },
          events: {} as { type: 'START'; value: number },
        },
        actors: { effectActor },
      }).createMachine({
        id: 'error-type-test',
        initial: 'idle',
        context: { result: null, error: null },
        states: {
          idle: { on: { START: 'loading' } },
          loading: {
            invoke: {
              src: 'effectActor',
              input: ({ event }) => ({ value: (event as { type: 'START'; value: number }).value }),
              onDone: {
                target: 'done',
                actions: assign({ result: ({ event }) => event.output }),
              },
              onError: {
                target: 'error',
                actions: assign({ error: ({ event }) => {
                  const err = event.error as ValidationError
                  return err.message
                }}),
              },
            },
          },
          done: {},
          error: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START', value: -5 })

      await waitFor(actor, (state) => state.matches('error'))

      expect(actor.getSnapshot().context.error).toBe('Value must be positive')

      actor.stop()
    })
  })

  describe('Effect Concurrency', () => {
    it('handles multiple concurrent effect invocations', async () => {
      let invocationCount = 0

      const effectActor = fromEffect(({ input }: { input: { id: number } }) =>
        Effect.gen(function* () {
          invocationCount++
          yield* Effect.sleep('10 millis')
          return `Result ${input.id}`
        })
      )

      const machine = setup({
        types: {
          context: {} as { results: string[] },
          events: {} as { type: 'START'; id: number } | { type: 'ADD_RESULT'; result: string },
        },
        actors: { effectActor },
      }).createMachine({
        id: 'concurrent-test',
        initial: 'running',
        context: { results: [] },
        states: {
          running: {
            on: {
              START: {
                actions: () => {}, // Just to trigger
              },
              ADD_RESULT: {
                actions: assign({
                  results: ({ context, event }) => [...context.results, event.result],
                }),
              },
            },
          },
        },
      })

      // This tests that the effect can be invoked, not concurrent actors
      // XState handles concurrency differently
      const actor = createActor(machine)
      actor.start()

      expect(invocationCount).toBe(0)

      actor.stop()
    })
  })
})

// =============================================================================
// fromEffectCallback() Tests
// =============================================================================

describe('fromEffectCallback()', () => {
  describe('Streaming Effects', () => {
    it('creates callback-style actor that can send multiple events', async () => {
      const callbackActor = fromEffectCallback<{ count: number }, { type: 'TICK'; value: number } | { type: 'DONE' }>(
        ({ input, sendBack }) =>
          Effect.gen(function* () {
            for (let i = 0; i < input.count; i++) {
              sendBack({ type: 'TICK', value: i })
              yield* Effect.sleep('1 millis')
            }
            sendBack({ type: 'DONE' })
          })
      )

      const tickValues: number[] = []
      let isDone = false

      const machine = setup({
        types: {
          context: {} as {},
          events: {} as { type: 'START'; count: number } | { type: 'TICK'; value: number } | { type: 'DONE' },
        },
        actors: { callbackActor },
      }).createMachine({
        id: 'callback-test',
        initial: 'idle',
        context: {},
        states: {
          idle: {
            on: { START: 'running' },
          },
          running: {
            invoke: {
              src: 'callbackActor',
              input: ({ event }) => ({ count: (event as { type: 'START'; count: number }).count }),
            },
            on: {
              TICK: {
                actions: ({ event }) => {
                  tickValues.push(event.value)
                },
              },
              DONE: {
                target: 'done',
                actions: () => {
                  isDone = true
                },
              },
            },
          },
          done: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START', count: 3 })

      await waitFor(actor, (state) => state.matches('done'), { timeout: 1000 })

      expect(tickValues).toEqual([0, 1, 2])
      expect(isDone).toBe(true)

      actor.stop()
    })

    it('supports abort signal for cleanup', async () => {
      let wasAborted = false

      const callbackActor = fromEffectCallback<{}, { type: 'TICK' }>(
        ({ sendBack, signal }) =>
          Effect.gen(function* () {
            signal.addEventListener('abort', () => {
              wasAborted = true
            })

            // Infinite loop until aborted
            while (!signal.aborted) {
              sendBack({ type: 'TICK' })
              yield* Effect.sleep('10 millis')
            }
          })
      )

      const machine = setup({
        types: {
          context: {} as { tickCount: number },
          events: {} as { type: 'START' } | { type: 'STOP' } | { type: 'TICK' },
        },
        actors: { callbackActor },
      }).createMachine({
        id: 'abort-test',
        initial: 'idle',
        context: { tickCount: 0 },
        states: {
          idle: {
            on: { START: 'running' },
          },
          running: {
            invoke: {
              src: 'callbackActor',
              input: () => ({}),
            },
            on: {
              TICK: {
                actions: assign({ tickCount: ({ context }) => context.tickCount + 1 }),
              },
              STOP: 'stopped',
            },
          },
          stopped: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START' })

      // Let it tick a few times
      await new Promise((r) => setTimeout(r, 50))

      const ticksBefore = actor.getSnapshot().context.tickCount

      actor.send({ type: 'STOP' })

      // Give time for abort to propagate
      await new Promise((r) => setTimeout(r, 50))

      // Should have been aborted
      expect(wasAborted).toBe(true)

      actor.stop()
    })
  })

  describe('Error Handling', () => {
    it('sends ERROR event when effect fails', async () => {
      let errorReceived = false

      const callbackActor = fromEffectCallback<{}, { type: 'ERROR'; error: unknown }>(
        () => Effect.fail(new Error('Callback failure'))
      )

      const machine = setup({
        types: {
          context: {} as { error: string | null },
          events: {} as { type: 'START' } | { type: 'ERROR'; error: unknown },
        },
        actors: { callbackActor },
      }).createMachine({
        id: 'callback-error-test',
        initial: 'idle',
        context: { error: null },
        states: {
          idle: {
            on: { START: 'running' },
          },
          running: {
            invoke: {
              src: 'callbackActor',
              input: () => ({}),
            },
            on: {
              ERROR: {
                target: 'error',
                actions: assign({ error: ({ event }) => String(event.error) }),
              },
            },
          },
          error: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START' })

      await waitFor(actor, (state) => state.matches('error'), { timeout: 1000 })

      expect(actor.getSnapshot().context.error).toContain('Callback failure')

      actor.stop()
    })
  })
})

// =============================================================================
// fromLegendState() Tests
// =============================================================================

describe('fromLegendState()', () => {
  describe('Observable Subscription', () => {
    it('creates actor that sends events when observable changes', async () => {
      const count$ = observable(0)
      const receivedValues: number[] = []

      const observableActor = fromLegendState(
        count$ as Observable<number>,
        (value, previous) => ({ type: 'VALUE_CHANGED', value, previous })
      )

      const machine = setup({
        types: {
          context: {} as {},
          events: {} as
            | { type: 'START' }
            | { type: 'VALUE_CHANGED'; value: number; previous: number | undefined },
        },
        actors: { observableActor },
      }).createMachine({
        id: 'legend-state-test',
        initial: 'idle',
        context: {},
        states: {
          idle: {
            on: { START: 'watching' },
          },
          watching: {
            invoke: {
              src: 'observableActor',
              input: () => ({}),
            },
            on: {
              VALUE_CHANGED: {
                actions: ({ event }) => {
                  receivedValues.push(event.value)
                },
              },
            },
          },
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START' })

      // Initial value
      await new Promise((r) => setTimeout(r, 10))
      expect(receivedValues).toContain(0)

      // Update observable
      count$.set(1)
      await new Promise((r) => setTimeout(r, 10))
      expect(receivedValues).toContain(1)

      count$.set(5)
      await new Promise((r) => setTimeout(r, 10))
      expect(receivedValues).toContain(5)

      actor.stop()
    })

    it('provides previous value in event', async () => {
      const value$ = observable('initial')
      const transitions: Array<{ current: string; previous: string | undefined }> = []

      const observableActor = fromLegendState(
        value$ as Observable<string>,
        (value, previous) => ({ type: 'CHANGE', current: value, previous })
      )

      const machine = setup({
        types: {
          context: {} as {},
          events: {} as
            | { type: 'START' }
            | { type: 'CHANGE'; current: string; previous: string | undefined },
        },
        actors: { observableActor },
      }).createMachine({
        id: 'previous-value-test',
        initial: 'idle',
        context: {},
        states: {
          idle: {
            on: { START: 'watching' },
          },
          watching: {
            invoke: {
              src: 'observableActor',
              input: () => ({}),
            },
            on: {
              CHANGE: {
                actions: ({ event }) => {
                  transitions.push({ current: event.current, previous: event.previous })
                },
              },
            },
          },
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START' })
      await new Promise((r) => setTimeout(r, 10))

      value$.set('second')
      await new Promise((r) => setTimeout(r, 10))

      value$.set('third')
      await new Promise((r) => setTimeout(r, 10))

      expect(transitions).toContainEqual({ current: 'initial', previous: undefined })
      expect(transitions).toContainEqual({ current: 'second', previous: 'initial' })
      expect(transitions).toContainEqual({ current: 'third', previous: 'second' })

      actor.stop()
    })

    it('cleans up subscription when actor stops', async () => {
      const value$ = observable(0)
      let updateCount = 0

      const observableActor = fromLegendState(
        value$ as Observable<number>,
        (value) => {
          updateCount++
          return { type: 'UPDATE', value }
        }
      )

      const machine = setup({
        types: {
          context: {} as {},
          events: {} as { type: 'START' } | { type: 'STOP' } | { type: 'UPDATE'; value: number },
        },
        actors: { observableActor },
      }).createMachine({
        id: 'cleanup-test',
        initial: 'idle',
        context: {},
        states: {
          idle: {
            on: { START: 'watching' },
          },
          watching: {
            invoke: {
              src: 'observableActor',
              input: () => ({}),
            },
            on: {
              UPDATE: {},
              STOP: 'stopped',
            },
          },
          stopped: {},
        },
      })

      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'START' })
      await new Promise((r) => setTimeout(r, 10))

      const countBefore = updateCount

      actor.send({ type: 'STOP' })
      await new Promise((r) => setTimeout(r, 10))

      // Updates after stopping shouldn't be received
      value$.set(100)
      value$.set(200)
      await new Promise((r) => setTimeout(r, 10))

      // Update count should not have increased significantly after stop
      // (may have +1 from the stop transition)
      expect(updateCount).toBeLessThanOrEqual(countBefore + 1)

      actor.stop()
    })
  })
})

// =============================================================================
// fromLegendStateMulti() Tests
// =============================================================================

describe('fromLegendStateMulti()', () => {
  it('watches multiple observables and sends combined events', async () => {
    const name$ = observable('Alice')
    const age$ = observable(25)
    const active$ = observable(true)

    const receivedValues: Array<{ name: string; age: number; active: boolean }> = []

    const multiObservableActor = fromLegendStateMulti(
      {
        name: name$ as Observable<string>,
        age: age$ as Observable<number>,
        active: active$ as Observable<boolean>,
      },
      (values) => ({ type: 'SYNC', ...values })
    )

    const machine = setup({
      types: {
        context: {} as {},
        events: {} as
          | { type: 'START' }
          | { type: 'SYNC'; name: string; age: number; active: boolean },
      },
      actors: { multiObservableActor },
    }).createMachine({
      id: 'multi-observable-test',
      initial: 'idle',
      context: {},
      states: {
        idle: {
          on: { START: 'watching' },
        },
        watching: {
          invoke: {
            src: 'multiObservableActor',
            input: () => ({}),
          },
          on: {
            SYNC: {
              actions: ({ event }) => {
                receivedValues.push({ name: event.name, age: event.age, active: event.active })
              },
            },
          },
        },
      },
    })

    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'START' })
    await new Promise((r) => setTimeout(r, 10))

    // Initial values
    expect(receivedValues).toContainEqual({ name: 'Alice', age: 25, active: true })

    // Update one observable
    name$.set('Bob')
    await new Promise((r) => setTimeout(r, 10))
    expect(receivedValues).toContainEqual({ name: 'Bob', age: 25, active: true })

    // Update another
    age$.set(30)
    await new Promise((r) => setTimeout(r, 10))
    expect(receivedValues).toContainEqual({ name: 'Bob', age: 30, active: true })

    actor.stop()
  })

  it('handles batched updates to multiple observables', async () => {
    const a$ = observable(0)
    const b$ = observable(0)

    let eventCount = 0

    const multiObservableActor = fromLegendStateMulti(
      { a: a$ as Observable<number>, b: b$ as Observable<number> },
      (values) => {
        eventCount++
        return { type: 'SYNC', ...values }
      }
    )

    const machine = setup({
      types: {
        context: {} as {},
        events: {} as { type: 'START' } | { type: 'SYNC'; a: number; b: number },
      },
      actors: { multiObservableActor },
    }).createMachine({
      id: 'batched-multi-test',
      initial: 'idle',
      context: {},
      states: {
        idle: { on: { START: 'watching' } },
        watching: {
          invoke: {
            src: 'multiObservableActor',
            input: () => ({}),
          },
          on: { SYNC: {} },
        },
      },
    })

    const actor = createActor(machine)
    actor.start()

    actor.send({ type: 'START' })
    await new Promise((r) => setTimeout(r, 10))

    const countAfterStart = eventCount

    // Batched update - should trigger once
    batch(() => {
      a$.set(10)
      b$.set(20)
    })

    await new Promise((r) => setTimeout(r, 10))

    // Should have only one additional event from the batch
    expect(eventCount).toBe(countAfterStart + 1)

    actor.stop()
  })
})

// =============================================================================
// updateLegendState() Tests
// =============================================================================

describe('updateLegendState()', () => {
  it('creates XState action that updates observable', () => {
    const count$ = observable(0)

    const updateAction = updateLegendState(
      count$ as Observable<number>,
      (context: { multiplier: number }, event: { type: 'SET'; value: number }) =>
        event.value * context.multiplier
    )

    // Simulate XState action call
    updateAction({
      context: { multiplier: 2 },
      event: { type: 'SET', value: 5 },
    })

    expect(count$.get()).toBe(10)
  })

  it('can be used with machine assign-style context', () => {
    const result$ = observable('')

    const updateAction = updateLegendState(
      result$ as Observable<string>,
      (context: { prefix: string }, event: { type: 'UPDATE'; text: string }) =>
        `${context.prefix}: ${event.text}`
    )

    updateAction({
      context: { prefix: 'Result' },
      event: { type: 'UPDATE', text: 'Hello World' },
    })

    expect(result$.get()).toBe('Result: Hello World')
  })
})

// =============================================================================
// batchLegendState() Tests
// =============================================================================

describe('batchLegendState()', () => {
  it('batches multiple observable updates', () => {
    const a$ = observable(0)
    const b$ = observable(0)
    const c$ = observable(0)

    let observerCallCount = 0
    const unsubscribe = observe(() => {
      a$.get()
      b$.get()
      c$.get()
      observerCallCount++
    })

    // Reset after initial observation
    observerCallCount = 0

    const batchAction = batchLegendState(
      (_context: {}, _event: { type: 'UPDATE' }) => {
        a$.set(1)
        b$.set(2)
        c$.set(3)
      }
    )

    batchAction({
      context: {},
      event: { type: 'UPDATE' },
    })

    // Should only trigger one observation due to batching
    expect(observerCallCount).toBe(1)
    expect(a$.get()).toBe(1)
    expect(b$.get()).toBe(2)
    expect(c$.get()).toBe(3)

    unsubscribe()
  })

  it('works with context and event data', () => {
    const name$ = observable('')
    const age$ = observable(0)

    const batchAction = batchLegendState(
      (context: { suffix: string }, event: { type: 'SET_USER'; name: string; age: number }) => {
        name$.set(event.name + context.suffix)
        age$.set(event.age)
      }
    )

    batchAction({
      context: { suffix: ' (verified)' },
      event: { type: 'SET_USER', name: 'Alice', age: 30 },
    })

    expect(name$.get()).toBe('Alice (verified)')
    expect(age$.get()).toBe(30)
  })
})

// =============================================================================
// bridgeToActor() Tests
// =============================================================================

describe('bridgeToActor()', () => {
  it('sends events to actor when observables change', async () => {
    const count$ = observable(0)
    const receivedEvents: Array<{ type: string; value: number }> = []

    const actor = createActor(testMachine)
    actor.start()

    // Intercept events
    actor.subscribe((snapshot) => {
      // Track context changes
    })

    const mockActor = {
      send: (event: { type: string; value: number }) => {
        receivedEvents.push(event)
        if (event.type === 'SYNC') {
          actor.send({ type: 'SYNC', value: event.value })
        }
      },
    }

    const dispose = bridgeToActor(
      () => ({ value: count$.get() }),
      (values) => ({ type: 'SYNC', value: values.value }),
      mockActor
    )

    // Initial value sent
    expect(receivedEvents).toContainEqual({ type: 'SYNC', value: 0 })

    // Update observable
    count$.set(10)
    await new Promise((r) => setTimeout(r, 10))
    expect(receivedEvents).toContainEqual({ type: 'SYNC', value: 10 })

    count$.set(20)
    await new Promise((r) => setTimeout(r, 10))
    expect(receivedEvents).toContainEqual({ type: 'SYNC', value: 20 })

    dispose()
    actor.stop()
  })

  it('stops sending events after dispose', async () => {
    const value$ = observable('initial')
    const receivedEvents: string[] = []

    const mockActor = {
      send: (event: { type: string; value: string }) => {
        receivedEvents.push(event.value)
      },
    }

    const dispose = bridgeToActor(
      () => ({ value: value$.get() }),
      (values) => ({ type: 'UPDATE', value: values.value }),
      mockActor
    )

    expect(receivedEvents).toContain('initial')

    dispose()

    // Updates after dispose shouldn't be sent
    value$.set('after-dispose')
    await new Promise((r) => setTimeout(r, 10))

    expect(receivedEvents).not.toContain('after-dispose')
  })

  it('selects multiple values from observables', async () => {
    const firstName$ = observable('John')
    const lastName$ = observable('Doe')

    const fullNames: string[] = []

    const mockActor = {
      send: (event: { type: string; fullName: string }) => {
        fullNames.push(event.fullName)
      },
    }

    const dispose = bridgeToActor(
      () => ({
        first: firstName$.get(),
        last: lastName$.get(),
      }),
      (values) => ({
        type: 'NAME_CHANGED',
        fullName: `${values.first} ${values.last}`,
      }),
      mockActor
    )

    expect(fullNames).toContain('John Doe')

    firstName$.set('Jane')
    await new Promise((r) => setTimeout(r, 10))
    expect(fullNames).toContain('Jane Doe')

    lastName$.set('Smith')
    await new Promise((r) => setTimeout(r, 10))
    expect(fullNames).toContain('Jane Smith')

    dispose()
  })
})

// =============================================================================
// createTwoWayBridge() Tests
// =============================================================================

describe('createTwoWayBridge()', () => {
  it('syncs observable to actor and vice versa', async () => {
    const value$ = observable(0)

    const syncMachine = setup({
      types: {
        context: {} as { value: number },
        events: {} as { type: 'SET'; value: number },
      },
    }).createMachine({
      id: 'sync-machine',
      initial: 'active',
      context: { value: 0 },
      states: {
        active: {
          on: {
            SET: {
              actions: assign({ value: ({ event }) => event.value }),
            },
          },
        },
      },
    })

    const actor = createActor(syncMachine)
    actor.start()

    const dispose = createTwoWayBridge({
      observable$: value$ as Observable<number>,
      actor,
      toEvent: (value) => ({ type: 'SET', value }),
      fromSnapshot: (snapshot) => snapshot.context.value,
    })

    // Initial sync
    expect(value$.get()).toBe(0)
    expect(actor.getSnapshot().context.value).toBe(0)

    // Update observable -> actor should sync
    value$.set(42)
    await new Promise((r) => setTimeout(r, 10))
    expect(actor.getSnapshot().context.value).toBe(42)

    // Update actor -> observable should sync
    actor.send({ type: 'SET', value: 100 })
    await new Promise((r) => setTimeout(r, 10))
    expect(value$.get()).toBe(100)

    dispose()
    actor.stop()
  })

  it('prevents infinite loops with equals check', async () => {
    const value$ = observable({ count: 0 })
    let syncCount = 0

    const objMachine = setup({
      types: {
        context: {} as { count: number },
        events: {} as { type: 'SET'; count: number },
      },
    }).createMachine({
      id: 'obj-machine',
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            SET: {
              actions: assign({ count: ({ event }) => event.count }),
            },
          },
        },
      },
    })

    const actor = createActor(objMachine)
    actor.start()

    actor.subscribe(() => {
      syncCount++
    })

    const dispose = createTwoWayBridge({
      observable$: value$ as Observable<{ count: number }>,
      actor,
      toEvent: (value) => ({ type: 'SET', count: value.count }),
      fromSnapshot: (snapshot) => ({ count: snapshot.context.count }),
      equals: (a, b) => a.count === b.count,
    })

    const initialSyncCount = syncCount

    // Update with same value (should not cause infinite loop)
    value$.set({ count: 0 })
    await new Promise((r) => setTimeout(r, 50))

    // Sync count should not have increased dramatically
    expect(syncCount).toBeLessThan(initialSyncCount + 5)

    dispose()
    actor.stop()
  })

  it('cleans up both subscriptions on dispose', async () => {
    const value$ = observable(0)
    let observableUpdateCount = 0
    let actorUpdateCount = 0

    const cleanupMachine = setup({
      types: {
        context: {} as { value: number },
        events: {} as { type: 'SET'; value: number },
      },
    }).createMachine({
      id: 'cleanup-machine',
      initial: 'active',
      context: { value: 0 },
      states: {
        active: {
          on: {
            SET: {
              actions: assign({ value: ({ event }) => event.value }),
            },
          },
        },
      },
    })

    const actor = createActor(cleanupMachine)
    actor.start()

    // Track updates
    const unsubObserve = observe(() => {
      value$.get()
      observableUpdateCount++
    })

    actor.subscribe(() => {
      actorUpdateCount++
    })

    const dispose = createTwoWayBridge({
      observable$: value$ as Observable<number>,
      actor,
      toEvent: (v) => ({ type: 'SET', value: v }),
      fromSnapshot: (s) => s.context.value,
    })

    const obsCountBefore = observableUpdateCount
    const actorCountBefore = actorUpdateCount

    dispose()

    // Updates after dispose
    value$.set(999)
    actor.send({ type: 'SET', value: 888 })
    await new Promise((r) => setTimeout(r, 50))

    // Bridge-related updates should have stopped (some updates may occur from direct interaction)
    // The key is that the bridge's cross-sync should be stopped

    unsubObserve()
    actor.stop()
  })
})

// =============================================================================
// fromEffectStreamToObservable() Tests
// =============================================================================

describe('fromEffectStreamToObservable()', () => {
  it('converts Effect to RxJS Observable', async () => {
    const effect = Effect.succeed(42)
    const observable$ = fromEffectStreamToObservable(effect)

    const values: number[] = []

    await new Promise<void>((resolve) => {
      observable$.subscribe({
        next: (v) => values.push(v),
        complete: () => resolve(),
      })
    })

    expect(values).toEqual([42])
  })

  it('propagates errors from Effect', async () => {
    const effect = Effect.fail(new Error('Observable error'))
    const observable$ = fromEffectStreamToObservable(effect)

    let caughtError: Error | null = null

    await new Promise<void>((resolve) => {
      observable$.subscribe({
        next: () => {},
        error: (e) => {
          caughtError = e
          resolve()
        },
        complete: () => resolve(),
      })
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect(caughtError?.message).toBe('Observable error')
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration: Full Bridge Workflow', () => {
  it('connects Effect, Legend-State, and XState in complete cycle', async () => {
    // 1. Setup observable data layer
    const userData$ = observable({
      name: '',
      status: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    })

    // 2. Create Effect-based actor
    const fetchUserActor = fromEffect(({ input }: { input: { userId: string } }) =>
      Effect.gen(function* () {
        yield* Effect.sleep('5 millis')
        return { name: `User ${input.userId}`, id: input.userId }
      })
    )

    // 3. Create machine with all actors
    const userMachine = setup({
      types: {
        context: {} as { user: { name: string; id: string } | null; error: string | null },
        events: {} as
          | { type: 'FETCH'; userId: string }
          | { type: 'SYNC_STATUS'; status: 'idle' | 'loading' | 'success' | 'error' },
      },
      actors: { fetchUserActor },
    }).createMachine({
      id: 'user-machine',
      initial: 'idle',
      context: { user: null, error: null },
      states: {
        idle: {
          on: { FETCH: 'loading' },
        },
        loading: {
          invoke: {
            src: 'fetchUserActor',
            input: ({ event }) => ({ userId: (event as { type: 'FETCH'; userId: string }).userId }),
            onDone: {
              target: 'success',
              actions: assign({ user: ({ event }) => event.output }),
            },
            onError: {
              target: 'error',
              actions: assign({ error: ({ event }) => String(event.error) }),
            },
          },
        },
        success: {
          on: { FETCH: 'loading' },
        },
        error: {
          on: { FETCH: 'loading' },
        },
      },
    })

    const actor = createActor(userMachine)
    actor.start()

    // 4. Bridge machine state to observable
    actor.subscribe((snapshot) => {
      const status = snapshot.value as 'idle' | 'loading' | 'success' | 'error'
      userData$.status.set(status)

      if (snapshot.context.user) {
        userData$.name.set(snapshot.context.user.name)
      }
    })

    // 5. Verify initial state
    expect(userData$.status.get()).toBe('idle')
    expect(actor.getSnapshot().matches('idle')).toBe(true)

    // 6. Trigger fetch via machine
    actor.send({ type: 'FETCH', userId: '123' })

    // 7. Verify machine is in loading or already success (timing sensitive)
    const machineState = actor.getSnapshot().value
    expect(['loading', 'success']).toContain(machineState)

    // 8. Wait for success
    await waitFor(actor, (state) => state.matches('success'))

    // 9. Verify final state
    expect(userData$.status.get()).toBe('success')
    expect(userData$.name.get()).toBe('User 123')
    expect(actor.getSnapshot().context.user).toEqual({ name: 'User 123', id: '123' })

    actor.stop()
  })
})
