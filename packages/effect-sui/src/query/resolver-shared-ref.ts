import * as Effect from 'effect/Effect';

import { SharedObjectRef, type SuiObjectId, SuiObjectVersion, type SuiObjectVersion as SuiObjectVersionType, SuiSchemaDecodeError } from '../schema';
import { decodeWithOptionalSchema } from './schema';

type SharedOwnerLike = {
  readonly $kind?: string;
  readonly Shared?: { readonly initialSharedVersion?: unknown; readonly mutable?: boolean };
};

export const decodeSharedObjectRef = (
  objectId: SuiObjectId,
  owner: unknown,
): Effect.Effect<SharedObjectRef | undefined, SuiSchemaDecodeError> => Effect.gen(function* () {
  const sharedOwner = owner as SharedOwnerLike | undefined;
  const sharedInitialVersion = sharedOwner?.$kind === 'Shared' ? sharedOwner.Shared?.initialSharedVersion : undefined;
  return sharedInitialVersion
    ? new SharedObjectRef({
        objectId,
        initialSharedVersion: yield* decodeWithOptionalSchema<SuiObjectVersionType>(sharedInitialVersion, SuiObjectVersion, 'SuiObjectVersion', sharedInitialVersion),
        mutable: sharedOwner?.Shared?.mutable ?? false,
      })
    : undefined;
});
