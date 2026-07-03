import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as TxHashMap from 'effect/TxHashMap';

import { SuiReservationConflict } from '../schema';
import type { SuiReservationRequest } from '../services';
import { resourceKeysFor } from './resources';
import type { SuiReservationResource, SuiTxState } from './types';

export const checkedResourcesFor = (
  state: SuiTxState,
  request: SuiReservationRequest,
): Effect.Effect<ReadonlyArray<SuiReservationResource>, SuiReservationConflict> => Effect.gen(function* () {
  const resources = resourceKeysFor(request);
  const duplicate = firstDuplicate(resources.map((resource) => resource.key));
  if (duplicate) return yield* Effect.fail(new SuiReservationConflict({
    kind: 'duplicate',
    resourceKey: duplicate,
    intent: request.intent,
    message: `Reservation request ${request.intent} contains duplicate resource ${duplicate}`,
  }));

  for (const resource of resources) {
    const existing = yield* TxHashMap.get(state.locks, resource.key);
    if (Option.isSome(existing)) return yield* Effect.fail(new SuiReservationConflict({
      kind: resource.kind,
      resourceKey: resource.key,
      intent: request.intent,
      heldBy: existing.value.tokenId,
      requestedBy: request.intent,
      message: `Resource ${resource.key} is already reserved by ${existing.value.intent}`,
    }));
  }
  return resources;
});

const firstDuplicate = (values: ReadonlyArray<string>): string | undefined => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
};
