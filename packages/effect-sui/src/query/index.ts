/** Transport-safe Sui read/query programs and BCS decode helpers. */

import { pureBcsSchemaFromTypeName } from '@mysten/sui/bcs';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Schema from 'effect-v4/Schema';

import type { SuiObject, SuiObjectSnapshot } from '../effectable';
import {
  decodeSuiObjectDigest,
  decodeSuiObjectId,
  decodeSuiObjectRef,
  decodeSuiTypeTagString,
  SuiObjectVersion,
  SharedObjectRef,
  SuiObjectLoadError,
  SuiSchemaDecodeError,
  SuiTransportError,
} from '../schema';
import {
  SuiBcsBridge,
  type SuiBcsBridgeShape,
  SuiClientService,
  SuiObjectResolver,
  type SuiObjectResolveRequest,
  type SuiObjectResolveResult,
  type SuiObjectResolverShape,
} from '../services';

export interface BcsCodecLike<A = unknown> {
  readonly parse?: (bytes: Uint8Array) => A;
  readonly fromBytes?: (bytes: Uint8Array) => A;
  readonly serialize?: (value: A) => { readonly toBytes: () => Uint8Array } | Uint8Array;
}

export interface ClientWithCoreReads {
  readonly core: {
    readonly getObject: (options: {
      readonly objectId: string;
      readonly include?: {
        readonly content?: boolean;
        readonly json?: boolean;
        readonly previousTransaction?: boolean;
        readonly objectBcs?: boolean;
      };
    }) => Promise<{ readonly object: SuiCoreObject }>;
  };
}

export interface SuiCoreObject {
  readonly objectId: string;
  readonly version: string | number;
  readonly digest: string;
  readonly owner?: SuiCoreObjectOwner;
  readonly type?: string;
  readonly content?: Uint8Array;
  readonly json?: Record<string, unknown> | null;
  readonly objectBcs?: Uint8Array;
}

export type SuiCoreObjectOwner =
  | { readonly $kind: 'Shared'; readonly Shared: { readonly initialSharedVersion: string | number } }
  | { readonly $kind: 'AddressOwner'; readonly AddressOwner: string }
  | { readonly $kind: 'ObjectOwner'; readonly ObjectOwner: string }
  | { readonly $kind: 'Immutable'; readonly Immutable: true }
  | { readonly $kind: 'ConsensusAddressOwner'; readonly ConsensusAddressOwner: unknown }
  | { readonly $kind: 'Unknown' };

export const makeSuiBcsBridge = (): SuiBcsBridgeShape => ({
  decode: (request) => Effect.try({
    try: () => {
      const codec = request.codec as BcsCodecLike;
      const parsed = codec.parse?.(request.bytes) ?? codec.fromBytes?.(request.bytes);
      if (parsed === undefined) {
        throw new Error(`BCS codec for ${request.label ?? 'value'} does not expose parse/fromBytes`);
      }
      return decodeWithOptionalSchema(parsed, request.schema) as never;
    },
    catch: (cause) => new SuiSchemaDecodeError({
      schema: request.label ?? 'BCS decode',
      message: cause instanceof Error ? cause.message : String(cause),
      input: request.bytes,
      cause,
    }),
  }),

  encodePure: (request) => Effect.try({
    try: () => {
      if (request.schema) decodeWithOptionalSchema(request.value, request.schema);
      if (request.codec) return serializeWithCodec(request.value, request.codec as BcsCodecLike);
      return pureBcsSchemaFromTypeName(request.typeTag as never)
        .serialize(request.value as never)
        .toBytes();
    },
    catch: (cause) => new SuiSchemaDecodeError({
      schema: String(request.typeTag),
      message: cause instanceof Error ? cause.message : String(cause),
      input: request.value,
      cause,
    }),
  }),

  serialize: (value, codec) => Effect.try({
    try: () => serializeWithCodec(value, codec as BcsCodecLike),
    catch: (cause) => new SuiSchemaDecodeError({
      schema: 'BCS serialize',
      message: cause instanceof Error ? cause.message : String(cause),
      input: value,
      cause,
    }),
  }),
});

export const SuiBcsBridgeLive = Layer.succeed(SuiBcsBridge)(makeSuiBcsBridge());

