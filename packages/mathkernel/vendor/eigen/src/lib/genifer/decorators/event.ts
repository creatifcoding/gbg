/**
 * @event decorator family
 *
 * Define custom event schemas as Schema.TaggedClass instances.
 * @emits and @subscribes wire methods to the event bus.
 *
 * Usage:
 *   @event('FlightSearched', { persistent: true })
 *   class FlightSearchedEvent extends Schema.TaggedClass<FlightSearchedEvent>()(
 *     'FlightSearchedEvent',
 *     {
 *       query: Schema.String,
 *       resultCount: Schema.Number,
 *       timestamp: Schema.Number,
 *     }
 *   ) {}
 *
 *   // On a service or ActionGroup:
 *   class FlightSearch {
 *     @emits('FlightSearched')
 *     async search(query: string) {
 *       const results = await fetchFlights(query)
 *       return { query, resultCount: results.length, timestamp: Date.now() }
 *     }
 *
 *     @subscribes('FlightSearched')
 *     onFlightSearched(event: FlightSearchedEvent) {
 *       console.log(`Searched: ${event.query} → ${event.resultCount} results`)
 *     }
 *   }
 *
 * @module genifer/decorators/event
 */

import 'reflect-metadata'
import {
  EventId,
  EmitsId,
  SubscribesId,
  type EventAnnotation,
} from './annotations'

// =============================================================================
// Registry
// =============================================================================

interface EventRegistration {
  readonly ctor: Function
  readonly meta: EventAnnotation
}

interface EmitterRegistration {
  readonly target: Function
  readonly method: string
  readonly eventTag: string
}

interface SubscriberRegistration {
  readonly target: Function
  readonly method: string
  readonly eventTag: string
}

const _eventRegistry = new Map<string, EventRegistration>()
const _emitters: EmitterRegistration[] = []
const _subscribers: SubscriberRegistration[] = []

export function getEventRegistry(): ReadonlyMap<string, EventRegistration> {
  return _eventRegistry
}

export function getEventMeta(target: Function): EventAnnotation | undefined {
  return Reflect.getMetadata(EventId, target)
}

// =============================================================================
// @event — Class Decorator
// =============================================================================

export interface EventOptions {
  /** Whether to persist events for replay/audit */
  readonly persistent?: boolean
  /** Human description */
  readonly description?: string
}

/**
 * @event — Register a Schema.TaggedClass as a custom event type.
 *
 * At bootstrap, registered events become available on the event bus.
 * DynamicEventService validates payloads against the Schema before emission.
 */
export function event(tag: string, options?: EventOptions) {
  return function <T extends Function>(constructor: T): T {
    const meta: EventAnnotation = {
      tag,
      persistent: options?.persistent ?? false,
    }

    Reflect.defineMetadata(EventId, meta, constructor)

    // Apply to Schema AST
    const ast = (constructor as any).ast
    if (ast) {
      const targetAst = ast.to ?? ast
      targetAst.annotations = {
        ...(targetAst.annotations ?? {}),
        [EventId]: meta,
      }
    }

    _eventRegistry.set(tag, { ctor: constructor, meta })

    return constructor
  }
}

// =============================================================================
// @emits — Method Decorator
// =============================================================================

/**
 * @emits — Mark a method as an event emitter.
 *
 * After the method executes, its return value is validated against
 * the registered event schema and emitted on the bus.
 *
 * The decorator wraps the original method:
 *   1. Call original method
 *   2. Validate return value against event schema
 *   3. Emit event on DynamicEventService
 *   4. Return original result
 *
 * ```ts
 * @emits('FlightSearched')
 * search(query: string) { return { query, resultCount: 42 } }
 * ```
 */
export function emits(eventTag: string): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const original = descriptor.value

    // Wrap the method to emit after execution
    descriptor.value = function (this: any, ...args: any[]) {
      const result = original.apply(this, args)

      // Handle async/Effect results
      if (result && typeof result.then === 'function') {
        return result.then((val: any) => {
          _emitDynamic(eventTag, val)
          return val
        })
      }

      _emitDynamic(eventTag, result)
      return result
    }

    // Track for introspection
    Reflect.defineMetadata(EmitsId, eventTag, target, propertyKey as string)
    _emitters.push({
      target: target.constructor,
      method: propertyKey as string,
      eventTag,
    })

    // Accumulate on class
    const existing: string[] = Reflect.getMetadata('genifer:emits_methods', target) ?? []
    Reflect.defineMetadata('genifer:emits_methods', [...existing, propertyKey as string], target)
  }
}

// Deferred emit — DynamicEventService injected at bootstrap
let _emitFn: ((tag: string, payload: unknown) => void) | null = null

/** @internal — Set by bootstrap to wire to DynamicEventService */
export function _setEmitFn(fn: (tag: string, payload: unknown) => void): void {
  _emitFn = fn
}

function _emitDynamic(tag: string, payload: unknown): void {
  if (_emitFn) {
    _emitFn(tag, payload)
  }
}

// =============================================================================
// @subscribes — Method Decorator
// =============================================================================

/**
 * @subscribes — Mark a method as an event subscriber.
 *
 * At bootstrap, the method is registered as a handler for the given event tag.
 * When the event fires, this method is called with the validated payload.
 *
 * ```ts
 * @subscribes('FlightSearched')
 * onFlightSearched(event: FlightSearchedEvent) {
 *   console.log(`Searched: ${event.query}`)
 * }
 * ```
 */
export function subscribes(eventTag: string): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    Reflect.defineMetadata(SubscribesId, eventTag, target, propertyKey as string)
    _subscribers.push({
      target: target.constructor,
      method: propertyKey as string,
      eventTag,
    })

    const existing: string[] = Reflect.getMetadata('genifer:subscribes_methods', target) ?? []
    Reflect.defineMetadata('genifer:subscribes_methods', [...existing, propertyKey as string], target)
  }
}
