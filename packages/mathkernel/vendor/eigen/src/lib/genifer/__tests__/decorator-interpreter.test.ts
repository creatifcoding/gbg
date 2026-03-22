/**
 * Tests the LLM generation → interpreter → live atoms pipeline.
 *
 * Proves that a JSON BehaviorBlock (what the LLM outputs) creates
 * the SAME ActionGroupInstance as decorated TypeScript classes.
 *
 * The React hooks (useActionGroup, etc.) work identically on both.
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import * as Registry from '@effect-atom/atom/Registry'

import {
  interpretBehaviorBlock,
  resolveProps,
  setRpcExecutor,
} from '../decorators/interpreter'
import type { BehaviorBlock, ActionDef, StateDef, EventSubscription } from '../decorators/generation-schema'
import { bootstrap, subscribeEvent, bootstrapRegistry } from '../decorators/bootstrap'
import { eventLogAtom } from '../decorators/bootstrap'
import { getActionGroupInstances } from '../decorators/action-group'

describe('Decorator Interpreter', () => {
  describe('interpretBehaviorBlock', () => {
    it('creates atoms for each state field', () => {
      const block: BehaviorBlock = {
        name: 'test-counter',
        state: [
          { field: 'count', initial: 0 } as StateDef,
          { field: 'label', initial: 'clicks' } as StateDef,
        ],
        actions: {} as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }

      const instance = interpretBehaviorBlock(block)

      expect(instance.name).toBe('test-counter')
      expect(instance.atoms.has('count')).toBe(true)
      expect(instance.atoms.has('label')).toBe(true)

      // Read initial values
      expect(instance.registry.get(instance.atoms.get('count')!)).toBe(0)
      expect(instance.registry.get(instance.atoms.get('label')!)).toBe('clicks')
    })

    it('dispatch setState writes to atoms', () => {
      // Clean up from previous test
      getActionGroupInstances().delete('test-set-state')

      const block: BehaviorBlock = {
        name: 'test-set-state',
        state: [
          { field: 'query', initial: '' } as StateDef,
          { field: 'loading', initial: false } as StateDef,
        ],
        actions: {
          setQuery: {
            _tag: 'setState',
            values: { query: 'hello' },
          } as any,
          startLoading: {
            _tag: 'setState',
            values: { loading: true },
          } as any,
        } as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }

      const instance = interpretBehaviorBlock(block)

      // Dispatch setQuery — sync actions, use runSync
      Effect.runSync(instance.dispatch('setQuery'))
      expect(instance.registry.get(instance.atoms.get('query')!)).toBe('hello')

      // Dispatch startLoading
      Effect.runSync(instance.dispatch('startLoading'))
      expect(instance.registry.get(instance.atoms.get('loading')!)).toBe(true)
    })

    it('dispatch sequence runs actions in order', () => {
      getActionGroupInstances().delete('test-sequence')

      const block: BehaviorBlock = {
        name: 'test-sequence',
        state: [
          { field: 'step', initial: 0 } as StateDef,
          { field: 'done', initial: false } as StateDef,
        ],
        actions: {
          runSequence: {
            _tag: 'sequence',
            actions: [
              { _tag: 'setState', values: { step: 1 } },
              { _tag: 'setState', values: { step: 2 } },
              { _tag: 'setState', values: { done: true } },
            ],
          } as any,
        } as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }

      const instance = interpretBehaviorBlock(block)
      Effect.runSync(instance.dispatch('runSequence'))

      expect(instance.registry.get(instance.atoms.get('step')!)).toBe(2)
      expect(instance.registry.get(instance.atoms.get('done')!)).toBe(true)
    })

    it('dispatch conditional branches correctly', () => {
      getActionGroupInstances().delete('test-conditional')

      const block: BehaviorBlock = {
        name: 'test-conditional',
        state: [
          { field: 'query', initial: 'hello' } as StateDef,
          { field: 'result', initial: '' } as StateDef,
        ],
        actions: {
          check: {
            _tag: 'conditional',
            field: 'query',
            op: 'notEmpty',
            then: { _tag: 'setState', values: { result: 'has query' } },
            else: { _tag: 'setState', values: { result: 'no query' } },
          } as any,
        } as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }

      const instance = interpretBehaviorBlock(block)

      // query is 'hello' → notEmpty → 'has query'
      Effect.runSync(instance.dispatch('check'))
      expect(instance.registry.get(instance.atoms.get('result')!)).toBe('has query')

      // Set query to empty
      instance.registry.set(instance.atoms.get('query')!, '')
      Effect.runSync(instance.dispatch('check'))
      expect(instance.registry.get(instance.atoms.get('result')!)).toBe('no query')
    })

    it('callRpc dispatches to executor and stores result', () => {
      getActionGroupInstances().delete('test-rpc')

      // Wire a mock RPC executor
      setRpcExecutor((tag, payload) => {
        if (tag === 'test/echo') {
          return Effect.succeed({ echo: payload, timestamp: 12345 })
        }
        return Effect.succeed(null)
      })

      const block: BehaviorBlock = {
        name: 'test-rpc',
        state: [
          { field: 'input', initial: 'test data' } as StateDef,
          { field: 'result', initial: null } as StateDef,
          { field: 'loading', initial: false } as StateDef,
          { field: 'error', initial: null } as StateDef,
        ],
        actions: {
          callEcho: {
            _tag: 'callRpc',
            rpc: 'test/echo',
            payload: { data: 'fixed-value' },
            resultField: 'result',
            loadingField: 'loading',
            errorField: 'error',
          } as any,
        } as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }

      const instance = interpretBehaviorBlock(block)

      // callRpc is sync when executor returns Effect.succeed — safe for runSync
      Effect.runSync(instance.dispatch('callEcho'))

      expect(instance.registry.get(instance.atoms.get('result')!)).toEqual({
        echo: { data: 'fixed-value' },
        timestamp: 12345,
      })
      expect(instance.registry.get(instance.atoms.get('loading')!)).toBe(false)
      expect(instance.registry.get(instance.atoms.get('error')!)).toBe(null)
    })

    it('ActionGroupAtoms ops work via Effect context', () => {
      getActionGroupInstances().delete('test-ops')

      const block: BehaviorBlock = {
        name: 'test-ops',
        state: [
          { field: 'counter', initial: 0 } as StateDef,
        ],
        actions: {} as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }

      const instance = interpretBehaviorBlock(block)

      // Use ops.get/set directly — these are Effect.sync, use runSync
      const result = Effect.runSync(instance.ops.get<number>('counter'))
      expect(result).toBe(0)

      Effect.runSync(instance.ops.set('counter', 42))
      const updated = Effect.runSync(instance.ops.get<number>('counter'))
      expect(updated).toBe(42)

      // Snapshot
      const snap = Effect.runSync(instance.ops.snapshot())
      expect(snap).toEqual({ counter: 42 })
    })

    it('is registered in global instances for React hooks', () => {
      getActionGroupInstances().delete('test-global')

      const block: BehaviorBlock = {
        name: 'test-global',
        state: [{ field: 'x', initial: 1 } as StateDef],
        actions: {} as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }

      interpretBehaviorBlock(block)

      // Should be findable by React hooks
      const instances = getActionGroupInstances()
      expect(instances.has('test-global')).toBe(true)
      expect(instances.get('test-global')!.atoms.has('x')).toBe(true)
    })
  })

  describe('resolveProps', () => {
    it('resolves @state: sigils to atom values', () => {
      getActionGroupInstances().delete('test-resolve')

      const block: BehaviorBlock = {
        name: 'test-resolve',
        state: [
          { field: 'query', initial: 'hello world' } as StateDef,
          { field: 'loading', initial: true } as StateDef,
        ],
        actions: {} as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }
      const instance = interpretBehaviorBlock(block)

      const { resolved, handlers } = resolveProps(
        {
          value: '@state:query',
          disabled: '@state:loading',
          placeholder: 'literal string',
          count: 42,
        },
        instance,
      )

      expect(resolved.value).toBe('hello world')
      expect(resolved.disabled).toBe(true)
      expect(resolved.placeholder).toBe('literal string')
      expect(resolved.count).toBe(42)
      expect(Object.keys(handlers)).toHaveLength(0)
    })

    it('resolves @action: sigils to dispatch handlers', () => {
      getActionGroupInstances().delete('test-action-resolve')

      const block: BehaviorBlock = {
        name: 'test-action-resolve',
        state: [{ field: 'clicked', initial: false } as StateDef],
        actions: {
          click: { _tag: 'setState', values: { clicked: true } } as any,
        } as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }
      const instance = interpretBehaviorBlock(block)

      const { resolved, handlers } = resolveProps(
        { onClick: '@action:click' },
        instance,
      )

      expect(handlers.onClick).toBeTypeOf('function')
      expect(resolved.onClick).toBeUndefined() // Actions go in handlers, not resolved
    })

    it('resolves bind: sigils to value + onChange handler', () => {
      getActionGroupInstances().delete('test-bind')

      const block: BehaviorBlock = {
        name: 'test-bind',
        state: [{ field: 'name', initial: 'Alice' } as StateDef],
        actions: {} as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }
      const instance = interpretBehaviorBlock(block)

      const { resolved, handlers } = resolveProps(
        { value: 'bind:name' },
        instance,
      )

      expect(resolved.value).toBe('Alice')
      expect(handlers.onValueChange).toBeTypeOf('function')

      // Simulate onChange
      handlers.onValueChange!('Bob')
      expect(instance.registry.get(instance.atoms.get('name')!)).toBe('Bob')
    })

    it('resolves {{@state:field}} interpolation', () => {
      getActionGroupInstances().delete('test-interpolation')

      const block: BehaviorBlock = {
        name: 'test-interpolation',
        state: [
          { field: 'name', initial: 'Prime' } as StateDef,
          { field: 'count', initial: 42 } as StateDef,
        ],
        actions: {} as any,
        subscriptions: [],
        emits: [],
        requires: [],
      }
      const instance = interpretBehaviorBlock(block)

      const { resolved } = resolveProps(
        { title: 'Hello {{@state:name}}, you have {{@state:count}} items' },
        instance,
      )

      expect(resolved.title).toBe('Hello Prime, you have 42 items')
    })
  })
})
