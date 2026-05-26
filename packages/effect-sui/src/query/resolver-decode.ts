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
} from '../schema';
import type { SuiObjectResolveRequest, SuiObjectResolveResult } from '../services';
import { decodeField, decodeWithOptionalSchema } from './schema';
import type { SuiCoreObject } from './types';

type SharedOwnerLike = {
  readonly $kind?: string;
  readonly Shared?: { readonly initialSharedVersion?: unknown; readonly mutable?: boolean };
};

export const decodeResolvedObject = <A>(
  request: SuiObjectResolveRequest<A>,
  object: SuiCoreObject,
): Effect.Effect<SuiObjectResolveResult<A>, SuiObjectLoadError | SuiSchemaDecodeError> => Effect.gen(function* () {
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
  const owner = object.owner as SharedOwnerLike | undefined;
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
      ? { id: objectId, ref, type, content: (object.json ?? object.content ?? object) as A }
      : undefined,
  };
});
