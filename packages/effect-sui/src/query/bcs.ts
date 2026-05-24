/** BCS decode/encode bridge for SuiQuery. */

import { pureBcsSchemaFromTypeName } from '@mysten/sui/bcs';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { SuiSchemaDecodeError } from '../schema';
import {
  SuiBcsBridge,
  type SuiBcsBridgeShape,
  type SuiBcsDecodeRequest,
} from '../services';
import { decodeWithOptionalSchema, normalizeSchemaError } from './schema';
import type { BcsCodecLike } from './types';

export const makeBcsBridge = (): SuiBcsBridgeShape => ({
  decode: <A>(request: SuiBcsDecodeRequest<A>) => Effect.gen(function* () {
    const codec = request.codec as BcsCodecLike<unknown>;
    const parsed = yield* parseWithCodec(request.bytes, codec, request.label ?? 'BCS decode');
    return yield* decodeWithOptionalSchema<A>(parsed, request.schema, request.label ?? 'BCS decode', request.bytes);
  }),

  encodePure: (request) => Effect.gen(function* () {
    if (request.schema) {
      yield* decodeWithOptionalSchema(request.value, request.schema, String(request.typeTag), request.value);
    }
    if (request.codec) return yield* serializeWithCodec(request.value, request.codec as BcsCodecLike, String(request.typeTag));

    return yield* Effect.tryPromise({
      try: () => Promise.resolve(
        pureBcsSchemaFromTypeName(request.typeTag as never)
          .serialize(request.value as never)
          .toBytes(),
      ),
      catch: (cause) => normalizeSchemaError(String(request.typeTag), request.value, cause),
    });
  }),

  serialize: (value, codec) => serializeWithCodec(value, codec as BcsCodecLike, 'BCS serialize'),
});

export const SuiBcsBridgeLive = Layer.succeed(SuiBcsBridge)(makeBcsBridge());

function parseWithCodec<A>(
  bytes: Uint8Array,
  codec: BcsCodecLike<A>,
  label: string,
): Effect.Effect<A, SuiSchemaDecodeError> {
  const hasParser = Boolean(codec.parse ?? codec.fromBytes);
  if (!hasParser) {
    return Effect.fail(new SuiSchemaDecodeError({
      schema: label,
      message: `BCS codec for ${label} does not expose parse/fromBytes`,
      input: bytes,
    }));
  }

  return Effect.tryPromise({
    try: () => Promise.resolve(codec.parse?.(bytes) ?? codec.fromBytes!(bytes)),
    catch: (cause) => normalizeSchemaError(label, bytes, cause),
  });
}

function serializeWithCodec<A>(
  value: A,
  codec: BcsCodecLike<A>,
  label: string,
): Effect.Effect<Uint8Array, SuiSchemaDecodeError> {
  if (!codec.serialize) {
    return Effect.fail(new SuiSchemaDecodeError({
      schema: label,
      message: 'BCS codec does not expose serialize',
      input: value,
    }));
  }

  return Effect.tryPromise({
    try: async () => {
      const serialized = codec.serialize!(value);
      return serialized instanceof Uint8Array ? serialized : serialized.toBytes();
    },
    catch: (cause) => normalizeSchemaError(label, value, cause),
  });
}
