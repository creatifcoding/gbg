/** Object resolver service contracts. */

import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';

import type { SuiObject, SuiObjectSnapshot } from '../effectable';
import type { SharedObjectRef, SuiObjectId, SuiObjectRef, SuiTypeTagString } from '../schema';

export interface SuiObjectResolveRequest<A = unknown> {
  readonly id: SuiObjectId;
  readonly object?: SuiObject<A, unknown, unknown>;
  readonly expectedType?: SuiTypeTagString;
  readonly requireFresh?: boolean;
  readonly decodeContent?: boolean;
}

export interface SuiObjectResolveResult<A = unknown> {
  readonly id: SuiObjectId;
  readonly ref?: SuiObjectRef;
  readonly sharedRef?: SharedObjectRef;
  readonly receivingRef?: SuiObjectRef;
  readonly snapshot?: SuiObjectSnapshot<A>;
}

export interface SuiObjectResolverShape {
  readonly resolve: <A>(
    request: SuiObjectResolveRequest<A>,
  ) => Effect.Effect<SuiObjectResolveResult<A>, unknown, never>;
  readonly refresh: <A>(
    object: SuiObject<A, unknown, unknown>,
  ) => Effect.Effect<SuiObjectSnapshot<A>, unknown, never>;
}

export class SuiObjectResolver extends Context.Service<
  SuiObjectResolver,
  SuiObjectResolverShape
>()('@tmnl/effect-sui/SuiObjectResolver') {}
