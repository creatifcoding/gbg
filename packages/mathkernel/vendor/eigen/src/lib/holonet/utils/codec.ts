/**
 * Shared JSON codec utilities for Holonet services.
 *
 * Eliminates duplication of JSON decoding logic across 4 services.
 * All decode functions return properly typed Effects with explicit error types.
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { ParseResult } from 'effect';
import { HolonetDecodeError } from '../schemas/errors';

/**
 * Context for error messages - includes subject and sequence number if available.
 */
export interface DecodeContext {
  readonly subject?: string;
  readonly seq?: number;
}

/**
 * Decodes a Uint8Array payload as JSON, then validates against a schema.
 *
 * @param schema - Effect Schema to validate against
 * @param context - Optional context for error messages (subject, seq)
 * @returns A function that takes data and returns Effect with decoded value or HolonetDecodeError
 *
 * @example
 * ```ts
 * // With context (recommended)
 * const decoded = yield* decodeJson(MySchema, { subject: msg.subject, seq: msg.seq })(msg.data);
 *
 * // Without context (legacy usage)
 * const decoded = yield* decodeJson(MySchema)(msg.data);
 * ```
 */
export const decodeJson =
  <A, I, R>(schema: Schema.Schema<A, I, R>, context?: DecodeContext) =>
  (data: Uint8Array): Effect.Effect<A, HolonetDecodeError, R> =>
    Effect.gen(function* () {
      const contextStr = context?.subject
        ? ` on '${context.subject}'${
            context.seq !== undefined ? ` (seq: ${context.seq})` : ''
          }`
        : '';

      // Step 1: Decode UTF-8 bytes to string
      const text = new TextDecoder().decode(data);

      // Step 2: Parse JSON
      const json = yield* Effect.try({
        try: () => JSON.parse(text) as I,
        catch: (error) =>
          new HolonetDecodeError({
            message: `Failed to parse JSON${contextStr}: ${error}`,
            subject: context?.subject,
            cause: error,
          }),
      });

      // Step 3: Validate against schema
      return yield* Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError(
          (error) =>
            new HolonetDecodeError({
              message: `Schema validation failed${contextStr}`,
              subject: context?.subject,
              cause: error,
            })
        )
      );
    });

export const decodeJsonUnknown = (
  data: Uint8Array,
  context?: DecodeContext
): Effect.Effect<unknown, HolonetDecodeError> =>
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
        new HolonetDecodeError({
          message: `Failed to parse JSON${contextStr}: ${error}`,
          subject: context?.subject,
          cause: error,
        }),
    });
  });

/**
 * Encodes a value as JSON Uint8Array for publishing (untyped).
 *
 * @param value - Value to encode
 * @returns Uint8Array of JSON bytes
 */
export const encodeJson = (value: unknown): Uint8Array => {
  const text = JSON.stringify(value);
  return new TextEncoder().encode(text);
};

/**
 * Unified codec object for NATS message encoding/decoding.
 *
 * Provides schema-aware encoding and decoding with consistent error handling.
 */
export const NatsCodec = {
  /**
   * Encodes a value using a schema, then converts to JSON Uint8Array.
   *
   * @param schema - Effect Schema to encode with
   * @param data - Data to encode
   * @returns Effect with Uint8Array or ParseError
   *
   * @example
   * ```typescript
   * const bytes = yield* NatsCodec.encodeJson(MySchema, myData);
   * nc.publish('subject', bytes);
   * ```
   */
  encodeJson: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    data: A
  ): Effect.Effect<Uint8Array, ParseResult.ParseError, R> =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encode(schema)(data);
      return new TextEncoder().encode(JSON.stringify(encoded));
    }),

  /**
   * Decodes a Uint8Array as JSON, then validates against a schema.
   *
   * @param schema - Effect Schema to validate against
   * @param context - Optional context for error messages
   * @returns Function that takes data and returns Effect with decoded value
   *
   * @example
   * ```typescript
   * const decoded = yield* NatsCodec.decodeJson(MySchema, { subject: msg.subject })(msg.data);
   * ```
   */
  decodeJson,
};
