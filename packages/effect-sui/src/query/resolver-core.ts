/** Core Sui object resolution program. */

import * as Effect from 'effect-v4/Effect';

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
import type { SuiObjectResolveRequest, SuiObjectResolveResult } from '../services';
import { normalizeObjectResolveError } from './resolver-errors';
import { decodeField, decodeWithOptionalSchema } from './schema';
import type { ClientWithCoreReads } from './types';

export const resolveObject = <A>(
  client: ClientWithCoreReads,
  request: SuiObjectResolveRequest<A>,
): Effect.Effect<SuiObjectResolveResult<A>, SuiObjectLoadError | SuiTransportError | SuiSchemaDecodeError> => Effect.gen(function* () {
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
  const type = object.type ? yield* decodeField('SuiTypeTagString', object.type, decodeSuiTypeTagString) : undefined;

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
  const owner = object.owner as { readonly $kind?: string; readonly Shared?: { readonly initialSharedVersion?: unknown; readonly mutable?: boolean } } | undefined;
  const sharedInitialVersion = owner?.$kind === 'Shared' ? owner.Shared?.initialSharedVersion : undefined;
  const sharedRef = sharedInitialVersion
    ? new SharedObjectRef({
        objectId,
        initialSharedVersion: yield* decodeWithOptionalSchema<SuiObjectVersionType>(
          sharedInitialVersion,
          SuiObjectVersion,
          'SuiObjectVersion',
          sharedInitialVersion,
        ),
        mutable: owner?.Shared?.mutable ?? false,
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
