/**
 * @validated / @schema — Runtime validation decorators
 *
 * Wraps method arguments with Schema.decodeUnknownSync before execution.
 * Turns schema violations into ParseErrors at method boundaries.
 *
 * Usage:
 *   class TreeService {
 *     @validated
 *     addElement(@schema(UIElement) element: UIElement) {
 *       // `element` is guaranteed to be a valid UIElement
 *       // ParseError thrown if validation fails
 *     }
 *   }
 *
 * Works with Effect methods too:
 *   @validated
 *   searchFlights(@schema(SearchPayload) payload: SearchPayload) {
 *     return Effect.gen(function*() { ... })
 *   }
 *
 * @module genifer/decorators/validated
 */

import 'reflect-metadata'
import { Schema } from 'effect'
import { ValidatedId } from './annotations'

// =============================================================================
// @schema — Parameter Decorator (marks a parameter for validation)
// =============================================================================

/**
 * @schema — Mark a method parameter for Schema validation.
 *
 * Stores the Schema on the method's parameter metadata.
 * @validated reads this metadata and wraps the method.
 *
 * ```ts
 * @validated
 * addElement(@schema(UIElement) element: UIElement) { ... }
 * ```
 */
export function schema(schemaType: Schema.Schema<any, any, never>): ParameterDecorator {
  return function (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number): void {
    if (!propertyKey) return // Skip constructor parameters

    const existing: Map<number, Schema.Schema<any, any, never>> =
      Reflect.getMetadata('genifer:schema_params', target, propertyKey as string) ?? new Map()
    existing.set(parameterIndex, schemaType)
    Reflect.defineMetadata('genifer:schema_params', existing, target, propertyKey as string)
  }
}

// =============================================================================
// @validated — Method Decorator (validates all @schema parameters)
// =============================================================================

/**
 * @validated — Validate method arguments against @schema annotations.
 *
 * Reads parameter schemas from @schema decorators and applies
 * Schema.decodeUnknownSync to each marked argument before calling
 * the original method.
 *
 * If validation fails, throws a ParseError with full path information.
 *
 * ```ts
 * @validated
 * updateTree(
 *   @schema(TreeId) treeId: string,
 *   @schema(UIElement) element: UIElement,
 * ) {
 *   // Both arguments validated before reaching here
 * }
 * ```
 */
export function validated(
  target: Object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  const original = descriptor.value
  if (typeof original !== 'function') return

  Reflect.defineMetadata(ValidatedId, true, target, propertyKey as string)

  descriptor.value = function (this: any, ...args: any[]) {
    const schemaParams: Map<number, Schema.Schema<any, any, never>> | undefined =
      Reflect.getMetadata('genifer:schema_params', target, propertyKey as string)

    if (schemaParams && schemaParams.size > 0) {
      const validatedArgs = [...args]
      for (const [index, paramSchema] of Array.from(schemaParams.entries())) {
        if (index < validatedArgs.length) {
          // Validate and decode — throws ParseError on failure
          validatedArgs[index] = Schema.decodeUnknownSync(paramSchema)(validatedArgs[index])
        }
      }
      return original.apply(this, validatedArgs)
    }

    return original.apply(this, args)
  }
}
