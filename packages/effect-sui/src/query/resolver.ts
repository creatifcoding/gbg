/** Sui object resolver service implementation. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import type { SuiObject } from '../effectable';
import {
  decodeSuiObjectDigest,
  decodeSuiObjectId,
  decodeSuiObjectRef,
  decodeSuiTypeTagString,
  SharedObjectRef,
  SuiObjectLoadError,
  SuiObjectVersion,
  type SuiObjectVersion as SuiObjectVersionType,
  SuiSchemaDecodeError,
  SuiTransportError,
} from '../schema';
import {
  SuiClientService,
  SuiObjectResolver,
  type SuiObjectResolveRequest,
  type SuiObjectResolveResult,
  type SuiObjectResolverShape,
} from '../services';
import { decodeField, decodeWithOptionalSchema, normalizeSchemaError } from './schema';
import type { ClientWithCoreReads } from './types';

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
