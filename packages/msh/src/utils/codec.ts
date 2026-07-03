/**
 * Shared JSON codec utilities for MSH services.
 *
 * Eliminates duplication of JSON decoding logic across services.
 * All decode functions return properly typed Effects with explicit error types.
 *
 * @module @tmnl/msh/utils/codec
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { MshDecodeError } from '../schemas/errors';

/**
 * Context for error messages - includes subject and sequence number if available.
 */
export interface DecodeContext {
  readonly subject?: string;
  readonly seq?: number;
}

/**
 * Decodes a Uint8Array payload as JSON, then validates against a schema.
 */
export const decodeJson =
  <S extends Schema.Top>(schema: S, context?: DecodeContext) =>
  (data: Uint8Array): Effect.Effect<S['Type'], MshDecodeError, S['DecodingServices']> =>
    Effect.gen(function* () {
      const contextStr = context?.subject
        ? ` on '${context.subject}'${
            context.seq !== undefined ? ` (seq: ${context.seq})` : ''
          }`
        : '';

      const text = new TextDecoder().decode(data);

      const json = yield* Effect.try({
        try: () => JSON.parse(text) as unknown,
        catch: (error) =>
          new MshDecodeError({
            message: `Failed to parse JSON${contextStr}: ${error}`,
            subject: context?.subject,
            cause: error,
          }),
      });

      return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
        Effect.mapError(
          (error) =>
            new MshDecodeError({
              message: `Schema validation failed${contextStr}`,
              subject: context?.subject,
              cause: error,
            }),
        ),
      );
    });

export const decodeJsonUnknown = (
  data: Uint8Array,
  context?: DecodeContext,
): Effect.Effect<unknown, MshDecodeError> =>
  Effect.gen(function* () {
    const contextStr = context?.subject
      ? ` on '${context.subject}'${
          context.seq !== undefined ? ` (seq: ${context.seq})` : ''
        }`
      : '';
    const text = new TextDecoder().decode(data);

    return yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (error) =>
        new MshDecodeError({
          message: `Failed to parse JSON${contextStr}: ${error}`,
          subject: context?.subject,
          cause: error,
        }),
    });
  });

/**
 * Encodes a value as JSON Uint8Array for publishing (untyped).
 */
export const encodeJson = (value: unknown): Uint8Array => {
  const text = JSON.stringify(value);
  return new TextEncoder().encode(text);
};

/**
 * Unified codec object for NATS message encoding/decoding.
 */
export const NatsCodec = {
  /**
   * Encodes a value using a schema, then converts to JSON Uint8Array.
   */
  encodeJson: <S extends Schema.Top>(
    schema: S,
    data: S['Type'],
  ): Effect.Effect<Uint8Array, Schema.SchemaError, S['EncodingServices']> =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encodeUnknownEffect(schema)(data);
      return new TextEncoder().encode(JSON.stringify(encoded));
    }),

  /**
   * Decodes a Uint8Array as JSON, then validates against a schema.
   */
  decodeJson,
};
