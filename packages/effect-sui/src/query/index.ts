/** Transport-safe Sui read/query programs and BCS decode helpers. */

import { pureBcsSchemaFromTypeName } from '@mysten/sui/bcs';
import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';
import * as Schema from 'effect-v4/Schema';

import type { SuiObject, SuiObjectSnapshot } from '../effectable';
import {
  decodeSuiObjectDigest,
  decodeSuiObjectId,
  decodeSuiObjectRef,
  decodeSuiTypeTagString,
  SuiObjectVersion,
  type SuiObjectVersion as SuiObjectVersionType,
  SharedObjectRef,
  SuiObjectLoadError,
  SuiSchemaDecodeError,
  SuiTransportError,
} from '../schema';
import {
  SuiBcsBridge,
  type SuiBcsBridgeShape,
  type SuiBcsDecodeRequest,
  SuiClientService,
  SuiObjectResolver,
  type SuiObjectResolveRequest,
  type SuiObjectResolveResult,
  type SuiObjectResolverShape,
  type SuiPureEncodeRequest,
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

export const makeObjectResolver = (client: ClientWithCoreReads): SuiObjectResolverShape => {
  const resolve = <A>(request: SuiObjectResolveRequest<A>) => resolveObject(client, request);

  return {
    resolve,
    refresh: <A>(object: SuiObject<A, unknown, unknown>) => Effect.gen(function* () {
      const resolved = yield* resolve<A>({
        id: object.id,
        object,
        expectedType: object.type,
        requireFresh: true,
        decodeContent: true,
      });

      if (resolved.snapshot) return resolved.snapshot;

      return yield* Effect.fail(new SuiObjectLoadError({
        code: 'unknown',
        message: `Object ${object.id} did not return a snapshot`,
        objectId: object.id,
      }));
    }),
  };
};

export const SuiObjectResolverFromClient = Layer.effect(SuiObjectResolver)(
  SuiClientService.useSync((service) => makeObjectResolver(service.client as ClientWithCoreReads)),
);
export const SuiQueryLive = Layer.merge(SuiBcsBridgeLive, SuiObjectResolverFromClient);

export type SuiQueryServices = SuiClientService | SuiBcsBridge | SuiObjectResolver;
export type SuiQueryRuntime = ManagedRuntime.ManagedRuntime<SuiQueryServices, never>;

export interface SuiQueryRuntimeOptions {
  readonly memoMap?: Layer.MemoMap;
}

export interface SuiQueryClient {
  readonly runtime: SuiQueryRuntime;
  readonly run: <A, E>(
    effect: Effect.Effect<A, E, SuiQueryServices>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<A>;
  readonly runExit: <A, E>(
    effect: Effect.Effect<A, E, SuiQueryServices>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<A, E>>;
  readonly resolve: <A>(
    request: SuiObjectResolveRequest<A>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiObjectResolveResult<A>>;
  readonly resolveExit: <A>(
    request: SuiObjectResolveRequest<A>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<SuiObjectResolveResult<A>, unknown>>;
  readonly refresh: <A>(
    object: SuiObject<A, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiObjectSnapshot<A>>;
  readonly decode: <A>(request: SuiBcsDecodeRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<A>;
  readonly encodePure: <A>(request: SuiPureEncodeRequest<A>, options?: { readonly signal?: AbortSignal }) => Promise<Uint8Array>;
  readonly serialize: <A>(value: A, codec: unknown, options?: { readonly signal?: AbortSignal }) => Promise<Uint8Array>;
  readonly dispose: () => Promise<void>;
}

export const makeLayer = (client: ClientWithCoreReads): Layer.Layer<SuiQueryServices, never, never> => SuiQueryLive.pipe(
  Layer.provideMerge(SuiClientService.layer(client)),
);

export const makeRuntime = (
  client: ClientWithCoreReads,
  options: SuiQueryRuntimeOptions = {},
): SuiQueryRuntime => ManagedRuntime.make(makeLayer(client), { memoMap: options.memoMap });

export const makeClient = (
  clientOrRuntime: ClientWithCoreReads | SuiQueryRuntime,
  options: SuiQueryRuntimeOptions = {},
): SuiQueryClient => {
  const runtime = ManagedRuntime.isManagedRuntime(clientOrRuntime)
    ? clientOrRuntime as SuiQueryRuntime
    : makeRuntime(clientOrRuntime as ClientWithCoreReads, options);
  return {
    runtime,
    run: (effect, runOptions) => runtime.runPromise(effect, runOptions),
    runExit: (effect, runOptions) => runtime.runPromiseExit(effect, runOptions),
    resolve: (request, runOptions) => runtime.runPromise(resolve(request), runOptions),
    resolveExit: (request, runOptions) => runtime.runPromiseExit(resolve(request), runOptions),
    refresh: (object, runOptions) => runtime.runPromise(refresh(object), runOptions),
    decode: (request, runOptions) => runtime.runPromise(decode(request), runOptions),
    encodePure: (request, runOptions) => runtime.runPromise(encodePure(request), runOptions),
    serialize: (value, codec, runOptions) => runtime.runPromise(serialize(value, codec), runOptions),
    dispose: () => runtime.dispose(),
  };
};

export const resolve = <A>(
  request: SuiObjectResolveRequest<A>,
): Effect.Effect<SuiObjectResolveResult<A>, unknown, SuiObjectResolver> =>
  SuiObjectResolver.use((resolver) => resolver.resolve(request));

export const refresh = <A>(
  object: SuiObject<A, unknown, unknown>,
): Effect.Effect<SuiObjectSnapshot<A>, unknown, SuiObjectResolver> =>
  SuiObjectResolver.use((resolver) => resolver.refresh(object));

export const decode = <A>(
  request: SuiBcsDecodeRequest<A>,
): Effect.Effect<A, unknown, SuiBcsBridge> => SuiBcsBridge.use((bridge) => bridge.decode(request));

export const encodePure = <A>(
  request: SuiPureEncodeRequest<A>,
): Effect.Effect<Uint8Array, unknown, SuiBcsBridge> => SuiBcsBridge.use((bridge) => bridge.encodePure(request));

export const serialize = <A>(
  value: A,
  codec: unknown,
): Effect.Effect<Uint8Array, unknown, SuiBcsBridge> => SuiBcsBridge.use((bridge) => bridge.serialize(value, codec));

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

function decodeWithOptionalSchema<A>(
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

function resolveObject<A>(
  client: ClientWithCoreReads,
  request: SuiObjectResolveRequest<A>,
): Effect.Effect<SuiObjectResolveResult<A>, SuiObjectLoadError | SuiTransportError | SuiSchemaDecodeError> {
  return Effect.gen(function* () {
    if (!client?.core?.getObject) {
      return yield* Effect.fail(new SuiTransportError({
        transport: 'unknown',
        message: 'Sui client does not expose core.getObject',
      }));
    }

    const response = yield* Effect.tryPromise({
      try: () => client.core.getObject({
        objectId: request.id,
        include: {
          content: request.decodeContent,
          json: request.decodeContent,
          previousTransaction: request.requireFresh,
          objectBcs: false,
        },
      }),
      catch: (cause) => normalizeObjectResolveError(request, cause),
    });
    const object = response.object;

    if (!object) {
      return yield* Effect.fail(new SuiObjectLoadError({
        code: 'notExists',
        message: `Object ${request.id} was not found`,
        objectId: request.id,
      }));
    }

    const objectId = yield* decodeField('SuiObjectId', object.objectId, decodeSuiObjectId);
    const type = object.type
      ? yield* decodeField('SuiTypeTagString', object.type, decodeSuiTypeTagString)
      : undefined;

    if (request.expectedType && type && type !== request.expectedType) {
      return yield* Effect.fail(new SuiObjectLoadError({
        code: 'unknown',
        message: `Object ${request.id} type mismatch: expected ${request.expectedType}, got ${type}`,
        objectId: request.id,
      }));
    }

    const version = yield* decodeWithOptionalSchema<SuiObjectVersionType>(
      object.version,
      SuiObjectVersion,
      'SuiObjectVersion',
      object.version,
    );
    const digest = yield* decodeField('SuiObjectDigest', object.digest, decodeSuiObjectDigest);
    const ref = yield* decodeField('SuiObjectRef', { objectId, version, digest }, decodeSuiObjectRef);
    const sharedRef = object.owner?.$kind === 'Shared'
      ? new SharedObjectRef({
          objectId,
          initialSharedVersion: yield* decodeWithOptionalSchema<SuiObjectVersionType>(
            object.owner.Shared.initialSharedVersion,
            SuiObjectVersion,
            'SharedObjectRef.initialSharedVersion',
            object.owner.Shared.initialSharedVersion,
          ),
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
  });
}

function decodeField<A>(
  label: string,
  input: unknown,
  decode: (value: unknown) => A,
): Effect.Effect<A, SuiSchemaDecodeError> {
  return Effect.try({
    try: () => decode(input),
    catch: (cause) => normalizeSchemaError(label, input, cause),
  });
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

function normalizeSchemaError(label: string, input: unknown, cause: unknown): SuiSchemaDecodeError {
  if (cause instanceof SuiSchemaDecodeError) return cause;
  return new SuiSchemaDecodeError({
    schema: label,
    message: cause instanceof Error ? cause.message : String(cause),
    input,
    cause,
  });
}
