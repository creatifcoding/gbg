/**
 * MessageDecoder Service
 *
 * Effect-native encoding/decoding for NATS messages using Schema.parseJson.
 * Eliminates try/catch by using Effect throughout.
 *
 * This is an enhanced version of holonet's NatsCodec, designed specifically
 * for the NEX service layer.
 *
 * @module nex/decoder
 */

import { Effect, Schema, ParseResult } from 'effect'
import { DecodeError } from './errors'

// =============================================================================
// Service Implementation
// =============================================================================

export class MessageDecoder extends Effect.Service<MessageDecoder>()(
  'nex/MessageDecoder',
  {
    effect: Effect.succeed({
      /**
       * Decode a JSON string using a schema.
       * Uses Schema.parseJson internally - no try/catch needed.
       */
      decodeJson:
        <A, I, R>(schema: Schema.Schema<A, I, R>) =>
        (raw: string): Effect.Effect<A, DecodeError, R> => {
          const parser = Schema.decodeUnknown(Schema.parseJson(schema))
          return parser(raw).pipe(
            Effect.mapError(
              (cause) =>
                new DecodeError({
                  message: `Failed to decode JSON: ${ParseResult.TreeFormatter.formatErrorSync(cause)}`,
                  cause,
                })
            )
          )
        },

      /**
       * Decode a Uint8Array (NATS message) using a schema.
       * Converts bytes to string, then decodes.
       */
      decodeBytes:
        <A, I, R>(schema: Schema.Schema<A, I, R>) =>
        (raw: Uint8Array): Effect.Effect<A, DecodeError, R> => {
          const parser = Schema.decodeUnknown(Schema.parseJson(schema))
          return parser(new TextDecoder().decode(raw)).pipe(
            Effect.mapError(
              (cause) =>
                new DecodeError({
                  message: `Failed to decode bytes: ${ParseResult.TreeFormatter.formatErrorSync(cause)}`,
                  cause,
                })
            )
          )
        },

      /**
       * Encode a value to JSON string using a schema.
       */
      encodeJson:
        <A, I, R>(schema: Schema.Schema<A, I, R>) =>
        (value: A): Effect.Effect<string, DecodeError, R> => {
          const encoder = Schema.encode(Schema.parseJson(schema))
          return encoder(value).pipe(
            Effect.mapError(
              (cause) =>
                new DecodeError({
                  message: `Failed to encode to JSON: ${ParseResult.TreeFormatter.formatErrorSync(cause)}`,
                  cause,
                })
            )
          )
        },

      /**
       * Encode a value to Uint8Array (for NATS publish).
       */
      encodeBytes:
        <A, I, R>(schema: Schema.Schema<A, I, R>) =>
        (value: A): Effect.Effect<Uint8Array, DecodeError, R> => {
          const encoder = Schema.encode(Schema.parseJson(schema))
          return encoder(value).pipe(
            Effect.map((json) => new TextEncoder().encode(json)),
            Effect.mapError(
              (cause) =>
                new DecodeError({
                  message: `Failed to encode to bytes: ${ParseResult.TreeFormatter.formatErrorSync(cause)}`,
                  cause,
                })
            )
          )
        },
    } as const),
  }
) {}

// =============================================================================
// Convenience Exports
// =============================================================================

export const MessageDecoderLive = MessageDecoder.Default
