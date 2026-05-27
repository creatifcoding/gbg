import * as Effect from 'effect-v4/Effect';

import { SuiBcsParseError, SuiPureEncodeError } from '../schema';
import type { BcsCodecLike } from './types';

export function parseWithCodec<A>(
  bytes: Uint8Array,
  codec: BcsCodecLike<A>,
  label: string,
): Effect.Effect<A, SuiBcsParseError> {
  const hasParser = Boolean(codec.parse ?? codec.fromBytes);
  if (!hasParser) return Effect.fail(new SuiBcsParseError({
    codec: label,
    message: `BCS codec for ${label} does not expose parse/fromBytes`,
    byteLength: bytes.byteLength,
    input: bytes,
  }));

  return Effect.tryPromise({
    try: () => Promise.resolve(codec.parse?.(bytes) ?? codec.fromBytes!(bytes)),
    catch: (cause) => normalizeBcsParseError(label, bytes, cause),
  });
}

export function serializeWithCodec<A>(
  value: A,
  codec: BcsCodecLike<A>,
  label: string,
): Effect.Effect<Uint8Array, SuiPureEncodeError> {
  if (!codec.serialize) return Effect.fail(new SuiPureEncodeError({
    typeTag: label,
    message: 'BCS codec does not expose serialize',
    value,
  }));

  return Effect.tryPromise({
    try: async () => {
      const serialized = codec.serialize!(value);
      return serialized instanceof Uint8Array ? serialized : serialized.toBytes();
    },
    catch: (cause) => normalizePureEncodeError(label, value, cause),
  });
}

export function normalizeBcsParseError(label: string, bytes: Uint8Array, cause: unknown): SuiBcsParseError {
  if (cause instanceof SuiBcsParseError) return cause;
  return new SuiBcsParseError({
    codec: label,
    message: messageOf(cause),
    byteLength: bytes.byteLength,
    input: bytes,
    cause,
  });
}

export function normalizePureEncodeError(typeTag: string, value: unknown, cause: unknown): SuiPureEncodeError {
  if (cause instanceof SuiPureEncodeError) return cause;
  return new SuiPureEncodeError({
    typeTag,
    message: messageOf(cause),
    value,
    cause,
  });
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause !== null && typeof cause === 'object') {
    const message = (cause as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(cause);
}
