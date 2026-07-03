/** Sui object resolver service implementation. */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import type { SuiObject } from '../effectable';
import {
  SuiClientService,
  SuiObjectResolver,
  type SuiObjectResolveRequest,
  type SuiObjectResolverShape,
} from '../services';
import { resolveObject } from './resolver-core';
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
      return resolved.snapshot!;
    }),
  };
};

export const SuiObjectResolverFromClient = Layer.effect(SuiObjectResolver)(
  SuiClientService.useSync((service) => makeObjectResolver(service.client as ClientWithCoreReads)),
);
