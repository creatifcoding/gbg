/** Query-local Schema decode helpers. */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { SuiSchemaDecodeError } from '../schema';

export function decodeWithOptionalSchema<A>(
  value: unknown,
  schema: unknown,
  label: string,
  input: unknown,
): Effect.Effect<A, SuiSchemaDecodeError> {
  if (!schema) return Effect.succeed(value as A);
  return Effect.try({
    try: () => {
      const decode = Schema.decodeUnknownSync(schema as never) as (candidate: unknown) => A;
      return decode(value);
    },
    catch: (cause) => normalizeSchemaError(label, input, cause),
  });
}

export function decodeField<A>(
  label: string,
  input: unknown,
  decode: (value: unknown) => A,
): Effect.Effect<A, SuiSchemaDecodeError> {
  return Effect.try({
    try: () => decode(input),
    catch: (cause) => normalizeSchemaError(label, input, cause),
  });
}

export function normalizeSchemaError(label: string, input: unknown, cause: unknown): SuiSchemaDecodeError {
  if (cause instanceof SuiSchemaDecodeError) return cause;
  return new SuiSchemaDecodeError({
    schema: label,
    message: cause instanceof Error ? cause.message : String(cause),
    input,
    cause,
  });
}
