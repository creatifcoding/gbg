import * as Effect from 'effect-v4/Effect';

import { SuiSchemaDecodeError } from '../schema';
import { normalizeSchemaError } from './schema';
import type { BcsCodecLike } from './types';

export function parseWithCodec<A>(
  bytes: Uint8Array,
  codec: BcsCodecLike<A>,
  label: string,
): Effect.Effect<A, SuiSchemaDecodeError> {
  const hasParser = Boolean(codec.parse ?? codec.fromBytes);
  if (!hasParser) return Effect.fail(new SuiSchemaDecodeError({
    schema: label,
    message: `BCS codec for ${label} does not expose parse/fromBytes`,
    input: bytes,
  }));

  return Effect.tryPromise({
    try: () => Promise.resolve(codec.parse?.(bytes) ?? codec.fromBytes!(bytes)),
    catch: (cause) => normalizeSchemaError(label, bytes, cause),
  });
}

export function serializeWithCodec<A>(
  value: A,
  codec: BcsCodecLike<A>,
  label: string,
): Effect.Effect<Uint8Array, SuiSchemaDecodeError> {
  if (!codec.serialize) return Effect.fail(new SuiSchemaDecodeError({
    schema: label,
    message: 'BCS codec does not expose serialize',
    input: value,
  }));

  return Effect.tryPromise({
    try: async () => {
      const serialized = codec.serialize!(value);
      return serialized instanceof Uint8Array ? serialized : serialized.toBytes();
    },
    catch: (cause) => normalizeSchemaError(label, value, cause),
  });
}
