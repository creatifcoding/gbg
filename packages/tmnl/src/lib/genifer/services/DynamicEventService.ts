/**
 * DynamicEventService — Runtime event definition, emission, and pub/sub.
 *
 * Implements the DynamicEventGroup handlers using @effect/rpc.
 *
 * Architecture:
 *   - Management API (define/emit/list/get/undefine) → @effect/rpc handlers
 *   - State → Atom<Map<string, EventDefinition>> (Atom-as-State pattern)
 *   - Event bus → Atom-based pub/sub (same pattern as bootstrap.ts eventLogAtom)
 *   - Subscribers → plain Map<tag, handler[]> for sync notification
 *
 * @module genifer/services/DynamicEventService
 */

import { Effect, Layer } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import { Registry } from '@effect-atom/atom'
import {
  DynamicEventGroup,
  EventNotDefinedError,
  DynamicEventPayload,
  type EventDefinition,
} from './DynamicEventSchemas'

// =============================================================================
// State Atoms (Atom-as-State — React subscribes directly)
// =============================================================================

/** All defined events, keyed by tag */
export const eventDefinitionsAtom = Atom.make<ReadonlyMap<string, EventDefinition>>(new Map())

/** Event log — append-only history of emitted events */
export const dynamicEventLogAtom = Atom.make<readonly DynamicEventPayload[]>([])

/** Get log via the service's own registry reference — avoids module duplication issues */
export function getDynamicEventLog(): readonly DynamicEventPayload[] {
  return reg().get(dynamicEventLogAtom)
}

/** Get definitions via the service's own registry reference */
export function getDynamicEventDefinitions(): ReadonlyMap<string, EventDefinition> {
  return reg().get(eventDefinitionsAtom)
}

/** Define an event via the service's own registry — avoids module duplication */
export function defineDynamicEvent(tag: string, def: EventDefinition): void {
  const r = reg()
  const current = new Map(r.get(eventDefinitionsAtom))
  current.set(tag, def)
  r.set(eventDefinitionsAtom, current)
}

/** Define multiple events at once */
export function defineDynamicEvents(defs: ReadonlyMap<string, EventDefinition>): void {
  const r = reg()
  const current = new Map(r.get(eventDefinitionsAtom))
  for (const [tag, def] of defs) {
    current.set(tag, def)
  }
  r.set(eventDefinitionsAtom, current)
}

// =============================================================================
// Subscriber Registry (in-process pub/sub)
// =============================================================================

type EventHandler = (payload: unknown, meta: { tag: string; emittedBy?: string }) => void
const _subscribers = new Map<string, EventHandler[]>()
const _wildcardSubscribers: EventHandler[] = []

/** Subscribe to a specific event tag. Returns unsubscribe function. */
export function subscribeDynamicEvent(
  tag: string,
  handler: EventHandler,
): () => void {
  if (!_subscribers.has(tag)) _subscribers.set(tag, [])
  _subscribers.get(tag)!.push(handler)
  return () => {
    const subs = _subscribers.get(tag)
    if (subs) {
      const idx = subs.indexOf(handler)
      if (idx >= 0) subs.splice(idx, 1)
    }
  }
}

/** Subscribe to ALL dynamic events. Returns unsubscribe function. */
export function subscribeAllDynamicEvents(handler: EventHandler): () => void {
  _wildcardSubscribers.push(handler)
  return () => {
    const idx = _wildcardSubscribers.indexOf(handler)
    if (idx >= 0) _wildcardSubscribers.splice(idx, 1)
  }
}

function notifySubscribers(tag: string, payload: unknown, emittedBy?: string): void {
  const meta = { tag, emittedBy }
  const subs = _subscribers.get(tag)
  if (subs) {
    for (const fn of subs) {
      try { fn(payload, meta) } catch { /* subscriber errors don't propagate */ }
    }
  }
  for (const fn of _wildcardSubscribers) {
    try { fn(payload, meta) } catch { /* subscriber errors don't propagate */ }
  }
}

