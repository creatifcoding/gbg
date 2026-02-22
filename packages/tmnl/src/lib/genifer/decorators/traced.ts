/**
 * @traced / @span — Observability decorators
 *
 * Wraps methods in Effect.withSpan for tracing. Works on any method
 * that returns an Effect — the decorator intercepts the return value
 * and wraps it. Non-Effect methods get annotated for manual span creation.
 *
 * Usage:
 *   class FlightService {
 *     @traced
 *     searchFlights(query: string) {
 *       return Effect.gen(function*() {
 *         yield* Effect.annotateCurrentSpan('query', query)
 *         ...
 *       })
 *     }
 *
 *     @span('flight-service.validate')
 *     validate(data: unknown) {
 *       return Effect.gen(function*() { ... })
 *     }
 *   }
 *
 * @module genifer/decorators/traced
 */

import 'reflect-metadata'
import { Effect } from 'effect'
import { SpanId } from './annotations'

// =============================================================================
// @traced — Method Decorator (auto-named span)
// =============================================================================

/**
 * @traced — Wrap a method's return Effect in Effect.withSpan.
 *
 * Span name = ClassName.methodName
 * If the method doesn't return an Effect, the decorator is a no-op passthrough.
 *
 * ```ts
 * @traced
 * searchFlights(query: string) {
 *   return Effect.gen(function*() { ... })
 * }
 * // → wrapped as Effect.withSpan('FlightService.searchFlights')
 * ```
 */
export function traced(
  target: Object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  const original = descriptor.value
  if (typeof original !== 'function') return

  const className = target.constructor.name
  const spanName = `${className}.${String(propertyKey)}`

  Reflect.defineMetadata(SpanId, spanName, target, propertyKey as string)

  descriptor.value = function (this: any, ...args: any[]) {
    const result = original.apply(this, args)

    // If the result is an Effect, wrap it
    if (result && Effect.isEffect(result)) {
      return Effect.withSpan(result, spanName)
    }

    return result
  }
}

// =============================================================================
// @span — Method Decorator (explicit span name)
// =============================================================================

/**
 * @span — Wrap a method's return Effect in Effect.withSpan with a custom name.
 *
 * ```ts
 * @span('genifer.compiler.enrichPrompt')
 * enrichPrompt(raw: string) {
 *   return Effect.gen(function*() { ... })
 * }
 * ```
 */
export function span(name: string): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const original = descriptor.value
    if (typeof original !== 'function') return

    Reflect.defineMetadata(SpanId, name, target, propertyKey as string)

    descriptor.value = function (this: any, ...args: any[]) {
      const result = original.apply(this, args)

      if (result && Effect.isEffect(result)) {
        return Effect.withSpan(result, name)
      }

      return result
    }
  }
}
