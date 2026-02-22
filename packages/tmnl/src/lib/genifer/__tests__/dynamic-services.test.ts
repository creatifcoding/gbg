/**
 * Tests for DynamicRpcService + DynamicEventService
 *
 * Both services use @effect/rpc for the management API
 * and Atom-as-State for reactive state.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Effect } from 'effect'
import { Registry } from '@effect-atom/atom'
import * as Atom from '@effect-atom/atom/Atom'

import {
  RpcDefinition,
  DynamicRpcNotFound,
  DynamicRpcHandlerError,
} from '../services/DynamicRpcSchemas'
import {
  rpcRegistryAtom,
  registerCustomRpcHandler,
  unregisterCustomRpcHandler,
  setDynamicRpcRegistry,
  callDynamicRpc,
  DynamicRpcHandlersLive,
} from '../services/DynamicRpcService'

import {
  EventDefinition,
  EventNotDefinedError,
  DynamicEventPayload,
} from '../services/DynamicEventSchemas'
import {
  eventDefinitionsAtom,
  dynamicEventLogAtom,
  subscribeDynamicEvent,
  subscribeAllDynamicEvents,
  setDynamicEventRegistry,
  emitDynamicEvent,
  getDynamicEventLog,
  DynamicEventHandlersLive,
} from '../services/DynamicEventService'

// =============================================================================
// DynamicRpcService Tests
// =============================================================================

describe('DynamicRpcService', () => {
  let registry: Registry.Registry

  beforeEach(() => {
    registry = Registry.make()
    setDynamicRpcRegistry(registry)
    // Reset atom state
    registry.set(rpcRegistryAtom, new Map())
  })

  describe('registration', () => {
    it('registers an RPC with custom handler', () => {
      const def = new RpcDefinition({
        tag: 'test/Echo',
        description: 'Echoes input',
        handler: { _tag: 'custom', handlerId: 'echo' },
        source: 'dynamic',
      })

      // Direct atom mutation (simulates what the RPC handler does)
      const current = registry.get(rpcRegistryAtom)
      const next = new Map(current)
      next.set(def.tag, { ...def, registeredAt: Date.now() } as RpcDefinition)
      registry.set(rpcRegistryAtom, next)

      const rpcs = registry.get(rpcRegistryAtom)
      expect(rpcs.size).toBe(1)
      expect(rpcs.has('test/Echo')).toBe(true)
    })

    it('registers multiple RPCs', () => {
      const defs = [
        new RpcDefinition({ tag: 'rpc/A', handler: { _tag: 'custom', handlerId: 'a' } }),
        new RpcDefinition({ tag: 'rpc/B', handler: { _tag: 'http', url: 'https://example.com' } }),
        new RpcDefinition({ tag: 'rpc/C', handler: { _tag: 'custom', handlerId: 'c' } }),
      ]

      const next = new Map<string, RpcDefinition>()
      for (const def of defs) next.set(def.tag, def)
      registry.set(rpcRegistryAtom, next)

      expect(registry.get(rpcRegistryAtom).size).toBe(3)
    })

    it('unregisters an RPC', () => {
      const next = new Map<string, RpcDefinition>()
      next.set('rpc/X', new RpcDefinition({ tag: 'rpc/X', handler: { _tag: 'custom', handlerId: 'x' } }))
      registry.set(rpcRegistryAtom, next)

      const after = new Map(registry.get(rpcRegistryAtom))
      after.delete('rpc/X')
      registry.set(rpcRegistryAtom, after)

      expect(registry.get(rpcRegistryAtom).size).toBe(0)
    })
  })

  describe('callDynamicRpc — custom handler dispatch', () => {
    it('calls a registered custom handler', async () => {
      // Register custom handler
      registerCustomRpcHandler('echo', async (payload) => ({ echo: payload }))

      // Register RPC definition
      const next = new Map<string, RpcDefinition>()
      next.set('test/Echo', new RpcDefinition({
        tag: 'test/Echo',
        handler: { _tag: 'custom', handlerId: 'echo' },
      }))
      registry.set(rpcRegistryAtom, next)

      // Call it
      const result = await Effect.runPromise(callDynamicRpc('test/Echo', { msg: 'hello' }))
      expect(result).toEqual({ echo: { msg: 'hello' } })

      // Cleanup
      unregisterCustomRpcHandler('echo')
    })

    it('fails on unknown RPC tag', async () => {
      const result = await Effect.runPromise(
        callDynamicRpc('nonexistent/Rpc', {}).pipe(
          Effect.catchAll((e) => Effect.succeed({ error: e._tag, tag: (e as any).tag })),
        ),
      )
      expect(result).toEqual({ error: 'DynamicRpcNotFound', tag: 'nonexistent/Rpc' })
    })

    it('fails when custom handler ID not registered', async () => {
      const next = new Map<string, RpcDefinition>()
      next.set('test/Missing', new RpcDefinition({
        tag: 'test/Missing',
        handler: { _tag: 'custom', handlerId: 'nonexistent' },
      }))
      registry.set(rpcRegistryAtom, next)

      const result = await Effect.runPromise(
        callDynamicRpc('test/Missing', {}).pipe(
          Effect.catchAll((e) => Effect.succeed({ error: e._tag })),
        ),
      )
      expect(result).toEqual({ error: 'DynamicRpcHandlerError' })
    })

    it('catches handler errors gracefully', async () => {
      registerCustomRpcHandler('boom', async () => { throw new Error('kaboom') })

      const next = new Map<string, RpcDefinition>()
      next.set('test/Boom', new RpcDefinition({
        tag: 'test/Boom',
        handler: { _tag: 'custom', handlerId: 'boom' },
      }))
      registry.set(rpcRegistryAtom, next)

      const result = await Effect.runPromise(
        callDynamicRpc('test/Boom', {}).pipe(
          Effect.catchAll((e) => Effect.succeed({
            error: e._tag,
            message: (e as DynamicRpcHandlerError).message,
          })),
        ),
      )
      expect(result).toMatchObject({ error: 'DynamicRpcHandlerError' })
      expect((result as any).message).toContain('kaboom')

      unregisterCustomRpcHandler('boom')
    })
  })

  describe('handler types', () => {
    it('rejects script handler (reserved for Tier 3)', async () => {
      const next = new Map<string, RpcDefinition>()
      next.set('test/Script', new RpcDefinition({
        tag: 'test/Script',
        handler: { _tag: 'script', code: 'console.log("hi")' },
      }))
      registry.set(rpcRegistryAtom, next)

      const result = await Effect.runPromise(
        callDynamicRpc('test/Script', {}).pipe(
          Effect.catchAll((e) => Effect.succeed({ error: e._tag })),
        ),
      )
      expect(result).toEqual({ error: 'DynamicRpcHandlerError' })
    })

    it('rejects llm handler (not yet implemented)', async () => {
      const next = new Map<string, RpcDefinition>()
      next.set('test/Llm', new RpcDefinition({
        tag: 'test/Llm',
        handler: { _tag: 'llm', promptTemplate: 'test' },
      }))
      registry.set(rpcRegistryAtom, next)

      const result = await Effect.runPromise(
        callDynamicRpc('test/Llm', {}).pipe(
          Effect.catchAll((e) => Effect.succeed({ error: e._tag })),
        ),
      )
      expect(result).toEqual({ error: 'DynamicRpcHandlerError' })
    })
  })
})

// =============================================================================
// DynamicEventService Tests
// =============================================================================

describe('DynamicEventService', () => {
  let registry: Registry.Registry

  beforeEach(() => {
    registry = Registry.make()
    setDynamicEventRegistry(registry)
    registry.set(eventDefinitionsAtom, new Map())
    registry.set(dynamicEventLogAtom, [])
  })

  describe('event definition', () => {
    it('defines a new event type', () => {
      const def = new EventDefinition({
        tag: 'FlightSearched',
        description: 'Emitted when a flight search is performed',
        source: 'dynamic',
      })

      const next = new Map<string, EventDefinition>()
      next.set(def.tag, { ...def, definedAt: Date.now() } as EventDefinition)
      registry.set(eventDefinitionsAtom, next)

      expect(registry.get(eventDefinitionsAtom).size).toBe(1)
      expect(registry.get(eventDefinitionsAtom).has('FlightSearched')).toBe(true)
    })

    it('lists all defined events', () => {
      const next = new Map<string, EventDefinition>()
      next.set('A', new EventDefinition({ tag: 'A' }))
      next.set('B', new EventDefinition({ tag: 'B' }))
      next.set('C', new EventDefinition({ tag: 'C' }))
      registry.set(eventDefinitionsAtom, next)

      const events = Array.from(registry.get(eventDefinitionsAtom).values())
      expect(events).toHaveLength(3)
      expect(events.map((e) => e.tag)).toEqual(['A', 'B', 'C'])
    })
  })

  describe('emitDynamicEvent', () => {
    it('emits an event and appends to log', async () => {
      // Define the event first
      const next = new Map<string, EventDefinition>()
      next.set('TestEvent', new EventDefinition({ tag: 'TestEvent' }))
      registry.set(eventDefinitionsAtom, next)

      const before = registry.get(eventDefinitionsAtom)

      // Emit
      Effect.runSync(emitDynamicEvent('TestEvent', { foo: 'bar' }, 'test'))

      const log = getDynamicEventLog()
      expect(log).toHaveLength(1)
      expect(log[0].eventTag).toBe('TestEvent')
      expect(log[0].payload).toEqual({ foo: 'bar' })
      expect(log[0].emittedBy).toBe('test')
      expect(log[0].timestamp).toBeGreaterThan(0)
    })

    it('fails on undefined event', async () => {
      const result = await Effect.runPromise(
        emitDynamicEvent('UnknownEvent', {}).pipe(
          Effect.catchAll((e) => Effect.succeed({ error: e._tag, tag: e.tag })),
        ),
      )
      expect(result).toEqual({ error: 'EventNotDefinedError', tag: 'UnknownEvent' })
    })

    it('notifies tag-specific subscribers', async () => {
      const next = new Map<string, EventDefinition>()
      next.set('Ping', new EventDefinition({ tag: 'Ping' }))
      registry.set(eventDefinitionsAtom, next)

      const received: unknown[] = []
      const unsub = subscribeDynamicEvent('Ping', (payload) => {
        received.push(payload)
      })

      Effect.runSync(emitDynamicEvent('Ping', { n: 1 }))
      Effect.runSync(emitDynamicEvent('Ping', { n: 2 }))

      expect(received).toEqual([{ n: 1 }, { n: 2 }])
      unsub()

      // After unsubscribe, no more notifications
      Effect.runSync(emitDynamicEvent('Ping', { n: 3 }))
      expect(received).toHaveLength(2)
    })

    it('notifies wildcard subscribers', async () => {
      const next = new Map<string, EventDefinition>()
      next.set('A', new EventDefinition({ tag: 'A' }))
      next.set('B', new EventDefinition({ tag: 'B' }))
      registry.set(eventDefinitionsAtom, next)

      const received: string[] = []
      const unsub = subscribeAllDynamicEvents((_payload, meta) => {
        received.push(meta.tag)
      })

      Effect.runSync(emitDynamicEvent('A', {}))
      Effect.runSync(emitDynamicEvent('B', {}))

      expect(received).toEqual(['A', 'B'])
      unsub()
    })

    it('subscriber errors do not propagate', async () => {
      const next = new Map<string, EventDefinition>()
      next.set('E', new EventDefinition({ tag: 'E' }))
      registry.set(eventDefinitionsAtom, next)

      const goodReceived: unknown[] = []

      subscribeDynamicEvent('E', () => { throw new Error('subscriber boom') })
      subscribeDynamicEvent('E', (payload) => { goodReceived.push(payload) })

      // Should not throw despite first subscriber throwing
      Effect.runSync(emitDynamicEvent('E', { ok: true }))
      expect(goodReceived).toEqual([{ ok: true }])
    })
  })

  describe('event log accumulation', () => {
    it('accumulates events in order', async () => {
      const next = new Map<string, EventDefinition>()
      next.set('Log', new EventDefinition({ tag: 'Log' }))
      registry.set(eventDefinitionsAtom, next)

      Effect.runSync(emitDynamicEvent('Log', { seq: 1 }))
      Effect.runSync(emitDynamicEvent('Log', { seq: 2 }))
      Effect.runSync(emitDynamicEvent('Log', { seq: 3 }))

      const log = getDynamicEventLog()
      expect(log).toHaveLength(3)
      expect(log.map((e) => (e.payload as any).seq)).toEqual([1, 2, 3])
    })
  })
})