// =============================================================================
// Registry Bridge (for Atom mutations — same pattern as bootstrap.ts)
// =============================================================================

let _registry: Registry.Registry | null = null

export function setDynamicEventRegistry(r: Registry.Registry): void {
  _registry = r
}

function reg(): Registry.Registry {
  if (!_registry) throw new Error('DynamicEventService registry not set — call setDynamicEventRegistry()')
  return _registry
}

// =============================================================================
// RPC Handlers Layer — @effect/rpc toLayer implementation
// =============================================================================

export const DynamicEventHandlersLive = DynamicEventGroup.toLayer({
  DefineEvent: ({ definition }) =>
    Effect.withSpan(
      Effect.sync(() => {
        const r = reg()
        const current = r.get(eventDefinitionsAtom)
        const next = new Map(current)
        next.set(definition.tag, {
          ...definition,
          definedAt: definition.definedAt ?? Date.now(),
        } as EventDefinition)
        r.set(eventDefinitionsAtom, next)
      }),
      'DynamicEvent.Define',
    ),

  EmitEvent: ({ tag, data, emittedBy }) =>
    Effect.withSpan(
      Effect.gen(function* () {
        const r = reg()
        const current = r.get(eventDefinitionsAtom)

        if (!current.has(tag)) {
          return yield* new EventNotDefinedError({
            tag,
            message: `Event '${tag}' not defined`,
          })
        }

        const entry = new DynamicEventPayload({
          eventTag: tag,
          payload: data,
          timestamp: Date.now(),
          emittedBy,
        })
        const log = r.get(dynamicEventLogAtom)
        r.set(dynamicEventLogAtom, [...log, entry])

        notifySubscribers(tag, data, emittedBy)
      }),
      'DynamicEvent.Emit',
    ),

  ListEvents: () =>
    Effect.sync(() => Array.from(reg().get(eventDefinitionsAtom).values())),

  GetEvent: ({ tag }) =>
    Effect.gen(function* () {
      const def = reg().get(eventDefinitionsAtom).get(tag)
      if (!def) {
        return yield* new EventNotDefinedError({
          tag,
          message: `Event '${tag}' not defined`,
        })
      }
      return def
    }),

  UndefineEvent: ({ tag }) =>
    Effect.withSpan(
      Effect.gen(function* () {
        const r = reg()
        const current = r.get(eventDefinitionsAtom)
        if (!current.has(tag)) {
          return yield* new EventNotDefinedError({
            tag,
            message: `Event '${tag}' not defined`,
          })
        }
        const next = new Map(current)
        next.delete(tag)
        r.set(eventDefinitionsAtom, next)
        _subscribers.delete(tag)
      }),
      'DynamicEvent.Undefine',
    ),
})

// =============================================================================
// Convenience: in-process emit (interpreter bridge)
// =============================================================================

/**
 * Direct in-process emit — bypasses RPC transport.
 * Used by the interpreter's emitEvent action handler.
 *
 * Uses Effect.sync (not Effect.gen) because all operations are synchronous
 * and Effect.runPromise with gen can cause stale atom reads.
 */
export function emitDynamicEvent(
  tag: string,
  payload: unknown,
  emittedBy?: string,
): Effect.Effect<void, EventNotDefinedError> {
  // Fully synchronous — runs in-place, no scheduling
  const r = reg()
  const current = r.get(eventDefinitionsAtom)

  if (!current.has(tag)) {
    return Effect.fail(new EventNotDefinedError({
      tag,
      message: `Event '${tag}' not defined`,
    }))
  }

  const entry = new DynamicEventPayload({
    eventTag: tag,
    payload,
    timestamp: Date.now(),
    emittedBy,
  })
  const log = r.get(dynamicEventLogAtom)
  r.set(dynamicEventLogAtom, [...log, entry])

  notifySubscribers(tag, payload, emittedBy)
  return Effect.void
}
