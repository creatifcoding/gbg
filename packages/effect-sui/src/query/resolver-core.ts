/** Core Sui object resolution program. */

import * as Effect from 'effect-v4/Effect';

import { SuiObjectLoadError, SuiSchemaDecodeError, SuiTransportError } from '../schema';
import type { SuiObjectResolveRequest, SuiObjectResolveResult } from '../services';
import { decodeResolvedObject } from './resolver-decode';
import { normalizeObjectResolveError } from './resolver-errors';
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

  if (!response.object) {
    return yield* Effect.fail(new SuiObjectLoadError({
      code: 'notExists',
      message: `Object ${request.id} was not found`,
      objectId: request.id,
    }));
  }

  return yield* decodeResolvedObject(request, response.object);
});