export const makeSuiObjectResolver = (client: ClientWithCoreReads): SuiObjectResolverShape => {
  const resolve = <A>(request: SuiObjectResolveRequest<A>) =>
    Effect.tryPromise({
      try: async () => resolveObject(client, request),
      catch: (cause) => normalizeObjectResolveError(request, cause),
    });

  return {
    resolve,
    refresh: <A>(object: SuiObject<A, unknown, unknown>) =>
      Effect.map(
        resolve<A>({
          id: object.id,
          object,
          expectedType: object.type,
          requireFresh: true,
          decodeContent: true,
        }),
        (resolved) => {
          if (!resolved.snapshot) {
            throw new SuiObjectLoadError({
              code: 'unknown',
              message: `Object ${object.id} did not return a snapshot`,
              objectId: object.id,
            });
          }
          return resolved.snapshot;
        },
      ),
  };
};

export const SuiObjectResolverFromClient = Layer.effect(SuiObjectResolver)(
  SuiClientService.useSync((service) => makeSuiObjectResolver(service.client as ClientWithCoreReads)),
);
export const SuiQueryLive = Layer.merge(SuiBcsBridgeLive, SuiObjectResolverFromClient);

function serializeWithCodec<A>(value: A, codec: BcsCodecLike<A>): Uint8Array {
  const serialized = codec.serialize?.(value);
  if (!serialized) throw new Error('BCS codec does not expose serialize');
  return serialized instanceof Uint8Array ? serialized : serialized.toBytes();
}

function decodeWithOptionalSchema<A>(value: unknown, schema: unknown): A {
  if (!schema) return value as A;
  const decode = Schema.decodeUnknownSync(schema as never) as (input: unknown) => A;
  return decode(value);
}

async function resolveObject<A>(
  client: ClientWithCoreReads,
  request: SuiObjectResolveRequest<A>,
): Promise<SuiObjectResolveResult<A>> {
  if (!client?.core?.getObject) {
    throw new SuiTransportError({
      transport: 'unknown',
      message: 'Sui client does not expose core.getObject',
    });
  }

  const response = await client.core.getObject({
    objectId: request.id,
    include: {
      content: request.decodeContent,
      json: request.decodeContent,
      previousTransaction: request.requireFresh,
      objectBcs: false,
    },
  });
  const object = response.object;

  if (!object) {
    throw new SuiObjectLoadError({
      code: 'notExists',
      message: `Object ${request.id} was not found`,
      objectId: request.id,
    });
  }

  const objectId = decodeSuiObjectId(object.objectId);
  const type = object.type ? decodeSuiTypeTagString(object.type) : undefined;
  if (request.expectedType && type && type !== request.expectedType) {
    throw new SuiObjectLoadError({
      code: 'unknown',
      message: `Object ${request.id} type mismatch: expected ${request.expectedType}, got ${type}`,
      objectId: request.id,
    });
  }

  const ref = decodeSuiObjectRef({
    objectId,
    version: Schema.decodeUnknownSync(SuiObjectVersion)(object.version),
    digest: decodeSuiObjectDigest(object.digest),
  });
  const sharedRef = object.owner?.$kind === 'Shared'
    ? new SharedObjectRef({
        objectId,
        initialSharedVersion: Schema.decodeUnknownSync(SuiObjectVersion)(object.owner.Shared.initialSharedVersion),
        mutable: true,
      })
    : undefined;

  return {
    id: objectId,
    ref,
    sharedRef,
    snapshot: request.decodeContent
      ? {
          id: objectId,
          ref,
          type,
          content: (object.json ?? object.content ?? object) as A,
        }
      : undefined,
  };
}

function normalizeObjectResolveError(
  request: SuiObjectResolveRequest,
  cause: unknown,
): SuiObjectLoadError | SuiTransportError | SuiSchemaDecodeError {
  if (
    cause instanceof SuiObjectLoadError ||
    cause instanceof SuiTransportError ||
    cause instanceof SuiSchemaDecodeError
  ) {
    return cause;
  }

  return new SuiObjectLoadError({
    code: 'unknown',
    message: cause instanceof Error ? cause.message : String(cause),
    objectId: request.id,
    cause,
  });
}
