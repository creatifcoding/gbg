/**
 * @tool decorator family
 *
 * Define ToolDefinitions as Schema.Class instances.
 * Fields = parameters. @result marks the output type. execute() is the handler.
 *
 * Usage:
 *   @tool({
 *     name: 'search_opensky',
 *     label: 'Search OpenSky',
 *     description: 'Search real-time flight data from OpenSky Network',
 *     rendererStyle: 'table',
 *   })
 *   class SearchOpenskyTool extends Schema.Class<SearchOpenskyTool>('SearchOpenskyTool')({
 *     query: Schema.String.annotations({ description: 'Flight callsign or area' }),
 *     limit: Schema.optionalWith(Schema.Number, { default: () => 10 }),
 *   }) {
 *     @result()
 *     static readonly Result = Schema.Array(FlightSchema)
 *
 *     execute() {
 *       return Effect.gen(function*(this: SearchOpenskyTool) {
 *         const http = yield* HttpClient.HttpClient
 *         // this.query, this.limit are typed from Schema.Class fields
 *         ...
 *       })
 *     }
 *   }
 *
 * @module genifer/decorators/tool
 */

import 'reflect-metadata'
import {
  ToolId,
  type ToolAnnotation,
} from './annotations'

// =============================================================================
// Registry
// =============================================================================

interface ToolRegistration {
  readonly ctor: Function
  readonly meta: ToolAnnotation
  readonly resultSchema?: unknown
  readonly executeMethod?: string
}

const _registry = new Map<string, ToolRegistration>()

export function getToolRegistry(): ReadonlyMap<string, ToolRegistration> {
  return _registry
}

export function getToolMeta(target: Function): ToolAnnotation | undefined {
  return Reflect.getMetadata(ToolId, target)
}

// =============================================================================
// @tool — Class Decorator
// =============================================================================

/**
 * @tool — Register a Schema.Class as a ToolDefinition.
 *
 * Class fields become tool parameters (TypeBox generated from Schema at bootstrap).
 * The execute() method is the handler.
 * Optionally auto-registers a ToolCallView renderer.
 *
 * At bootstrap:
 *   1. Schema.Class fields → TypeBox parameter schema
 *   2. execute() → ToolDefinition.execute bridge
 *   3. rendererStyle → registerToolRenderer() call
 *   4. Available to LLM in subsequent turns
 */
export function tool(meta: ToolAnnotation) {
  return function <T extends Function>(constructor: T): T {
    Reflect.defineMetadata(ToolId, meta, constructor)

    // Apply to Schema AST
    const ast = (constructor as any).ast
    if (ast) {
      const targetAst = ast.to ?? ast
      targetAst.annotations = {
        ...(targetAst.annotations ?? {}),
        [ToolId]: meta,
      }
    }

    // Check for execute method
    const proto = constructor.prototype
    const hasExecute = typeof proto.execute === 'function'

    // Check for result schema
    const resultField: string | undefined = Reflect.getMetadata('genifer:result_field', constructor)
    const resultSchema = resultField ? (constructor as any)[resultField] : undefined

    _registry.set(meta.name, {
      ctor: constructor,
      meta,
      resultSchema,
      executeMethod: hasExecute ? 'execute' : undefined,
    })

    return constructor
  }
}

// =============================================================================
// @param — Property Decorator (adds description/validation to a field)
// =============================================================================

/**
 * @param — Annotate a Schema.Class field with parameter metadata.
 *
 * Since Schema.Class fields ARE the parameters, this adds extra
 * context like description, examples, and constraints for the LLM.
 *
 * Note: You can also use Schema.annotations({ description: '...' }) inline.
 * @param is syntactic sugar for the decorator style.
 *
 * ```ts
 * @param({ description: 'Flight callsign to search', examples: ['DLH123'] })
 * declare query: string
 * ```
 */
export function param(meta: { description?: string; examples?: unknown[] }): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    const existing: Array<{ key: string; meta: typeof meta }> =
      Reflect.getMetadata('genifer:param_fields', target.constructor) ?? []
    Reflect.defineMetadata(
      'genifer:param_fields',
      [...existing, { key: propertyKey as string, meta }],
      target.constructor,
    )
  }
}

// =============================================================================
// @result — Property Decorator (marks static schema as result type)
// =============================================================================

/**
 * @result — Mark a static property as the tool's result schema.
 *
 * ```ts
 * @result()
 * static readonly Result = Schema.Array(FlightSchema)
 * ```
 */
export function result(): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    Reflect.defineMetadata('genifer:result_field', propertyKey as string, target)
    const value = (target as any)[propertyKey]
    if (value) {
      Reflect.defineMetadata('genifer:result_schema', value, target)
    }
  }
}
