/**
 * Bootstrap — Wire all decorated classes into Effect services + atoms
 *
 * Called once at app startup. Walks every registry, creates atoms,
 * registers with CatalogService, DynamicRpcService, DynamicEventService,
 * and wires tool definitions into the harness.
 *
 * This is the bridge: decorators collect metadata at import time,
 * bootstrap converts it into live, atom-connected, Effect-serviced reality.
 *
 * @module genifer/decorators/bootstrap
 */

import { Effect, Layer, Context } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'

import { getComponentRegistry } from './component'
import { getActionGroupRegistry, hydrate as hydrateActionGroup, type ActionGroupInstance } from './action-group'
import { getRpcRegistry } from './rpc'
import { getEventRegistry, _setEmitFn } from './event'
import { getToolRegistry } from './tool'
import {
  ComponentId,
  DomainId,
  TierId,
  ActionGroupId,
  RpcId,
  EventId,
  ToolId,
} from './annotations'

// =============================================================================
// Bootstrap Result — everything that was wired up
// =============================================================================

export interface BootstrapResult {
  /** All hydrated ActionGroup instances (live atoms, dispatch methods) */
  readonly actionGroups: ReadonlyMap<string, ActionGroupInstance>
  /** Component count registered to catalog */
  readonly componentCount: number
  /** RPC count registered dynamically */
  readonly rpcCount: number
  /** Event count registered */
  readonly eventCount: number
  /** Tool count registered */
  readonly toolCount: number
}

/** Writable atom holding the bootstrap result — React can subscribe to this */
export const bootstrapResultAtom = Atom.make<BootstrapResult | null>(null)

/** Atom holding all live ActionGroup instances — keyed by name */
export const actionGroupsAtom = Atom.make<ReadonlyMap<string, ActionGroupInstance>>(new Map())

/** Atom holding registered event tags for subscription */
export const registeredEventsAtom = Atom.make<ReadonlySet<string>>(new Set<string>())

/** Atom holding registered RPC tags */
export const registeredRpcsAtom = Atom.make<ReadonlySet<string>>(new Set<string>())

/** Atom holding registered tool names */
export const registeredToolsAtom = Atom.make<ReadonlySet<string>>(new Set<string>())

// =============================================================================
// Event Bus — simple atom-based pub/sub
// =============================================================================

interface EventBusEntry {
  readonly tag: string
  readonly payload: unknown
  readonly timestamp: number
}

/** Event log — append-only atom of emitted events */
export const eventLogAtom = Atom.make<readonly EventBusEntry[]>([])

/** Subscribers — keyed by event tag */
const _subscribers = new Map<string, Array<(payload: unknown) => void>>()

function emitEvent(tag: string, payload: unknown): void {
  // Append to log via registry
  const r = bootstrapRegistry
  const current = r.get(eventLogAtom)
  r.set(eventLogAtom, [...current, { tag, payload, timestamp: Date.now() }])

  // Notify subscribers
  const subs = _subscribers.get(tag)
  if (subs) {
    for (const fn of subs) {
      try { fn(payload) } catch { /* subscriber errors don't propagate */ }
    }
  }
}

export function subscribeEvent(tag: string, fn: (payload: unknown) => void): () => void {
  if (!_subscribers.has(tag)) _subscribers.set(tag, [])
  _subscribers.get(tag)!.push(fn)
  return () => {
    const subs = _subscribers.get(tag)
    if (subs) {
      const idx = subs.indexOf(fn)
      if (idx >= 0) subs.splice(idx, 1)
    }
  }
}

// =============================================================================
// bootstrap() — The main entry point
// =============================================================================

/**
 * Bootstrap all decorated genifer classes into the live system.
 *
 * Call this ONCE at app startup, after all decorated modules have been imported.
 *
 * ```ts
 * import { bootstrap } from '@/lib/genifer/decorators'
 * import './my-components'  // Side-effect imports that register decorators
 * import './my-action-groups'
 * import './my-rpcs'
 *
 * const result = bootstrap()
 * console.log(`Bootstrapped: ${result.componentCount} components, ${result.actionGroups.size} action groups`)
 * ```
 */
/** Global registry for bootstrap atoms — React Provider wraps with this */
export const bootstrapRegistry = Registry.make()

export function bootstrap(): BootstrapResult {
  const r = bootstrapRegistry

  // --- 1. Wire event emitter for @emits decorator ---
  _setEmitFn(emitEvent)

  // --- 2. Hydrate all ActionGroups (creates atoms) ---
  const actionGroupReg = getActionGroupRegistry()
  const actionGroups = new Map<string, ActionGroupInstance>()
  for (const [name] of Array.from(actionGroupReg.entries())) {
    const instance = hydrateActionGroup(name)
    if (instance) {
      actionGroups.set(name, instance)
    }
  }
  r.set(actionGroupsAtom, actionGroups)

  // --- 3. Register components ---
  const componentReg = getComponentRegistry()
  const componentCount = componentReg.size

  // --- 4. Register RPCs ---
  const rpcReg = getRpcRegistry()
  const rpcTags = new Set<string>()
  for (const [tag] of Array.from(rpcReg.entries())) {
    rpcTags.add(tag)
  }
  r.set(registeredRpcsAtom, rpcTags)

  // --- 5. Register events ---
  const eventReg = getEventRegistry()
  const eventTags = new Set<string>()
  for (const [tag] of Array.from(eventReg.entries())) {
    eventTags.add(tag)
  }
  r.set(registeredEventsAtom, eventTags)

  // --- 6. Wire @subscribes methods ---
  for (const [, instance] of Array.from(actionGroups.entries())) {
    const proto = instance.ctor.prototype
    const subMethods: string[] = Reflect.getMetadata('genifer:subscribes_methods', proto) ?? []
    for (const method of subMethods) {
      const eventTag: string | undefined = Reflect.getMetadata('genifer:subscribes_event', proto, method)
      if (eventTag && typeof proto[method] === 'function') {
        subscribeEvent(eventTag, (payload) => {
          proto[method].call(undefined, payload)
        })
      }
    }
  }

  // --- 7. Register tools ---
  const toolReg = getToolRegistry()
  const toolNames = new Set<string>()
  for (const [toolName] of Array.from(toolReg.entries())) {
    toolNames.add(toolName)
  }
  r.set(registeredToolsAtom, toolNames)

  // --- 8. Build result ---
  const result: BootstrapResult = {
    actionGroups,
    componentCount,
    rpcCount: rpcTags.size,
    eventCount: eventTags.size,
    toolCount: toolNames.size,
  }

  r.set(bootstrapResultAtom as Atom.Writable<BootstrapResult | null, BootstrapResult | null>, result)

  return result
}
