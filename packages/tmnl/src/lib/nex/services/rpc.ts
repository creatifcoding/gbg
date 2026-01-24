/**
 * RpcService
 *
 * Effect service for NEX RPC operations:
 * - Register request-reply handlers
 * - Make RPC calls with schema validation
 *
 * @module nex/services/rpc
 */

import { Effect, Stream, Schema } from 'effect'
import type { Msg } from 'nats.ws'
import { NatsInnerService } from '@/lib/holonet/nats/inner'
import { MessageDecoder } from '../decoder'
import { RpcError, RpcTimeoutError } from '../errors'
import { RpcRequest, RpcResponse } from '../schemas'

// =============================================================================
// Types
// =============================================================================

/** Handler registration result */
export interface RpcHandler {
  /** Subject this handler is registered on */
  readonly subject: string
  /** Stream of processed messages */
  readonly stream: Stream.Stream<void, Error>
}

// =============================================================================
// Service Implementation
// =============================================================================

export class RpcService extends Effect.Service<RpcService>()('nex/Rpc', {
  effect: Effect.gen(function* () {
    const nats = yield* NatsInnerService
    const decoder = yield* MessageDecoder

    // ─────────────────────────────────────────────────────────────────────────
    // Handler Registration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Register an RPC handler on a subject.
     *
     * @param subject - NATS subject to handle
     * @param handler - Effect function that processes (method, params) -> result
     * @returns Handler object with subject and processing stream
     */
    const registerHandler = <A, E, R>(
      subject: string,
      handler: (method: string, params: unknown) => Effect.Effect<A, E, R>
    ) =>
      Effect.gen(function* () {
        const sub = yield* nats.core.subscribe(subject)

        // Create async iterable wrapper for subscription
        const subIterable: AsyncIterable<Msg> = {
          [Symbol.asyncIterator]: () => sub[Symbol.asyncIterator](),
        }

        const processMessages = Stream.fromAsyncIterable(
          subIterable,
          (e) => e as Error
        ).pipe(
          Stream.mapEffect((msg) =>
            Effect.gen(function* () {
              // Decode request
              const decodeResult = yield* decoder
                .decodeBytes(RpcRequest)(msg.data)
                .pipe(Effect.either)

              if (decodeResult._tag === 'Left') {
                // Decode failed - send error response
                if (msg.reply) {
                  const errorPayload = yield* decoder.encodeBytes(RpcResponse)({
                    result: null,
                    error: `Decode error: ${decodeResult.left.message}`,
                  })
                  yield* nats.core.publish(msg.reply, errorPayload)
                }
                return
              }

              const request = decodeResult.right

              // Execute handler
              const handlerResult = yield* handler(
                request.method,
                request.params
              ).pipe(Effect.either)

              // Send response
              if (msg.reply) {
                if (handlerResult._tag === 'Left') {
                  const errorPayload = yield* decoder.encodeBytes(RpcResponse)({
                    result: null,
                    error: String(handlerResult.left),
                  })
                  yield* nats.core.publish(msg.reply, errorPayload)
                } else {
                  const successPayload = yield* decoder.encodeBytes(RpcResponse)({
                    result: handlerResult.right,
                  })
                  yield* nats.core.publish(msg.reply, successPayload)
                }
              }
            })
          )
        )

        return { subject, stream: processMessages } as RpcHandler
      })

    /**
     * Register a typed RPC handler with schema validation.
     *
     * @param subject - NATS subject to handle
     * @param paramsSchema - Schema for validating params
     * @param resultSchema - Schema for encoding result
     * @param handler - Typed handler function
     * @returns Handler object
     */
    const registerTypedHandler = <P, PR, E, R, A, AR>(
      subject: string,
      paramsSchema: Schema.Schema<P, PR>,
      _resultSchema: Schema.Schema<A, AR>,
      handler: (method: string, params: P) => Effect.Effect<A, E, R>
    ) =>
      registerHandler(subject, (method, params) =>
        Effect.gen(function* () {
          // Validate params against schema
          const validatedParams = yield* Schema.decodeUnknown(paramsSchema)(
            params
          ).pipe(
            Effect.mapError(
              (error) =>
                new RpcError({
                  message: `Invalid params: ${error}`,
                  method,
                  subject,
                })
            )
          )

          // Call typed handler
          return yield* handler(method, validatedParams)
        })
      )

    // ─────────────────────────────────────────────────────────────────────────
    // RPC Client
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Make an RPC call.
     *
     * @param subject - Target subject
     * @param method - Method name
     * @param params - Method parameters
     * @param timeout - Timeout in ms (default: 5000)
     * @returns Result from handler
     */
    const call = <A>(
      subject: string,
      method: string,
      params: unknown,
      timeout = 5000
    ) =>
      Effect.gen(function* () {
        const payload = yield* decoder.encodeBytes(RpcRequest)({ method, params })

        const response = yield* nats.core
          .request(subject, payload, { timeout })
          .pipe(
            Effect.mapError((error) => {
              if ('_tag' in error && error._tag === 'Inner/Core/Timeout') {
                return new RpcTimeoutError({
                  subject,
                  method,
                  timeoutMs: timeout,
                })
              }
              return new RpcError({
                message: `RPC call failed: ${String(error)}`,
                method,
                subject,
                cause: error,
              })
            })
          )

        const parsed = yield* decoder.decodeBytes(RpcResponse)(response.data).pipe(
          Effect.mapError(
            (error) =>
              new RpcError({
                message: `Failed to decode RPC response: ${error.message}`,
                method,
                subject,
                cause: error,
              })
          )
        )

        if (parsed.error) {
          return yield* Effect.fail(
            new RpcError({
              message: parsed.error,
              method,
              subject,
            })
          )
        }

        return parsed.result as A
      })

    /**
     * Make a typed RPC call with schema validation.
     *
     * @param subject - Target subject
     * @param method - Method name
     * @param params - Typed parameters
     * @param paramsSchema - Schema for params
     * @param resultSchema - Schema for result
     * @param timeout - Timeout in ms
     * @returns Typed result
     */
    const callTyped = <P, PR, A, AR>(
      subject: string,
      method: string,
      params: P,
      paramsSchema: Schema.Schema<P, PR>,
      resultSchema: Schema.Schema<A, AR>,
      timeout = 5000
    ) =>
      Effect.gen(function* () {
        // Encode params through schema
        const encodedParams = yield* Schema.encode(paramsSchema)(params).pipe(
          Effect.mapError(
            (error) =>
              new RpcError({
                message: `Failed to encode params: ${error}`,
                method,
                subject,
              })
          )
        )

        // Make call
        const result = yield* call<unknown>(subject, method, encodedParams, timeout)

        // Decode result through schema
        return yield* Schema.decodeUnknown(resultSchema)(result).pipe(
          Effect.mapError(
            (error) =>
              new RpcError({
                message: `Failed to decode result: ${error}`,
                method,
                subject,
              })
          )
        )
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Service API
    // ─────────────────────────────────────────────────────────────────────────

    return {
      // Handler registration
      registerHandler,
      registerTypedHandler,

      // RPC client
      call,
      callTyped,
    } as const
  }),
  dependencies: [NatsInnerService.Default, MessageDecoder.Default],
}) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const RpcServiceLive = RpcService.Default
