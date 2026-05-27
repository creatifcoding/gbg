/** BCS decode/encode bridge for SuiQuery. */

import { pureBcsSchemaFromTypeName } from '@mysten/sui/bcs';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { SuiBcsBridge, type SuiBcsBridgeShape, type SuiBcsDecodeRequest } from '../services';
import { normalizePureEncodeError, parseWithCodec, serializeWithCodec } from './bcs-codec';
import { decodeWithOptionalSchema } from './schema';
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
      catch: (cause) => normalizePureEncodeError(String(request.typeTag), request.value, cause),
    });
  }),

  serialize: (value, codec) => serializeWithCodec(value, codec as BcsCodecLike, 'BCS serialize'),
});

export const SuiBcsBridgeLive = Layer.succeed(SuiBcsBridge)(makeBcsBridge());
