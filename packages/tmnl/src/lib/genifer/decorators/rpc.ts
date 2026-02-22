/**
 * @rpc decorator family
 *
 * Define dynamic RPCs as Schema.Class instances.
 * Payload schema = class fields. Handler = decorated method.
 * Auto-registers with DynamicRpcService at bootstrap.
 *
 * Usage:
 *   @rpc('opensky/SearchFlights', { description: 'Search real-time flight data' })
 *   class SearchFlights extends Schema.Class<SearchFlights>('SearchFlights')({
 *     query: Schema.optional(Schema.String),
 *     bbox: Schema.optional(BoundingBox),
 *   }) {
 *     @success()
 *     static readonly Result = Schema.Array(FlightSchema)
 *
 *     @error()
 *     static readonly Error = Schema.TaggedError('SearchFlightsError', { message: Schema.String })
 *
 *     @handler({ _tag: 'http', url: 'https://opensky-network.org/api/states/all', method: 'GET' })
 *     execute(payload: typeof SearchFlights.Type) {
 *       return Effect.gen(function*() {
 *         const http = yield* HttpClient.HttpClient
 *         const res = yield* http.get(...)
 *         return yield* res.json
 *       })
 *     }
 *   }
 *
 * @module genifer/decorators/rpc
 */

import 'reflect-metadata'
import {
  RpcId,
  HandlerId,
  type RpcAnnotation,
  type HandlerAnnotation,
} from './annotations'

// =============================================================================
// Registry
// =============================================================================

interface RpcRegistration {
  readonly ctor: Function
  readonly meta: RpcAnnotation
  readonly handlerMeta?: HandlerAnnotation
  readonly handlerMethod?: string
  readonly successSchema?: unknown
  readonly errorSchema?: unknown
}

const _registry = new Map<string, RpcRegistration>()

export function getRpcRegistry(): ReadonlyMap<string, RpcRegistration> {
  return _registry
}

export function getRpcMeta(target: Function): RpcAnnotation | undefined {
  return Reflect.getMetadata(RpcId, target)
}

// =============================================================================
// @rpc — Class Decorator
// =============================================================================

export interface RpcOptions {
  /** Human description for LLM context */
  readonly description?: string
  /** Whether this is a streaming RPC */
  readonly stream?: boolean
}

/**
 * @rpc — Register a Schema.Class as a dynamic RPC definition.
 *
 * Class fields become the payload schema. @handler method is the executor.
 * @success and @error mark static schemas for response types.
 *
 * At bootstrap, registered RPCs become callable via:
 *   - DynamicRpcService.call(tag, payload)
 *   - ActionGroup @action references: { type: 'callRpc', target: tag }
 *   - LLM tool calls (if also exposed via @tool)
 */
export function rpc(tag: string, options?: RpcOptions) {
  return function <T extends Function>(constructor: T): T {
    const meta: RpcAnnotation = {
      tag,
      description: options?.description,
      stream: options?.stream,
    }

    Reflect.defineMetadata(RpcId, meta, constructor)

    // Apply to Schema AST
    const ast = (constructor as any).ast
    if (ast) {
      const targetAst = ast.to ?? ast
      targetAst.annotations = {
        ...(targetAst.annotations ?? {}),
        [RpcId]: meta,
      }
    }

    // Collect handler method from prototype
    const proto = constructor.prototype
    const handlerMethod: string | undefined = Reflect.getMetadata('genifer:handler_method', proto)
    const handlerMeta: HandlerAnnotation | undefined = handlerMethod
      ? Reflect.getMetadata(HandlerId, proto, handlerMethod)
      : undefined

    // Collect success/error schemas from static fields
    const successSchema = Reflect.getMetadata('genifer:success_schema', constructor)
    const errorSchema = Reflect.getMetadata('genifer:error_schema', constructor)

    _registry.set(tag, {
      ctor: constructor,
      meta,
      handlerMeta,
      handlerMethod,
      successSchema,
      errorSchema,
    })

    return constructor
  }
}

// =============================================================================
// @handler — Method Decorator
// =============================================================================

/**
 * @handler — Mark a method as the RPC executor.
 *
 * The handler annotation describes HOW the RPC executes:
 *   - http: Bridge to external HTTP API
 *   - service: Delegate to an existing Effect service
 *   - llm: Ask the LLM to handle it (agentic)
 *   - script: Run a command
 *   - custom: The method body IS the handler (most common)
 *
 * ```ts
 * @handler({ _tag: 'custom' })
 * execute(payload: SearchFlightsPayload) {
 *   return Effect.gen(function*() { ... })
 * }
 * ```
 */
export function handler(meta: HandlerAnnotation): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    Reflect.defineMetadata(HandlerId, meta, target, propertyKey as string)
    Reflect.defineMetadata('genifer:handler_method', propertyKey as string, target)
  }
}

// =============================================================================
// @payload — Property Decorator (documentation — fields ARE the payload)
// =============================================================================

/**
 * @payload — Mark a property as part of the RPC payload.
 *
 * Since Schema.Class fields ARE the payload, this is primarily for
 * documentation and introspection. It adds description/validation metadata.
 */
export function payload(description?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    const existing: Array<{ key: string; description?: string }> =
      Reflect.getMetadata('genifer:payload_fields', target.constructor) ?? []
    Reflect.defineMetadata(
      'genifer:payload_fields',
      [...existing, { key: propertyKey as string, description }],
      target.constructor
    )
  }
}

// =============================================================================
// @success — Property Decorator (marks static schema as success type)
// =============================================================================

/**
 * @success — Mark a static property as the RPC success schema.
 *
 * ```ts
 * @success()
 * static readonly Result = Schema.Array(FlightSchema)
 * ```
 */
export function success(): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    // Defer reading the actual schema value — it may not be initialized yet
    // Store the property key, bootstrap reads the value
    Reflect.defineMetadata('genifer:success_field', propertyKey as string, target)
    // Also try to read immediately for eager registration
    const value = (target as any)[propertyKey]
    if (value) {
      Reflect.defineMetadata('genifer:success_schema', value, target)
    }
  }
}

// =============================================================================
// @error — Property Decorator (marks static schema as error type)
// =============================================================================

/**
 * @error — Mark a static property as the RPC error schema.
 *
 * ```ts
 * @error()
 * static readonly Error = Schema.TaggedError('SearchError', { message: Schema.String })
 * ```
 */
export function error(): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    Reflect.defineMetadata('genifer:error_field', propertyKey as string, target)
    const value = (target as any)[propertyKey]
    if (value) {
      Reflect.defineMetadata('genifer:error_schema', value, target)
    }
  }
}
